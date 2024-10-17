function createFileTreeNode(filePath = currentPath, sx = undefined, sy = undefined, x = undefined, y = undefined) {
    const name = filePath;
    const fileTreeContainer = document.createElement("div");
    fileTreeContainer.classList.add('custom-scrollbar', 'nodeFileTreeContainer'); // Use class instead of ID
    let node = addNodeAtNaturalScale(name, []);

    let windowDiv = node.windowDiv;
    windowDiv.style.resize = 'both';
    windowDiv.style.minWidth = `250px`;
    windowDiv.style.minHeight = `250px`;
    windowDiv.style.width = `350px`;
    windowDiv.style.height = `350px`;

    // Append the file tree to the node.
    windowDiv.appendChild(fileTreeContainer);

    // Set the correct file path when the node is created or restored
    node.filePath = filePath;  // Ensure filePath is the provided one, not global

    node.isFileTree = true;

    initFileTreeNode(node);

    return node;
}

function initFileTreeNode(node) {
    let fileTreeContainer = node.content.querySelector('.nodeFileTreeContainer');
    node.fileTreeContainer = fileTreeContainer;

    // Clear the file tree container before re-initialization
    node.fileTreeContainer.innerHTML = '';

    node.fileTree = new FileTree(node.fileTreeContainer, node.titleInput, node.filePath, false, (newPath) => {
        node.filePath = newPath; // Update node.filePath when it changes
    });

    addFileTreeContainerListeners(node);
}

function addFileTreeContainerListeners(node) { 

    // Stop mouse-following when interacting with the file tree container
    node.fileTreeContainer.addEventListener('mousedown', (event) => {
        node.followingMouse = 0;
        event.stopPropagation(); // Prevent the event from bubbling up
    });

    // Also stop mouse-following on dragstart (for dragging from the file tree)
    node.fileTreeContainer.addEventListener('dragstart', (event) => {
        node.followingMouse = 0;
        event.stopPropagation(); // Prevent further propagation
    });

    // Ensure dragend doesn't restart following the mouse
    node.fileTreeContainer.addEventListener('dragend', (event) => {
        event.stopPropagation(); // Prevent the dragend from affecting the parent
    });

    // Ensure dragend doesn't restart following the mouse
    node.fileTreeContainer.addEventListener('dblclick', (event) => {
        event.stopPropagation(); // Prevent the dragend from affecting the parent
    });
}