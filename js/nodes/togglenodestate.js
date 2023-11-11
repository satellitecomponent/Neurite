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
    let div = node.content.querySelector('.window');
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

            div.style.display = 'relative';
            // Adjust the window to make it look like a circle
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
            titleInput.style.transform = 'translate(-50%, -50%)';
            titleInput.style.border = 'none';
            titleInput.style.textAlign = 'center';
            titleInput.style.pointerEvents = 'none';
            titleInput.style.fontSize = '25px';

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

    // Logic to handle the button's visibility after node expansion
    let button = div.querySelector('.code-button');
    if (button) { // Check if the button exists
        if (node.addCodeButton || (document.getElementById('code-checkbox') && document.getElementById('code-checkbox').checked)) {
            button.style.display = "block";
        } else {
            button.style.display = "none";
        }
    }

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