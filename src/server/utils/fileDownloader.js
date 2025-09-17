const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const basePath =
  process.env.NODE_ENV === "development" ? __dirname : process.resourcesPath;

/**
 * 创建临时文件路径
 * @param {string} filename - 保存的文件名（可选）
 * @param {string} defaultExt - 默认文件扩展名，默认为".pdf"
 * @returns {string} 本地临时文件路径
 */
function createTempFilePath(filename, defaultExt = ".pdf") {
  const tmpDir = path.join(basePath, "tmp");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  if (filename) {
    const localPath = path.join(tmpDir, filename);

    // 检查文件是否存在
    if (!fs.existsSync(localPath)) {
      return localPath;
    }

    // 如果文件存在，检查是否为空
    const stats = fs.statSync(localPath);
    if (stats.size === 0) {
      return localPath;
    }

    // 文件存在且不为空，生成新文件名
    const ext = path.extname(filename) || defaultExt;
    const base = path.basename(filename, path.extname(filename) || defaultExt);
    let counter = 1;
    let newFilename = `${base}_${counter}${ext}`;
    let newPath = path.join(tmpDir, newFilename);
    while (fs.existsSync(newPath)) {
      counter++;
      newFilename = `${base}_${counter}${ext}`;
      newPath = path.join(tmpDir, newFilename);
    }
    return newPath;
  } else {
    // 生成随机唯一文件名
    let randomName;
    let localPath;
    do {
      randomName = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${defaultExt}`;
      localPath = path.join(tmpDir, randomName);
    } while (fs.existsSync(localPath));
    return localPath;
  }
}

/**
 * 下载远程文件到本地临时目录
 * @param {string} url - 文件URL
 * @param {string} filename - 保存的文件名（可选）
 * @returns {Promise<string>} 本地文件路径
 */
async function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === "https:" ? https : http;

    const localPath = createTempFilePath(filename);

    const file = fs.createWriteStream(localPath);

    const request = protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on("finish", () => {
        file.close();
        resolve(localPath);
      });
    });

    request.on("error", (err) => {
      fs.unlink(localPath, () => {}); // 删除不完整的文件
      reject(err);
    });

    file.on("error", (err) => {
      fs.unlink(localPath, () => {}); // 删除不完整的文件
      reject(err);
    });
  });
}

/**
 * 检查字符串是否为HTTP/HTTPS URL
 * @param {string} str - 要检查的字符串
 * @returns {boolean} 是否为HTTP/HTTPS URL
 */
function isUrl(str) {
  if (typeof str !== "string") return false;
  return str.startsWith("http://") || str.startsWith("https://");
}
module.exports = {
  createTempFilePath,
  downloadFile,
  isUrl,
};
