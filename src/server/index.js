const os = require("os");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const logger = require("./utils/logger");
const logTransport = logger.transports?.file;
const logFile = logTransport?.getFile?.();
const { getConfigValue, getConfigPath } = require("./config");
const { printSinglePDF, listPrinters } = require("./utils/printManager");
const {
  downloadFile,
  isUrl,
  createTempFilePath,
} = require("./utils/fileDownloader");
const { html2pdf, resolveChromiumExecutablePath } = require("./utils/html2pdf");

const fastify = require("fastify")({
  logger: true,
  // 禁用请求日志，因为我们使用electron-log
  disableRequestLogging: true,
});

export async function printHTML(htmlContent) {
  const pdfPath = await html2pdf(htmlContent);
  return await printPdf(pdfPath);
}

/**
 * 处理文件路径，支持本地路径和远程URL
 * @param {string} filePath - 文件路径或URL
 * @param {string} fileType - 文件类型（用于生成临时文件名）
 * @returns {Promise<string>} 本地文件路径
 */
async function resolveFilePath(filePath, fileType = "") {
  if (isUrl(filePath)) {
    // 如果是URL，先下载到本地
    const filename = `temp_${fileType}_${Date.now()}${path.extname(filePath) || ".pdf"}`;
    const localPath = await downloadFile(filePath, filename);
    logger.info(`Downloaded remote file: ${filePath} -> ${localPath}`);
    return localPath;
  } else {
    // 本地路径，确保是绝对路径
    return path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
  }
}

export async function printPdf(filePath) {
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

/* 
Word, Excel, and PowerPoint
For Microsoft Office files, you can use the command-line switches provided by Office applications:

Word
"C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE" /q /n /mFilePrintDefault /mFileExit "C:\path\to\file.docx"

Excel
"C:\Program Files\Microsoft Office\root\Office16\EXCEL.EXE" /q /e /mFilePrintDefault /mFileExit "C:\path\to\file.xlsx"

PowerPoint
"C:\Program Files\Microsoft Office\root\Office16\POWERPNT.EXE" /P "C:\path\to\file.pptx"
*/

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

fastify.get("/config", async (request, reply) => {
  try {
    const configPath = getConfigPath();
    const config = getConfigValue();
    const resolvedOffice = {
      word: getOfficePath("word"),
      excel: getOfficePath("excel"),
      ppt: getOfficePath("ppt"),
    };
    const resolvedChromium = resolveChromiumExecutablePath();
    const configDir = path.dirname(configPath);
    const demoDir = path.join(configDir, "demo");
    const resolvedDemo = {
      baseDir: demoDir,
      pdf: path.join(demoDir, "demo.pdf"),
      word: path.join(demoDir, "demo.docx"),
      excel: path.join(demoDir, "demo.xlsx"),
      ppt: path.join(demoDir, "demo.pptx"),
    };
    const logFilePath = logFile?.path || logTransport?.resolvePath?.();

    const payload = {
      configPath,
      configFileExists: fs.existsSync(configPath),
      platform: os.platform(),
      resolved: {
        office: resolvedOffice,
        officePath: resolvedOffice.word
          ? path.dirname(resolvedOffice.word)
          : undefined,
        demo: resolvedDemo,
        logFile: logFilePath,
        chromiumExecutablePath: resolvedChromium,
      },
      config,
    };

    return { success: true, data: payload };
  } catch (error) {
    logger.error("Error loading configuration info:", error);
    reply.code(500);
    return { success: false, error: "Failed to load configuration info" };
  }
});

function execCmd(cmdStr) {
  logger.info(`Executing: ${cmdStr}`);

  return new Promise((resolve, reject) => {
    exec(cmdStr, (err, stdout, stderr) => {
      if (err) {
        logger.error(`执行错误: ${err}`);
        reject(err);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export async function printWord(filePath) {
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
    const cmdStr = `"${executable}" /q /n /mFilePrintDefault /mFileCloseOrExit "${resolvedPath}"`;

    await execCmd(cmdStr);
    logger.info("Word print job completed");
    return { success: true };
  } catch (error) {
    logger.error("Word print error:", error);
    return { success: false, error: error.message };
  }
}

export async function printExcel(filePath) {
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

export async function printPPT(filePath) {
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

export async function printJsx(jsx, initialData) {
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

  return await printHTML(html);
}

export async function startServer() {
  // 注册CORS插件
  await fastify.register(require("@fastify/cors"), {
    origin: true, // 允许所有来源
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  });

  // 注册multipart插件用于文件上传
  await fastify.register(require("@fastify/multipart"), {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });

  // 获取打印机列表
  fastify.get("/printers", async (request, reply) => {
    try {
      const info = await listPrinters();
      return { success: true, data: info };
    } catch (error) {
      logger.error("Error listing printers:", error);
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // 打印HTML内容
  fastify.post("/print/html", async (request, reply) => {
    const { htmlContent } = request.body || {};

    if (!htmlContent) {
      reply.code(400);
      return { success: false, error: "htmlContent is required" };
    }

    try {
      await printHTML(htmlContent);
      return { success: true, message: "HTML print job submitted" };
    } catch (error) {
      logger.error("Error printing HTML:", error);
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // 打印PDF文件（支持本地路径和远程URL）
  fastify.post("/print/pdf", async (request, reply) => {
    const { filePath } = request.body || {};

    if (!filePath) {
      reply.code(400);
      return { success: false, error: "filePath is required" };
    }

    try {
      const result = await printPdf(filePath);
      if (result.success) {
        return { success: true, message: "PDF print job submitted" };
      } else {
        reply.code(500);
        return { success: false, error: result.error };
      }
    } catch (error) {
      logger.error("Error printing PDF:", error);
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // 打印PDF文件流
  fastify.post("/print/pdf-stream", async (request, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        reply.code(400);
        return { success: false, error: "No file uploaded" };
      }

      // 使用 createTempFilePath 创建临时文件路径
      const tempFilePath = createTempFilePath();

      // 将上传的文件保存到临时路径
      const buffer = await data.toBuffer();
      fs.writeFileSync(tempFilePath, buffer);

      // 使用现有的打印功能
      const result = await printPdf(tempFilePath);

      if (result.success) {
        return { success: true, message: "PDF stream print job submitted" };
      } else {
        reply.code(500);
        return { success: false, error: result.error };
      }
    } catch (error) {
      logger.error("Error printing PDF stream:", error);
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // 打印Word文件（支持本地路径和远程URL）
  fastify.post("/print/word", async (request, reply) => {
    const { filePath } = request.body || {};

    if (!filePath) {
      reply.code(400);
      return { success: false, error: "filePath is required" };
    }

    try {
      const result = await printWord(filePath);
      if (result.success) {
        return { success: true, message: "Word print job submitted" };
      } else {
        reply.code(500);
        return { success: false, error: result.error };
      }
    } catch (error) {
      logger.error("Error printing Word:", error);
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // 打印Excel文件（支持本地路径和远程URL）
  fastify.post("/print/excel", async (request, reply) => {
    const { filePath } = request.body || {};

    if (!filePath) {
      reply.code(400);
      return { success: false, error: "filePath is required" };
    }

    try {
      const result = await printExcel(filePath);
      if (result.success) {
        return { success: true, message: "Excel print job submitted" };
      } else {
        reply.code(500);
        return { success: false, error: result.error };
      }
    } catch (error) {
      logger.error("Error printing Excel:", error);
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // 打印PowerPoint文件（支持本地路径和远程URL）
  fastify.post("/print/ppt", async (request, reply) => {
    const { filePath } = request.body || {};

    if (!filePath) {
      reply.code(400);
      return { success: false, error: "filePath is required" };
    }

    try {
      const result = await printPPT(filePath);
      if (result.success) {
        return { success: true, message: "PowerPoint print job submitted" };
      } else {
        reply.code(500);
        return { success: false, error: result.error };
      }
    } catch (error) {
      logger.error("Error printing PowerPoint:", error);
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // 打印JSX内容
  fastify.post("/print/jsx", async (request, reply) => {
    const { jsx, initialData } = request.body || {};

    if (!jsx) {
      reply.code(400);
      return { success: false, error: "jsx is required" };
    }

    try {
      const result = await printJsx(jsx, initialData || {});
      return { success: true, message: "JSX print job submitted" };
    } catch (error) {
      logger.error("Error printing JSX:", error);
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // 启动服务器
  try {
    await fastify.listen({ port: 8000, host: "0.0.0.0" });
    logger.info("Fastify server running on port 8000");
  } catch (err) {
    logger.error("Error starting server:", err);
    process.exit(1);
  }

  return fastify;
}
