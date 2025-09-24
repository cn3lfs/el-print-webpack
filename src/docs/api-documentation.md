### API 文档：El-Print-Webpack 服务接口

#### 介绍

本文档描述了 El-Print-Webpack 项目中 Fastify 服务器的 API 接口。这些接口主要用于打印相关功能，第三方可以通过 HTTP 请求调用这些接口来与服务器交互。服务器运行在端口 8000（默认），所有接口都支持 CORS。

- **基础 URL**：`http://localhost:8000`（在生产环境中替换为实际服务器地址）。
- **认证**：当前接口未指定认证机制（如 Bearer Token），但请求头可包含 `Authorization`。
- **错误处理**：如果请求失败，返回 JSON 对象如 `{ success: false, error: "错误消息" }`。
- **请求格式**：POST 请求通常需要 JSON 体；GET 请求无体。

#### 接口列表

1. **获取打印机列表**
   - **方法**：GET
   - **路径**：`/printers`
   - **参数**：无
   - **响应**：
     - 成功：`{ success: true, data: [array of printer info] }`
     - 失败：`{ success: false, error: "错误消息" }`
   - **第三方使用说明**：第三方可用于查询可用打印机。示例使用 curl：
     ```
     curl http://localhost:8000/printers
     ```
     或在 JavaScript 中：
     ```javascript
     fetch("http://localhost:8000/printers")
       .then((response) => response.json())
       .then((data) => console.log(data));
     ```

2. **获取配置信息**
   - **方法**：GET
   - **路径**：`/config`
   - **参数**：无
   - **响应**：返回配置对象，包括路径、平台信息等。
     - 成功：`{ success: true, data: { configPath, config, ... } }`
     - 失败：`{ success: false, error: "错误消息" }`
   - **第三方使用说明**：第三方可用于检查服务器配置。示例：
     ```
     curl http://localhost:8000/config
     ```

3. **设置配置值**
   - **方法**：POST
   - **路径**：`/setConfig`
   - **参数**（请求体 JSON）：
     - `key`: 字符串（必填）
     - `value`: 字符串（必填）
   - **响应**：
     - 成功：`{ success: true }`
     - 失败：`{ success: false, error: "错误消息" }`
   - **第三方使用说明**：第三方可动态更新配置。示例：
     ```
     curl -X POST http://localhost:8000/setConfig -H "Content-Type: application/json" -d '{"key": "someKey", "value": "someValue"}'
     ```
     JavaScript 示例：
     ```javascript
     fetch("http://localhost:8000/setConfig", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ key: "someKey", value: "someValue" }),
     });
     ```

4. **打印 HTML 内容**
   - **方法**：POST
   - **路径**：`/print/html`
   - **参数**（请求体 JSON）：
     - `htmlContent`: 字符串（必填，HTML 内容）
   - **响应**：
     - 成功：`{ success: true, message: "HTML print job submitted" }`
     - 失败：`{ success: false, error: "错误消息" }`
   - **第三方使用说明**：第三方可提交 HTML 字符串进行打印。示例：
     ```
     curl -X POST http://localhost:8000/print/html -H "Content-Type: application/json" -d '{"htmlContent": "<h1>Hello World</h1>"}'
     ```

5. **打印 PDF 文件**
   - **方法**：POST
   - **路径**：`/print/pdf`
   - **参数**（请求体 JSON）：
     - `filePath`: 字符串（必填，PDF 文件路径或 URL）
   - **响应**：
     - 成功：`{ success: true, message: "PDF print job submitted" }`
     - 失败：`{ success: false, error: "错误消息" }`
   - **第三方使用说明**：第三方可指定 PDF 文件路径进行打印。示例：
     ```
     curl -X POST http://localhost:8000/print/pdf -H "Content-Type: application/json" -d '{"filePath": "/path/to/file.pdf"}'
     ```

6. **打印 PDF 文件流**
   - **方法**：POST
   - **路径**：`/print/pdf-stream`
   - **参数**：multipart/form-data（上传 PDF 文件）
   - **响应**：
     - 成功：`{ success: true, message: "PDF stream print job submitted" }`
     - 失败：`{ success: false, error: "错误消息" }`
   - **第三方使用说明**：第三方可上传 PDF 文件流。示例（使用 curl）：
     ```
     curl -X POST http://localhost:8000/print/pdf-stream -F "file=@/path/to/file.pdf"
     ```

7. **打印 Word 文件**
   - **方法**：POST
   - **路径**：`/print/word`
   - **参数**（请求体 JSON）：
     - `filePath`: 字符串（必填，Word 文件路径或 URL）
   - **响应**：类似其他打印接口
   - **第三方使用说明**：示例：
     ```
     curl -X POST http://localhost:8000/print/word -H "Content-Type: application/json" -d '{"filePath": "/path/to/demo.docx"}'
     ```

8. **打印 Excel 文件**
   - **方法**：POST
   - **路径**：`/print/excel`
   - **参数**（请求体 JSON）：
     - `filePath`: 字符串（必填，Excel 文件路径或 URL）
   - **响应**：类似其他打印接口
   - **第三方使用说明**：示例：
     ```
     curl -X POST http://localhost:8000/print/excel -H "Content-Type: application/json" -d '{"filePath": "/path/to/demo.xlsx"}'
     ```

9. **打印 PowerPoint 文件**
   - **方法**：POST
   - **路径**：`/print/ppt`
   - **参数**（请求体 JSON）：
     - `filePath`: 字符串（必填，PowerPoint 文件路径或 URL）
   - **响应**：类似其他打印接口
   - **第三方使用说明**：示例：
     ```
     curl -X POST http://localhost:8000/print/ppt -H "Content-Type: application/json" -d '{"filePath": "/path/to/demo.pptx"}'
     ```

10. **打印 JSX 内容**
    - **方法**：POST
    - **路径**：`/print/jsx`
    - **参数**（请求体 JSON）：
      - `jsx`: 字符串（必填，JSX 内容）
      - `initialData`: 对象（可选，初始数据）
    - **响应**：类似其他打印接口
    - **第三方使用说明**：示例：
      ```
      curl -X POST http://localhost:8000/print/jsx -H "Content-Type: application/json" -d '{"jsx": "<div>Hello</div>", "initialData": {}}'
      ```

#### 注意事项

- **错误处理**：始终检查响应中的 `success` 字段。
- **安全**：在生产环境中，添加认证和输入验证。
- **测试**：使用工具如 Postman 或 curl 测试接口。
