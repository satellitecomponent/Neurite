class Graph {
    draggedNode = null;
    edges = {};
    edgeDirectionalities = {};
    edgeViews = {};
    funcPopulate = 'populateForBackground';
    htmlEdges = Elem.byId('edges');
    htmlNodes = Elem.byId('nodes');
    lastPos = {x: 0, y: 0};
    model = svg;
    mouseDownPos = new vec2(0, 0);
    mousePos = new vec2(0, 0);
    movingNode;
    #nextUuid = 0;
    nodes = {};
    nodeViews = {};
    own = {self: this};
    pan = new vec2(0, 0);
    rotation = new vec2(1, 0);
    zoom = new vec2(1, 0); // bigger is farther out

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
        this.lastPos = node.pos;
    }
    appendNode(node){ this.htmlNodes.append(node.content) }

    clear(){
        App.selectedNodes.clear();
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
        App.selectedNodes.uuids.delete(uuid);
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
    findEdge(cb, ct){
        const edges = this.edges;
        for (const edgeKey in edges) {
            const edge = edges[edgeKey];
            if (cb.call(ct, edge)) return edge;
        }
    }
    forEachEdge(cb, ct){ Object.forEach(this.edges, cb, ct) }
    forEachEdgeView(cb, ct){ Object.forEach(this.edgeViews, cb, ct) }
    forEachNode(cb, ct){ Object.forEach(this.nodes, cb, ct) }
    forEachNodeView(cb, ct){ Object.forEach(this.nodeViews, cb, ct) }

    mouseDownPos_setXY(x, y){
        this.mouseDownPos.x = x ?? this.mousePos.x;
        this.mouseDownPos.y = y ?? this.mousePos.y;
    }
    mousePos_setXY(x, y){
        this.mousePos.x = x;
        this.mousePos.y = y;
    }

    get nextUuid(){
        const nodes = this.nodes;
        while (nodes[this.#nextUuid]) {
            this.#nextUuid += 1;
        }
        return this.#nextUuid;
    }

    pan_decBy(vec){
        this.pan = this.pan.minus(vec);
        return this;
    }
    pan_incBy(vec){
        this.pan = this.pan.plus(vec);
        return this;
    }
    pan_set(vecNew){
        this.pan = vecNew;
        return this;
    }

    setEdgeDirectionalityFromData(edgeData){
        this.edgeDirectionalities[edgeData.edgeKey] ||=
            Edge.directionalityFromData(edgeData.directionality)
    }
    updateRotationByAngle(angle){
//        const delta = new vec2(Math.cos(angle), Math.sin(angle));
//        this.rotation = this.rotation.cmult(delta);
        const x = Math.cos(angle);
        const y = Math.sin(angle);
        const rotation = this.rotation;
        this.rotation = new vec2(
            rotation.x * x - rotation.y * y,
            rotation.y * x + rotation.x * y
        )
        return this;
    }
    vecToZ(c = this.mousePos){
//        Svg.updateScaleAndOffset();
//        return c.minus(Svg.offset).unscale(Svg.scale)
//            .minus(new vec2(.5, .5)).scale(2)
//            .cmult(this.zoom).cadd(this.pan);
        return this.xyToZ(c.x, c.y)
    }
    viewForElem(target){
        const viewType = target.dataset.viewType;
        if (viewType) return this[viewType][target.dataset.viewId];

        const elem = target.closest('[data-view-type]');
        if (elem) return this[elem.dataset.viewType][elem.dataset.viewId];
    }
    xyToZ(x, y){
        Svg.updateScaleAndOffset();
        return new vec2(
            ((x - Svg.offset.x) / Svg.scale - .5) * 2,
            ((y - Svg.offset.y) / Svg.scale - .5) * 2
        ).cmult(this.zoom).cadd(this.pan);
    }

    zoom_cmultWith(o){
        this.zoom = this.zoom.cmult(o);
        return this;
    }
    zoom_rotBy(angle){
        this.zoom = this.zoom.rot(angle);
        return this;
    }
    zoom_set(vecNew){
        this.zoom = vecNew;
        return this;
    }
    zoom_scaleBy(scale){
        this.zoom = this.zoom.scale(scale);
        return this;
    }
}
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
    reduce(cb, init){
        return this.uuids.values().reduce( (acc, uuid)=>{
            const node = Node.byUuid(uuid);
            return (node ? cb(acc, node) : acc);
        }, init)
    }

    toggleNode(node){
        node.view.toggleSelected();
        const isSelected = this.uuids.has(node.uuid);
        this.uuids[isSelected ? 'delete' : 'add'](node.uuid);
        Logger.debug(isSelected ? 'deselected' : 'selected');
    }
    static toggleNode(node){ App.selectedNodes.toggleNode(node) }

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

        const cb = (sumPos, node)=>sumPos.plus(node.pos) ;
        return this.reduce(cb, new vec2(0, 0)).scale(1 / this.uuids.size);
    }

    getUniqueEdges(){
        return this.reduce( (set, node)=>{
            node.edges.forEach( (edge)=>{
                if (edge.pts.every(this.hasNode, this)) set.add(edge)
            });
            return set;
        }, new Set())
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
        //Graph.zoom_scaleBy(scaleFactor)
        //    .pan_set(centralPoint.scale(1 - scaleFactor).plus(Graph.pan.scale(scaleFactor)));
    }
}



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
    const edgeKey = edgeData.edgeKey;
    if (Graph.findEdge( (edge)=>(edge.edgeKey === edgeKey) )) return;

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
