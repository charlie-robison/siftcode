package com.siftcode

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefJSQuery
import org.cef.browser.CefBrowser
import org.cef.handler.CefLoadHandlerAdapter
import java.awt.BorderLayout
import javax.swing.JPanel

class SiftcodePanel(private val project: Project) : JPanel(BorderLayout()) {

    private val browser = JBCefBrowser()
    private val jsQuery = JBCefJSQuery.create(browser)

    private var files: List<DiffFile> = emptyList()
    private var originals: Map<String, String> = emptyMap()
    private var decisions: MutableMap<Int, String> = mutableMapOf()
    private var selectedFile: String? = null

    init {
        add(browser.component, BorderLayout.CENTER)

        jsQuery.addHandler { msg ->
            handleMessage(msg)
            null
        }

        browser.jbCefClient.addLoadHandler(object : CefLoadHandlerAdapter() {
            override fun onLoadEnd(b: CefBrowser?, frame: org.cef.browser.CefFrame?, httpStatusCode: Int) {
                if (frame?.isMain == true) {
                    injectQueryFunction()
                }
            }
        }, browser.cefBrowser)

        loadDiff()
    }

    private fun injectQueryFunction() {
        val injection = jsQuery.inject("msg")
        browser.cefBrowser.executeJavaScript(
            "window.sendToKotlin = function(msg) { $injection };",
            browser.cefBrowser.url, 0
        )
    }

    fun loadDiff() {
        val raw = GitOps.getDiff(project)
        if (raw.isBlank()) {
            files = emptyList()
            decisions.clear()
            originals = emptyMap()
            renderEmpty()
            return
        }

        val result = DiffParser.parse(raw)
        files = result.files

        decisions = mutableMapOf()
        for (i in 0 until result.totalActions) {
            decisions[i] = "accept"
        }

        originals = mutableMapOf<String, String>().apply {
            for (file in files) {
                put(file.path, GitOps.getOriginalContent(project, file.path))
            }
        }

        selectedFile = files.firstOrNull()?.path
        renderWebview()
    }

    private fun handleMessage(msg: String) {
        val parts = msg.split(":", limit = 2)
        val type = parts[0]
        val arg = if (parts.size > 1) parts[1] else ""

        when (type) {
            "toggle" -> {
                val idx = arg.toIntOrNull() ?: return
                decisions[idx] = if (decisions[idx] == "accept") "reject" else "accept"
                renderWebview()
            }
            "acceptFile" -> {
                val file = files.find { it.path == selectedFile } ?: return
                for (hunk in file.hunks) {
                    for (line in hunk.lines) {
                        if (line.actionIndex >= 0) decisions[line.actionIndex] = "accept"
                    }
                }
                // Move to next file
                val idx = files.indexOf(file)
                selectedFile = files.getOrNull(idx + 1)?.path ?: files.firstOrNull()?.path
                renderWebview()
            }
            "rejectFile" -> {
                val file = files.find { it.path == selectedFile } ?: return
                for (hunk in file.hunks) {
                    for (line in hunk.lines) {
                        if (line.actionIndex >= 0) decisions[line.actionIndex] = "reject"
                    }
                }
                val idx = files.indexOf(file)
                selectedFile = files.getOrNull(idx + 1)?.path ?: files.firstOrNull()?.path
                renderWebview()
            }
            "acceptAll" -> {
                for (key in decisions.keys) decisions[key] = "accept"
                renderWebview()
            }
            "rejectAll" -> {
                for (key in decisions.keys) decisions[key] = "reject"
                renderWebview()
            }
            "selectFile" -> {
                selectedFile = arg
                renderWebview()
            }
            "apply" -> {
                for (file in files) {
                    val original = originals[file.path] ?: ""
                    val content = DiffParser.reconstructFile(original, file.hunks, decisions)
                    GitOps.writeFile(project, file.path, content)
                }
                // Refresh VFS so IDE sees changes
                ApplicationManager.getApplication().invokeLater {
                    LocalFileSystem.getInstance().refresh(true)
                }
                loadDiff()
            }
            "refresh" -> {
                loadDiff()
            }
        }
    }

    private fun renderEmpty() {
        browser.loadHTML("""
            <html><head><style>
            body { font-family: -apple-system, sans-serif; background: #1e1e1e; color: #888; display: flex; align-items: center; justify-content: center; height: 100vh; }
            h2 { font-weight: 400; font-size: 18px; }
            </style></head><body><h2>No changes to review</h2></body></html>
        """.trimIndent())
    }

    private fun renderWebview() {
        val file = files.find { it.path == selectedFile } ?: files.firstOrNull() ?: run {
            renderEmpty()
            return
        }
        selectedFile = file.path

        val original = originals[file.path] ?: ""
        val (text, lineInfos) = DiffParser.buildUnifiedDoc(original, file.hunks)
        val textLines = text.split("\n")

        var accepted = 0
        var rejected = 0
        for (v in decisions.values) {
            if (v == "accept") accepted++ else if (v == "reject") rejected++
        }

        val fileListHtml = files.joinToString("") { f ->
            val isSelected = f.path == selectedFile
            val name = f.path.substringAfterLast("/")
            val dir = if (f.path.contains("/")) f.path.substringBeforeLast("/") else ""
            """<div class="file-item ${if (isSelected) "selected" else ""}" onclick="send('selectFile:${escapeHtml(f.path)}')">
                <span class="file-name">${escapeHtml(name)}</span>
                ${if (dir.isNotEmpty()) """<span class="file-dir">${escapeHtml(dir)}</span>""" else ""}
            </div>"""
        }

        val linesHtml = textLines.mapIndexed { i, line ->
            val info = lineInfos.getOrNull(i)
            if (info == null || info.type == "context") {
                """<div class="line context"><span class="line-num">${i + 1}</span><span class="line-content">${escapeHtml(line)}</span></div>"""
            } else {
                val isAccepted = decisions[info.actionIndex] == "accept"
                val cls = when {
                    info.type == "deletion" && isAccepted -> "del-accepted"
                    info.type == "deletion" -> "del-rejected"
                    info.type == "addition" && isAccepted -> "add-accepted"
                    else -> "add-rejected"
                }
                val icon = if (isAccepted) "✓" else "✗"
                val iconCls = if (isAccepted) "icon-accept" else "icon-reject"
                val prefix = if (info.type == "deletion") "-" else "+"

                """<div class="line $cls">
                    <span class="line-gutter" onclick="send('toggle:${info.actionIndex}')"><span class="$iconCls">$icon</span></span>
                    <span class="line-num">${i + 1}</span>
                    <span class="line-prefix">$prefix</span>
                    <span class="line-content">${escapeHtml(line)}</span>
                </div>"""
            }
        }.joinToString("")

        val html = """
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'JetBrains Mono', 'Menlo', monospace; font-size: 13px; background: #1e1e1e; color: #ccc; display: flex; height: 100vh; overflow: hidden; }
.sidebar { width: 200px; min-width: 160px; background: #252526; border-right: 1px solid #404040; display: flex; flex-direction: column; overflow-y: auto; }
.sidebar-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; padding: 10px 10px 6px; font-weight: 600; }
.file-item { padding: 5px 10px; cursor: pointer; font-size: 12px; border-left: 3px solid transparent; display: flex; flex-direction: column; gap: 1px; }
.file-item:hover { background: #2a2d2e; }
.file-item.selected { background: #37373d; border-left-color: #007acc; }
.file-name { font-weight: 500; }
.file-dir { font-size: 10px; opacity: 0.6; }
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.editor { flex: 1; overflow: auto; padding: 4px 0; }
.line { display: flex; align-items: stretch; min-height: 20px; line-height: 20px; white-space: pre; }
.line-gutter { width: 28px; min-width: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; user-select: none; font-size: 12px; }
.line-gutter:hover { background: #333; }
.line-num { width: 44px; min-width: 44px; text-align: right; padding-right: 8px; color: #555; font-size: 11px; user-select: none; }
.line-prefix { width: 16px; min-width: 16px; text-align: center; font-weight: bold; user-select: none; }
.line-content { flex: 1; padding-right: 16px; }
.icon-accept { color: #4caf50; font-weight: bold; }
.icon-reject { color: #f44336; font-weight: bold; }
.context .line-gutter { width: 28px; min-width: 28px; }
.del-accepted { background: rgba(255,0,0,0.12); text-decoration: line-through; opacity: 0.65; }
.del-accepted .line-prefix { color: #f44336; }
.del-rejected { background: rgba(100,100,100,0.08); }
.del-rejected .line-prefix { color: #888; }
.add-accepted { background: rgba(0,255,0,0.12); }
.add-accepted .line-prefix { color: #4caf50; }
.add-rejected { background: rgba(100,100,100,0.08); text-decoration: line-through; opacity: 0.5; }
.add-rejected .line-prefix { color: #888; }
.toolbar { display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; background: #2d2d2d; border-top: 1px solid #404040; }
.toolbar-left, .toolbar-right { display: flex; align-items: center; gap: 6px; }
.toolbar-stats { font-size: 12px; color: #888; margin-right: 8px; }
.stat-accepted { color: #4caf50; }
.stat-rejected { color: #f44336; }
.btn { padding: 4px 12px; font-size: 12px; border: 1px solid #555; border-radius: 3px; cursor: pointer; font-family: inherit; background: #333; color: #ccc; }
.btn:hover { background: #444; }
.btn-accept { color: #4caf50; }
.btn-reject { color: #f44336; }
.btn-primary { background: #007acc; border-color: #007acc; color: #fff; }
.btn-primary:hover { background: #1a8ad4; }
</style></head><body>
<div class="sidebar">
    <div class="sidebar-title">Files (${files.size})</div>
    $fileListHtml
</div>
<div class="main">
    <div class="editor">$linesHtml</div>
    <div class="toolbar">
        <div class="toolbar-left">
            <button class="btn btn-accept" onclick="send('acceptFile:')">✓ Accept & Done</button>
            <button class="btn btn-reject" onclick="send('rejectFile:')">✕ Reject & Done</button>
            <span style="color:#555;margin:0 2px;">|</span>
            <button class="btn btn-accept" onclick="send('acceptAll:')">Accept All</button>
            <button class="btn btn-reject" onclick="send('rejectAll:')">Reject All</button>
        </div>
        <div class="toolbar-right">
            <div class="toolbar-stats">
                <span class="stat-accepted">$accepted accepted</span> /
                <span class="stat-rejected">$rejected rejected</span> /
                ${accepted + rejected} total
            </div>
            <button class="btn btn-primary" onclick="send('apply:')">Apply Changes</button>
            <button class="btn" onclick="send('refresh:')">↻ Refresh</button>
        </div>
    </div>
</div>
<script>
function send(msg) {
    if (window.sendToKotlin) { window.sendToKotlin(msg); }
}
</script>
</body></html>"""

        browser.loadHTML(html)
    }

    private fun escapeHtml(s: String): String {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;")
    }
}
