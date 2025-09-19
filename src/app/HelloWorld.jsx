import * as React from "react";
import * as printUtils from "./utils/print";
import { message } from "antd";

function HelloWorld() {
  const [messageApi, contextHolder] = message.useMessage();
  const [configInfo, setConfigInfo] = React.useState(null);
  const [configError, setConfigError] = React.useState(null);
  const [configLoading, setConfigLoading] = React.useState(true);
  const [updatingKey, setUpdatingKey] = React.useState(null);
  const cancelRef = React.useRef(false);
  const wordInputRef = React.useRef(null);
  const excelInputRef = React.useRef(null);
  const pptInputRef = React.useRef(null);
  const chromiumInputRef = React.useRef(null);

  const configKeyMap = React.useMemo(
    () => ({
      word: "office.word.win32",
      excel: "office.excel.win32",
      ppt: "office.ppt.win32",
      chromium: "chromium.executablePath",
    }),
    []
  );

  const loadConfig = React.useCallback(async () => {
    setConfigLoading(true);
    setConfigError(null);

    try {
      const response = await fetch("http://localhost:8000/config");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      if (!cancelRef.current) {
        setConfigInfo(payload.data || payload);
      }
    } catch (error) {
      if (!cancelRef.current) {
        setConfigInfo(null);
        setConfigError(error.message);
      }
    } finally {
      if (!cancelRef.current) {
        setConfigLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    cancelRef.current = false;
    loadConfig();

    return () => {
      cancelRef.current = true;
    };
  }, [loadConfig]);

  const prettyConfig = React.useMemo(() => {
    return JSON.stringify(configInfo?.config ?? {}, null, 2);
  }, [configInfo]);

  const demoPaths = configInfo?.resolved?.demo || null;

  const resolvedPaths = configInfo?.resolved ?? {};
  const resolvedOffice = resolvedPaths.office ?? {};
  const platform = configInfo?.platform || "win32";

  const fileDialogOptions = React.useMemo(() => {
    const isWindows = platform === "win32";
    const isMac = platform === "darwin";
    const extensions = isWindows ? ["exe"] : isMac ? ["app"] : ["*"];

    const buildOptions = (title, defaultPath) => ({
      properties: ["openFile"],
      title,
      filters: [
        {
          name: "Executable Files",
          extensions,
        },
      ],
      ...(defaultPath ? { defaultPath } : {}),
    });

    return {
      word: buildOptions("Select Word executable", resolvedOffice.word),
      excel: buildOptions("Select Excel executable", resolvedOffice.excel),
      ppt: buildOptions("Select PowerPoint executable", resolvedOffice.ppt),
      chromium: buildOptions(
        "Select Chromium executable",
        resolvedPaths.chromiumExecutablePath
      ),
    };
  }, [platform, resolvedOffice, resolvedPaths]);

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

  const updateConfigValue = React.useCallback(
    async (key, filePath) => {
      const configKey = configKeyMap[key];
      if (!configKey) {
        messageApi.open({
          type: "error",
          content: "未知的配置项",
        });
        return;
      }

      try {
        setUpdatingKey(key);
        const response = await fetch("http://localhost:8000/setConfig", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ key: configKey, value: filePath }),
        });

        let payload = null;
        try {
          payload = await response.json();
        } catch (error) {
          payload = null;
        }

        if (!response.ok || payload?.success === false) {
          const errorMessage = payload?.error || `HTTP ${response.status}`;
          throw new Error(errorMessage);
        }

        messageApi.open({
          type: "success",
          content: "配置已更新",
        });

        await loadConfig();
      } catch (error) {
        messageApi.open({
          type: "error",
          content: `更新配置失败：${error.message}`,
        });
      } finally {
        setUpdatingKey(null);
      }
    },
    [configKeyMap, loadConfig, messageApi]
  );

  const handleFileSelection = React.useCallback(
    async (event, key) => {
      const fileList = event.target.files;
      const file = fileList && fileList[0];

      if (!file) {
        return;
      }

      let filePath = file.path || file.webkitRelativePath || file.name;

      if (
        typeof filePath === "string" &&
        filePath.toLowerCase().startsWith("c:\\fakepath\\")
      ) {
        filePath = null;
      }

      if (!filePath) {
        messageApi.open({
          type: "error",
          content: "Unable to read the selected file path.",
        });
        return;
      }

      event.target.value = "";
      await updateConfigValue(key, filePath);
    },
    [messageApi, updateConfigValue]
  );

  const handleManualConfigClick = React.useCallback(
    async (key) => {
      const selectFile = window?.electronAPI?.selectFile;

      if (typeof selectFile === "function") {
        try {
          const options = fileDialogOptions[key] || fileDialogOptions.chromium;
          const result = await selectFile(options);
          const selectedPath =
            result && !result.canceled && Array.isArray(result.filePaths)
              ? result.filePaths[0]
              : null;

          if (selectedPath) {
            await updateConfigValue(key, selectedPath);
            return;
          }

          if (result && result.canceled) {
            return;
          }
        } catch (error) {
          messageApi.open({
            type: "error",
            content: `Failed to select file: ${error.message}`,
          });
          return;
        }
      }

      const refMap = {
        word: wordInputRef,
        excel: excelInputRef,
        ppt: pptInputRef,
        chromium: chromiumInputRef,
      };
      const targetInput = refMap[key]?.current;
      if (targetInput) {
        targetInput.value = "";
        targetInput.click();
      }
    },
    [fileDialogOptions, messageApi, updateConfigValue]
  );

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
  function printWordPowershell() {
    if (!ensureDemoReady()) {
      return;
    }
    showSuccessTip();
    printUtils.printOfficeDocument(demoPaths.word);
  }

  function printExcelPowershell() {
    if (!ensureDemoReady()) {
      return;
    }
    showSuccessTip();
    printUtils.printOfficeDocument(demoPaths.excel);
  }

  function printPptPowershell() {
    if (!ensureDemoReady()) {
      return;
    }
    showSuccessTip();
    printUtils.printOfficeDocument(demoPaths.ppt);
  }

  return (
    <div className="h-screen  h-full relative bg-gray-100">
      {contextHolder}

      <input
        ref={wordInputRef}
        type="file"
        accept=".exe,.EXE,.app,.APP"
        className="hidden"
        onChange={(event) => handleFileSelection(event, "word")}
      />
      <input
        ref={excelInputRef}
        type="file"
        accept=".exe,.EXE,.app,.APP"
        className="hidden"
        onChange={(event) => handleFileSelection(event, "excel")}
      />
      <input
        ref={pptInputRef}
        type="file"
        accept=".exe,.EXE,.app,.APP"
        className="hidden"
        onChange={(event) => handleFileSelection(event, "ppt")}
      />
      <input
        ref={chromiumInputRef}
        type="file"
        accept=".exe,.EXE,.app,.APP"
        className="hidden"
        onChange={(event) => handleFileSelection(event, "chromium")}
      />

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
                  <span
                    className={
                      configInfo?.configFileExists
                        ? "text-gray-800"
                        : "text-red-800"
                    }
                  >
                    {configInfo?.configFileExists
                      ? "已加载"
                      : "未找到，使用默认"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">运行平台:</span>
                  <span className="text-gray-800">{configInfo?.platform}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-gray-600">
                    Word 可执行程序:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-800 break-all text-right">
                      {resolvedOffice.word || "未检测"}
                    </span>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs text-blue-600 border border-blue-400 rounded hover:bg-blue-50 disabled:opacity-50"
                      onClick={() => handleManualConfigClick("word")}
                      disabled={updatingKey === "word"}
                    >
                      {updatingKey === "word" ? "更新中..." : "手动设置"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-gray-600">
                    Excel 可执行程序:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-800 break-all text-right">
                      {resolvedOffice.excel || "未检测"}
                    </span>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs text-blue-600 border border-blue-400 rounded hover:bg-blue-50 disabled:opacity-50"
                      onClick={() => handleManualConfigClick("excel")}
                      disabled={updatingKey === "excel"}
                    >
                      {updatingKey === "excel" ? "更新中..." : "手动设置"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-gray-600">
                    PowerPoint 可执行程序:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-800 break-all text-right">
                      {resolvedOffice.ppt || "未检测"}
                    </span>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs text-blue-600 border border-blue-400 rounded hover:bg-blue-50 disabled:opacity-50"
                      onClick={() => handleManualConfigClick("ppt")}
                      disabled={updatingKey === "ppt"}
                    >
                      {updatingKey === "ppt" ? "更新中..." : "手动设置"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-gray-600">
                    生效的 Chromium 路径:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-800 break-all text-right">
                      {resolvedPaths.chromiumExecutablePath || "未检测"}
                    </span>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs text-blue-600 border border-blue-400 rounded hover:bg-blue-50 disabled:opacity-50"
                      onClick={() => handleManualConfigClick("chromium")}
                      disabled={updatingKey === "chromium"}
                    >
                      {updatingKey === "chromium" ? "更新中..." : "手动设置"}
                    </button>
                  </div>
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

          <button
            className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded transition duration-300"
            onClick={printWordPowershell}
          >
            Print Word Powershell
          </button>

          <button
            className="bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition duration-300"
            onClick={printExcelPowershell}
          >
            Print Excel Powershell
          </button>

          <button
            className="bg-pink-500 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded transition duration-300"
            onClick={printPptPowershell}
          >
            Print PPT Powershell
          </button>
        </div>
      </div>
    </div>
  );
}

export default HelloWorld;
