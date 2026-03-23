package com.siftcode

import com.intellij.openapi.project.Project
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader

object GitOps {

    fun getDiff(project: Project): String {
        val basePath = project.basePath ?: return ""
        var diff = runGit(basePath, "git", "diff", "HEAD") ?: ""

        // Include untracked files as synthetic diffs
        val untracked = runGit(basePath, "git", "ls-files", "--others", "--exclude-standard")
        if (!untracked.isNullOrBlank()) {
            for (filePath in untracked.trim().split("\n")) {
                if (filePath.isBlank()) continue
                try {
                    val file = File(basePath, filePath)
                    if (!file.exists() || !file.isFile) continue
                    val content = file.readText()
                    val lines = content.split("\n")
                    diff += "\ndiff --git a/$filePath b/$filePath\nnew file mode 100644\n--- /dev/null\n+++ b/$filePath\n@@ -0,0 +1,${lines.size} @@\n"
                    diff += lines.joinToString("\n") { "+$it" } + "\n"
                } catch (_: Exception) {}
            }
        }

        return diff
    }

    fun getOriginalContent(project: Project, filePath: String): String {
        val basePath = project.basePath ?: return ""
        return runGit(basePath, "git", "show", "HEAD:$filePath") ?: ""
    }

    fun writeFile(project: Project, filePath: String, content: String) {
        val basePath = project.basePath ?: return
        val file = File(basePath, filePath)
        file.writeText(content)
    }

    private fun runGit(workDir: String, vararg command: String): String? {
        return try {
            val process = ProcessBuilder(*command)
                .directory(File(workDir))
                .redirectErrorStream(false)
                .start()
            val output = BufferedReader(InputStreamReader(process.inputStream)).readText()
            process.waitFor()
            output
        } catch (_: Exception) {
            null
        }
    }
}
