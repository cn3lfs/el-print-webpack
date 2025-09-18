const fs = require("fs");
const path = require("path");
const logger = require("./utils/logger");

const baseDir =
  process.env.NODE_ENV === "development" ? __dirname : process.resourcesPath;

const defaultConfigPath = path.join(baseDir, "./static/config.json");
let cachedConfig = null;

function getConfigPath() {
  return process.env.APP_CONFIG_PATH || defaultConfigPath;
}

function loadConfig() {
  if (cachedConfig !== null) {
    return cachedConfig;
  }

  const configPath = getConfigPath();

  try {
    const fileContent = fs.readFileSync(configPath, "utf8");
    cachedConfig = JSON.parse(fileContent);
  } catch (error) {
    if (error.code !== "ENOENT") {
      logger.warn(`Failed to read config file at ${configPath}:`, error);
    }
    cachedConfig = {};
  }

  return cachedConfig;
}

function getConfigValue(keyPath) {
  if (!keyPath) {
    return loadConfig();
  }

  return keyPath.split(".").reduce((acc, key) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, key)) {
      return acc[key];
    }
    return undefined;
  }, loadConfig());
}

function clearConfigCache() {
  cachedConfig = null;
}

module.exports = {
  loadConfig,
  getConfigValue,
  clearConfigCache,
  getConfigPath,
};
