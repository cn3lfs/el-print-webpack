import * as React from "react";

import * as printUtils from "./utils/print";

function HelloWorld() {
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
    const jsx = `<h1 className="text-center text-red-600">Hello, I'm {data.name}</h1>`;
    const data = { name: "KangKang" };
    printUtils.printJsx(jsx, data);
  }

  return (
    <div>
      <h1>Hello World</h1>

      <div>
        <button
          onClick={() => {
            printFrag();
          }}
        >
          打印React片段
        </button>
        <button
          onClick={() => {
            printUtils.printHTML(htmlContent);
          }}
        >
          打印HTML
        </button>
        <button
          onClick={() => {
            printUtils.printPdf(
              "E:/reactprj/el-print-webpack/src/static/demo/demo.pdf"
            );
          }}
        >
          打印Pdf
        </button>

        <button
          onClick={() => {
            printUtils.printWord(
              "E:/reactprj/el-print-webpack/src/static/demo/demo.docx"
            );
          }}
        >
          打印Word
        </button>

        <button
          onClick={() => {
            printUtils.printExcel(
              "E:/reactprj/el-print-webpack/src/static/demo/demo.xlsx"
            );
          }}
        >
          打印Excel
        </button>

        <button
          onClick={() => {
            printUtils.printPPT(
              "E:/reactprj/el-print-webpack/src/static/demo/demo.pptx"
            );
          }}
        >
          打印PPT
        </button>
      </div>
    </div>
  );
}

export default HelloWorld;
