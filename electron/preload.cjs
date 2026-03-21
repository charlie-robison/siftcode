const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('siftcode', {
  getDirectories: () => ipcRenderer.invoke('git:getDirectories'),
  getDiffs: () => ipcRenderer.invoke('git:getDiffs'),
  getOriginal: (filePath, repoRoot) => ipcRenderer.invoke('git:getOriginal', { filePath, repoRoot }),
  applyFile: (filePath, content, repoRoot) => ipcRenderer.invoke('git:applyFile', { filePath, content, repoRoot }),
  addFolder: () => ipcRenderer.invoke('dialog:addFolder'),
  removeFolder: (dir) => ipcRenderer.invoke('git:removeFolder', dir),
  updateTitle: (title) => ipcRenderer.send('update-title', title),
});
