function preventEventPropagation(event) {
    event.stopPropagation();
}

function setupContextMenuEventListeners() {
    const menu = document.getElementById('customContextMenu');
    menu.addEventListener('mousedown', preventEventPropagation);
    menu.addEventListener('mouseup', preventEventPropagation);
    menu.addEventListener('click', preventEventPropagation);
}

// Call this function once to set up the event listeners
setupContextMenuEventListeners();


function positionContextMenu(menu, x, y) {
    // Adjust the position of the menu to offset it slightly from the cursor
    const offsetX = 5; // Horizontal offset
    const offsetY = -10; // Vertical offset

    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Check if the menu would go off the right side of the screen
    if (x + menuWidth + offsetX > windowWidth) {
        x -= menuWidth + offsetX;
    } else {
        x += offsetX;
    }

    // Check if the menu would go off the bottom of the screen
    if (y + menuHeight + offsetY > windowHeight) {
        y -= menuHeight + offsetY;
    } else {
        y += offsetY;
    }

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.display = 'block';
}

function clearMenuOptions(menu) {
    menu.innerHTML = '';
}


document.addEventListener('contextmenu', function (event) {
    // Function to check if default context menu should be used
    function shouldUseDefaultContextMenu(target) {
        return target.closest('.dropdown, .CodeMirror, #customContextMenu, #suggestions-container, .modal-content, .tooltip') ||
            target.tagName === 'IFRAME' ||
            target.tagName === 'IMG' ||
            target.tagName === 'VIDEO';
    }

    // Exit if Ctrl key is pressed or default context menu should be used
    if (event.ctrlKey || shouldUseDefaultContextMenu(event.target)) {
        hideContextMenu();
        return;
    }

    // Prevent the default context menu and show the custom one
    event.preventDefault();
    openCustomContextMenu(event.pageX, event.pageY, event.target);
});


function openCustomContextMenu(x, y, target) {
    const menu = document.getElementById('customContextMenu');
    positionContextMenu(menu, x, y);
    // Reposition the suggestion box if it's already displayed
    if (globalSuggestions.container.style.display === 'block') {
        globalSuggestions.position(x, y);
    }
    clearMenuOptions(menu);
    const node = findNodeForElement(target);
    if (node) {
        populateMenuForNode(menu, node, x, y);
        return;
    }
    const edge = findEdgeForElement(target);
    if (edge) {
        populateMenuForEdge(menu, edge);
        return;
    }
    if (target.id === 'svg_bg' || target.closest('#svg_bg')) {
        populateMenuForBackground(menu, target);
    } else {
        populateMenuForGeneric(menu);
    }
}

function findNodeForElement(element) {
    for (const uuid in nodeMap) {
        if (nodeMap.hasOwnProperty(uuid)) {
            const node = nodeMap[uuid];
            if (node.content === element || node.content.contains(element)) {
                return node;
            }
        }
    }
    return null;
}

function findEdgeForElement(element) {
    if (element instanceof SVGElement) {
        const pathElement = element.closest('path');
        if (pathElement) {
            return edgeSVGMap.get(pathElement) || null;
        }
    }
    return null;
}

// Helper function to create a menu item
function createMenuItem(displayText, uniqueIdentifier, action) {
    const menuItem = document.createElement('li');
    menuItem.textContent = displayText;
    menuItem.dataset.identifier = uniqueIdentifier;
    menuItem.classList.add('dynamic-option');
    menuItem.addEventListener('click', action);
    return menuItem;
}

// Helper function to remove a menu item
function removeMenuItem(menu, text) {
    const itemToRemove = Array.from(menu.children).find(item => item.textContent === text);
    if (itemToRemove) {
        menu.removeChild(itemToRemove);
    }
}


function addNodeMethodInput(menu, node, pageX, pageY) {
    let inputField = menu.querySelector('.custom-node-method-input');
    if (!inputField) {
        const inputLi = document.createElement('li');
        inputLi.classList.add('input-item');
        inputField = document.createElement('input');
        inputField.type = 'text';
        inputField.placeholder = 'Enter method';
        inputField.classList.add('dynamic-input', 'custom-node-method-input');
        inputLi.appendChild(inputField);
        menu.appendChild(inputLi);
    }

    setupSuggestionsForInput(menu, inputField, node, getNodeMethodSuggestions, pageX, pageY);
}

function populateMenuForNode(menu, node, pageX, pageY) {
    addNodeMethodInput(menu, node, pageX, pageY);

    // Load pinned items each time the menu is opened
    loadPinnedItemsToContextMenu(menu, node);
}

function populateMenuForEdge(menu, edge) {
    // Option to change direction
    menu.appendChild(createMenuItem('updateDirection', 'update-direction', () => {
        edge.toggleDirection();
    }));

    // Option to delete edge
    menu.appendChild(createMenuItem('delete', 'delete-edge', () => {
        edge.removeEdgeInstance();
        hideContextMenu();
    }));
}


function populateMenuForBackground(menu, target) {
    // Option to create a Text Node (without calling draw)
    addNodeCreationOption(menu, '+ Note', createNodeFromWindow, false);
    // Option to create an LLM Node
    addNodeCreationOption(menu, '+ Ai', createLLMNode, true);
    // Option to create a Link Node or Search Google
    addNodeCreationOption(menu, '+ Link', returnLinkNodes, false);
    // Option to select a file
    addFileSelectionOption(menu, '+ File', handleFileSelection);
    addPasteOption(menu, target);
}

function populateMenuForGeneric(menu) {
    // Generic action for non-SVG targets
    addGenericOption(menu, 'Generic Action', handleGenericAction);
}



let rightClickFileInput = null; // Declare a variable to hold the file input element

function addFileSelectionOption(menu, text, fileSelectionFunction) {
    const li = document.createElement('li');
    li.textContent = text;
    li.classList.add('dynamic-option');
    li.onclick = () => fileSelectionFunction();
    menu.appendChild(li);
}

function handleFileSelection() {
    if (!rightClickFileInput) {
        // Create the file input element if it doesn't exist
        rightClickFileInput = document.createElement('input');
        rightClickFileInput.type = 'file';
        rightClickFileInput.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const data = e.target.result;
                    const customEvent = {
                        preventDefault: () => { },
                        dataTransfer: {
                            getData: () => data,
                            files: [file],  // Pass the selected file as an array
                            items: [{
                                kind: 'file',
                                getAsFile: () => file
                            }]
                        }
                    };
                    dropHandler(customEvent); // Pass the custom event object to dropHandler
                };
                reader.readAsText(file);
            }
        };
    }
    rightClickFileInput.click();
    hideContextMenu();
}


function addNodeCreationOption(menu, text, createNodeFunction, shouldDraw) {
    const li = document.createElement('li');
    li.textContent = text;
    li.classList.add('dynamic-option');
    li.onclick = () => createAndDrawNode(createNodeFunction, shouldDraw);
    menu.appendChild(li);
}

function addGenericOption(menu, text, actionFunction) {
    const li = document.createElement('li');
    li.textContent = text;
    li.classList.add('dynamic-option');
    li.onclick = () => actionFunction();
    menu.appendChild(li);
}

function createAndDrawNode(createNodeFunction, shouldDraw) {
    const node = createNodeFunction();
    if (shouldDraw) {
        node.draw();
    }
    hideContextMenu();
}

function handleGenericAction(target) {
    console.log('Generic action for:', target);
    // Additional logic for handling generic actions
}

function hideContextMenu() {
    const menu = document.getElementById('customContextMenu');
    if (menu) {
        menu.style.display = 'none';
    }

    // Now this should correctly select the suggestions container by its ID
    const suggestionsContainer = document.getElementById('suggestions-container');
    if (suggestionsContainer) {
        suggestionsContainer.style.display = 'none';
    }
}

document.addEventListener('mousedown', function (event) {
    const menu = document.getElementById('customContextMenu');
    const suggestionsContainer = document.getElementById('suggestions-container');

    const clickedInsideMenu = menu.contains(event.target);
    const clickedInsideSuggestions = suggestionsContainer && suggestionsContainer.contains(event.target);

    if (!clickedInsideMenu && !clickedInsideSuggestions) {
        hideContextMenu();
    }
});

function addPasteOption(menu, target) {
    const pasteLi = document.createElement('li');
    pasteLi.textContent = 'Paste';
    pasteLi.classList.add('dynamic-option');
    pasteLi.onclick = async () => {
        try {
            let pastedData = await navigator.clipboard.readText();
            handlePasteData(pastedData, target);
        } catch (err) {
            console.error('Error reading from clipboard:', err);
        }
        hideContextMenu();
    };
    menu.appendChild(pasteLi);
}

function addCopyOptionIfTextSelected(menu) {
    const selection = window.getSelection();
    if (!selection.isCollapsed) {
        const copyLi = document.createElement('li');
        copyLi.textContent = 'Copy';
        copyLi.classList.add('dynamic-option');
        copyLi.onclick = copySelectedText;
        menu.appendChild(copyLi);
    }
}


function copySelectedText() {
    const selection = window.getSelection();
    if (!selection.isCollapsed) {
        // There's a text selection
        navigator.clipboard.writeText(selection.toString())
            .then(() => hideContextMenu())
            .catch(err => console.error('Failed to copy text: ', err));
    } else {
        console.log('No text selected');
    }
    hideContextMenu();
}