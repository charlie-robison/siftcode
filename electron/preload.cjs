const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('siftcode', {
  getCurrentDir: () => ipcRenderer.invoke('git:getCurrentDir'),
  getDiffs: () => ipcRenderer.invoke('git:getDiffs'),
  getOriginal: (filePath, repoRoot) => ipcRenderer.invoke('git:getOriginal', { filePath, repoRoot }),
  applyFile: (filePath, content, repoRoot) => ipcRenderer.invoke('git:applyFile', { filePath, content, repoRoot }),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  updateTitle: (dir) => ipcRenderer.send('update-title', dir),
});
