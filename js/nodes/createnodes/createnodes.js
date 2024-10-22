document.addEventListener('dblclick', function (e) {
    // Cancel the default behavior of the event
    cancel(e);

    if (e.getModifierState(controls.altKey.value)) {
        // Alt + double click behavior
        e.preventDefault();
        createLlmNode('', undefined, undefined, e.clientX, e.clientY).draw();
    } else if (nodeMode && !prevNode) { // Node mode (Shift) + double click behavior *text nodes
        createNodeFromWindow();
    }
});

function getDefaultTitle(){
    return String.titleFromDate(new Date())
}

String.titleFromDate = function(date){
    const zeroPadded = String.zeroPadded;

    const YY = String(date.getFullYear()).slice(-2); // Extracting last two digits of the year
    const MM = zeroPadded(date.getMonth() + 1, 2); // Months are zero-based
    const DD = zeroPadded(date.getDate(), 2);
    const HH = zeroPadded(date.getHours(), 2);
    const mm = zeroPadded(date.getMinutes(), 2);
    const SS = zeroPadded(date.getSeconds(), 2);
    const sss = zeroPadded(date.getMilliseconds(), 3);
    //const amPm = hour >= 12 ? 'PM' : 'AM';

    return `${YY}-${MM}-${DD} ~ ${HH}:${mm}:${SS}.${sss}`;
}
String.zeroPadded = function(num, len){
    return String(num).padStart(len, '0')
}

// Function to handle node creation from a window (double-click behavior)
function createNodeFromWindow(title = null, content = null, followMouse = false) {
    nodefromWindow = true;
    if (followMouse) followMouseFromWindow = true;
    addNodeTagToZettelkasten(title || getDefaultTitle(), content);
}

function addNodeTagToZettelkasten(title, content = null) {
    const curMirror = window.currentActiveZettelkastenMirror;

    const curValue = curMirror.getValue();
    const newlines = (curValue.endsWith('\n') ? '\n' : '\n\n');
    curMirror.setValue(curValue + newlines + Tag.node + ' ' + title);
    curMirror.refresh();

    // Find the UI associated with the current active Zettelkasten mirror
    const ui = window.zettelkastenUIs.find(ui => ui.cm === curMirror);
    if (!ui) return;

    node = ui.scrollToTitle(title);
    node.contentEditableDiv.value = content;
    node.contentEditableDiv.dispatchEvent(new Event('input'));
}

function createTextNodeWithPosAndScale(title, text, scale, x, y) {
    // Create the node without scale and position
    const node = TextNode.create(title || getDefaultTitle(), text);

    if (scale !== undefined) node.scale = scale;
    if (x !== undefined && y !== undefined) {
        node.pos.x = x;
        node.pos.y = y;
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
