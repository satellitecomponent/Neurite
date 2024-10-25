function nextUUID() {
    while (nodeMap[NodeUUID] !== undefined) {
        NodeUUID++;
    }
    return NodeUUID;
}



const SelectedNodes = {
    uuids: new Set()
};
SelectedNodes.forEach = function(cb, ct){
    SelectedNodes.uuids.forEach(
        (uuid)=>cb.call(ct, nodeMap[uuid])
    )
}
SelectedNodes.hasNode = function(node){
    return SelectedNodes.uuids.has(node.uuid)
}

SelectedNodes.toggleNode = function(node){
    node.windowDiv.classList.toggle('selected');
    const isSelected = SelectedNodes.uuids.has(node.uuid);
    SelectedNodes.uuids[isSelected ? 'delete' : 'add'](node.uuid);
    //console.log(isSelected ? 'deselected' : 'selected');
}

SelectedNodes.restoreNodeById = function(uuid){
    const node = findNodeByUUID(uuid);
    if (!node) return;

    node.windowDiv.classList.add('selected');
    SelectedNodes.uuids.add(uuid);
}

SelectedNodes.clear = function(){
    SelectedNodes.uuids.forEach(SelectedNodes.clearNodeById);
    SelectedNodes.uuids.clear();
}
SelectedNodes.clearNodeById = function(uuid){
    const node = findNodeByUUID(uuid);
    if (node) node.windowDiv.classList.remove('selected');
}

SelectedNodes.getCentroid = function(){
    if (SelectedNodes.uuids.size === 0) return null;

    let sumPos = new vec2(0, 0);
    SelectedNodes.forEach(
        (node)=>(sumPos = sumPos.plus(node.pos))
    );
    return sumPos.scale(1 / SelectedNodes.uuids.size);
}

SelectedNodes.collectEdges = function(){
    const uniqueEdges = new Set();
    SelectedNodes.forEach(node => {
        node.edges.forEach(edge => {
            if (edge.pts.every(SelectedNodes.hasNode)) uniqueEdges.add(edge);
        });
    });
    return uniqueEdges;
}



function edgeFromJSON(o, nodeMap) {
    const pts = o.p.map((k) => nodeMap[k]);

    if (pts.includes(undefined)) {
        console.warn("missing keys", o, nodeMap);
    }

    // Check if edge already exists
    for (const e of Graph.edges) {
        const e_pts = e.pts.map(n => n.uuid).sort();
        const o_pts = o.p.sort();
        if (JSON.stringify(e_pts) === JSON.stringify(o_pts)) return; // Edge already exists
    }

    const e = new Edge(pts, o.l, o.s, o.g);
    pts.forEach(Node.addEdgeThis, e);
    Graph.edges.push(e);
    return e;
}

function updateNodeEdgesLength(node) {
    node.edges.forEach(edge => {
        const currentLength = edge.currentLength;
        if (currentLength) edge.length = currentLength;
    })
}

SelectedNodes.scale = function(scaleFactor, centralPoint){
    SelectedNodes.forEach(node => {
        node.scale *= scaleFactor;

        // Adjust position to maintain relative spacing only if the node is not anchored
        if (node.anchorForce !== 1) {
            const directionToCentroid = node.pos.minus(centralPoint);
            node.pos = centralPoint.plus(directionToCentroid.scale(scaleFactor));
        }

        updateNodeEdgesLength(node);
    });

    // If needed, scale the user screen (global zoom)
    //zoom = zoom.scale(scaleFactor);
    //pan = centralPoint.scale(1 - scaleFactor).plus(pan.scale(scaleFactor));
}

function findNodeByUUID(uuid) {
    return Graph.nodes.find(node => node.uuid === uuid);
}

function getNodeByTitle(title) {
    const lCaseTitle = title.toLowerCase();
    const matchingNodes = [];

    for (const node of Graph.nodes) {
        const lCaseNodeTitle = node.getTitle()?.toLowerCase();
        if (lCaseNodeTitle === lCaseTitle) matchingNodes.push(node);
    }

    // Debugging: Show all matching nodes and their count
    //console.log(`Found ${matchingNodes.length} matching nodes for title ${title}.`);
    //console.log("Matching nodes:", matchingNodes);

    return (matchingNodes.length > 0 ? matchingNodes[0] : null);
}
function getTextareaContentForNode(node) {
    if (!node?.content) {
        console.warn("Node or node.content is not available");
        return null;
    }

    if (!node.isTextNode) {
        //console.warn("Node is not a text node. Skipping getText.");
        return null;
    }

    const editableTextarea = node.contentEditableDiv;
    if (!editableTextarea) {
        console.warn('editableTextarea not found.');
        return null;
    }

    return editableTextarea.value;
}

function testNodeText(title) {
    Graph.nodes.forEach(node => {
        const textarea = node.content.querySelector('textarea');
        console.log("From nodes array");
        if (textarea) {
            console.log("Node UUID:", node.uuid, "- Textarea value from DOM:", textarea.value);
        } else {
            console.log("Node UUID:", node.uuid, "- No textarea found in DOM");
        }
    });

    const node = getNodeByTitle(title);
    if (node) {
        console.log("Fetching text for node with title:", title);
        const text = getTextareaContentForNode(node);
        console.log("Text fetched:", text);
        return text;
    } else {
        console.warn("Node with title", title, "not found");
        return null;
    }
}

function getNodeText() {
    const nodes = [];
    for (const nodeKey in nodeMap) {
        const node = nodeMap[nodeKey];

        const titleInput = node.titleInput;
        const contentText = node.hiddenTextarea;

        nodes.push({
            ...node,
            titleInput: titleInput ? titleInput.value : '',
            contentText: contentText ? contentText.value : ''
        });
    }
    return nodes;
}
