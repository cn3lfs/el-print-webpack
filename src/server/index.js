const os = require("os");
const fs = require("fs");
const path = require("path");
const logger = require("./utils/logger");
const logTransport = logger.transports?.file;
const logFile = logTransport?.getFile?.();
const {
  getConfigValue,
  getConfigPath,
  setConfigValue,
} = require("./config");
const { listPrinters } = require("./utils/printManager");
const { createTempFilePath } = require("./utils/fileDownloader");
const { resolveChromiumExecutablePath } = require("./utils/html2pdf");

const {
  getOfficePath,
  printHTML,
  printPdf,
  printWord,
  printExcel,
  printPPT,
  printJsx,
  printOfficeDocument,
} = require("./print");

const fastify = require("fastify")({
  logger: true,
  // 禁用请求日志，因为我们使用electron-log
  disableRequestLogging: true,
});

async function startServer() {
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

  // 配置信息
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
  fastify.post("/setConfig", async (request, reply) => {
    const { key, value } = request.body || {};

    if (!key || typeof key !== "string" || !key.trim()) {
      reply.code(400);
      return { success: false, error: "key is required" };
    }

    const normalizedValue = typeof value === "string" ? value.trim() : value;

    if (!normalizedValue || typeof normalizedValue !== "string") {
      reply.code(400);
      return { success: false, error: "value is required" };
    }

    try {
      setConfigValue(key.trim(), normalizedValue);
      return { success: true };
    } catch (error) {
      logger.error("Error updating configuration:", error);
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

module.exports = {
  startServer,
  printHTML,
  printPdf,
  printWord,
  printExcel,
  printPPT,
  printJsx,
  printOfficeDocument,
};

