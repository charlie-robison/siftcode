export default function FileList({ files, repoGroups, decisions, selectedIndex, onSelect, dismissedCount, onUndismiss, onDismiss, onRemoveFolder, onAddFolder }) {

  return (
    <div className="sidebar">
      <div className="sidebar-title">
        <span>Changed Files ({files.length})</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {dismissedCount > 0 && (
            <button className="show-dismissed-btn" onClick={onUndismiss}>
              +{dismissedCount} dismissed
            </button>
          )}
          <button className="show-dismissed-btn" onClick={onAddFolder} title="Add another folder">
            + folder
          </button>
        </div>
      </div>

      <div className="file-list">
        {repoGroups.map((group) => {
          const groupFiles = files.filter(f => f.repoRoot === group.repoRoot);

          return (
            <div key={group.repoRoot}>
              <div className="repo-group-header">
                <span className="repo-group-icon">📁</span>
                <span className="repo-group-name" title={group.repoRoot}>{group.repoName}</span>
                <span className="repo-group-count">{groupFiles.length}</span>
                <button
                  className="repo-group-close"
                  onClick={() => onRemoveFolder(group.repoRoot)}
                  title="Remove folder"
                >
                  ✕
                </button>
              </div>
              {groupFiles.map((file) => {
                const thisIndex = files.indexOf(file);
                let fileTotal = 0;
                let fileRejected = 0;
                for (const hunk of file.hunks) {
                  for (const line of hunk.lines) {
                    if (line.actionIndex !== undefined) {
                      fileTotal++;
                      if (decisions[line.actionIndex] === 'reject') fileRejected++;
                    }
                  }
                }

                const fileName = file.path.split('/').pop();
                const dirPath = file.path.includes('/')
                  ? file.path.slice(0, file.path.lastIndexOf('/'))
                  : '';

                return (
                  <div
                    key={`${file.repoRoot}:${file.path}`}
                    className={`file-item file-item-nested ${thisIndex === selectedIndex ? 'selected' : ''}`}
                    onClick={() => onSelect(thisIndex)}
                  >
                    <span className="file-icon">
                      {fileRejected > 0 ? '●' : '○'}
                    </span>
                    <span className="file-name" title={file.path}>
                      {fileName}
                      {dirPath && <span style={{ color: '#666', fontSize: 11 }}> {dirPath}</span>}
                    </span>
                    <span className="file-count">
                      {fileTotal}
                    </span>
                    <button
                      className="file-dismiss-btn"
                      onClick={(e) => { e.stopPropagation(); onDismiss(file); }}
                      title="Dismiss file"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
