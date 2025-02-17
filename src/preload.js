// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  print: (f) => ipcRenderer.invoke("print", f),
  printHTML: (f) => ipcRenderer.invoke("printHTML", f),
  printPdf: (f) => ipcRenderer.invoke("printPdf", f),
  printWord: (f) => ipcRenderer.invoke("printWord", f),
  printExcel: (f) => ipcRenderer.invoke("printExcel", f),
  printPPT: (f) => ipcRenderer.invoke("printPPT", f),
  printJsx: (jsx, data) => ipcRenderer.invoke("printJsx", jsx, data),
  // we can also expose variables, not just functions
});
