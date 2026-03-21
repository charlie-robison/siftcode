import { useRef, useEffect, useMemo, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { buildUnifiedDoc } from '../lib/parser';

const LANG_MAP = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python', rb: 'ruby', rs: 'rust', go: 'go', java: 'java',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
  css: 'css', scss: 'scss', less: 'less',
  html: 'html', xml: 'xml', svg: 'xml',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'plaintext',
  md: 'markdown', sh: 'shell', bash: 'shell', zsh: 'shell',
  sql: 'sql', graphql: 'graphql', swift: 'swift', kt: 'kotlin',
};

function getLanguage(filePath) {
  if (!filePath) return 'plaintext';
  const ext = filePath.split('.').pop()?.toLowerCase();
  return LANG_MAP[ext] || 'plaintext';
}

export default function DiffView({ file, originalContent, decisions, onToggle }) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef(null);

  // Keep latest values in refs so callbacks never go stale
  const decisionsRef = useRef(decisions);
  const lineInfosRef = useRef([]);
  const onToggleRef = useRef(onToggle);

  decisionsRef.current = decisions;
  onToggleRef.current = onToggle;

  const { text, lineInfos } = useMemo(() => {
    if (!file || originalContent === undefined) return { text: '', lineInfos: [] };
    return buildUnifiedDoc(originalContent, file.hunks);
  }, [file, originalContent]);

  lineInfosRef.current = lineInfos;

  const language = useMemo(() => getLanguage(file?.path), [file?.path]);

  const applyDecorations = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const infos = lineInfosRef.current;
    const decs = decisionsRef.current;

    if (!editor || !monaco || infos.length === 0) return;

    const newDecorations = [];

    infos.forEach((info, i) => {
      const lineNumber = i + 1;

      if (info.type === 'deletion') {
        const accepted = decs[info.actionIndex] === 'accept';
        newDecorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className: accepted ? 'line-del-accepted' : 'line-del-rejected',
            glyphMarginClassName: accepted ? 'glyph-check' : 'glyph-cross',
            overviewRuler: {
              color: accepted ? '#f4433666' : '#66666666',
              position: monaco.editor.OverviewRulerLane.Left,
            },
          },
        });
      } else if (info.type === 'addition') {
        const accepted = decs[info.actionIndex] === 'accept';
        newDecorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className: accepted ? 'line-add-accepted' : 'line-add-rejected',
            glyphMarginClassName: accepted ? 'glyph-check' : 'glyph-cross',
            overviewRuler: {
              color: accepted ? '#4caf5066' : '#66666666',
              position: monaco.editor.OverviewRulerLane.Left,
            },
          },
        });
      }
    });

    if (decorationsRef.current) {
      decorationsRef.current.clear();
    }
    decorationsRef.current = editor.createDecorationsCollection(newDecorations);
  }, []);

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.updateOptions({ glyphMargin: true });

    // Click handler uses refs so it always has latest values
    editor.onMouseDown((e) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const lineNumber = e.target.position?.lineNumber;
        const infos = lineInfosRef.current;
        if (lineNumber && infos[lineNumber - 1]) {
          const info = infos[lineNumber - 1];
          if (info.actionIndex !== undefined) {
            onToggleRef.current(info.actionIndex);
          }
        }
      }
    });

    applyDecorations();
  }

  // Re-apply decorations whenever decisions or lineInfos change
  useEffect(() => {
    applyDecorations();
  }, [decisions, lineInfos, applyDecorations]);

  if (!file) {
    return (
      <div className="editor-container">
        <div className="empty-state">
          <p>Select a file to review</p>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <Editor
        key={file.path}
        height="100%"
        language={language}
        value={text}
        theme="vs-dark"
        onMount={handleEditorDidMount}
        options={{
          readOnly: true,
          minimap: { enabled: true },
          glyphMargin: true,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          renderWhitespace: 'selection',
          folding: false,
          fontSize: 13,
          lineHeight: 20,
          padding: { top: 8 },
          smoothScrolling: true,
          cursorBlinking: 'solid',
        }}
      />
    </div>
  );
}
