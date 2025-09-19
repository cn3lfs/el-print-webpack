import { exec, spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import {
  getPrinters as getWinPrinters,
  print as winPrint,
} from "pdf-to-printer";
import {
  getDefaultPrinter as getUnixDefault,
  getPrinters as getUnixPrinters,
  isPrintComplete,
  print as unixPrint,
} from "unix-print";
import logger from "./logger";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function ensureAbsolute(p) {
  return path.isAbsolute(p) ? p : path.resolve(p);
}
function isPosix() {
  return ["linux", "darwin", "freebsd"].includes(os.platform());
}

function isOfficeDocument(filePath) {
  const ext = path.extname(filePath || "").toLowerCase();
  return SUPPORTED_OFFICE_EXTENSIONS.has(ext);
}

// ---------------------------
// 打印机信息
// ---------------------------
export async function listPrinters() {
  if (os.platform() === "win32") {
    return await getWinPrinters();
  } else if (isPosix()) {
    return await getUnixPrinters();
  }
  throw new Error("Unsupported OS");
}

export async function getDefaultPrinter() {
  if (os.platform() === "win32") {
    const printers = await getWinPrinters();
    return printers.find((p) => p.isDefault) || printers[0] || null;
  } else if (isPosix()) {
    return await getUnixDefault();
  }
  throw new Error("Unsupported OS");
}

// ---------------------------
// 健康检查
// ---------------------------
export async function checkPrinterStatus(printerName) {
  return new Promise((resolve, reject) => {
    if (os.platform() === "win32") {
      exec(
        `wmic printer where "Name='${printerName}'" get PrinterStatus,WorkOffline`,
        (err, stdout) => {
          if (err) return reject(err);
          resolve(stdout.trim());
        }
      );
    } else if (isPosix()) {
      exec(`lpstat -p "${printerName}"`, (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout.trim());
      });
    } else {
      reject(new Error("Unsupported OS"));
    }
  });
}

// ---------------------------
// POSIX: 驱动选项 & 任务管理
// ---------------------------
export function getPrinterDriverOptions(printerName) {
  if (!isPosix()) throw new Error("POSIX only");
  return new Promise((resolve, reject) => {
    exec(`lpoptions -p "${printerName}" -l`, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout.trim());
    });
  });
}

export function getJobStatus(printerName, jobId) {
  if (!isPosix()) throw new Error("POSIX only");
  return new Promise((resolve, reject) => {
    exec(`lpstat -o "${printerName}"`, (err, stdout) => {
      if (err) return reject(err);
      const jobs = stdout.split("\n").filter(Boolean);
      const job = jobs.find((j) => j.startsWith(`${printerName}-${jobId}`));
      resolve(job || null);
    });
  });
}

export function cancelJob(printerName, jobId) {
  if (!isPosix()) throw new Error("POSIX only");
  return new Promise((resolve, reject) => {
    exec(`cancel "${printerName}-${jobId}"`, (err) => {
      if (err) return reject(err);
      resolve(true);
    });
  });
}

// ---------------------------
// 打印 PDF
// ---------------------------
const basePath =
  process.env.NODE_ENV === "development" ? __dirname : process.resourcesPath;
const sumatraPdfPath = path.resolve(
  basePath,
  "./static/lib/SumatraPDF-3.4.6-32.exe"
);

const POWERSHELL_COMMAND = process.env.POWERSHELL_PATH || "powershell.exe";
const printDocumentScriptPath = path.resolve(
  basePath,
  "./static/lib/Print-Document.ps1"
);

const SUPPORTED_OFFICE_EXTENSIONS = new Set([
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
]);

function mapWindowsOptions(options) {
  const {
    printer,
    pages,
    copies,
    orientation,
    scale,
    bin,
    paperSize,
    color,
    duplex,
  } = options || {};
  return {
    printer,
    pages,
    copies,
    orientation,
    scale,
    bin,
    paperSize,
    color,
    duplex,
    sumatraPdfPath,
  };
}

function mapCupsOptions(options) {
  const cupsOptions = [];
  if (!options) return cupsOptions;
  if (options.pages) cupsOptions.push(`-P ${options.pages}`);
  if (options.copies) cupsOptions.push(`-n ${options.copies}`);
  if (options.duplex) {
    const sides =
      options.duplex === "long-edge"
        ? "two-sided-long-edge"
        : options.duplex === "short-edge"
          ? "two-sided-short-edge"
          : undefined;
    if (sides) cupsOptions.push(`-o sides=${sides}`);
  }
  if (options.media) cupsOptions.push(`-o media=${options.media}`);
  if (options.fitToPage) cupsOptions.push(`-o fit-to-page`);
  if (options.orientation === "landscape" || options.landscape)
    cupsOptions.push(`-o landscape`);
  return cupsOptions;
}

function toPowerShellValue(value) {
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  return String(value);
}

function buildPrintScriptArgs(parameters) {
  if (!printDocumentScriptPath || !fs.existsSync(printDocumentScriptPath)) {
    throw new Error(
      "Print-Document.ps1 not found at " + printDocumentScriptPath
    );
  }

  const args = [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    printDocumentScriptPath,
  ];

  for (const [key, value] of Object.entries(parameters)) {
    if (value === undefined || value === null) continue;
    args.push("-" + key);
    args.push(toPowerShellValue(value));
  }

  return args;
}

function runPrintScript(parameters) {
  return new Promise((resolve, reject) => {
    const args = buildPrintScriptArgs(parameters);
    const child = spawn(POWERSHELL_COMMAND, args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        const message =
          stderr.trim() ||
          stdout.trim() ||
          "PowerShell exited with code " + code;
        const error = new Error(message);
        error.code = code;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });
  });
}

export async function printOfficeDocument(filePath, options = {}) {
  logger.info("start printing: ");
  if (os.platform() !== "win32") {
    const msg = "Office document printing is only supported on Windows.";
    logger.error(msg);

    return {
      success: false,
      error: msg,
    };
  }

  const absPath = ensureAbsolute(filePath);

  if (!isOfficeDocument(absPath)) {
    const msg =
      "Unsupported file type for office printing: " +
      path.extname(absPath || filePath);
    logger.error(msg);
    return {
      success: false,
      error: msg,
    };
  }

  if (!fs.existsSync(absPath)) {
    const msg = "File not found: " + absPath;
    logger.error(msg);
    return { success: false, error: msg };
  }

  if (!printDocumentScriptPath || !fs.existsSync(printDocumentScriptPath)) {
    const msg =
      "Print-Document.ps1 not found at " + String(printDocumentScriptPath);
    logger.error(msg);
    return {
      success: false,
      error: msg,
    };
  }

  const parameters = {
    FilePath: absPath,
  };

  const printerName = options.printer || options.printerName;
  if (printerName) {
    parameters.PrinterName = printerName;
  }

  if (options.copies != null) {
    const copies = Number(options.copies);
    if (!Number.isNaN(copies)) {
      parameters.Copies = copies;
    }
  }

  if (options.pageRange) {
    parameters.PageRange = options.pageRange;
  }

  if (options.convertToPdf === true) {
    parameters.ConvertToPdf = true;
  }

  if (options.outputFolder) {
    parameters.OutputFolder = ensureAbsolute(options.outputFolder);
  }

  try {
    const { stdout = "", stderr = "" } = await runPrintScript(parameters);

    stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => logger.info("[Print-Document] " + line));

    stderr
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => logger.warn("[Print-Document] " + line));

    logger.info(
      "SUCCESS: " +
        absPath +
        " -> " +
        (printerName || "(default)") +
        " [Office]"
    );

    return { success: true };
  } catch (error) {
    logger.error(
      "FAIL: " +
        absPath +
        " -> " +
        (printerName || "(default)") +
        " [Office] | " +
        error.message
    );
    return {
      success: false,
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr,
    };
  }
}

export async function printOfficeDocuments(files, options = {}) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("files must be array");
  }

  const total = files.length;
  const results = [];
  let completed = 0;

  for (const file of files) {
    const result = await printOfficeDocument(file, options);
    completed += 1;
    console.log(
      "Office progress: " +
        completed +
        "/" +
        total +
        " (" +
        Math.round((completed / total) * 100) +
        "%)"
    );
    results.push(result);
  }

  return results;
}

export async function printSinglePDF(
  filePath,
  options = {},
  retries = 1,
  waitMs = 3000
) {
  const absPath = ensureAbsolute(filePath);
  const platform = os.platform();
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      if (platform === "win32") {
        await winPrint(absPath, mapWindowsOptions(options));
        logger.info(
          `SUCCESS: ${absPath} -> ${options.printer || "(default)"} [Windows]`
        );
        return { success: true };
      } else if (isPosix()) {
        const jobId = await unixPrint(
          absPath,
          options.printer,
          mapCupsOptions(options)
        );
        if (options.waitForCompletion) {
          while (!(await isPrintComplete(jobId))) {
            await sleep(1000);
          }
        }
        logger.info(
          `SUCCESS: ${absPath} -> ${options.printer || "(default)"} [POSIX] jobId=${jobId}`
        );
        return { success: true, jobId };
      } else {
        throw new Error("Unsupported OS");
      }
    } catch (err) {
      logger.info(
        `FAIL [${attempt}/${retries + 1}]: ${absPath} -> ${options.printer || "(default)"} | ${err.message}`
      );
      if (attempt <= retries) await sleep(waitMs);
      else return { success: false, error: err };
    }
  }
}

export async function printPDFs(files, options = {}) {
  if (!Array.isArray(files) || files.length === 0)
    throw new Error("files must be array");
  if (!options.printer) {
    const d = await getDefaultPrinter();
    if (d) options.printer = d.name || d;
  }
  let completed = 0;
  const total = files.length;
  const results = [];
  for (const file of files) {
    const res = await printSinglePDF(
      file,
      options,
      options.retries || 1,
      options.retryDelay || 3000
    );
    completed++;
    console.log(
      `Progress: ${completed}/${total} (${Math.round((completed / total) * 100)}%)`
    );
    results.push(res);
  }
  return results;
}
