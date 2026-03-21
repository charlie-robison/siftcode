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

  ipcMain.on('update-title', (_event, dir) => {
    mainWindow.setTitle(`siftcode — ${dir}`);
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

function findGitRepos(dir) {
  const repos = [];

  // Check if dir itself is a git repo
  try {
    const root = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf8', cwd: dir, stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    repos.push(root);
  } catch {
    // Not a git repo — scan one level deep for repos
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const subdir = path.join(dir, entry.name);
        try {
          const root = execSync('git rev-parse --show-toplevel', {
            encoding: 'utf8', cwd: subdir, stdio: ['pipe', 'pipe', 'pipe'],
          }).trim();
          if (!repos.includes(root)) repos.push(root);
        } catch {}
      }
    } catch {}
  }

  return repos;
}

function getDiffForRepo(repoRoot) {
  let diff = '';
  try {
    diff = execSync('git diff', {
      encoding: 'utf8', cwd: repoRoot, maxBuffer: 50 * 1024 * 1024,
    });
  } catch {}

  // Include untracked files
  try {
    const untracked = execSync('git ls-files --others --exclude-standard', {
      encoding: 'utf8', cwd: repoRoot,
    }).trim();
    if (untracked) {
      for (const filePath of untracked.split('\n')) {
        try {
          const fullPath = path.resolve(repoRoot, filePath);
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

ipcMain.handle('git:getCurrentDir', () => currentDir);

ipcMain.handle('git:getDiffs', () => {
  const repos = findGitRepos(currentDir);
  const results = [];

  for (const repoRoot of repos) {
    const diff = getDiffForRepo(repoRoot);
    if (diff.trim()) {
      results.push({
        repoRoot,
        repoName: path.basename(repoRoot),
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
