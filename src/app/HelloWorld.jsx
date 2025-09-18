import * as React from "react";
import * as printUtils from "./utils/print";
import { message } from "antd";

function HelloWorld() {
  const [messageApi, contextHolder] = message.useMessage();
  const [configInfo, setConfigInfo] = React.useState(null);
  const [configError, setConfigError] = React.useState(null);
  const [configLoading, setConfigLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      try {
        const response = await fetch("http://localhost:8000/config");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (!cancelled) {
          setConfigInfo(payload.data || payload);
          setConfigLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setConfigError(error.message);
          setConfigLoading(false);
        }
      }
    };

    loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  const prettyConfig = React.useMemo(() => {
    return JSON.stringify(configInfo?.config ?? {}, null, 2);
  }, [configInfo]);

  const demoPaths = configInfo?.resolved?.demo || null;

  const showSuccessTip = React.useCallback(
    (content = "正在打印...") => {
      messageApi.open({
        type: "success",
        content,
      });
    },
    [messageApi]
  );

  const ensureDemoReady = React.useCallback(() => {
    if (configLoading) {
      messageApi.open({
        type: "info",
        content: "配置加载中，请稍后再试",
      });
      return false;
    }

    if (configError) {
      messageApi.open({
        type: "error",
        content: `配置加载失败：${configError}`,
      });
      return false;
    }

    if (
      !demoPaths ||
      !demoPaths.pdf ||
      !demoPaths.word ||
      !demoPaths.excel ||
      !demoPaths.ppt
    ) {
      messageApi.open({
        type: "error",
        content: "未能解析演示文件目录，请检查配置",
      });
      return false;
    }

    return true;
  }, [configLoading, configError, demoPaths, messageApi]);

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
    if (!ensureDemoReady()) {
      return;
    }
    showSuccessTip();
    printUtils.printPdf(demoPaths.pdf);
  }

  function printWord() {
    if (!ensureDemoReady()) {
      return;
    }
    showSuccessTip();
    printUtils.printWord(demoPaths.word);
  }

  function printExcel() {
    if (!ensureDemoReady()) {
      return;
    }
    showSuccessTip();
    printUtils.printExcel(demoPaths.excel);
  }

  function printPpt() {
    if (!ensureDemoReady()) {
      return;
    }
    showSuccessTip();
    printUtils.printPPT(demoPaths.ppt);
  }

  const resolvedPaths = configInfo?.resolved ?? {};
  const resolvedOffice = resolvedPaths.office ?? {};

  return (
    <div className="h-screen  h-full relative bg-gray-100">
      {contextHolder}

      <div className="relative p-10 bg-white shadow-lg">
        {/* 应用配置信息 */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg border">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">应用配置</h2>
          <div className="space-y-2 text-sm">
            {configLoading ? (
              <span className="text-gray-600">正在加载配置...</span>
            ) : configError ? (
              <span className="text-red-600 break-all">
                读取配置失败：{configError}
              </span>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">
                    配置文件路径:
                  </span>
                  <span className="text-gray-800 break-all text-right">
                    {configInfo?.configPath || "默认路径 (config.json)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">
                    配置文件检测:
                  </span>
                  <span className="text-gray-800">
                    {configInfo?.configFileExists
                      ? "已加载"
                      : "未找到，使用默认"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">运行平台:</span>
                  <span className="text-gray-800">{configInfo?.platform}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">
                    Word 可执行程序:
                  </span>
                  <span className="text-gray-800 break-all text-right">
                    {resolvedOffice.word || "未检测"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">
                    Excel 可执行程序:
                  </span>
                  <span className="text-gray-800 break-all text-right">
                    {resolvedOffice.excel || "未检测"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">
                    PowerPoint 可执行程序:
                  </span>
                  <span className="text-gray-800 break-all text-right">
                    {resolvedOffice.ppt || "未检测"}
                  </span>
                </div>
                {demoPaths?.baseDir ? (
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">
                      演示文件目录:
                    </span>
                    <span className="text-gray-800 break-all text-right">
                      {demoPaths.baseDir}
                    </span>
                  </div>
                ) : null}
                {resolvedPaths.logFile ? (
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">
                      main.log 路径:
                    </span>
                    <span className="text-gray-800 break-all text-right">
                      {resolvedPaths.logFile}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">
                    生效的 Chromium 路径:
                  </span>
                  <span className="text-gray-800 break-all text-right">
                    {resolvedPaths.chromiumExecutablePath || "未检测"}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-600 block mb-1">
                    配置文件内容:
                  </span>
                  <pre className="bg-white border rounded p-2 text-xs text-gray-800 whitespace-pre-wrap break-words">
                    {prettyConfig}
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          客户端打印功能演示:
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
