const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("codexQuota", {
  read: () => ipcRenderer.invoke("quota:read"),
  showMenu: () => ipcRenderer.invoke("widget:menu"),
  onRefresh: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("quota:refresh", listener);
    return () => ipcRenderer.removeListener("quota:refresh", listener);
  },
  onUpdated: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on("quota:updated", listener);
    return () => ipcRenderer.removeListener("quota:updated", listener);
  },
});
