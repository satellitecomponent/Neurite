function toggleNodeState(node, event) {
    if (!node?.content) return;

    const div = node.windowDiv;
    if (div?.collapsed) {
        expandNode(node, div, div.querySelector('.collapsed-circle'));
    } else {
        collapseNode(node)(null);
    }
    if (node.isTextNode) {
        ui = getZetNodeCMInstance(node).ui;
        const title = node.getTitle();
        if (title) (div?.collapsed ? ui.hideNodeText(title) : ui.showNodeText(title));
    }

    // Check if the alt key is being held
    if (event && event.getModifierState(controls.altKey.value)) {
        getAllConnectedNodes(node).forEach(toggleNodeState);
    }
}

const originalSizes = new Map();  // A map to store original sizes keyed by node

function centerTitleInput(titleInput){
    const style = titleInput.style;
    style.position = 'absolute';
    style.top = '50%';
    style.left = '50%';
    style.transform = 'translate(-47.5%, -59%)';
    style.border = 'none';
    style.textAlign = 'center';
    style.pointerEvents = 'none';
    style.fontSize = '25px';
    style.width = 'fit-content';
}
function resetTitleInput(titleInput){
    const style = titleInput.style;
    style.position = '';
    style.top = '';
    style.left = '';
    style.transform = '';
    style.border = '';
    style.textAlign = '';
    style.pointerEvents = '';
    style.fontSize = '';
}

function collapseNode(node) {
    return function (event) {
        const div = node.content.querySelector('.window');

        if (!originalSizes.has(node)) {
            const style = getComputedStyle(div);
            originalSizes.set(node, {
                width: style.width,
                height: style.height,
                minWidth: style.minWidth,
                minHeight: style.minHeight,
                maxWidth: style.maxWidth,
                maxHeight: style.maxHeight
            });
        }
        const titleInput = div.querySelector('.title-input');
        const headerContainer = div.querySelector('.header-container');

        if (div.collapsed) {
            expandNode(node, div);
            return;
        }

        div.originalSize = {
            width: div.offsetWidth,
            height: div.offsetHeight
        };

        // Hide all children of the window div except headerContainer and titleInput
        Array.from(div.children).forEach(child => {
            if (child !== headerContainer && child !== titleInput) {
                child.style.display = 'none';
            }
        });

        // Hide all children of headerContainer except titleInput
        Array.from(headerContainer.children).forEach(child => {
            if (child !== titleInput) {
                child.style.display = 'none';
            }
        });

        const style = div.style;
        style.display = 'inline-block';
        style.minWidth = '60px';
        style.minHeight = '60px';
        style.width = '60px';
        style.height = '60px';
        style.maxWidth = '60px';
        style.maxHeight = '60px';
        style.borderRadius = '50%';
        style.boxShadow = 'none';
        style.backdropFilter = 'none';
        div.classList.add('collapsed');

        centerTitleInput(titleInput);

        // Create the circle
        const circle = document.createElement('div');
        circle.className = 'collapsed-circle';
        circle.style.borderRadius = '50%';
        circle.style.boxShadow = getComputedStyle(div).boxShadow;

        div.appendChild(circle);

        circle.ondragstart = function (e) {
            e.preventDefault();
        };

        // If window is anchored, switch out for the collapsed node anchor class
        if (div.classList.contains('window-anchored')) {
            div.classList.remove('window-anchored');
            circle.classList.add('collapsed-anchor');
        }

        function handleCircleDoubleClick(e) {
            if (nodeMode !== 1) {
                const classList = circle.classList;
                if (classList.contains('collapsed-anchor')) {
                    classList.remove('collapsed-anchor');
                } else {
                    classList.add('collapsed-anchor');
                }
            } else {
                // Call the toggleNodeState function instead of expanding the node directly
                toggleNodeState(node, e);
                e.stopPropagation();
            }
        }

        circle.addEventListener('dblclick', handleCircleDoubleClick);

        div.collapsed = true;
    }
}

function expandNode(node, div, circle) {
    const style = div.style;
    if (originalSizes.has(node)) {
        const originalSize = originalSizes.get(node);
        style.width = originalSize.width;
        style.height = originalSize.height;
        style.minWidth = originalSize.minWidth;
        style.minHeight = originalSize.minHeight;
        style.maxWidth = originalSize.maxWidth;
        style.maxHeight = originalSize.maxHeight;
    }
    // Reset the window properties
    style.display = '';
    style.borderRadius = '';
    style.backgroundColor = '';
    style.borderColor = '';
    style.boxShadow = '';
    style.backdropFilter = '';
    div.classList.remove('collapsed');

    for (const child of Array.from(div.children)) {
        child.style.display = ''; // i.e. show
    }

    const container = div.querySelector('.header-container');
    for (const child of Array.from(container.children)) {
        child.style.display = ''; // i.e. show
    }

    resetTitleInput(div.querySelector('.title-input'));

    // Transfer the .window-anchored class from circle to node.content if present
    if (circle && circle.classList.contains('collapsed-anchor')) {
        div.classList.add('window-anchored');
        circle.classList.remove('collapsed-anchor');
    }

    if (circle) div.removeChild(circle);

    div.collapsed = false;
}



//Drag Box Selection

/*
document.addEventListener('contextmenu', function (event) {
    if (event.ctrlKey) {
        event.preventDefault();
        event.stopPropagation();
        // Additional logic for when right-click is combined with Ctrl key
        // ...
    }
});
*/
let dragBox = null;
let startX, startY;

document.addEventListener('mousedown', function (e) {
    if (e.button === 0 && e.getModifierState(controls.altKey.value)) {
        e.preventDefault();
        e.stopPropagation();
        isDraggingDragBox = true;
        startX = e.pageX;
        startY = e.pageY;

        dragBox = document.createElement('div');
        dragBox.className = 'drag-box';
        dragBox.style.left = startX + 'px';
        dragBox.style.top = startY + 'px';
        document.body.appendChild(dragBox);
    }
});

document.addEventListener('mousemove', function (e) {
    if (isDraggingDragBox) {
        e.preventDefault();
        e.stopPropagation();

        const currentX = e.pageX;
        const currentY = e.pageY;

        const style = dragBox.style;
        style.width = Math.abs(currentX - startX) + 'px';
        style.height = Math.abs(currentY - startY) + 'px';
        style.left = Math.min(startX, currentX) + 'px';
        style.top = Math.min(startY, currentY) + 'px';
    }
});

document.addEventListener('mouseup', function (e) {
    if (isDraggingDragBox) {
        isDraggingDragBox = false;

        let isAnyNodeSelected = false;

        // Finalize the drag box bounds
        const style = dragBox.style;
        const left = parseInt(style.left, 10);
        const top = parseInt(style.top, 10);
        dragBoxBounds = {
            left, top,
            right: left + parseInt(style.width, 10),
            bottom: top + parseInt(style.height, 10)
        };

        // Check for intersection with node windows and select them
        Object.values(nodeMap).forEach(node => {
            const rect = node.windowDiv.getBoundingClientRect();
            const isNodeSelected = (rect.left < dragBoxBounds.right && rect.right > dragBoxBounds.left &&
                                    rect.top < dragBoxBounds.bottom && rect.bottom > dragBoxBounds.top);
            if (!isNodeSelected) return;

            SelectedNodes.toggleNode(node);
            isAnyNodeSelected = true;
        });

        if (!isAnyNodeSelected) SelectedNodes.clear();

        dragBox.remove();
        dragBox = null;
        dragBoxBounds = null;
    }
});
