const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("codexQuota", {
  read: () => ipcRenderer.invoke("quota:read"),
  readPreferences: () => ipcRenderer.invoke("preferences:read"),
  readHistory: () => ipcRenderer.invoke("history:read"),
  clearHistory: () => ipcRenderer.invoke("history:clear"),
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
  onPreferencesUpdated: (callback) => {
    const listener = (_event, preferences) => callback(preferences);
    ipcRenderer.on("preferences:updated", listener);
    return () => ipcRenderer.removeListener("preferences:updated", listener);
  },
  onHistoryUpdated: (callback) => {
    const listener = (_event, history) => callback(history);
    ipcRenderer.on("history:updated", listener);
    return () => ipcRenderer.removeListener("history:updated", listener);
  },
});
