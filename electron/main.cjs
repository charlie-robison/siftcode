const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

let mainWindow;
let directories = []; // multiple open directories

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
    title: 'siftcode',
  });

  ipcMain.on('update-title', (_event, title) => {
    mainWindow.setTitle(title);
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  const distPath = path.join(__dirname, '..', 'dist', 'index.html');

  if (fs.existsSync(distPath) && !process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadFile(distPath);
  } else {
    mainWindow.loadURL(devUrl);
  }
}

// ── Helpers ──

function getDiffForDir(dir) {
  let diff = '';
  try {
    diff = execSync('git diff', {
      encoding: 'utf8', cwd: dir, maxBuffer: 50 * 1024 * 1024,
    });
  } catch {}

  try {
    const untracked = execSync('git ls-files --others --exclude-standard', {
      encoding: 'utf8', cwd: dir,
    }).trim();
    if (untracked) {
      for (const filePath of untracked.split('\n')) {
        try {
          const fullPath = path.resolve(dir, filePath);
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');
          diff += `\ndiff --git a/${filePath} b/${filePath}\nnew file mode 100644\n--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n`;
          diff += lines.map(l => `+${l}`).join('\n') + '\n';
        } catch {}
      }
    }
  } catch {}

  return diff;
}

// ── Git IPC Handlers ──

ipcMain.handle('git:getDirectories', () => directories);

ipcMain.handle('git:getDiffs', () => {
  const results = [];
  for (const dir of directories) {
    const diff = getDiffForDir(dir);
    if (diff.trim()) {
      results.push({
        repoRoot: dir,
        repoName: path.basename(dir),
        diff,
      });
    }
  }
  return results;
});

ipcMain.handle('git:getOriginal', (_event, { filePath, repoRoot }) => {
  try {
    return execSync(`git show HEAD:${filePath}`, {
      encoding: 'utf8', cwd: repoRoot, maxBuffer: 50 * 1024 * 1024,
    });
  } catch {
    return '';
  }
});

ipcMain.handle('git:applyFile', (_event, { filePath, content, repoRoot }) => {
  try {
    const fullPath = path.resolve(repoRoot, filePath);
    fs.writeFileSync(fullPath, content);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('dialog:addFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const dir = result.filePaths[0];
    if (!directories.includes(dir)) {
      directories.push(dir);
    }
    return dir;
  }
  return null;
});

ipcMain.handle('git:removeFolder', (_event, dir) => {
  directories = directories.filter(d => d !== dir);
  return directories;
});

// ── App Lifecycle ──

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
