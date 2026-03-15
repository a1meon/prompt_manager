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

