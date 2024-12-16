/*

function connect(na, nb, length = 0.2, linkStrength = 0.1, linkStyle = {
    stroke: "none",
    "stroke-width": "0.005",
    fill: "lightcyan",
    opacity: "0.5"
}) {
    // Check if edge already exists
    if (na.edges.some(edge => edge.pts.includes(nb)) && nb.edges.some(edge => edge.pts.includes(na))) {
        return;
    }

    let edge = new Edge([na, nb], length, linkStrength, linkStyle);

    na.edges.push(edge);
    nb.edges.push(edge);

    Graph.addEdge(edge);
    return edge;
}

function connectRandom(n) {
    for (let i = 0; i < n; i++) {
        let a = Math.floor(Math.random() * nodes.length);
        let b = Math.floor(Math.random() * nodes.length);
        // Ensures both nodes have the connection
        connect(nodes[a], nodes[b]);
    }
}

//connectRandom(10);
*/

function connectNodes(node1, node2) {
    // Check if the titles are different and ensure the nodes are not the same instance
    if (node1 !== node2 && node1.isTextNode && node2.isTextNode) {
        const title1 = node1.getTitle();
        const title2 = node2.getTitle();

        addEdgeToZettelkasten(title1, title2);
        addEdgeToZettelkasten(title2, title1);
    } else if (node1 !== node2) {
        connectDistance(node1, node2, node1.pos.minus(node2.pos).mag() / 2, undefined, true);
    }
}

function connectDistance(na, nb, linkStrength = 0.1, linkStyle = {
    stroke: "none",
    "stroke-width": "0.005",
    fill: "lightcyan",
    opacity: "0.5"
}) {
    Logger.debug("Connecting:", na.uuid, "to", nb.uuid);

    const existingEdge = na.edges.find(edge =>
        edge.pts.some(pt => pt.uuid === nb.uuid) &&
        nb.edges.some(edge => edge.pts.some(pt => pt.uuid === na.uuid))
    );

    if (existingEdge) {
        Logger.debug("Existing edge found between", na.uuid, "and", nb.uuid);
        return existingEdge;
    }
    // Log positions for debugging
    Logger.debug(`Node A Position: ${na.pos.x}, ${na.pos.y}`);
    Logger.debug(`Node B Position: ${nb.pos.x}, ${nb.pos.y}`);

    // Calculate the distance between the two nodes
    const dx = nb.pos.x - na.pos.x;
    const dy = nb.pos.y - na.pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Half distance to account for radial edge connection.
    const adjustedDistance = distance * 0.5;

    const edge = new Edge([na, nb], adjustedDistance, linkStrength, linkStyle);

    na.edges.push(edge);
    nb.edges.push(edge);

    Graph.addEdge(edge);
    return edge;
}

Edge.prototype.getPointBarUuid = function(uuid){
    const pts = this.pts;
    if (pts?.length !== 2) return;

    return Node.getBarUuid(pts[0], uuid)
        || Node.getBarUuid(pts[1], uuid);
}
Node.getBarUuid = function(node, uuid){
    const id = node?.uuid;
    return id && id !== uuid && node;
}
Node.callNodeOnEdgePerThis = function(edge){
    const pt = edge.getPointBarUuid(this.uuid);
    if (pt) this.cb.call(this.ct, pt);
}
Node.prototype.forEachConnectedNode = function(cb, ct){
    this.edges.forEach(Node.callNodeOnEdgePerThis, {cb, ct, uuid: this.uuid})
}

Node.prototype.getData = function(){
    if (this.isImageNode) {
        Logger.debug("Skipping image node", this.uuid);
        return null;
    }

    const titleInput = this.view.titleInput;
    const title = titleInput ? titleInput.value : "No title found";

    if (!this.createdAt) {
        Logger.warn("Node.getData: Creation time for node", this.uuid, "is not defined.")
    }

    if (this.isLLM) {
        const lastPromptsAndResponses = getLastPromptsAndResponses(4, 400, this.aiResponseTextArea);
        const nodeInfo = `${tagValues.nodeTag} ${title} (AI Node)\nConversation History:${lastPromptsAndResponses}`;
        return nodeInfo;
    }

    const contentText = Node.getTextareaContent(this);
    if (!contentText) {
        Logger.warn("No content found for node");
        return null;
    }

    const nodeInfo = `${tagValues.nodeTag} ${title}\nText Content: ${contentText}`;
    return nodeInfo;
}

Node.prototype.topologicalSort = function(visited, stack, filterAfterLLM = false, branchUUID = undefined){
    visited.add(this.uuid);

    // Push the node to the stack before checking the conditions.
    stack.push(this);

    if (this.isLLM) {
        if (branchUUID === null) {
            branchUUID = this.uuid;  // Assign new branch
        } else if (branchUUID !== this.uuid && branchUUID !== undefined) {
            // Different AI branch, so return after pushing the boundary node.
            return;
        }
    }

    this.forEachConnectedNode( (node)=>{
        if (visited.has(node.uuid)) return;

        const nextFilterAfterLLM = node.isLLM || filterAfterLLM;
        node.topologicalSort(visited, stack, nextFilterAfterLLM, branchUUID);
    })
}

Node.prototype.traverseConnectedNodes = function(cb, ct, filterAfterLLM = false){
    const visited = new Set();
    const stack = [];
    this.topologicalSort(visited, stack, filterAfterLLM, filterAfterLLM ? null : undefined);

    while (stack.length > 0) {
        const currentNode = stack.pop();
        if (currentNode.uuid !== this.uuid) cb.call(ct, currentNode);
    }
}

Node.prototype.getAllConnectedNodesData = function(filterAfterLLM){
    const arr = [];
    const cb = (node)=>{
        arr.push({
            node: node,
            data: node.getData(),
            isLLM: node.isLLM
        })
    }
    this.traverseConnectedNodes(cb, arr, filterAfterLLM);
    return arr;
}

Node.prototype.getAllConnectedNodes = function(filterAfterLLM){
    const arr = [];
    this.traverseConnectedNodes(arr.push, arr, filterAfterLLM);
    return arr;
}
