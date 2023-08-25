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
        createNodeFromWindow();
    }
});

// Function to create a user-friendly date and time string
function getDefaultTitle() {
    const date = new Date();
    const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    let dateString = date.toLocaleString(undefined, options);
    const timeComponents = dateString.split(', ').pop().split(' ');
    const timeWithoutAmPm = timeComponents[0];
    const amPm = timeComponents[1];
    const formattedTime = `${timeWithoutAmPm}:${date.getMilliseconds()} ${amPm}`;
    dateString = dateString.replace(timeComponents.join(' '), formattedTime);
    return dateString;
}

// Function to handle node creation from a window (double-click behavior)
function createNodeFromWindow(title = null, content = null, followMouse = false) {
    const defaultTitle = title || getDefaultTitle();
    nodefromWindow = true;
    // Set the followMouseFromWindow global flag if followMouse is true
    if (followMouse) {
        followMouseFromWindow = true;
    }
    addNodeTagToZettelkasten(defaultTitle, content);
}