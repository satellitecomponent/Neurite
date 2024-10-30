ContextMenu = {};

ContextMenu.setupEventListeners = function(){
    ['click', 'mousedown', 'mouseup']
    .forEach(Event.stopPropagationByNameForThis, Elem.byId('customContextMenu'))
}
ContextMenu.setupEventListeners();

ContextMenu.position = function(menu, x, y){
    // offset slightly from the cursor
    const offsetX = 5;
    const offsetY = -10;

    const menuWidth = menu.offsetWidth;
    if (x + menuWidth + offsetX > window.innerWidth) { // off the right side
        x -= menuWidth + offsetX;
    } else {
        x += offsetX;
    }

    const menuHeight = menu.offsetHeight;
    if (y + menuHeight + offsetY > window.innerHeight) { // off the bottom
        y -= menuHeight + offsetY;
    } else {
        y += offsetY;
    }

    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'block';
}

ContextMenu.open = function(x, y, target){
    const menu = Elem.byId('customContextMenu');
    ContextMenu.position(menu, x, y);
    // Reposition the suggestion box if it's already displayed
    if (Suggestions.global.container.style.display === 'block') {
        Suggestions.global.position(x, y);
    }
    menu.innerHTML = ''; // clear options
    const node = findNodeForElement(target);
    if (node) {
        ContextMenu.populateForNode(menu, node, x, y);
        return;
    }
    const edge = Edge.SvgMap.get(target.closest('path'));
    if (edge) {
        ContextMenu.populateForEdge(menu, edge);
        return;
    }
    if (target.id === 'svg_bg' || target.closest('#svg_bg')) {
        ContextMenu.populateForBackground(menu, target);
    } else {
        ContextMenu.populateForGeneric(menu);
    }
}

function findNodeForElement(element) {
    for (const uuid in nodeMap) {
        const node = nodeMap[uuid];
        const content = node.content;
        if (content === element || content.contains(element)) return node;
    }
}

function createMenuItem(displayText, uniqueIdentifier, action) {
    const li = document.createElement('li');
    li.textContent = displayText;
    li.dataset.identifier = uniqueIdentifier;
    li.classList.add('dynamic-option');
    On.click(li, action);
    return li;
}

// Helper function to remove a menu item
function removeMenuItem(menu, text) {
    const itemToRemove = Array.from(menu.children).find(item => item.textContent === text);
    if (itemToRemove) menu.removeChild(itemToRemove);
}

function createInputField(menu){
    const inputLi = document.createElement('li');
    inputLi.classList.add('input-item');
    inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.placeholder = 'Enter method';
    inputField.classList.add('dynamic-input', 'custom-node-method-input');
    inputLi.appendChild(inputField);
    menu.appendChild(inputLi);
    return inputField;
}
ContextMenu.populateForNode = function(menu, node, pageX, pageY){
    const inputField = menu.querySelector('.custom-node-method-input') || createInputField(menu);
    setupSuggestionsForInput(menu, inputField, node, getNodeMethodSuggestions, pageX, pageY);
    loadPinnedItemsToContextMenu(menu, node);
}

ContextMenu.populateForEdge = function(menu, edge){
    const handler = edge.toggleDirection.bind(edge);
    menu.appendChild(createMenuItem('updateDirection', 'update-direction', handler));

    menu.appendChild(createMenuItem('delete', 'delete-edge', () => {
        edge.removeEdgeInstance();
        ContextMenu.hide();
    }));
}

ContextMenu.populateForBackground = function(menu, target){
    menu.append(
        // Option to create a Text Node (without calling draw)
        makeNodeCreationOption('+ Note', createNodeFromWindow, false),
        makeNodeCreationOption('+ Ai', createLlmNode, true),
        // Option to create a Link Node or Search Google
        makeNodeCreationOption('+ Link', returnLinkNodes, false),
        makeFileSelectionOption('+ File', handleFileSelection),
        makePasteOption(target)
    )
}

ContextMenu.populateForGeneric = function(menu){ // non-SVG targets
    menu.appendChild(makeGenericOption("Generic Action", handleGenericAction))
}



let rightClickFileInput = null; // Declare a variable to hold the file input element

function makeFileSelectionOption(text, fileSelectionFunction){
    const li = document.createElement('li');
    li.textContent = text;
    li.classList.add('dynamic-option');
    On.click(li, fileSelectionFunction);
    return li;
}

function handleFileSelection() {
    if (!rightClickFileInput) {
        // Create the file input element if it doesn't exist
        rightClickFileInput = document.createElement('input');
        rightClickFileInput.type = 'file';
        On.change(rightClickFileInput, (e)=>{
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            On.load(reader, (e)=>{
                const data = e.target.result;
                const customEvent = {
                    preventDefault: () => { },
                    dataTransfer: {
                        getData: () => data,
                        files: [file], // file as an array
                        items: [{
                            kind: 'file',
                            getAsFile: () => file
                        }]
                    }
                };
                dropHandler(customEvent);
            });
            reader.readAsText(file);
        });
    }
    rightClickFileInput.click();
    ContextMenu.hide();
}

function makeNodeCreationOption(text, createNodeFunction, shouldDraw){
    const li = document.createElement('li');
    li.textContent = text;
    li.classList.add('dynamic-option');
    On.click(li, createAndDrawNode.bind(null, createNodeFunction, shouldDraw));
    return li;
}

function makeGenericOption(text, actionFunction){
    const li = document.createElement('li');
    li.textContent = text;
    li.classList.add('dynamic-option');
    On.click(li, actionFunction);
    return li;
}

function createAndDrawNode(createNodeFunction, shouldDraw) {
    const node = createNodeFunction();
    if (shouldDraw) node.draw();
    ContextMenu.hide();
}

function handleGenericAction(target) {
    Logger.info("Generic action for:", target);
}

ContextMenu.hide = function(){
    Elem.hideById('customContextMenu');
    Elem.hideById('suggestions-container');
}

On.mousedown(document, (e)=>{
    const clickedInsideMenu = Elem.byId('customContextMenu').contains(e.target);
    if (!clickedInsideMenu) {
        const suggestionsContainer = Elem.byId('suggestions-container');
        const clickedInsideSuggestions = suggestionsContainer && suggestionsContainer.contains(e.target);
        if (!clickedInsideSuggestions) ContextMenu.hide();
    }
});

function makePasteOption(target){
    const li = document.createElement('li');
    li.textContent = 'Paste';
    li.classList.add('dynamic-option');
    On.click(li, async (e)=>{
        try {
            const pastedData = await navigator.clipboard.readText();
            handlePasteData(pastedData, target);
        } catch (err) {
            Logger.err("In reading from clipboard:", err);
        }
        ContextMenu.hide();
    });
    return li;
}

function addCopyOptionIfTextSelected(menu) {
    if (window.getSelection().isCollapsed) return;

    const li = document.createElement('li');
    li.textContent = 'Copy';
    li.classList.add('dynamic-option');
    On.click(li, copySelectedText);
    menu.appendChild(li);
}

function copySelectedText() {
    const selection = window.getSelection();
    if (!selection.isCollapsed) {
        // There's a text selection
        navigator.clipboard.writeText(selection.toString())
            .then(ContextMenu.hide)
            .catch(Logger.err.bind(Logger, "Failed to copy text:"));
    } else {
        Logger.info("No text selected")
    }
    ContextMenu.hide();
}
