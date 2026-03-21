const vscode = require('vscode');
const { buildUnifiedDoc } = require('./parser');

class ReviewPanel {
  static currentPanel = null;

  constructor(panel, context) {
    this._panel = panel;
    this._context = context;
    this._files = [];
    this._originals = {};
    this._decisions = {};
    this._selectedFile = null;
    this._onToggle = null;
    this._onAcceptFile = null;
    this._onRejectFile = null;
    this._onAcceptAll = null;
    this._onRejectAll = null;
    this._onApply = null;

    this._panel.onDidDispose(() => {
      ReviewPanel.currentPanel = null;
    });

    this._panel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case 'toggle':
          if (this._onToggle) this._onToggle(msg.actionIndex);
          break;
        case 'acceptFile':
          if (this._onAcceptFile) this._onAcceptFile(this._selectedFile);
          break;
        case 'rejectFile':
          if (this._onRejectFile) this._onRejectFile(this._selectedFile);
          break;
        case 'acceptAll':
          if (this._onAcceptAll) this._onAcceptAll();
          break;
        case 'rejectAll':
          if (this._onRejectAll) this._onRejectAll();
          break;
        case 'apply':
          if (this._onApply) this._onApply();
          break;
        case 'selectFile':
          this.showFile(msg.filePath);
          break;
      }
    });
  }

  static createOrShow(context) {
    if (ReviewPanel.currentPanel) {
      ReviewPanel.currentPanel._panel.reveal();
      return ReviewPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'siftcodeReview',
      'siftcode — Review Changes',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    ReviewPanel.currentPanel = new ReviewPanel(panel, context);
    return ReviewPanel.currentPanel;
  }

  setCallbacks({ onToggle, onAcceptFile, onRejectFile, onAcceptAll, onRejectAll, onApply }) {
    this._onToggle = onToggle;
    this._onAcceptFile = onAcceptFile;
    this._onRejectFile = onRejectFile;
    this._onAcceptAll = onAcceptAll;
    this._onRejectAll = onRejectAll;
    this._onApply = onApply;
  }

  setData(files, originals, decisions) {
    this._files = files;
    this._originals = originals;
    this._decisions = decisions;
    // If selected file is gone (dismissed), pick the first available
    const selectedStillExists = files.some(f => f.path === this._selectedFile);
    if (files.length > 0 && !selectedStillExists) {
      this._selectedFile = files[0].path;
    }
    this._updateWebview();
  }

  updateDecisions(decisions) {
    this._decisions = decisions;
    this._panel.webview.postMessage({ type: 'updateDecisions', decisions });
  }

  showFile(filePath) {
    this._selectedFile = filePath;
    this._updateWebview();
  }

  _updateWebview() {
    const file = this._files.find(f => f.path === this._selectedFile);
    if (!file) return;

    const original = this._originals[file.path] || '';
    const { text, lineInfos } = buildUnifiedDoc(original, file.hunks);

    // Compute stats
    let accepted = 0, rejected = 0;
    for (const val of Object.values(this._decisions)) {
      if (val === 'accept') accepted++;
      else if (val === 'reject') rejected++;
    }

    this._panel.webview.html = this._getHtml(
      this._files,
      file,
      text,
      lineInfos,
      this._decisions,
      { accepted, rejected, total: accepted + rejected }
    );
  }

  _getHtml(files, currentFile, text, lineInfos, decisions, stats) {
    const lines = text.split('\n');
    const fileListHtml = files.map(f => {
      const isSelected = f.path === currentFile.path;
      const name = f.path.split('/').pop();
      const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '';
      return `<div class="file-item ${isSelected ? 'selected' : ''}" onclick="selectFile('${this._escapeHtml(f.path)}')">
        <span class="file-name">${this._escapeHtml(name)}</span>
        ${dir ? `<span class="file-dir">${this._escapeHtml(dir)}</span>` : ''}
      </div>`;
    }).join('');

    const linesHtml = lines.map((line, i) => {
      const info = lineInfos[i];
      if (!info || info.type === 'context') {
        return `<div class="line context"><span class="line-num">${i + 1}</span><span class="line-content">${this._escapeHtml(line)}</span></div>`;
      }
      const isAccepted = decisions[info.actionIndex] === 'accept';
      const cls = info.type === 'deletion'
        ? (isAccepted ? 'del-accepted' : 'del-rejected')
        : (isAccepted ? 'add-accepted' : 'add-rejected');
      const icon = isAccepted ? '✓' : '✗';
      const iconCls = isAccepted ? 'icon-accept' : 'icon-reject';

      return `<div class="line ${cls}">
        <span class="line-gutter" onclick="toggle(${info.actionIndex})"><span class="${iconCls}">${icon}</span></span>
        <span class="line-num">${i + 1}</span>
        <span class="line-prefix">${info.type === 'deletion' ? '-' : '+'}</span>
        <span class="line-content">${this._escapeHtml(line)}</span>
      </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: var(--vscode-editor-font-family, 'Menlo', monospace);
    font-size: var(--vscode-editor-font-size, 13px);
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    display: flex;
    height: 100vh;
    overflow: hidden;
  }

  /* Sidebar */
  .sidebar {
    width: 200px;
    min-width: 160px;
    background: var(--vscode-sideBar-background);
    border-right: 1px solid var(--vscode-sideBar-border, #333);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  .sidebar-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--vscode-sideBarSectionHeader-foreground);
    padding: 10px 10px 6px;
    font-weight: 600;
    background: var(--vscode-sideBarSectionHeader-background);
  }
  .file-item {
    padding: 5px 10px;
    cursor: pointer;
    font-size: 12px;
    border-left: 3px solid transparent;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .file-item:hover { background: var(--vscode-list-hoverBackground); }
  .file-item.selected {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
    border-left-color: var(--vscode-focusBorder);
  }
  .file-name { font-weight: 500; }
  .file-dir { font-size: 10px; opacity: 0.6; }

  /* Main area */
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Editor */
  .editor {
    flex: 1;
    overflow: auto;
    padding: 4px 0;
  }

  .line {
    display: flex;
    align-items: stretch;
    min-height: 20px;
    line-height: 20px;
    white-space: pre;
  }
  .line-gutter {
    width: 28px;
    min-width: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    user-select: none;
    font-size: 12px;
  }
  .line-gutter:hover { background: var(--vscode-toolbar-hoverBackground); }
  .line-num {
    width: 44px;
    min-width: 44px;
    text-align: right;
    padding-right: 8px;
    color: var(--vscode-editorLineNumber-foreground);
    font-size: 11px;
    user-select: none;
  }
  .line-prefix {
    width: 16px;
    min-width: 16px;
    text-align: center;
    font-weight: bold;
    user-select: none;
  }
  .line-content {
    flex: 1;
    padding-right: 16px;
  }

  .icon-accept { color: #4caf50; font-weight: bold; }
  .icon-reject { color: #f44336; font-weight: bold; }

  /* Line colors */
  .del-accepted {
    background: rgba(255, 0, 0, 0.12);
    text-decoration: line-through;
    opacity: 0.65;
  }
  .del-accepted .line-prefix { color: #f44336; }

  .del-rejected {
    background: rgba(100, 100, 100, 0.08);
  }
  .del-rejected .line-prefix { color: #888; }

  .add-accepted {
    background: rgba(0, 255, 0, 0.12);
  }
  .add-accepted .line-prefix { color: #4caf50; }

  .add-rejected {
    background: rgba(100, 100, 100, 0.08);
    text-decoration: line-through;
    opacity: 0.5;
  }
  .add-rejected .line-prefix { color: #888; }

  .context .line-gutter { width: 28px; min-width: 28px; }

  /* Toolbar */
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: var(--vscode-panel-background, var(--vscode-sideBar-background));
    border-top: 1px solid var(--vscode-panel-border, #333);
  }
  .toolbar-left, .toolbar-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .toolbar-stats {
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    margin-right: 8px;
  }
  .stat-accepted { color: #4caf50; }
  .stat-rejected { color: #f44336; }

  .btn {
    padding: 4px 12px;
    font-size: 12px;
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 3px;
    cursor: pointer;
    font-family: inherit;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  .btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
  .btn-accept { color: #4caf50; }
  .btn-reject { color: #f44336; }
  .btn-primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }
  .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
</style>
</head>
<body>
  <div class="sidebar">
    <div class="sidebar-title">Files (${files.length})</div>
    ${fileListHtml}
  </div>
  <div class="main">
    <div class="editor">${linesHtml}</div>
    <div class="toolbar">
      <div class="toolbar-left">
        <button class="btn btn-accept" onclick="send('acceptFile')">✓ Accept & Done</button>
        <button class="btn btn-reject" onclick="send('rejectFile')">✕ Reject & Done</button>
        <span style="color:var(--vscode-panel-border);margin:0 2px;">|</span>
        <button class="btn btn-accept" onclick="send('acceptAll')">Accept All</button>
        <button class="btn btn-reject" onclick="send('rejectAll')">Reject All</button>
      </div>
      <div class="toolbar-right">
        <div class="toolbar-stats">
          <span class="stat-accepted">${stats.accepted} accepted</span> /
          <span class="stat-rejected">${stats.rejected} rejected</span> /
          ${stats.total} total
        </div>
        <button class="btn btn-primary" onclick="send('apply')">Apply Changes</button>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function toggle(actionIndex) { vscode.postMessage({ type: 'toggle', actionIndex }); }
    function send(type) { vscode.postMessage({ type }); }
    function selectFile(path) { vscode.postMessage({ type: 'selectFile', filePath: path }); }
  </script>
</body>
</html>`;
  }

  _escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

module.exports = { ReviewPanel };
