const { app, BrowserWindow, ipcMain, Tray, Menu } = require("electron");
const {
  default: installExtension,
  REACT_DEVELOPER_TOOLS,
} = require("electron-devtools-installer");
const path = require("path");

const {
  printHTML,
  printPdf,
  printWord,
  printExcel,
  printPPT,
  printJsx,
  startServer,
} = require("./server");

app.commandLine.appendSwitch("ignore-certificate-errors");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

const basePath =
  process.env.NODE_ENV === "development" ? __dirname : process.resourcesPath;
const iconPath = path.join(basePath, "./static/tray-icon.png");

let mainWindow = null;
let tray = null;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: iconPath,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // 👇 拦截关闭事件，隐藏窗口而不是退出
  mainWindow.on("close", (event) => {
    event.preventDefault();
    mainWindow?.hide(); // 或使用 minimize()
  });
};

function createTray() {
  tray = new Tray(iconPath); // 图标路径
  tray.setToolTip("MES打印客户端");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "显示主窗口",
      click: () => {
        mainWindow?.show();
      },
    },
    {
      label: "退出",
      click: () => {
        tray?.destroy();
        mainWindow?.destroy();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    mainWindow?.isVisible() ? mainWindow.hide() : mainWindow?.show();
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  installExtension(REACT_DEVELOPER_TOOLS)
    .then((ext) => {
      console.log(`Added Extension:  ${ext.name}`);
      console.log(
        `Tips: Please use ctrl+r to reload the page and enable react devtools`
      );
    })
    .catch((err) => console.log("An error occurred: ", err));

  createWindow();
  createTray();
  startServer();

  ipcMain.handle("print", (event, f) => {
    // print(f)
  });
  ipcMain.handle("printJsx", (event, jsx, data) => {
    printJsx(jsx, data);
  });
  ipcMain.handle("printHTML", (event, f) => {
    printHTML(f);
  });
  ipcMain.handle("printPdf", (event, f) => {
    printPdf(f);
  });
  ipcMain.handle("printWord", (event, f) => {
    printWord(f);
  });
  ipcMain.handle("printExcel", (event, f) => {
    printExcel(f);
  });
  ipcMain.handle("printPPT", (event, f) => {
    printPPT(f);
  });

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // tray?.destroy();
    // app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
