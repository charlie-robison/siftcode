export default function Toolbar({
  accepted,
  rejected,
  total,
  onAcceptAll,
  onRejectAll,
  onAcceptFile,
  onRejectFile,
  onApply,
  fileName,
}) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className="btn btn-accept" onClick={onAcceptFile} title="Accept all changes in this file and dismiss it">
          ✓ Accept & Done
        </button>
        <button className="btn btn-reject" onClick={onRejectFile} title="Reject all changes in this file and dismiss it">
          ✕ Reject & Done
        </button>
        <span style={{ color: '#555', margin: '0 4px' }}>|</span>
        <button className="btn btn-accept" onClick={onAcceptAll} title="Accept all changes across all files">
          Accept All
        </button>
        <button className="btn btn-reject" onClick={onRejectAll} title="Reject all changes across all files">
          Reject All
        </button>
      </div>
      <div className="toolbar-right">
        <div className="toolbar-stats">
          <span className="stat-accepted">{accepted} accepted</span>
          {' / '}
          <span className="stat-rejected">{rejected} rejected</span>
          {' / '}
          <span>{total} total</span>
        </div>
        <button className="btn btn-apply" onClick={onApply}>
          Apply Changes
        </button>
      </div>
    </div>
  );
}
