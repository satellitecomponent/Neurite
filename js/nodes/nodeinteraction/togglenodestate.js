function toggleNodeState(nodeOrTitle, cm, event) {
    let node;
    let title;

    if (typeof nodeOrTitle === 'string') {
        title = nodeOrTitle;
        node = getNodeByTitle(title);
    } else {
        node = nodeOrTitle;
        title = node.getTitle();
    }

    if (!node || !node.content) return;
    let div = node.windowDiv;
    let circle = div.querySelector('.collapsed-circle'); // Find the circle here

    // Collapse or expand based on current state
    if (div && div.collapsed) {
        expandNode(node, div, circle);
        if (title) showNodeText(title, cm); // Show node text in CodeMirror
    } else {
        collapseNode(node)(null);
        if (title) hideNodeText(title, cm); // Hide node text in CodeMirror
    }

    // Check if the alt key is being held
    if (event && event.altKey) {
        let allConnectedNodes = getAllConnectedNodes(node);
        allConnectedNodes.forEach(connectedNode => {
            toggleNodeState(connectedNode, cm); // Pass the connected node
        });
    }
}

let originalSizes = new Map();  // A map to store original sizes keyed by node

function collapseNode(node) {
    return function (event) {
        let div = node.content.querySelector('.window');

        if (!originalSizes.has(node)) {
            originalSizes.set(node, {
                width: getComputedStyle(div).width,
                height: getComputedStyle(div).height
            });
        }
        let titleInput = div.querySelector('.title-input');
        let headerContainer = div.querySelector('.header-container');

        if (!div.collapsed) {
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
            div.style.display = 'inline-block'; // or 'block' depending on your layout needs
            //div.style.position = 'relative'; // only if you need specific positioning
            div.style.width = '60px';
            div.style.height = '60px';
            div.style.borderRadius = '50%';
            // Capture the box-shadow of the window div
            let boxShadow = getComputedStyle(div).boxShadow;

            div.style.boxShadow = 'none'; // Remove box-shadow from div
            div.style.backdropFilter = 'none';
            div.classList.add('collapsed');

            // Position title input in the center
            titleInput.style.position = 'absolute';
            titleInput.style.top = '50%';
            titleInput.style.left = '50%';
            titleInput.style.transform = 'translate(-47.5%, -59%)';
            titleInput.style.border = 'none';
            titleInput.style.textAlign = 'center';
            titleInput.style.pointerEvents = 'none';
            titleInput.style.fontSize = '25px';
            titleInput.style.width = 'fit-content';

            // Create the circle
            let circle = document.createElement('div');
            circle.className = 'collapsed-circle';
            circle.style.borderRadius = '50%';
            circle.style.boxShadow = boxShadow;

            div.appendChild(circle);

            // Prevent the browser's default drag behavior for the circle
            circle.ondragstart = function (event) {
                event.preventDefault();
            };

            // If window is anchored, switch out for the collapsed node anchor class
            if (div.classList.contains('window-anchored')) {
                div.classList.remove('window-anchored');
                circle.classList.add('collapsed-anchor');
            }

            function handleCircleDoubleClick(event) {
                if (nodeMode !== 1) {
                    if (circle.classList.contains('collapsed-anchor')) {
                        circle.classList.remove('collapsed-anchor');
                    } else {
                        circle.classList.add('collapsed-anchor');
                    }
                } else {
                    // Call the toggleNodeState function instead of expanding the node directly
                    toggleNodeState(node, myCodeMirror, event); // Assuming myCodeMirror is in scope
                    event.stopPropagation(); // Prevent the event from propagating up the DOM tree only in node mode
                }
            }

            circle.addEventListener('dblclick', handleCircleDoubleClick);

            //Flag for toggleanchored in node class
            div.collapsed = true;
        } else {
            expandNode(node, div);
        }
    }
}

function expandNode(node, div, circle) {
    if (originalSizes.has(node)) {
        const originalSize = originalSizes.get(node);
        div.style.width = originalSize.width;
        div.style.height = originalSize.height;
    }
    // Reset the window properties
    div.style.display = '';
    div.style.borderRadius = '';
    div.style.backgroundColor = '';
    div.style.borderColor = '';
    div.style.boxShadow = '';
    div.style.backdropFilter = '';
    div.classList.remove('collapsed');

    // Show all the children of the window div
    let children = Array.from(div.children);
    for (let child of children) {
        child.style.display = '';
    }

    // Show the children of the header container
    let headerChildren = Array.from(div.querySelector('.header-container').children);
    for (let child of headerChildren) {
        child.style.display = '';
    }

    // Reset the title input's position and transformation
    let titleInput = div.querySelector('.title-input');
    titleInput.style.position = '';
    titleInput.style.top = '';
    titleInput.style.left = '';
    titleInput.style.transform = '';
    titleInput.style.textAlign = '';
    titleInput.style.pointerEvents = '';
    titleInput.style.border = '';
    titleInput.style.fontSize = '';

    // Transfer the .window-anchored class from circle to node.content if present
    if (circle && circle.classList.contains('collapsed-anchor')) {
        div.classList.add('window-anchored');
        circle.classList.remove('collapsed-anchor');
    }

    // Remove the circle from the window div
    if (circle) {
        div.removeChild(circle);
    }

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
let isDraggingDragBox = false;
let dragBox = null;
let startX, startY;

document.addEventListener('mousedown', function (event) {
    if (event.button === 0 && event.altKey) { // Right-click and Ctrl key
        event.preventDefault();
        event.stopPropagation();
        isDraggingDragBox = true;
        startX = event.pageX;
        startY = event.pageY;

        dragBox = document.createElement('div');
        dragBox.className = 'drag-box';
        dragBox.style.left = `${startX}px`;
        dragBox.style.top = `${startY}px`;
        document.body.appendChild(dragBox);
    }
});

document.addEventListener('mousemove', function (event) {
    if (isDraggingDragBox) {
        event.preventDefault();
        event.stopPropagation();
        const currentX = event.pageX;
        const currentY = event.pageY;

        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        dragBox.style.width = `${width}px`;
        dragBox.style.height = `${height}px`;

        dragBox.style.left = `${Math.min(startX, currentX)}px`;
        dragBox.style.top = `${Math.min(startY, currentY)}px`;
    }
});

document.addEventListener('mouseup', function (event) {
    if (isDraggingDragBox) {
        isDraggingDragBox = false;

        // Flag to check if any node is selected
        let isAnyNodeSelected = false;

        // Finalize the drag box bounds
        dragBoxBounds = {
            left: parseInt(dragBox.style.left, 10),
            top: parseInt(dragBox.style.top, 10),
            right: parseInt(dragBox.style.left, 10) + parseInt(dragBox.style.width, 10),
            bottom: parseInt(dragBox.style.top, 10) + parseInt(dragBox.style.height, 10)
        };

        // Check for intersection with node windows and select them
        Object.values(nodeMap).forEach(node => {
            const nodeDiv = node.windowDiv; // Assuming this is how you access the windowDiv of a node
            const rect = nodeDiv.getBoundingClientRect();

            if (rect.left < dragBoxBounds.right && rect.right > dragBoxBounds.left &&
                rect.top < dragBoxBounds.bottom && rect.bottom > dragBoxBounds.top) {
                toggleNodeSelection(node); // Assuming this function handles the selection logic
                isAnyNodeSelected = true; // Update flag as a node is selected
            }
        });

        // If no nodes were selected, clear the current selection
        if (!isAnyNodeSelected) {
            clearNodeSelection(); // Assuming this function clears the selection
        }

        // Clean up
        dragBox.remove();
        dragBox = null;
        dragBoxBounds = null;
    }
});