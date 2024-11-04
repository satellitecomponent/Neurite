class Graph {
    draggedNode = null;
    edges = [];
    nodes = {};
    movingNode;
    #nextUuid = 0;

    deleteNode(node){ delete this.nodes[node.uuid] }
    edgeForTarget(target){ return Edge.SvgMap.get(target.closest('path')) }
    forEachNode(cb, ct){
        const nodes = this.nodes;
        for (const uuid in nodes) cb.call(ct, nodes[uuid]);
    }
    get nextUuid(){
        const nodes = this.nodes;
        while (nodes[this.#nextUuid]) {
            this.#nextUuid += 1;
        }
        return this.#nextUuid;
    }
    nodeForTarget(target){
        return this.nodes[target.closest('[data-uuid]')?.dataset.uuid]
    }
    registerNode(node){
        let id = this.nodes.length;
        let div = node.content;
        /*div.setAttribute("onclick","(e)=>nodes["+id+"].onclick(e)");
        div.setAttribute("onmousedown","(e)=>nodes["+id+"].onmousedown(e)");
        div.setAttribute("onmouseup","(e)=>nodes["+id+"].onmouseup(e)");
        div.setAttribute("onmousemove","(e)=>nodes["+id+"].onmousemove(e)");*/
        this.nodes[node.uuid] = node;
    }
}
Graph = new Graph();



class SelectedNodes {
    uuids = new Set();

    forEach(cb, ct){
        this.uuids.forEach( (uuid)=>cb.call(ct, Node.byUuid(uuid)) )
    }
    hasNode(node){ return this.uuids.has(node.uuid) }

    toggleNode(node){
        node.windowDiv.classList.toggle('selected');
        const isSelected = this.uuids.has(node.uuid);
        this.uuids[isSelected ? 'delete' : 'add'](node.uuid);
        Logger.debug(isSelected ? 'deselected' : 'selected');
    }

    restoreNodeById(uuid){
        const node = Node.byUuid(uuid);
        if (!node) return;

        node.windowDiv.classList.add('selected');
        this.uuids.add(uuid);
    }

    clear(){
        this.uuids.forEach(this.clearNodeById);
        this.uuids.clear();
    }
    clearNodeById(uuid){
        const node = Node.byUuid(uuid);
        if (node) node.windowDiv.classList.remove('selected');
    }

    getCentroid(){
        if (this.uuids.size === 0) return null;

        let sumPos = new vec2(0, 0);
        this.forEach(
            (node)=>{ sumPos = sumPos.plus(node.pos) }
        );
        return sumPos.scale(1 / this.uuids.size);
    }

    collectEdges(){
        const uniqueEdges = new Set();
        this.forEach(node => {
            node.edges.forEach(edge => {
                if (edge.pts.every(this.hasNode, this)) uniqueEdges.add(edge);
            });
        });
        return uniqueEdges;
    }

    scale(scaleFactor, centralPoint){
        this.forEach(node => {
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
}
SelectedNodes = new SelectedNodes();



function updateNodeEdgesLength(node) {
    node.edges.forEach(edge => {
        const currentLength = edge.currentLength;
        if (currentLength) edge.length = currentLength;
    })
}

function edgeFromJSON(edgeData) {
    const nodes = Graph.nodes;
    const pts = edgeData.p.map((k) => nodes[k]);
    if (pts.includes(undefined)) Logger.warn("missing keys", edgeData, nodes);

    // Check if edge already exists
    for (const e of Graph.edges) {
        const e_pts = e.pts.map(n => n.uuid).sort();
        const o_pts = edgeData.p.sort();
        if (JSON.stringify(e_pts) === JSON.stringify(o_pts)) return; // Edge already exists
    }

    const e = new Edge(pts, edgeData.l, edgeData.s, edgeData.g);
    pts.forEach(Node.addEdgeThis, e);
    Graph.edges.push(e);
    return e;
}

function getNodeByTitle(title) {
    const lCaseTitle = title.toLowerCase();
    const matchingNodes = [];

    Graph.forEachNode( (node)=>{
        const lCaseNodeTitle = node.getTitle()?.toLowerCase();
        if (lCaseNodeTitle === lCaseTitle) matchingNodes.push(node);
    });

    Logger.debug(`Found ${matchingNodes.length} matching nodes for title ${title}.`);
    Logger.debug("Matching nodes:", matchingNodes);

    return (matchingNodes.length > 0 ? matchingNodes[0] : null);
}
function getTextareaContentForNode(node) {
    if (!node?.content) {
        Logger.warn("Node or node.content is not available");
        return null;
    }

    if (!node.isTextNode) {
        Logger.debug("Node is not a text node. Skipping getText.");
        return null;
    }

    const editableTextarea = node.contentEditableDiv;
    if (!editableTextarea) {
        Logger.warn("editableTextarea not found.");
        return null;
    }

    return editableTextarea.value;
}
function testNodeText(title) {
    Graph.forEachNode( (node)=>{
        const textarea = node.content.querySelector('textarea');
        Logger.info("From nodes array");
        if (textarea) {
            Logger.info("Node UUID:", node.uuid, "- Textarea value from DOM:", textarea.value)
        } else {
            Logger.info("Node UUID:", node.uuid, "- No textarea found in DOM")
        }
    });

    const node = getNodeByTitle(title);
    if (node) {
        Logger.info("Fetching text for node with title:", title);
        const text = getTextareaContentForNode(node);
        Logger.info("Text fetched:", text);
        return text;
    } else {
        Logger.warn("Node with title", title, "not found");
        return null;
    }
}

function getNodeText() {
    const nodes = [];
    Graph.forEachNode( (node)=>{
        const titleInput = node.titleInput;
        const contentText = node.hiddenTextarea;

        nodes.push({
            ...node,
            titleInput: titleInput ? titleInput.value : '',
            contentText: contentText ? contentText.value : ''
        });
    });
    return nodes;
}
