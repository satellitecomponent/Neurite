document.addEventListener('dblclick', function (e) {
    // Cancel the default behavior of the event
    cancel(e);

    if (nodeMode && e.altKey) {
        // Node mode (Shift) + Alt + double click behavior
        let node = createEditorNode();
        node.draw();
    } else if (e.altKey) {
        // Alt + double click behavior
        e.preventDefault();
        // Assuming that the createLLMNode function takes x, y coordinates
        let node = createLLMNode('', undefined, undefined, e.clientX, e.clientY);
        node.draw();
    } else if (nodeMode && !prevNode) {
        // Node mode (Shift) + double click behavior
        let node = createTextNode();
        node.draw();
    }
});