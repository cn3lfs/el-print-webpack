const os = require("os");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const logger = require("electron-log/main");
const { printSinglePDF, listPrinters } = require("./utils/printManager");
const {
  downloadFile,
  isUrl,
  createTempFilePath,
} = require("./utils/fileDownloader");
const html2pdf = require("./utils/html2pdf");

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

function checkOfficePath(officePath) {
  return fs.existsSync(officePath);
}

function getOfficePath() {
  let officePath;

  if (os.platform() === "win32") {
    officePath = "C:/Program Files/Microsoft Office/root/Office16/";
    if (!checkOfficePath(officePath)) {
      officePath = "C:/Program Files (x86)/Microsoft Office/root/Office16/";
    }
  } else if (os.platform() === "darwin") {
    officePath = "/Applications/Microsoft Word.app";
    if (!checkOfficePath(officePath)) {
      officePath = "/Applications/Microsoft Excel.app";
    }
  } else if (os.platform() === "linux") {
    officePath = "/usr/local/Microsoft Office";
  }

  return officePath;
}

const OFFICE_DIR = getOfficePath();

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
    const exePath = path.resolve(OFFICE_DIR, "WINWORD.EXE");
    const cmdStr = `"${exePath}" /q /n /mFilePrintDefault /mFileCloseOrExit "${resolvedPath}"`;

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
    const exePath = path.resolve(OFFICE_DIR, "EXCEL.EXE");
    const cmdStr = `"${exePath}" /q /e /mFilePrintDefault /mFileCloseOrExit "${resolvedPath}"`;

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
    const exePath = path.resolve(OFFICE_DIR, "POWERPNT.EXE");
    const cmdStr = `"${exePath}" /P "${resolvedPath}"`;

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
