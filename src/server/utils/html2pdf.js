const puppeteer = require("puppeteer-core");
const fs = require("fs/promises");
const logger = require("./logger");
const { createTempFilePath } = require("./fileDownloader");

const basePath =
  process.env.NODE_ENV === "development" ? __dirname : process.resourcesPath;

/**
 * 获取默认的 Chrome 可执行文件路径
 * @returns {string} Chrome 可执行文件路径
 */
function getDefaultChromiumExecPath() {
  // 尝试常见的 Chrome 安装路径
  const possiblePaths = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ];

  for (const execPath of possiblePaths) {
    try {
      require("fs").accessSync(execPath);
      return execPath;
    } catch {
      // 继续尝试下一个路径
    }
  }

  // 如果都没有找到，使用 Puppeteer 自带的 Chromium
  return puppeteer.executablePath().replace("app.asar", "app.asar.unpacked");
}

/**
 * 将 HTML 内容转换为 PDF
 * @param {string} htmlContent - HTML 内容
 * @param {object} options - 配置选项
 * @param {string} options.executablePath - Chrome 可执行文件路径
 * @param {string} options.paperFormat - 纸张格式 (A4, A3, Letter, Legal 等)
 * @param {object} options.pdfOptions - PDF 生成选项
 * @returns {Promise<string>} 生成的 PDF 文件路径
 */
export async function html2pdf(htmlContent, options = {}) {
  const {
    executablePath = getDefaultChromiumExecPath(),
    paperFormat = "A4",
    pdfOptions = {},
    ...launchOptions
  } = options;

  let browser = null;
  let tempFilePath = null;

  try {
    logger.info(`Starting PDF generation with format: ${paperFormat}`);

    // 使用 createTempFilePath 生成临时文件路径
    tempFilePath = createTempFilePath();

    // 启动浏览器
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
      ...launchOptions,
    });

    const page = await browser.newPage();

    // 设置页面内容
    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // 生成 PDF
    const defaultPdfOptions = {
      format: paperFormat,
      printBackground: true,
      margin: {
        top: "1cm",
        right: "1cm",
        bottom: "1cm",
        left: "1cm",
      },
      preferCSSPageSize: false,
      ...pdfOptions,
    };

    const pdfBuffer = await page.pdf(defaultPdfOptions);

    // 写入临时文件
    await fs.writeFile(tempFilePath, pdfBuffer);

    logger.info(`PDF generated successfully: ${tempFilePath}`);
    return tempFilePath;
  } catch (error) {
    logger.error("Error generating PDF:", error);

    // 如果生成失败，清理临时文件
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        logger.warn("Failed to cleanup temp file:", cleanupError);
      }
    }

    throw error;
  } finally {
    // 确保浏览器被关闭
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        logger.warn("Error closing browser:", error);
      }
    }
  }
}
