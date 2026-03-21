const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('siftcode', {
  getCurrentDir: () => ipcRenderer.invoke('git:getCurrentDir'),
  getRepoRoot: () => ipcRenderer.invoke('git:getRepoRoot'),
  getDiff: (options) => ipcRenderer.invoke('git:getDiff', options || {}),
  getOriginal: (filePath) => ipcRenderer.invoke('git:getOriginal', filePath),
  applyFile: (filePath, content) => ipcRenderer.invoke('git:applyFile', { filePath, content }),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  updateTitle: (dir) => ipcRenderer.send('update-title', dir),
});
