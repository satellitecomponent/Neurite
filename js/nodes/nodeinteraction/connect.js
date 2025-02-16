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

Node.parentAvailableFromRoot = function(root, max = 3, filterAfterLLM = false){
    const queue = [root];
    const visited = new Set([root.uuid]);

    while (queue.length) {
        const node = queue.shift();
        const kids = [];
        node.forEachConnectedNode( (kid)=>{
            if (kid.isTextNode) kids.push(kid)
        });
        if (kids.length < max) {
            if (node.isTextNode ||
                (filterAfterLLM && node.isLLM) ||
                node === root) return node;
        }

        kids.forEach( (kid)=>{
            if (visited.has(kid.uuid)) return;

            visited.add(kid.uuid);
            queue.push(kid);
        });
    }
    return root;
}

function thetaForNodes(n1, n2){
    if (n1 === n2) return Math.random() * Math.PI * 2;

    const vector = new vec2(n1.pos.x - n2.pos.x, n1.pos.y - n2.pos.y);
    const baseTheta = vector.ang();
    return baseTheta + (Math.random() * Math.PI - Math.PI / 2);
}
async function spawnHierarchy(count, delay){
    const root = createLlmNode('Root');
    const allNodes = new Map();
    allNodes.set(root.uuid, root);
    for (let i = 0; i < count; i++) {
        const parent = Node.parentAvailableFromRoot(root);

        const theta = thetaForNodes(parent, root);
        const node = spawnZettelkastenNode(parent, 1.5, theta);
        connectNodes(parent, node);
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
