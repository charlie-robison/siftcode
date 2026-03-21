const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { FileTreeProvider } = require('./src/fileTree');
const { ReviewPanel } = require('./src/reviewPanel');
const { getDiff, getOriginalContent } = require('./src/gitOps');
const { parseDiff, reconstructFile } = require('./src/parser');

function activate(context) {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showWarningMessage('siftcode: Open a workspace folder first.');
    return;
  }

  // State
  let files = [];
  let decisions = {};
  let originals = {};
  let totalActions = 0;
  let dismissedFiles = new Set();

  // Tree view
  const treeProvider = new FileTreeProvider();
  vscode.window.registerTreeDataProvider('siftcode-files', treeProvider);

  function loadDiff() {
    const raw = getDiff(workspaceRoot);
    if (!raw.trim()) {
      files = [];
      decisions = {};
      originals = {};
      totalActions = 0;
      dismissedFiles = new Set();
      treeProvider.setFiles([], {});
      return false;
    }

    const result = parseDiff(raw);
    files = result.files;
    totalActions = result.totalActions;
    dismissedFiles = new Set();

    decisions = {};
    for (let i = 0; i < totalActions; i++) {
      decisions[i] = 'accept';
    }

    originals = {};
    for (const file of files) {
      originals[file.path] = getOriginalContent(file.path, workspaceRoot);
    }

    treeProvider.setFiles(files, decisions);
    return true;
  }

  function updatePanel() {
    if (!ReviewPanel.currentPanel) return;
    const visibleFiles = files.filter(f => !dismissedFiles.has(f.path));
    ReviewPanel.currentPanel.setData(visibleFiles, originals, decisions);
  }

  function showReview() {
    const visibleFiles = files.filter(f => !dismissedFiles.has(f.path));
    if (visibleFiles.length === 0) {
      vscode.window.showInformationMessage('siftcode: No changes to review.');
      return;
    }

    const panel = ReviewPanel.createOrShow(context);
    panel.setData(visibleFiles, originals, decisions);

    panel.setCallbacks({
      onToggle: (actionIndex) => {
        decisions[actionIndex] = decisions[actionIndex] === 'accept' ? 'reject' : 'accept';
        treeProvider.setFiles(files, decisions);
        updatePanel();
      },
      onAcceptFile: (filePath) => {
        const targetFile = files.find(f => f.path === filePath);
        if (!targetFile) return;
        for (const hunk of targetFile.hunks) {
          for (const line of hunk.lines) {
            if (line.actionIndex !== undefined) decisions[line.actionIndex] = 'accept';
          }
        }
        dismissedFiles.add(targetFile.path);
        treeProvider.setFiles(files, decisions);
        updatePanel();
      },
      onRejectFile: (filePath) => {
        const targetFile = files.find(f => f.path === filePath);
        if (!targetFile) return;
        for (const hunk of targetFile.hunks) {
          for (const line of hunk.lines) {
            if (line.actionIndex !== undefined) decisions[line.actionIndex] = 'reject';
          }
        }
        dismissedFiles.add(targetFile.path);
        treeProvider.setFiles(files, decisions);
        updatePanel();
      },
      onAcceptAll: () => {
        for (const key of Object.keys(decisions)) decisions[key] = 'accept';
        treeProvider.setFiles(files, decisions);
        updatePanel();
      },
      onRejectAll: () => {
        for (const key of Object.keys(decisions)) decisions[key] = 'reject';
        treeProvider.setFiles(files, decisions);
        updatePanel();
      },
      onApply: async () => {
        for (const file of files) {
          const original = originals[file.path];
          const content = reconstructFile(original, file.hunks, decisions);
          const fullPath = path.join(workspaceRoot, file.path);
          fs.writeFileSync(fullPath, content);
        }

        // Compute summary
        let accepted = 0, rejected = 0;
        for (const val of Object.values(decisions)) {
          if (val === 'accept') accepted++;
          else rejected++;
        }

        vscode.window.showInformationMessage(
          `siftcode: Applied ${accepted} accepted, ${rejected} rejected across ${files.length} file(s).`
        );

        // Reload
        loadDiff();
        updatePanel();
      },
    });
  }

  function getCurrentPanelFile() {
    if (!ReviewPanel.currentPanel) return null;
    const selectedPath = ReviewPanel.currentPanel._selectedFile;
    return files.find(f => f.path === selectedPath) || null;
  }

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('siftcode.startReview', () => {
      if (loadDiff()) {
        showReview();
      } else {
        vscode.window.showInformationMessage('siftcode: No changes to review.');
      }
    }),

    vscode.commands.registerCommand('siftcode.refresh', () => {
      loadDiff();
      updatePanel();
      vscode.window.showInformationMessage('siftcode: Refreshed.');
    }),

    vscode.commands.registerCommand('siftcode.acceptAll', () => {
      for (const key of Object.keys(decisions)) decisions[key] = 'accept';
      treeProvider.setFiles(files, decisions);
      updatePanel();
    }),

    vscode.commands.registerCommand('siftcode.rejectAll', () => {
      for (const key of Object.keys(decisions)) decisions[key] = 'reject';
      treeProvider.setFiles(files, decisions);
      updatePanel();
    }),

    vscode.commands.registerCommand('siftcode.apply', async () => {
      if (files.length === 0) {
        vscode.window.showWarningMessage('siftcode: No changes loaded. Run "siftcode: Review Changes" first.');
        return;
      }
      for (const file of files) {
        const original = originals[file.path];
        const content = reconstructFile(original, file.hunks, decisions);
        const fullPath = path.join(workspaceRoot, file.path);
        fs.writeFileSync(fullPath, content);
      }
      vscode.window.showInformationMessage('siftcode: Changes applied.');
      loadDiff();
      updatePanel();
    }),

    vscode.commands.registerCommand('siftcode.openFile', (filePath) => {
      if (ReviewPanel.currentPanel) {
        ReviewPanel.currentPanel.showFile(filePath);
      } else {
        showReview();
        if (ReviewPanel.currentPanel) {
          ReviewPanel.currentPanel.showFile(filePath);
        }
      }
    })
  );

  // Auto-load on activation
  loadDiff();
}

function deactivate() {}

module.exports = { activate, deactivate };
