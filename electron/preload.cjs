const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appWindow', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizedChanged: (listener) => {
    if (typeof listener !== 'function') return () => {};
    const handler = (_event, value) => listener(Boolean(value));
    ipcRenderer.on('window:maximizedChanged', handler);
    return () => {
      ipcRenderer.removeListener('window:maximizedChanged', handler);
    };
  }
});

contextBridge.exposeInMainWorld('appUpdate', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  quitAndInstall: () => ipcRenderer.invoke('update:quitAndInstall'),
  onDownloadProgress: (listener) => {
    if (typeof listener !== 'function') return () => {};
    const handler = (_event, info) => listener(info || {});
    ipcRenderer.on('update:downloadProgress', handler);
    return () => {
      ipcRenderer.removeListener('update:downloadProgress', handler);
    };
  }
});
