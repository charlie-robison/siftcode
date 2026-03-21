import { useState, useEffect, useCallback } from 'react';
import { parseDiff, reconstructFile } from './lib/parser';
import FileList from './components/FileList';
import DiffView from './components/DiffView';
import Toolbar from './components/Toolbar';
import './App.css';

export default function App() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(0);
  const [decisions, setDecisions] = useState({});
  const [originals, setOriginals] = useState({});
  const [currentDir, setCurrentDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [totalActions, setTotalActions] = useState(0);
  const [dismissedFiles, setDismissedFiles] = useState(new Set());

  const loadDiff = useCallback(async () => {
    setLoading(true);
    const dir = await window.siftcode.getCurrentDir();
    setCurrentDir(dir);
    window.siftcode.updateTitle(dir);

    const raw = await window.siftcode.getDiff();
    if (!raw.trim()) {
      setFiles([]);
      setTotalActions(0);
      setDecisions({});
      setOriginals({});
      setLoading(false);
      return;
    }

    const { files: parsed, totalActions: total } = parseDiff(raw);

    const decs = {};
    for (let i = 0; i < total; i++) {
      decs[i] = 'accept';
    }
    setDecisions(decs);
    setTotalActions(total);
    setDismissedFiles(new Set());

    const origs = {};
    for (const file of parsed) {
      origs[file.path] = await window.siftcode.getOriginal(file.path);
    }
    setOriginals(origs);

    setFiles(parsed);
    setSelectedFile(0);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDiff();
  }, [loadDiff]);

  const visibleFiles = files.filter(f => !dismissedFiles.has(f.path));
  const currentFile = visibleFiles[selectedFile] || null;
  const currentOriginal = currentFile ? originals[currentFile.path] || '' : '';

  function toggleLine(actionIndex) {
    setDecisions(prev => ({
      ...prev,
      [actionIndex]: prev[actionIndex] === 'accept' ? 'reject' : 'accept',
    }));
  }

  function acceptAll() {
    setDecisions(prev => {
      const next = {};
      for (const key of Object.keys(prev)) next[key] = 'accept';
      return next;
    });
  }

  function rejectAll() {
    setDecisions(prev => {
      const next = {};
      for (const key of Object.keys(prev)) next[key] = 'reject';
      return next;
    });
  }

  function acceptFileAndDismiss() {
    if (!currentFile) return;
    setDecisions(prev => {
      const next = { ...prev };
      for (const hunk of currentFile.hunks) {
        for (const line of hunk.lines) {
          if (line.actionIndex !== undefined) next[line.actionIndex] = 'accept';
        }
      }
      return next;
    });
    dismissFile(currentFile.path);
  }

  function rejectFileAndDismiss() {
    if (!currentFile) return;
    setDecisions(prev => {
      const next = { ...prev };
      for (const hunk of currentFile.hunks) {
        for (const line of hunk.lines) {
          if (line.actionIndex !== undefined) next[line.actionIndex] = 'reject';
        }
      }
      return next;
    });
    dismissFile(currentFile.path);
  }

  function dismissFile(filePath) {
    setDismissedFiles(prev => {
      const next = new Set(prev);
      next.add(filePath);
      return next;
    });
    const remaining = visibleFiles.filter(f => f.path !== filePath);
    if (remaining.length === 0) {
      setSelectedFile(0);
    } else if (selectedFile >= remaining.length) {
      setSelectedFile(remaining.length - 1);
    }
  }

  function undismissAll() {
    setDismissedFiles(new Set());
  }

  async function apply() {
    for (const file of files) {
      const original = originals[file.path] || '';
      const content = reconstructFile(original, file.hunks, decisions);
      await window.siftcode.applyFile(file.path, content);
    }
    await loadDiff();
  }

  async function openFolder() {
    const dir = await window.siftcode.openFolder();
    if (dir) {
      setCurrentDir(dir);
      await loadDiff();
    }
  }

  let accepted = 0, rejected = 0;
  for (const val of Object.values(decisions)) {
    if (val === 'accept') accepted++;
    else if (val === 'reject') rejected++;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1>siftcode</h1>
          <span className="dir-path" title={currentDir}>{currentDir}</span>
        </div>
        <div className="header-actions">
          <button className="btn btn-open" onClick={openFolder}>Open Folder</button>
          <button className="btn btn-open" onClick={loadDiff}>Refresh</button>
        </div>
      </header>

      <div className="app-body">
        {loading ? (
          <div className="loading">Loading changes...</div>
        ) : files.length === 0 ? (
          <div className="empty-state">
            <h2>No changes to review</h2>
            <p>
              Run your AI coding agent, then come back here to review changes
              line by line before they hit your codebase.
            </p>
            <button className="btn" onClick={openFolder}>Open a project folder</button>
          </div>
        ) : visibleFiles.length === 0 ? (
          <div className="empty-state">
            <h2>All files reviewed</h2>
            <p>Every file has been dismissed. Apply your changes or bring files back.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={undismissAll}>Show All Files</button>
              <button className="btn btn-apply" onClick={apply}>Apply Changes</button>
            </div>
          </div>
        ) : (
          <>
            <FileList
              files={visibleFiles}
              decisions={decisions}
              selectedIndex={selectedFile}
              onSelect={setSelectedFile}
              repoDir={currentDir}
              dismissedCount={dismissedFiles.size}
              onUndismiss={undismissAll}
              onDismiss={(filePath) => dismissFile(filePath)}
            />
            <div className="editor-area">
              <DiffView
                file={currentFile}
                originalContent={currentOriginal}
                decisions={decisions}
                onToggle={toggleLine}
              />
              <Toolbar
                accepted={accepted}
                rejected={rejected}
                total={totalActions}
                onAcceptAll={acceptAll}
                onRejectAll={rejectAll}
                onAcceptFile={acceptFileAndDismiss}
                onRejectFile={rejectFileAndDismiss}
                onApply={apply}
                fileName={currentFile?.path}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
