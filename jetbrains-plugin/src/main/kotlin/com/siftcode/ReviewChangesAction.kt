package com.siftcode

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.wm.ToolWindowManager

class ReviewChangesAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow("siftcode") ?: return
        toolWindow.show()

        // Trigger a refresh in the tool window
        val content = toolWindow.contentManager.getContent(0) ?: return
        val component = content.component
        if (component is SiftcodePanel) {
            component.loadDiff()
        }
    }
}
