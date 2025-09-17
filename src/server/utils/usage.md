# 🖨 跨平台打印管理器使用文档

## 简介
本模块是一个 **Node.js 跨平台打印 SDK**，支持 **Windows**（基于 `pdf-to-printer`）和 **Linux/macOS**（基于 `unix-print` + CUPS 命令），提供以下功能：

- 打印 PDF（单个 / 批量）
- 打印进度显示
- 失败重试机制
- 打印机健康检查
- 打印机列表与默认打印机获取
- POSIX 下获取驱动支持的纸张/分辨率
- 打印任务状态查询与取消
- 日志记录（按日期保存）

---

## 📦 安装依赖

```bash
npm install pdf-to-printer unix-print
```

Windows 需安装 pdf-to-printer，并确保系统已安装打印机（如 Microsoft Print to PDF）

Linux/macOS 需安装并启用 CUPS，lpstat、lpoptions、cancel 等命令可用

## 📚 API 说明
1. 打印机管理

`listPrinters()`
获取打印机列表。

```js
const printers = await listPrinters();
console.log(printers);
```

`getDefaultPrinter()`
获取系统默认打印机。

```js
const def = await getDefaultPrinter();
console.log(def);
```

`checkPrinterStatus(printerName)`
检查打印机状态（在线/离线、缺纸等）。

```js
const status = await checkPrinterStatus("HP_LaserJet");
console.log(status);
```

`getPrinterDriverOptions(printerName) (POSIX)`
获取打印机驱动支持的纸张、分辨率等。

```js
const opts = await getPrinterDriverOptions("HP_LaserJet");
console.log(opts);
```
2. 打印任务管理
`getJobStatus(printerName, jobId) (POSIX)`
查询任务状态。

```js
const job = await getJobStatus("HP_LaserJet", 42);
console.log(job);
```

`cancelJob(printerName, jobId) (POSIX)`
取消打印任务。

```js
await cancelJob("HP_LaserJet", 42);
```

3. 打印 PDF
`printSinglePDF(filePath, options, retries, retryDelay)`
打印单个 PDF 文件。

参数：

- filePath：PDF 文件路径
- options：
  * printer：打印机名称
  * pages：页码范围（如 "1-3,5"）
  * copies：份数
  * duplex："long-edge" / "short-edge"
  * media：纸张大小（如 "A4"）
  * fitToPage：是否适应页面
  * orientation："portrait" / "landscape"
  * waitForCompletion：POSIX 下等待任务完成
  * retries：失败重试次数（默认 3）
  * retryDelay：重试间隔（毫秒，默认 3000）

```js
await printSinglePDF("/path/to/file.pdf", {
  printer: "Microsoft Print to PDF",
  pages: "1-2",
  copies: 2,
  duplex: "long-edge",
  fitToPage: true
});
```
`printPDFs(files, options)`
批量打印 PDF 文件，带进度显示与重试。

```js 
await printPDFs(
  [
    "/path/to/file1.pdf",
    "/path/to/file2.pdf"
  ],
  {
    printer: "HP_LaserJet",
    pages: "1-3",
    copies: 2,
    duplex: "long-edge",
    retries: 3,
    retryDelay: 3000,
    waitForCompletion: true
  }
);
```
## 📄 日志
所有打印任务的成功/失败记录会保存到 ./print_logs/YYYY-MM-DD.log

日志内容包含时间戳、文件路径、打印机、状态、错误信息

## ⚠️ 注意事项
Windows 下建议安装 SumatraPDF 或使用系统自带的 Microsoft Print to PDF 虚拟打印机

Linux/macOS 需确保 CUPS 服务已启动：

```bash
sudo systemctl start cups
sudo systemctl enable cups
```
POSIX 下的任务管理功能依赖 lpstat、lpoptions、cancel 命令

## 📌 示例：打印前健康检查 + 批量打印
```js
import { checkPrinterStatus, printPDFs } from "./printManager.js";

const printerName = "HP_LaserJet";
const status = await checkPrinterStatus(printerName);
console.log("Printer status:", status);

await printPDFs(
  ["doc1.pdf", "doc2.pdf"],
  { printer: printerName, copies: 1, duplex: "long-edge" }
);
```