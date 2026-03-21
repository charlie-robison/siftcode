const vscode = require('vscode');

class FileTreeProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this._files = [];
    this._decisions = {};
  }

  setFiles(files, decisions) {
    this._files = files;
    this._decisions = decisions || {};
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element) {
    return element;
  }

  getChildren() {
    return this._files.map((file) => {
      let total = 0;
      let rejected = 0;
      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          if (line.actionIndex !== undefined) {
            total++;
            if (this._decisions[line.actionIndex] === 'reject') rejected++;
          }
        }
      }

      const fileName = file.path.split('/').pop();
      const label = `${fileName}  (${total} changes${rejected > 0 ? `, ${rejected} rejected` : ''})`;
      const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
      item.description = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
      item.tooltip = file.path;
      item.command = {
        command: 'siftcode.openFile',
        title: 'Open File',
        arguments: [file.path],
      };
      item.iconPath = new vscode.ThemeIcon(rejected > 0 ? 'warning' : 'file');
      return item;
    });
  }
}

module.exports = { FileTreeProvider };
