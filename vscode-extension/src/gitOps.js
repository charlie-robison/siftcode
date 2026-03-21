const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getDiff(cwd) {
  try {
    let diff = execSync('git diff', { encoding: 'utf8', cwd, maxBuffer: 50 * 1024 * 1024 });

    // Include untracked files as synthetic diffs
    try {
      const untracked = execSync('git ls-files --others --exclude-standard', {
        encoding: 'utf8',
        cwd,
      }).trim();
      if (untracked) {
        for (const filePath of untracked.split('\n')) {
          try {
            const fullPath = path.resolve(cwd, filePath);
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            diff += `\ndiff --git a/${filePath} b/${filePath}\nnew file mode 100644\n--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n`;
            diff += lines.map(l => `+${l}`).join('\n') + '\n';
          } catch {}
        }
      }
    } catch {}

    return diff;
  } catch {
    return '';
  }
}

function getOriginalContent(filePath, cwd) {
  try {
    return execSync(`git show HEAD:${filePath}`, { encoding: 'utf8', cwd, maxBuffer: 50 * 1024 * 1024 });
  } catch {
    return '';
  }
}

module.exports = { getDiff, getOriginalContent };
