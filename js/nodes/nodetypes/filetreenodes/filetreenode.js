class FileTreeNode {
    static create(filePath = currentPath, sx, sy, x, y){
        const container = Html.make.div('custom-scrollbar nodeFileTreeContainer');
        const node = new Node();

        const divView = NodeView.addAtNaturalScale(node, filePath, []).div;
        const style = divView.style;
        style.resize = 'both';
        style.minWidth = '250px';
        style.minHeight = '250px';
        style.width = '350px';
        style.height = '350px';
        divView.appendChild(container);

        node.filePath = filePath;
        node.isFileTree = true;
        FileTreeNode.init(node);
        return node;
    }
    static init(node){
        const container = node.content.querySelector('.nodeFileTreeContainer');
        node.fileTreeContainer = container;

        container.innerHTML = '';

        node.fileTree = new FileTree(container, node.view.titleInput, node.filePath, false, (newPath) => {
            node.filePath = newPath; // Update node.filePath when it changes
        });

        FileTreeNode.addContainerListeners(node);
    }
    static addContainerListeners(node){
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
}
