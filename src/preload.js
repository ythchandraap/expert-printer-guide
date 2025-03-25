const { contextBridge, ipcRenderer } = require("electron");

// Mengekspos API yang bisa digunakan di frontend (renderer)
contextBridge.exposeInMainWorld("electron", {
  sendMessage: (channel, data) => {
    ipcRenderer.send(channel, data);
  },
  receiveMessage: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  },
  getIPAddress: () => ipcRenderer.invoke("get-ip"),
});
contextBridge.exposeInMainWorld("electronAPI", {
  getIPAddress: () => ipcRenderer.invoke("get-ip"),
  getListPrinter: () => ipcRenderer.invoke("list-printer"),
  OS: () => ipcRenderer.invoke("operating-system"),
  printFromViewer: () => ipcRenderer.invoke("print-from-viewer"),
  printPDF: (filePath, printerName) =>
    ipcRenderer.invoke("print-pdf", filePath, printerName),
});

// contextBridge.exposeInMainWorld("electronAPI", {
//   getMACAddress: () => ipcRenderer.invoke("get-mac"),
// });
// contextBridge.exposeInMainWorld("api", api);
