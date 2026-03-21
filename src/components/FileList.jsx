export default function FileList({ files, decisions, selectedIndex, onSelect, repoDir, dismissedCount, onUndismiss, onDismiss }) {
  const repoName = repoDir ? repoDir.split('/').pop() : '';

  return (
    <div className="sidebar">
      <div className="repo-header">
        <span className="repo-folder-icon">📁</span>
        <div className="repo-header-text">
          <span className="repo-name">{repoName}</span>
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
        {files.map((file, i) => {
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
              key={file.path}
              className={`file-item ${i === selectedIndex ? 'selected' : ''}`}
              onClick={() => onSelect(i)}
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
                onClick={(e) => { e.stopPropagation(); onDismiss(file.path); }}
                title="Dismiss file"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
