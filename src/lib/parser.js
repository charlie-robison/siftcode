export function parseDiff(raw, actionOffset = 0) {
  const files = [];
  let currentFile = null;
  let currentHunk = null;
  let actionIndex = actionOffset;

  const lines = raw.split('\n');

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      if (match) {
        currentFile = { path: match[2], hunks: [] };
        files.push(currentFile);
        currentHunk = null;
      }
      continue;
    }

    if (line.startsWith('---') || line.startsWith('+++')) continue;
    if (line.startsWith('index ') || line.startsWith('new file') || line.startsWith('deleted file')) continue;
    if (line.startsWith('old mode') || line.startsWith('new mode')) continue;
    if (line.startsWith('similarity') || line.startsWith('rename')) continue;
    if (line.startsWith('Binary')) continue;

    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/);
      if (match && currentFile) {
        currentHunk = {
          originalStart: parseInt(match[1]),
          originalCount: parseInt(match[2] ?? '1'),
          newStart: parseInt(match[3]),
          newCount: parseInt(match[4] ?? '1'),
          context: match[5]?.trim() || '',
          lines: [],
        };
        currentFile.hunks.push(currentHunk);
      }
      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith('+')) {
      currentHunk.lines.push({ type: 'addition', content: line.slice(1), actionIndex: actionIndex++ });
    } else if (line.startsWith('-')) {
      currentHunk.lines.push({ type: 'deletion', content: line.slice(1), actionIndex: actionIndex++ });
    } else if (line.startsWith(' ')) {
      currentHunk.lines.push({ type: 'context', content: line.slice(1) });
    }
  }

  return { files, totalActions: actionIndex - actionOffset };
}

export function buildUnifiedDoc(originalContent, hunks) {
  const originalLines = originalContent.split('\n');
  const docLines = [];
  const lineInfos = [];
  let origIndex = 0;

  for (const hunk of hunks) {
    const hunkStart = hunk.originalStart - 1;
    while (origIndex < hunkStart) {
      docLines.push(originalLines[origIndex]);
      lineInfos.push({ type: 'context' });
      origIndex++;
    }

    for (const line of hunk.lines) {
      if (line.type === 'context') {
        docLines.push(line.content);
        lineInfos.push({ type: 'context' });
        origIndex++;
      } else if (line.type === 'deletion') {
        docLines.push(line.content);
        lineInfos.push({ type: 'deletion', actionIndex: line.actionIndex });
        origIndex++;
      } else if (line.type === 'addition') {
        docLines.push(line.content);
        lineInfos.push({ type: 'addition', actionIndex: line.actionIndex });
      }
    }
  }

  while (origIndex < originalLines.length) {
    docLines.push(originalLines[origIndex]);
    lineInfos.push({ type: 'context' });
    origIndex++;
  }

  return { text: docLines.join('\n'), lineInfos };
}

export function reconstructFile(originalContent, hunks, decisions) {
  const originalLines = originalContent.split('\n');
  const outputLines = [];
  let origIndex = 0;

  for (const hunk of hunks) {
    const hunkStart = hunk.originalStart - 1;
    while (origIndex < hunkStart) {
      outputLines.push(originalLines[origIndex]);
      origIndex++;
    }

    for (const line of hunk.lines) {
      if (line.type === 'context') {
        outputLines.push(originalLines[origIndex]);
        origIndex++;
      } else if (line.type === 'deletion') {
        if (decisions[line.actionIndex] !== 'accept') {
          outputLines.push(originalLines[origIndex]);
        }
        origIndex++;
      } else if (line.type === 'addition') {
        if (decisions[line.actionIndex] === 'accept') {
          outputLines.push(line.content);
        }
      }
    }
  }

  while (origIndex < originalLines.length) {
    outputLines.push(originalLines[origIndex]);
    origIndex++;
  }

  return outputLines.join('\n');
}
