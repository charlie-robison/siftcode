export default function FileList({ files, decisions, selectedIndex, onSelect, repoDir, repos, dismissedCount, onUndismiss, onDismiss }) {
  // Group files by repo
  const grouped = {};
  for (const file of files) {
    const key = file.repoName || 'unknown';
    if (!grouped[key]) grouped[key] = { repoRoot: file.repoRoot, repoName: file.repoName, files: [] };
    grouped[key].files.push(file);
  }
  const repoGroups = Object.values(grouped);
  const multiRepo = repoGroups.length > 1;

  // Build a flat index mapping for selection
  let flatIndex = 0;

  return (
    <div className="sidebar">
      <div className="repo-header">
        <span className="repo-folder-icon">📁</span>
        <div className="repo-header-text">
          <span className="repo-name">{repoDir?.split('/').pop() || ''}</span>
          <span className="repo-path">{repoDir}</span>
        </div>
      </div>

      <div className="sidebar-title">
        <span>Changed Files ({files.length})</span>
        {dismissedCount > 0 && (
          <button className="show-dismissed-btn" onClick={onUndismiss}>
            +{dismissedCount} dismissed
          </button>
        )}
      </div>

      <div className="file-list">
        {repoGroups.map((group) => {
          const groupFiles = group.files;
          return (
            <div key={group.repoRoot}>
              {multiRepo && (
                <div className="repo-group-header">
                  <span className="repo-group-icon">📂</span>
                  <span className="repo-group-name">{group.repoName}</span>
                  <span className="repo-group-count">{groupFiles.length}</span>
                </div>
              )}
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
                    className={`file-item ${thisIndex === selectedIndex ? 'selected' : ''} ${multiRepo ? 'file-item-nested' : ''}`}
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
