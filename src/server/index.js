const http = require("node:http");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const logger = require("electron-log/main");

const pdfPrinter = require("pdf-to-printer");

const html2pdf = require("./utils/html2pdf");

const basePath =
  process.env.NODE_ENV === "development" ? __dirname : process.resourcesPath;

const demoPdf = path.resolve(basePath, "./static/demo/demo.pdf");
const demoWord = path.resolve(basePath, "./static/demo/demo.docx");
const demoExcel = path.resolve(basePath, "./static/demo/demo.xlsx");
const demoPPT = path.resolve(basePath, "./static/demo/demo.pptx");

const sumatraPdfPath = path.resolve(
  basePath,
  "./static/lib/SumatraPDF-3.4.6-32.exe"
);

export async function printHTML(htmlContent) {
  await html2pdf(htmlContent);
  printPdf(path.resolve(basePath, "./tmp/output.pdf"));
}

export function printPdf(f) {
  logger.info(sumatraPdfPath);
  logger.info(f);

  try {
    pdfPrinter
      .print(f, {
        sumatraPdfPath: sumatraPdfPath,
      })
      .then((res) => {
        logger.info("print success");
      })
      .catch((err) => {
        logger.error("print failed");
      });
  } catch (err) {
    logger.error(err);
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
  logger.info(cmdStr);

  exec(cmdStr, (err, stdout, stderr) => {
    if (err) {
      logger.error(`执行错误: ${err}`);
      return;
    }
  });
}

export function printWord(f) {
  const exePath = path.resolve(OFFICE_DIR, "WINWORD.EXE");
  const cmdStr = `"${exePath}" /q /n /mFilePrintDefault /mFileCloseOrExit "${f}"`;

  execCmd(cmdStr);
}

export function printExcel(f) {
  const exePath = path.resolve(OFFICE_DIR, "EXCEL.EXE");
  const cmdStr = `"${exePath}" /q /e /mFilePrintDefault /mFileCloseOrExit "${f}"`;

  execCmd(cmdStr);
}
export function printPPT(f) {
  const exePath = path.resolve(OFFICE_DIR, "POWERPNT.EXE");
  const cmdStr = `"${exePath}" /P "${f}"`;

  execCmd(cmdStr);
}

export function printJsx(jsx, initialData) {
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
    integrity="sha512-NhSC1YmyruXifcj/KFRWoC561YpHpc5Jtzgvbuzx5VozKpWvQ+4nXhPdFgmx8xqexRcpAglTj9sIBWINXa8x5w=="
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

  printHTML(html);
}

export function startServer() {
  // Create a local server to receive data from
  const server = http.createServer();

  // Listen to the request event
  server.on("request", (request, res) => {
    const info = pdfPrinter.getPrinters();

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(info));

    // handlePrint();
  });

  server.listen(8000);
}
