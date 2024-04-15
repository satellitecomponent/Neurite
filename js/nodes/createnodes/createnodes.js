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
        // Node mode (Shift) + double click behavior *text nodes
        createNodeFromWindow();
    }
});

function getDefaultTitle() {
    const date = new Date();
    const year = String(date.getFullYear()).slice(-2); // Extracting last two digits of the year
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    //const amPm = hour >= 12 ? 'PM' : 'AM';

    // Create a string in the format "YY-MM-DD HH:MM:SS.sss"
    const dateString = `${year}/${month}/${day} ${hour}:${minute}:${second}.${milliseconds}`;
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

function addNodeTagToZettelkasten(title, content = null) {
    const nodeTagLine = nodeTag + ' ' + title;
    let currentZettelkastenValue = noteInput.getValue();

    // Check if the content ends with a newline and add one or two newlines accordingly
    if (currentZettelkastenValue.endsWith('\n')) {
        currentZettelkastenValue += '\n' + nodeTagLine;
    } else {
        currentZettelkastenValue += '\n\n' + nodeTagLine;
    }

    // Add content if given
    if (content) {
        currentZettelkastenValue += '\n' + content;
    }

    // Set processAll to true
    processAll = true;

    noteInput.setValue(currentZettelkastenValue);
    noteInput.refresh();

    node = scrollToTitle(title, noteInput);

}

function createTextNodeWithPosAndScale(title, text, scale, x, y) {
    const defaultTitle = title || getDefaultTitle();

    // Create the node without scale and position
    const node = createTextNode(defaultTitle, text, undefined, undefined, undefined, undefined);

    // Set position if specified
    if (x !== undefined && y !== undefined) {
        node.pos.x = x;
        node.pos.y = y;
    }

    // Set scale if specified
    if (scale !== undefined) {
        node.scale = scale;
    }

    return node;
}

function spawnZettelkastenNode(spawningNode, offsetDistance = 0.6, theta = null) {
    const scaleFactor = 0.8; // Factor to scale the new node relative to the original

    // If theta is not provided, select a random angle between 0 and 2π
    if (theta === null) {
        theta = Math.random() * Math.PI * 2;
    }

    // Calculate new position based on angle and distance
    const newPositionX = spawningNode.pos.x + offsetDistance * Math.cos(theta) * spawningNode.scale;
    const newPositionY = spawningNode.pos.y + offsetDistance * Math.sin(theta) * spawningNode.scale;
    const newScale = spawningNode.scale * scaleFactor;

    // Create a new node at the calculated position and scale
    const newNode = createTextNodeWithPosAndScale(null, null, newScale, newPositionX, newPositionY);
    newNode.draw();
    restoreZettelkastenEvent = true;
    addNodeTagToZettelkasten(newNode.getTitle());

    return newNode;
}