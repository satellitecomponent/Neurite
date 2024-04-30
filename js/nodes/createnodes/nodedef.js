/* Node Flag Types

    if (node.isTextNode) {
        initTextNode(node)
    }

    if (node.isLLM) {
        initAiNode(node);
        restoreNewLinesInPreElements(node.aiResponseDiv);
    }

    if (node.isLink) {
        initLinkNode(node);
    }

    if (isEditorNode(node)) {
        initEditorNode(node)
    }
}

*/