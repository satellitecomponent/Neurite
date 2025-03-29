On.dblclick(document, (e) => {
    e.stopPropagation();

    // Ensure the click target is the background SVG
    const isSvgBackground = e.target.id === 'svg_bg';
    if (!isSvgBackground) return;

    if (e.getModifierState(controls.altKey.value)) {
        // Alt + double click => Create LLM node
        e.preventDefault();
        createLlmNode('', undefined, undefined, e.clientX, e.clientY).draw();
    } else if (App.nodeMode && !Node.prev) {
        // Shift + double click => Create regular node
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
    return addNodeTagToZettelkasten(title || getDefaultTitle(), content);
}

function addNodeTagToZettelkasten(title, content = null) {
    const curMirror = window.currentActiveZettelkastenMirror;

    const curValue = curMirror.getValue();
    const newVal = [curValue];
    if (!curValue.endsWith('\n')) newVal.push('\n');
    newVal.push('\n', Tag.node, ' ', title);
    if (content) newVal.push('\n', content);
    curMirror.setValue(newVal.join(''));
    curMirror.refresh();

    // Find the UI associated with the current active Zettelkasten mirror
    const ui = window.zettelkastenUIs.find(ui => ui.cm === curMirror);
    if (!ui) return;

    const node = ui.scrollToTitle(title);
    node.contentEditableDiv.value = content;
    node.contentEditableDiv.dispatchEvent(new Event('input'));
    return node;
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

function spawnZettelkastenNode(spawningNode, offsetDistance = 0.6, theta = null, title = null, text = null) {
    const scaleFactor = 0.8; // Factor to scale the new node relative to the original

    if (theta === null) theta = thetaForPos(spawningNode.pos, Graph.lastPos);

    // Calculate new position based on angle and distance
    const newPositionX = spawningNode.pos.x + offsetDistance * Math.cos(theta) * spawningNode.scale;
    const newPositionY = spawningNode.pos.y + offsetDistance * Math.sin(theta) * spawningNode.scale;
    const newScale = spawningNode.scale * scaleFactor;

    // Create a new node at the calculated position and scale
    const newNode = createTextNodeWithPosAndScale(title, text, newScale, newPositionX, newPositionY);
    newNode.draw();
    restoreZettelkastenEvent = true;
    addNodeTagToZettelkasten(newNode.getTitle(), text);

    return newNode;
}

Math.PHI = 5 ** .5 * .5 + .5;
function thetaForNodes(n1, n2){
    const lastEdge = n1.edges[n1.edges.length - 1];
    if (lastEdge) n2 = lastEdge.getPointBarUuid(n1.uuid);
    return thetaForPos(n1.pos, n2.pos);
}
function thetaForPos(pos1, pos2){
    const x = pos2.x - pos1.x;
    const y = pos2.y - pos1.y;
    if (x === 0 && y === 0) return 2 * Math.PI * Math.random();

    const baseTheta = Math.atan2(y, x);
    return (baseTheta + 2 * Math.PI / Math.PHI) % (2 * Math.PI);
}

function spawnMemoryNode(root, title, message) {
    const parent = Node.parentAvailableFromRoot(root);
    const theta = thetaForNodes(parent, root);
    const node = spawnZettelkastenNode(parent, 1.5, theta, title, message);
    connectNodes(parent, node);
    return { node, parent };
}

// Testing for spawnMemoryNode

async function spawnHierarchy(count, delay){
    const root = createLlmNode('Root');
    const allNodes = new Map();
    allNodes.set(root.uuid, root);
    for (let i = 0; i < count; i++) {
        const { node, parent } = spawnMemoryNode(root);
        allNodes.set(node.uuid, node);

        Logger.info("Created", `N${i + 1}`, "under", parent.getTitle());
        await Promise.delay(delay);
    }
    return { root, allNodes };
}

function validateTestResult(res){
    const connectedNodes = new Map();

    function traverse(node){
        if (connectedNodes.has(node.uuid)) return;

        connectedNodes.set(node.uuid, node);
        node.forEachConnectedNode(traverse);
    }
    traverse(res.root);

    const errors = [];
    if (connectedNodes.size !== res.allNodes.size) {
        const msg = "Connectivity check failed: Not every node is connected to the root.";
        Logger.err(msg);
        errors.push(msg);
    } else {
        Logger.info("Connectivity test passed.");
    }
    const activeInstance = getActiveZetCMInstanceInfo();
    if (activeInstance && activeInstance.parser) {
        if (activeInstance.parser.nodeTitleToLineMap.size !== connectedNodes.size - 1) { // for root being LLM
            const msg = "Parser validation failed: The number of parser nodes does not match the number of connected nodes.";
            Logger.err(msg);
            errors.push(msg);
        } else {
            Logger.info("Parser test passed.");
        }
    } else {
        Logger.warn("No active ZettelkastenParser found for validation.");
    }

    function print(node, depth = 0, visited = new Set()){
        if (visited.has(node.uuid)) return;

        visited.add(node.uuid);
        const kids = [];
        node.forEachConnectedNode(kids.push, kids);
        console.log(`${'  '.repeat(depth)}${node.getTitle()} (${kids.length})`);
        kids.forEach( (kid)=>{ print(kid, depth + 1, visited) } );
    }
    print(res.root);

    if (errors.length > 0) {
        throw new Error("Hierarchy tests failed:\n" + errors.join("\n"));
    }

    Logger.info("All tests passed successfully.");
}

async function testHierarchy(count = 30, delay = 1000){
    spawnHierarchy(count, delay).then(validateTestResult)
}
