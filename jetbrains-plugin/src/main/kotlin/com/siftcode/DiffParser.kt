package com.siftcode

data class DiffLine(val type: String, val content: String, val actionIndex: Int = -1)
data class DiffHunk(val originalStart: Int, val lines: MutableList<DiffLine> = mutableListOf())
data class DiffFile(val path: String, val hunks: MutableList<DiffHunk> = mutableListOf())
data class ParseResult(val files: List<DiffFile>, val totalActions: Int)

object DiffParser {

    fun parse(raw: String): ParseResult {
        val files = mutableListOf<DiffFile>()
        var currentFile: DiffFile? = null
        var currentHunk: DiffHunk? = null
        var actionIndex = 0

        for (line in raw.split("\n")) {
            if (line.startsWith("diff --git")) {
                val match = Regex("diff --git a/(.+) b/(.+)").find(line)
                if (match != null) {
                    currentFile = DiffFile(match.groupValues[2])
                    files.add(currentFile)
                    currentHunk = null
                }
                continue
            }
            if (line.startsWith("---") || line.startsWith("+++")) continue
            if (line.startsWith("index ") || line.startsWith("new file") || line.startsWith("deleted file")) continue
            if (line.startsWith("old mode") || line.startsWith("new mode")) continue
            if (line.startsWith("similarity") || line.startsWith("rename")) continue
            if (line.startsWith("Binary")) continue

            if (line.startsWith("@@")) {
                val match = Regex("@@ -(\\d+)(?:,\\d+)? \\+(\\d+)(?:,\\d+)? @@(.*)").find(line)
                if (match != null && currentFile != null) {
                    currentHunk = DiffHunk(match.groupValues[1].toInt())
                    currentFile.hunks.add(currentHunk)
                }
                continue
            }

            if (currentHunk == null) continue

            when {
                line.startsWith("+") -> {
                    currentHunk.lines.add(DiffLine("addition", line.substring(1), actionIndex++))
                }
                line.startsWith("-") -> {
                    currentHunk.lines.add(DiffLine("deletion", line.substring(1), actionIndex++))
                }
                line.startsWith(" ") -> {
                    currentHunk.lines.add(DiffLine("context", line.substring(1)))
                }
            }
        }

        return ParseResult(files, actionIndex)
    }

    fun buildUnifiedDoc(originalContent: String, hunks: List<DiffHunk>): Pair<String, List<DiffLine>> {
        val originalLines = originalContent.split("\n")
        val docLines = mutableListOf<String>()
        val lineInfos = mutableListOf<DiffLine>()
        var origIndex = 0

        for (hunk in hunks) {
            val hunkStart = hunk.originalStart - 1
            while (origIndex < hunkStart && origIndex < originalLines.size) {
                docLines.add(originalLines[origIndex])
                lineInfos.add(DiffLine("context", originalLines[origIndex]))
                origIndex++
            }
            for (line in hunk.lines) {
                when (line.type) {
                    "context" -> {
                        docLines.add(line.content)
                        lineInfos.add(line)
                        origIndex++
                    }
                    "deletion" -> {
                        docLines.add(line.content)
                        lineInfos.add(line)
                        origIndex++
                    }
                    "addition" -> {
                        docLines.add(line.content)
                        lineInfos.add(line)
                    }
                }
            }
        }
        while (origIndex < originalLines.size) {
            docLines.add(originalLines[origIndex])
            lineInfos.add(DiffLine("context", originalLines[origIndex]))
            origIndex++
        }

        return Pair(docLines.joinToString("\n"), lineInfos)
    }

    fun reconstructFile(originalContent: String, hunks: List<DiffHunk>, decisions: Map<Int, String>): String {
        val originalLines = originalContent.split("\n")
        val outputLines = mutableListOf<String>()
        var origIndex = 0

        for (hunk in hunks) {
            val hunkStart = hunk.originalStart - 1
            while (origIndex < hunkStart && origIndex < originalLines.size) {
                outputLines.add(originalLines[origIndex])
                origIndex++
            }
            for (line in hunk.lines) {
                when (line.type) {
                    "context" -> {
                        if (origIndex < originalLines.size) outputLines.add(originalLines[origIndex])
                        origIndex++
                    }
                    "deletion" -> {
                        if (decisions[line.actionIndex] != "accept") {
                            if (origIndex < originalLines.size) outputLines.add(originalLines[origIndex])
                        }
                        origIndex++
                    }
                    "addition" -> {
                        if (decisions[line.actionIndex] == "accept") {
                            outputLines.add(line.content)
                        }
                    }
                }
            }
        }
        while (origIndex < originalLines.size) {
            outputLines.add(originalLines[origIndex])
            origIndex++
        }

        return outputLines.joinToString("\n")
    }
}
