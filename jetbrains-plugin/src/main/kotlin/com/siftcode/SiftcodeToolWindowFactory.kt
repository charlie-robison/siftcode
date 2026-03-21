package com.siftcode

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory

class SiftcodeToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel = SiftcodePanel(project)
        val content = ContentFactory.getInstance().createContent(panel, "Review", false)
        toolWindow.contentManager.addContent(content)
    }
}
