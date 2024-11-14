class Graph {
    draggedNode = null;
    edges = {};
    edgeDirectionalities = {};
    edgeViews = {};
    funcPopulate = 'populateForBackground';
    htmlEdges = Elem.byId('edges');
    htmlNodes = Elem.byId('nodes');
    nodes = {};
    nodeViews = {};
    model = svg;
    movingNode;
    #nextUuid = 0;
    own = {self: this};

    addEdge(edge){
        this.addEdgeView(edge.view);
        this.edges[edge.edgeKey] = edge;
    }
    addEdgeView(edgeView){
        this.edgeViews[edgeView.id] = edgeView;
        this.htmlEdges.append(edgeView.svgArrow, edgeView.svgBorder, edgeView.svgLink);
    }
    addNode(node){
        let id = this.nodes.length;
        let div = node.content;
        /*div.setAttribute("onclick","(e)=>nodes["+id+"].onclick(e)");
        div.setAttribute("onmousedown","(e)=>nodes["+id+"].onmousedown(e)");
        div.setAttribute("onmouseup","(e)=>nodes["+id+"].onmouseup(e)");
        div.setAttribute("onmousemove","(e)=>nodes["+id+"].onmousemove(e)");*/
        if (node.view) this.nodeViews[node.view.id] = node.view;
        this.nodes[node.uuid] = node;
    }
    appendNode(node){ this.htmlNodes.append(node.content) }

    clear(){
        SelectedNodes.clear();
        this.forEachEdge(this.deleteEdge, this);
        this.edgeDirectionalities = {};
        this.forEachNode(this.deleteNode, this);
    }
    deleteEdge(edge){
        this.edgeDirectionalities[edge.edgeKey] = edge.directionality;

        // Remove this edge from both connected nodes' edges arrays
        edge.pts.forEach(Node.removeThisEdge, edge);

        this.deleteEdgeView(edge.view);
        delete this.edges[edge.edgeKey];
    }
    deleteEdgeView(edgeView){
        edgeView.svgArrow.remove();
        edgeView.svgBorder.remove();
        edgeView.svgLink.remove();
        delete this.edgeViews[edgeView.id];
    }
    deleteNode(target){
        const dels = [];
        this.forEachNode( (node)=>{
            for (const edge of node.edges) {
                if (edge.pts.includes(target)) dels.push(edge);
            }
        });
        for (const edge of dels) edge.remove();

        // Remove target node from the edges array of any nodes it was connected to
        this.forEachNode(Node.filterEdgesToThis, target);

        const uuid = target.uuid;
        SelectedNodes.uuids.delete(uuid);
        delete this.nodeViews[uuid];
        delete this.nodes[uuid];

        target.removed = true;
        target.content.remove();
    }

    filterNodes(cb, ct){
        const arr = [];
        const nodes = this.nodes;
        for (const uuid in nodes) {
            const node = nodes[uuid];
            if (cb.call(ct, node)) arr.push(node);
        }
        return arr;
    }
    forEachEdge(cb, ct){ Object.forEach(this.edges, cb, ct) }
    forEachEdgeView(cb, ct){ Object.forEach(this.edgeViews, cb, ct) }
    forEachNode(cb, ct){ Object.forEach(this.nodes, cb, ct) }
    forEachNodeView(cb, ct){ Object.forEach(this.nodeViews, cb, ct) }

    get nextUuid(){
        const nodes = this.nodes;
        while (nodes[this.#nextUuid]) {
            this.#nextUuid += 1;
        }
        return this.#nextUuid;
    }
    setEdgeDirectionalityFromData(edgeData){
        this.edgeDirectionalities[edgeData.edgeKey] ||= {
            start: Node.byUuid(edgeData.directionality.start),
            end: Node.byUuid(edgeData.directionality.end)
        }
    }
    viewForElem(target){
        const viewType = target.dataset.viewType;
        if (viewType) return this[viewType][target.dataset.viewId];

        const elem = target.closest('[data-view-type]');
        if (elem) return this[elem.dataset.viewType][elem.dataset.viewId];
    }
}
Graph = new Graph();
svg.dataset.viewType = 'own';
svg.dataset.viewId = 'self';



class SelectedNodes {
    uuids = new Set();

    forEach(cb, ct){
        this.uuids.forEach( (uuid)=>{
            const node = Node.byUuid(uuid);
            if (node) cb.call(ct, node);
        })
    }
    forEachView(cb, ct){
        this.uuids.forEach( (id)=>{
            const nodeView = NodeView.byId(id);
            if (nodeView) cb.call(ct, nodeView);
        })
    }
    hasNode(node){ return this.uuids.has(node.uuid) }

    toggleNode(node){
        node.view.toggleSelected();
        const isSelected = this.uuids.has(node.uuid);
        this.uuids[isSelected ? 'delete' : 'add'](node.uuid);
        Logger.debug(isSelected ? 'deselected' : 'selected');
    }

    restoreNodeById(id){
        const nodeView = NodeView.byId(id);
        if (!nodeView) return;

        nodeView.toggleSelected(true);
        this.uuids.add(id);
    }

    clear(){
        this.forEachView(NodeView.toggleSelectedToThis, false);
        this.uuids.clear();
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
    Graph.forEachEdge( (edge)=>{
        const e_pts = edge.pts.map(n => n.uuid).sort();
        const o_pts = edgeData.p.sort();
        if (JSON.stringify(e_pts) === JSON.stringify(o_pts)) return; // Edge already exists
    });

    const edge = new Edge(pts, edgeData.l, edgeData.s, edgeData.g);
    pts.forEach(Node.addEdgeThis, edge);
    Graph.addEdge(edge);
    return edge;
}

Node.byTitle = function(title){
    const lCaseTitle = title.toLowerCase();
    const matchingNodes = Graph.filterNodes(
        (node)=>(node.getTitle()?.toLowerCase() === lCaseTitle)
    );

    Logger.debug(`Found ${matchingNodes.length} matching nodes for title ${title}.`);
    Logger.debug("Matching nodes:", matchingNodes);

    return (matchingNodes.length > 0 ? matchingNodes[0] : null);
}
Node.getTextareaContent = function(node){
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

    const node = Node.byTitle(title);
    if (!node) {
        Logger.warn("Node with title", title, "not found");
        return null;
    }

    const text = Node.getTextareaContent(node);
    Logger.info("Node with title:", title, "has text:", text);
    return text;
}

function getNodeText() {
    const nodes = [];
    Graph.forEachNode( (node)=>{
        const titleInput = node.view.titleInput;
        const contentText = node.hiddenTextarea;

        nodes.push({
            ...node,
            titleInput: titleInput ? titleInput.value : '',
            contentText: contentText ? contentText.value : ''
        });
    });
    return nodes;
}
