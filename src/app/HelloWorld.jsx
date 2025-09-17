import * as React from "react";
import * as printUtils from "./utils/print";
import { message } from "antd";

function HelloWorld() {
  const [messageApi, contextHolder] = message.useMessage();

  const showSuccessTip = () => {
    messageApi.open({
      type: "success",
      content: "正在打印中",
    });
  };

  const htmlContent = `
    <html>
      <head>
        <title>Sample PDF</title>
      </head>
      <body>
        <h1>Hello, World!</h1>
        <p>This is a sample PDF generated from HTML.</p>
      </body>
    </html>
  `;

  function printFrag() {
    showSuccessTip();
    const jsx = `<h1 className="text-center text-red-600">Hello, I'm {data.name}</h1>`;
    const data = { name: "KangKang" };
    printUtils.printJsx(jsx, data);
  }

  function printHtml() {
    showSuccessTip();
    printUtils.printHTML(htmlContent);
  }

  function printPdf() {
    showSuccessTip();
    printUtils.printPdf(
      "E:/reactprj/el-print-webpack/src/static/demo/demo.pdf"
    );
  }

  function printWord() {
    showSuccessTip();
    printUtils.printWord(
      "E:/reactprj/el-print-webpack/src/static/demo/demo.docx"
    );
  }

  function printExcel() {
    showSuccessTip();
    printUtils.printExcel(
      "E:/reactprj/el-print-webpack/src/static/demo/demo.xlsx"
    );
  }

  function printPpt() {
    showSuccessTip();
    printUtils.printPPT(
      "E:/reactprj/el-print-webpack/src/static/demo/demo.pptx"
    );
  }

  return (
    <div className="h-screen  h-full relative bg-gray-100">
      {contextHolder}

      <div className="relative p-10 bg-white shadow-lg">
        {/* 应用默认配置信息 */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg border">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            应用默认配置
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-medium text-gray-600">端口:</span>
              <span className="text-gray-800">8000</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-600">
                默认 Office 目录:
              </span>
              <span className="text-gray-800 break-all">
                C:/Program Files/Microsoft Office/root/Office16/
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-600">
                默认 Chrome 路径:
              </span>
              <span className="text-gray-800 break-all">
                C:/Program Files/Google/Chrome/Application/chrome.exe
              </span>
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          客户端打印测试:
        </h1>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <button
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition duration-300"
            onClick={printFrag}
          >
            Print React Fragment
          </button>

          <button
            className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition duration-300"
            onClick={printHtml}
          >
            Print HTML
          </button>

          <button
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition duration-300"
            onClick={printPdf}
          >
            Print PDF
          </button>

          <button
            className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded transition duration-300"
            onClick={printWord}
          >
            Print Word
          </button>

          <button
            className="bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition duration-300"
            onClick={printExcel}
          >
            Print Excel
          </button>

          <button
            className="bg-pink-500 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded transition duration-300"
            onClick={printPpt}
          >
            Print PPT
          </button>
        </div>
      </div>
    </div>
  );
}

export default HelloWorld;
