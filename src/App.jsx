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
  const [loading, setLoading] = useState(false);
  const [totalActions, setTotalActions] = useState(0);
  const [dismissedFiles, setDismissedFiles] = useState(new Set());
  const [directories, setDirectories] = useState([]);

  const loadDiffs = useCallback(async () => {
    setLoading(true);

    const repoResults = await window.siftcode.getDiffs();
    const dirs = await window.siftcode.getDirectories();
    setDirectories(dirs);

    if (!repoResults || repoResults.length === 0) {
      setFiles([]);
      setTotalActions(0);
      setDecisions({});
      setOriginals({});
      setLoading(false);
      return;
    }

    let allFiles = [];
    let actionOffset = 0;

    for (const repo of repoResults) {
      const { files: parsed, totalActions: repoActions } = parseDiff(repo.diff, actionOffset);
      for (const file of parsed) {
        file.repoRoot = repo.repoRoot;
        file.repoName = repo.repoName;
      }
      allFiles = allFiles.concat(parsed);
      actionOffset += repoActions;
    }

    const decs = {};
    for (let i = 0; i < actionOffset; i++) {
      decs[i] = 'accept';
    }
    setDecisions(decs);
    setTotalActions(actionOffset);
    setDismissedFiles(new Set());

    const origs = {};
    for (const file of allFiles) {
      const key = `${file.repoRoot}:${file.path}`;
      origs[key] = await window.siftcode.getOriginal(file.path, file.repoRoot);
    }
    setOriginals(origs);

    setFiles(allFiles);
    setSelectedFile(0);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDiffs();
  }, [loadDiffs]);

  const fileKey = (f) => `${f.repoRoot}:${f.path}`;
  const visibleFiles = files.filter(f => !dismissedFiles.has(fileKey(f)));
  const currentFile = visibleFiles[selectedFile] || null;
  const currentOriginal = currentFile ? originals[fileKey(currentFile)] || '' : '';

  // Group visible files by repo
  const repoGroups = [];
  const seen = new Set();
  for (const f of visibleFiles) {
    if (!seen.has(f.repoRoot)) {
      seen.add(f.repoRoot);
      repoGroups.push({ repoRoot: f.repoRoot, repoName: f.repoName });
    }
  }

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
    dismissFile(currentFile);
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
    dismissFile(currentFile);
  }

  function dismissFile(file) {
    const key = fileKey(file);
    setDismissedFiles(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    const remaining = visibleFiles.filter(f => fileKey(f) !== key);
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
      const original = originals[fileKey(file)] || '';
      const content = reconstructFile(original, file.hunks, decisions);
      await window.siftcode.applyFile(file.path, content, file.repoRoot);
    }
    await loadDiffs();
  }

  async function addFolder() {
    const dir = await window.siftcode.addFolder();
    if (dir) {
      await loadDiffs();
    }
  }

  async function removeFolder(repoRoot) {
    await window.siftcode.removeFolder(repoRoot);
    await loadDiffs();
  }

  let accepted = 0, rejected = 0;
  for (const val of Object.values(decisions)) {
    if (val === 'accept') accepted++;
    else if (val === 'reject') rejected++;
  }

  const hasDirectories = directories.length > 0;

  return (
    <div className="app">
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1>siftcode</h1>
        </div>
        <div className="header-actions">
          <button className="btn btn-open" onClick={addFolder}>Add Folder</button>
          <button className="btn btn-open" onClick={loadDiffs}>Refresh</button>
        </div>
      </header>

      <div className="app-body">
        {loading ? (
          <div className="loading">Loading changes...</div>
        ) : !hasDirectories ? (
          <div className="empty-state">
            <h2>No folders open</h2>
            <p>
              Add a project folder to start reviewing AI-generated code changes line by line.
            </p>
            <button className="btn" onClick={addFolder}>Add a project folder</button>
          </div>
        ) : files.length === 0 ? (
          <div className="empty-state">
            <h2>No changes to review</h2>
            <p>
              Run your AI coding agent, then click Refresh to review changes.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={addFolder}>Add another folder</button>
              <button className="btn" onClick={loadDiffs}>Refresh</button>
            </div>
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
              repoGroups={repoGroups}
              decisions={decisions}
              selectedIndex={selectedFile}
              onSelect={setSelectedFile}
              dismissedCount={dismissedFiles.size}
              onUndismiss={undismissAll}
              onDismiss={(file) => dismissFile(file)}
              onRemoveFolder={removeFolder}
              onAddFolder={addFolder}
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
