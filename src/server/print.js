const os = require("os");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const logger = require("./utils/logger");
const { printSinglePDF, printOfficeDocument } = require("./utils/printManager");
const { downloadFile, isUrl } = require("./utils/fileDownloader");
const { html2pdf } = require("./utils/html2pdf");
const { getConfigValue } = require("./config");

async function resolveFilePath(filePath, fileType = "") {
  if (isUrl(filePath)) {
    const filename = `temp_${fileType}_${Date.now()}${path.extname(filePath) || ".pdf"}`;
    const localPath = await downloadFile(filePath, filename);
    logger.info(`Downloaded remote file: ${filePath} -> ${localPath}`);
    return localPath;
  }
  return path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
}

async function printPdf(filePath) {
  try {
    const resolvedPath = await resolveFilePath(filePath, "pdf");
    logger.info(`Printing PDF: ${resolvedPath}`);

    const result = await printSinglePDF(resolvedPath, { printer: undefined });
    if (result.success) {
      logger.info("PDF print success");
    } else {
      logger.error("PDF print failed:", result.error);
    }
    return result;
  } catch (error) {
    logger.error("PDF print error:", error);
    return { success: false, error: error.message };
  }
}

async function printHTML(htmlContent) {
  const pdfPath = await html2pdf(htmlContent);
  return printPdf(pdfPath);
}

const OFFICE_EXECUTABLE_NAMES = {
  word: {
    win32: "WINWORD.EXE",
    darwin: "Microsoft Word",
    linux: "soffice",
  },
  excel: {
    win32: "EXCEL.EXE",
    darwin: "Microsoft Excel",
    linux: "soffice",
  },
  ppt: {
    win32: "POWERPNT.EXE",
    darwin: "Microsoft PowerPoint",
    linux: "soffice",
  },
};

function getDefaultOfficeCandidates(appName, platform) {
  const exeName = OFFICE_EXECUTABLE_NAMES[appName]?.[platform];

  if (platform === "win32" && exeName) {
    return [
      path.join("C:/Program Files/Microsoft Office/root/Office16", exeName),
      path.join(
        "C:/Program Files (x86)/Microsoft Office/root/Office16",
        exeName
      ),
    ];
  }

  if (platform === "darwin") {
    const bundleMap = {
      word: "/Applications/Microsoft Word.app",
      excel: "/Applications/Microsoft Excel.app",
      ppt: "/Applications/Microsoft PowerPoint.app",
    };
    const bundlePath = bundleMap[appName];
    if (!bundlePath) {
      return [];
    }
    if (!exeName) {
      return [bundlePath];
    }
    return [bundlePath, path.join(bundlePath, "Contents", "MacOS", exeName)];
  }

  if (platform === "linux") {
    const roots = [
      "/usr/bin",
      "/usr/local/bin",
      "/snap/bin",
      "/usr/lib/libreoffice/program",
      "/usr/local/libreoffice/program",
      "/usr/local/Microsoft Office",
    ];
    if (!exeName) {
      return roots;
    }
    return roots.map((root) => path.join(root, exeName));
  }

  return [];
}

function getOfficePath(appName) {
  const platform = os.platform();
  const exeName = OFFICE_EXECUTABLE_NAMES[appName]?.[platform];
  const candidates = [];
  const seenPaths = new Set();
  const warned = new Set();

  const deriveExecutablePaths = (basePath) => {
    const results = [];
    if (!basePath) {
      return results;
    }
    const trimmed = basePath.trim();
    if (!trimmed) {
      return results;
    }
    results.push(trimmed);

    if (exeName) {
      const lower = trimmed.toLowerCase();
      const exeLower = exeName.toLowerCase();

      if (platform === "darwin" && trimmed.endsWith(".app")) {
        results.push(path.join(trimmed, "Contents", "MacOS", exeName));
      } else if (!lower.endsWith(exeLower)) {
        results.push(path.join(trimmed, exeName));
      }
    }

    return results;
  };

  const pushCandidate = (candidatePath, source, fromConfig = false) => {
    if (!candidatePath) {
      return;
    }
    const normalized = candidatePath.trim();
    if (!normalized) {
      return;
    }
    const key = normalized.toLowerCase();
    if (seenPaths.has(key)) {
      return;
    }
    seenPaths.add(key);
    candidates.push({ path: normalized, fromConfig, source });
  };

  const expandValue = (value, source, fromConfig = false) => {
    if (!value) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => expandValue(item, source, fromConfig));
      return;
    }
    if (typeof value === "object") {
      if (value[platform]) {
        expandValue(value[platform], `${source}.${platform}`, fromConfig);
      }
      if (value.default) {
        expandValue(value.default, `${source}.default`, fromConfig);
      }
      return;
    }
    if (typeof value === "string") {
      deriveExecutablePaths(value).forEach((candidate) =>
        pushCandidate(candidate, source, fromConfig)
      );
    }
  };

  expandValue(getConfigValue(`office.${appName}`), `office.${appName}`, true);
  expandValue(
    getConfigValue(`office.${appName}.${platform}`),
    `office.${appName}.${platform}`,
    true
  );

  const legacyPlatformBase = getConfigValue(`officePaths.${platform}`);
  if (legacyPlatformBase) {
    expandValue(legacyPlatformBase, `officePaths.${platform}`, true);
  }

  const defaultCandidates = getDefaultOfficeCandidates(appName, platform);
  defaultCandidates.forEach((candidate) =>
    expandValue(candidate, "default", false)
  );

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate.path)) {
        return candidate.path;
      }
    } catch (error) {
      logger.warn(`Error checking Office path ${candidate.path}:`, error);
    }

    if (candidate.fromConfig && !warned.has(candidate.path)) {
      warned.add(candidate.path);
      logger.warn(
        `Configured ${appName} path not accessible: ${candidate.path}`
      );
    }
  }

  const fallback = candidates.find(
    (candidate) => candidate.source === "default"
  );

  return fallback ? fallback.path : undefined;
}

function execCmd(cmdStr) {
  logger.info(`Executing: ${cmdStr}`);

  return new Promise((resolve, reject) => {
    exec(cmdStr, (err, stdout, stderr) => {
      if (err) {
        logger.error(`执行失败: ${err}`);
        reject(err);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function printWord(filePath) {
  try {
    const resolvedPath = await resolveFilePath(filePath, "word");
    const exePath = getOfficePath("word");

    if (!exePath) {
      throw new Error(
        "Word executable not found. Configure office.word in config.json"
      );
    }

    const executable = path.isAbsolute(exePath)
      ? exePath
      : path.resolve(exePath);
    const cmdStr = `"${executable}" /q /n /w /mFilePrintDefault /mFileCloseOrExit "${resolvedPath}"`;
    await execCmd(cmdStr);
    logger.info("Word print job completed");
    return { success: true };
  } catch (error) {
    logger.error("Word print error:", error);
    return { success: false, error: error.message };
  }
}

async function printExcel(filePath) {
  try {
    const resolvedPath = await resolveFilePath(filePath, "excel");
    const exePath = getOfficePath("excel");

    if (!exePath) {
      throw new Error(
        "Excel executable not found. Configure office.excel in config.json"
      );
    }

    const executable = path.isAbsolute(exePath)
      ? exePath
      : path.resolve(exePath);
    const cmdStr = `"${executable}" /q /e /mFilePrintDefault /mFileCloseOrExit "${resolvedPath}"`;

    await execCmd(cmdStr);
    logger.info("Excel print job completed");
    return { success: true };
  } catch (error) {
    logger.error("Excel print error:", error);
    return { success: false, error: error.message };
  }
}

async function printPPT(filePath) {
  try {
    const resolvedPath = await resolveFilePath(filePath, "ppt");
    const exePath = getOfficePath("ppt");

    if (!exePath) {
      throw new Error(
        "PowerPoint executable not found. Configure office.ppt in config.json"
      );
    }

    const executable = path.isAbsolute(exePath)
      ? exePath
      : path.resolve(exePath);
    const cmdStr = `"${executable}" /P "${resolvedPath}"`;

    await execCmd(cmdStr);
    logger.info("PowerPoint print job completed");
    return { success: true };
  } catch (error) {
    logger.error("PowerPoint print error:", error);
    return { success: false, error: error.message };
  }
}

async function printJsx(jsx, initialData) {
  const html = `
  <html lang="en" version="1.0.0">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, user-scalable=0, initial-scale=1.0, viewport-fit=cover" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <title>React with Babel Standalone</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script
    src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/6.26.0/babel.min.js"
    integrity="sha512-kp7YHLxuJDJcOzStgd6vtpxr4ZU9kjn77e6dBsivSz+pUuAuMlE2UTdKB7jjsWT84qbS8kdCWHPETnP/ctrFsA=="
    crossorigin="anonymous"
    referrerpolicy="no-referrer"
  ></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css"
    integrity="sha512-NhSC1YmyruXifcj/KFRWoC561YpHpc5Jtzgvbuzx5VozKpWvQ4nXhPdFgmx8xqexRcpAglTj9sIBWINXa8x5w=="
    crossorigin="anonymous"
    referrerpolicy="no-referrer"
  />
</head>
<body>
  <div id="root"></div>

  <script description="App Component" type="text/babel">
    const { useState } = React;

    const App = () => {
      const [data, setData] = useState(${JSON.stringify(initialData)});
      return (
        <div>
          ${jsx}
        </div>
      );
    };
  </script>

  <script description="Rendering" type="text/babel">
    const root = ReactDOM.createRoot(document.getElementById('root'));

    root.render(<App />);
  </script>
</body>
</html>
  `;

  return printHTML(html);
}

module.exports = {
  printHTML,
  printPdf,
  printWord,
  printExcel,
  printPPT,
  printJsx,
  getOfficePath,
  resolveFilePath,
  printOfficeDocument,
};
