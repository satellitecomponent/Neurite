function createFileTreeNode(filePath = currentPath, sx = undefined, sy = undefined, x = undefined, y = undefined) {
    const fileTreeContainer = document.createElement('div');
    fileTreeContainer.classList.add('custom-scrollbar', 'nodeFileTreeContainer'); // Use class instead of ID
    const node = addNodeAtNaturalScale(filePath, []);

    const windowDiv = node.windowDiv;
    const style = windowDiv.style;
    style.resize = 'both';
    style.minWidth = '250px';
    style.minHeight = '250px';
    style.width = '350px';
    style.height = '350px';
    windowDiv.appendChild(fileTreeContainer);

    node.filePath = filePath;
    node.isFileTree = true;
    initFileTreeNode(node);
    return node;
}

function initFileTreeNode(node) {
    const fileTreeContainer = node.content.querySelector('.nodeFileTreeContainer');
    node.fileTreeContainer = fileTreeContainer;

    // Clear the file tree container before re-initialization
    fileTreeContainer.innerHTML = '';

    node.fileTree = new FileTree(fileTreeContainer, node.titleInput, node.filePath, false, (newPath) => {
        node.filePath = newPath; // Update node.filePath when it changes
    });

    addFileTreeContainerListeners(node);
}

function addFileTreeContainerListeners(node) { 

    // Stop mouse-following when interacting with the file tree container
    node.fileTreeContainer.addEventListener('mousedown', (event) => {
        node.followingMouse = 0;
        event.stopPropagation();
    });

    // Also stop mouse-following on dragstart (for dragging from the file tree)
    node.fileTreeContainer.addEventListener('dragstart', (event) => {
        node.followingMouse = 0;
        event.stopPropagation();
    });

    // Ensure dragend doesn't restart following the mouse
    node.fileTreeContainer.addEventListener('dragend', Elem.stopPropagationOfEvent);

    // Ensure dragend doesn't restart following the mouse
    node.fileTreeContainer.addEventListener('dblclick', Elem.stopPropagationOfEvent);
}
