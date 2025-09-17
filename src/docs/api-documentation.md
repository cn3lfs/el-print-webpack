# 打印服务 API 文档

## 概述

这是一个基于 Electron 和 Fastify 的打印服务，提供多种文档格式的打印功能，支持本地文件、远程 URL 和文件流上传。

## 服务器启动

### startServer()

启动 Fastify 服务器，监听端口 8000。

```javascript
import { startServer } from "./server/index.js";

const server = await startServer();
// 服务器将在 http://localhost:8000 启动
```

## API 接口

### 1. 获取打印机列表

**接口**: `GET /printers`

**描述**: 获取系统中所有可用的打印机列表

**响应**:

```json
{
  "success": true,
  "data": [
    {
      "name": "打印机名称",
      "isDefault": true,
      "status": "idle"
    }
  ]
}
```

**错误响应**:

```json
{
  "success": false,
  "error": "错误信息"
}
```

---

### 2. 打印 HTML 内容

**接口**: `POST /print/html`

**描述**: 将 HTML 内容转换为 PDF 并打印

**请求体**:

```json
{
  "htmlContent": "<html><body><h1>Hello World</h1></body></html>"
}
```

**响应**:

```json
{
  "success": true,
  "message": "HTML print job submitted"
}
```

---

### 3. 打印 PDF 文件

**接口**: `POST /print/pdf`

**描述**: 打印 PDF 文件，支持本地路径和远程 URL

**请求体**:

```json
{
  "filePath": "/path/to/file.pdf"
}
// 或者远程 URL
{
  "filePath": "https://example.com/file.pdf"
}
```

**响应**:

```json
{
  "success": true,
  "message": "PDF print job submitted"
}
```

---

### 4. 打印 PDF 文件流

**接口**: `POST /print/pdf-stream`

**描述**: 上传 PDF 文件并打印（FormData 格式）

**请求**:

- Content-Type: `multipart/form-data`
- 文件字段名: `file`

**示例** (JavaScript):

```javascript
const formData = new FormData();
formData.append("file", pdfFile);

fetch("http://localhost:8000/print/pdf-stream", {
  method: "POST",
  body: formData,
});
```

**响应**:

```json
{
  "success": true,
  "message": "PDF stream print job submitted"
}
```

---

### 5. 打印 Word 文件

**接口**: `POST /print/word`

**描述**: 打印 Word 文档，支持本地路径和远程 URL

**请求体**:

```json
{
  "filePath": "/path/to/document.docx"
}
// 或者远程 URL
{
  "filePath": "https://example.com/document.docx"
}
```

**响应**:

```json
{
  "success": true,
  "message": "Word print job submitted"
}
```

---

### 6. 打印 Excel 文件

**接口**: `POST /print/excel`

**描述**: 打印 Excel 表格，支持本地路径和远程 URL

**请求体**:

```json
{
  "filePath": "/path/to/spreadsheet.xlsx"
}
// 或者远程 URL
{
  "filePath": "https://example.com/spreadsheet.xlsx"
}
```

**响应**:

```json
{
  "success": true,
  "message": "Excel print job submitted"
}
```

---

### 7. 打印 PowerPoint 文件

**接口**: `POST /print/ppt`

**描述**: 打印 PowerPoint 演示文稿，支持本地路径和远程 URL

**请求体**:

```json
{
  "filePath": "/path/to/presentation.pptx"
}
// 或者远程 URL
{
  "filePath": "https://example.com/presentation.pptx"
}
```

**响应**:

```json
{
  "success": true,
  "message": "PowerPoint print job submitted"
}
```

---

### 8. 打印 JSX 内容

**接口**: `POST /print/jsx`

**描述**: 将 JSX 内容转换为 HTML，然后转换为 PDF 并打印

**请求体**:

```json
{
  "jsx": "<div><h1>Hello World</h1><p>This is JSX content</p></div>",
  "initialData": {
    "name": "John Doe",
    "age": 30
  }
}
```

**响应**:

```json
{
  "success": true,
  "message": "JSX print job submitted"
}
```

## 导出函数

### printHTML(htmlContent)

直接打印 HTML 内容（内部使用）

```javascript
import { printHTML } from "./server/index.js";

await printHTML("<html><body><h1>Test</h1></body></html>");
```

### printPdf(filePath)

直接打印 PDF 文件（内部使用）

```javascript
import { printPdf } from "./server/index.js";

const result = await printPdf("/path/to/file.pdf");
// result: { success: true } 或 { success: false, error: "错误信息" }
```

### printWord(filePath), printExcel(filePath), printPPT(filePath)

分别打印 Office 文档（内部使用）

```javascript
import { printWord, printExcel, printPPT } from "./server/index.js";

const result = await printWord("/path/to/document.docx");
```

### printJsx(jsx, initialData)

直接打印 JSX 内容（内部使用）

```javascript
import { printJsx } from "./server/index.js";

await printJsx("<div>Hello JSX</div>", { name: "Test" });
```

## 错误处理

所有接口在出错时都会返回以下格式：

```json
{
  "success": false,
  "error": "详细错误信息"
}
```

## 支持的文件格式

- **PDF**: `.pdf`
- **Word**: `.doc`, `.docx`
- **Excel**: `.xls`, `.xlsx`
- **PowerPoint**: `.ppt`, `.pptx`
- **HTML**: 纯 HTML 内容或包含 React/JSX 的内容

## 注意事项

1. 服务器默认运行在端口 8000
2. 支持 CORS，允许所有来源的请求
3. 文件上传大小限制为 50MB
4. 远程 URL 会被下载到临时目录后打印
5. 所有临时文件会在打印完成后自动清理
6. 需要系统中安装有 Microsoft Office（用于 Office 文档打印）
7. 需要 Chrome/Chromium（用于 HTML 到 PDF 转换）

## 示例用法

### 打印本地 PDF 文件

```javascript
fetch("http://localhost:8000/print/pdf", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    filePath: "C:/documents/report.pdf",
  }),
});
```

### 上传并打印 PDF 文件

```javascript
const formData = new FormData();
formData.append("file", fileInput.files[0]);

fetch("http://localhost:8000/print/pdf-stream", {
  method: "POST",
  body: formData,
});
```

### 打印 HTML 内容

```javascript
fetch("http://localhost:8000/print/html", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    htmlContent: `
      <html>
        <body>
          <h1>打印测试</h1>
          <p>这是要打印的内容</p>
        </body>
      </html>
    `,
  }),
});
```
