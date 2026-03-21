const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

let mainWindow;
let currentDir = process.cwd();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#1e1e1e',
    title: `siftcode — ${currentDir}`,
  });

  // Update title when dir changes
  ipcMain.on('update-title', (_event, dir) => {
    mainWindow.setTitle(`siftcode — ${dir}`);
  });

  // Dev: load Vite server. Prod: load built files.
  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  const distPath = path.join(__dirname, '..', 'dist', 'index.html');

  if (fs.existsSync(distPath) && !process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadFile(distPath);
  } else {
    mainWindow.loadURL(devUrl);
  }

}

// ── Git IPC Handlers ──

ipcMain.handle('git:getCurrentDir', () => currentDir);

ipcMain.handle('git:getRepoRoot', () => {
  try {
    return execSync('git rev-parse --show-toplevel', {
      encoding: 'utf8',
      cwd: currentDir,
    }).trim();
  } catch {
    return null;
  }
});

ipcMain.handle('git:getDiff', (_event, options = {}) => {
  try {
    const args = options.staged ? '--cached' : '';
    let diff = execSync(`git diff ${args}`, {
      encoding: 'utf8',
      cwd: currentDir,
      maxBuffer: 50 * 1024 * 1024,
    });

    // Also include untracked files as synthetic diffs
    try {
      const untracked = execSync('git ls-files --others --exclude-standard', {
        encoding: 'utf8',
        cwd: currentDir,
      }).trim();
      if (untracked) {
        for (const filePath of untracked.split('\n')) {
          try {
            const fullPath = path.resolve(currentDir, filePath);
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            diff += `\ndiff --git a/${filePath} b/${filePath}\nnew file mode 100644\n--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n`;
            diff += lines.map(l => `+${l}`).join('\n') + '\n';
          } catch {}
        }
      }
    } catch {}

    return diff;
  } catch {
    return '';
  }
});

ipcMain.handle('git:getOriginal', (_event, filePath) => {
  try {
    return execSync(`git show HEAD:${filePath}`, {
      encoding: 'utf8',
      cwd: currentDir,
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch {
    return '';
  }
});

ipcMain.handle('git:applyFile', (_event, { filePath, content }) => {
  try {
    const fullPath = path.resolve(currentDir, filePath);
    fs.writeFileSync(fullPath, content);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    currentDir = result.filePaths[0];
    return currentDir;
  }
  return null;
});

// ── App Lifecycle ──

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
