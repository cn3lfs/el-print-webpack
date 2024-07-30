const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs/promises");

const basePath =
  process.env.NODE_ENV === "development" ? __dirname : process.resourcesPath;

function getChromiumExecPath() {
  return puppeteer.executablePath().replace("app.asar", "app.asar.unpacked");
}

async function html2pdf(htmlContent) {
  // console.log(getChromiumExecPath());
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    // executablePath: getChromiumExecPath(),
  });
  const page = await browser.newPage();
  console.log("start generating pdf");
  await page.setContent(htmlContent);

  // Navigate the page to a URL.
  // await page.goto("https://www.baidu.com/");

  const pdf = await page.pdf({ format: "A4" });
  await browser.close();
  console.log("PDF generated successfully!");

  const tmpPath = path.join(basePath, "tmp");
  const tmpPdfPath = path.join(tmpPath, "output.pdf");
  fs.mkdir(tmpPath).catch();

  // Check if the file exists and remove it if it does
  try {
    await fs.access(tmpPdfPath);
    // File exists, remove it
    await fs.unlink(tmpPdfPath);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error(`Error accessing file: ${err}`);
      return;
    }
  }

  // Write the new file
  try {
    await fs.writeFile(tmpPdfPath, pdf);
    console.log("File has been written");
  } catch (err) {
    console.error(`Error writing file: ${err}`);
  }

  return pdf;
}

module.exports = html2pdf;
