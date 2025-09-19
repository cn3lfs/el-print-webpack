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

function setConfigValue(keyPath, value) {
  if (!keyPath || typeof keyPath !== "string") {
    throw new Error("keyPath must be a non-empty string");
  }

  const configPath = getConfigPath();
  let config = {};

  try {
    const fileContent = fs.readFileSync(configPath, "utf8");
    config = JSON.parse(fileContent);
  } catch (error) {
    if (error.code !== "ENOENT") {
      logger.warn(`Failed to read config file at ${configPath}:`, error);
    }
    config = {};
  }

  const keys = keyPath.split(".");
  const finalKey = keys.pop();

  if (!finalKey) {
    throw new Error("Invalid keyPath");
  }

  let cursor = config;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(cursor, key) || typeof cursor[key] !== "object" || cursor[key] === null) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }

  cursor[finalKey] = value;

  const dir = path.dirname(configPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");

  clearConfigCache();

  return config;
}

module.exports = {
  loadConfig,
  getConfigValue,
  clearConfigCache,
  getConfigPath,
  setConfigValue,
};

