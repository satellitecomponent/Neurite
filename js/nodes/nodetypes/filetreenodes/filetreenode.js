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
    function stopFollowingMouse(e){
        node.followingMouse = 0;
        e.stopPropagation();
    }

    const container = node.fileTreeContainer;
    On.mousedown(container, stopFollowingMouse);
    On.dragstart(container, stopFollowingMouse);
    On.dragend(container, Event.stopPropagation);
    On.dblclick(container, Event.stopPropagation);
}
