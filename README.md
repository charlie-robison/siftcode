# siftcode

**Sift through AI code changes. Review every line.**

siftcode is a desktop code audit tool that lets you review AI-generated code changes line by line before they reach production. It works with any coding agent (Claude Code, Codex, Copilot, aider, etc.) and any editor — it reads your git diff and gives you a clean UI to accept or reject each individual line.

This is not an IDE. It's a quality gate. Your coding agent does the work, siftcode lets you verify it.

## Why

AI coding agents can write hundreds of lines in seconds. Most of it is fine. Some of it is slop — unnecessary abstractions, wrong assumptions, subtle bugs, security issues. The problem is that reviewing a massive diff in your terminal or git client is tedious, and it's easy to rubber-stamp changes that shouldn't ship.

siftcode gives you a purpose-built interface for exactly one thing: deciding which AI-generated lines make it into your codebase and which don't.

## How It Works

```
1. Run your coding agent normally (Claude Code, Codex, Cursor, etc.)
   → Agent edits files in your repo

2. Open siftcode
   → Reads git diff, shows every change with syntax highlighting

3. Review line by line
   → Click gutter icons to accept/reject individual lines
   → Accept & dismiss entire files when they look good
   → Reject the slop

4. Apply
   → Only accepted changes are written to disk
   → Rejected lines are reverted to the original
   → Your IDE picks up the clean result
```

## Install

Requires [Node.js](https://nodejs.org/) 18+.

```bash
git clone https://github.com/charlie-robison/siftcode.git
cd siftcode
npm install
```

## Usage

### Development

```bash
npm run dev
```

This starts the Vite dev server and launches the Electron app.

### Production build

```bash
npm run build
npm start
```

### Pointing to a repo

By default, siftcode reads changes from the directory it was launched in. To review a different repo, click **Open Folder** in the top-right corner.

## Controls

| Action | How |
|--------|-----|
| **Accept/reject a line** | Click the green ✓ or red ✗ icon in the gutter |
| **Accept & dismiss file** | Click "Accept & Done" in the bottom toolbar |
| **Reject & dismiss file** | Click "Reject & Done" in the bottom toolbar |
| **Dismiss a file** | Hover over a file in the sidebar, click ✕ |
| **Accept all changes** | Click "Accept All" in the bottom toolbar |
| **Reject all changes** | Click "Reject All" in the bottom toolbar |
| **Bring back dismissed files** | Click "+N dismissed" link in the sidebar |
| **Apply changes to disk** | Click "Apply Changes" — writes accepted lines, reverts rejected ones |
| **Refresh** | Click "Refresh" to re-read the git diff |

## What It Audits

siftcode reviews **unstaged changes** to tracked files (`git diff`). This covers the typical workflow:

1. You have a clean working tree
2. An AI agent edits your files
3. You run siftcode to review before staging/committing

For staged changes, you can modify the source to use `git diff --cached`.

## What It Doesn't Do

- It is not an IDE or editor — you don't write code here
- It does not run or wrap your coding agent — use your agent normally, then audit with siftcode
- It does not track new untracked files (yet) — only modifications to existing tracked files
- It does not auto-commit or push — you decide what happens after applying

## Agent Agnostic

siftcode works with any tool that edits files in a git repo:

- **Claude Code** (CLI)
- **Codex** (OpenAI)
- **Cursor**
- **GitHub Copilot**
- **Windsurf**
- **aider**
- **Cline**
- **Any MCP-based agent**
- **Any script or tool that modifies code**

If it shows up in `git diff`, siftcode can audit it.

## Tech Stack

- **Electron** — desktop shell
- **Monaco Editor** — same editor engine as VS Code, with syntax highlighting for every language
- **React** — UI components
- **Vite** — build tooling
- **Zero backend** — everything runs locally, nothing leaves your machine

## License

MIT
