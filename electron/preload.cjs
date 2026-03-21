const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('siftcode', {
  getCurrentDir: () => ipcRenderer.invoke('git:getCurrentDir'),
  getDiff: () => ipcRenderer.invoke('git:getDiff'),
  getOriginal: (filePath) => ipcRenderer.invoke('git:getOriginal', filePath),
  applyFile: (filePath, content) => ipcRenderer.invoke('git:applyFile', { filePath, content }),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  updateTitle: (dir) => ipcRenderer.send('update-title', dir),
});
