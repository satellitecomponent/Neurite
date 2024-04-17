
function nextUUID() {
    while (nodeMap[NodeUUID] !== undefined) {
        NodeUUID++;
    }
    return NodeUUID;
}

// Global array for selected UUIDs
let selectedNodeUUIDs = new Set();

// Function to clone the current set of selected UUIDs
function cloneSelectedUUIDs() {
    return new Set(selectedNodeUUIDs);
}

// Function to toggle node selection
function toggleNodeSelection(node) {
    if (selectedNodeUUIDs.has(node.uuid)) {
        node.windowDiv.classList.toggle('selected');
        selectedNodeUUIDs.delete(node.uuid); // Deselect
        //console.log(`deselected`);
    } else {
        node.windowDiv.classList.toggle('selected');
        selectedNodeUUIDs.add(node.uuid); // Select
        //console.log(`selected`);
    }
}

// Restores selections from a saved state
function restoreNodeSelections(savedUUIDs) {
    savedUUIDs.forEach(uuid => {
        const node = findNodeByUUID(uuid);
        if (node) {
            node.windowDiv.classList.add('selected');
            selectedNodeUUIDs.add(uuid);
        }
    });
}

function clearNodeSelection() {
    selectedNodeUUIDs.forEach(uuid => {
        const node = findNodeByUUID(uuid); // Implement this function based on how your nodes are stored
        if (node) {
            node.windowDiv.classList.remove('selected');
        }
    });
    selectedNodeUUIDs.clear(); // Clear the set of selected UUIDs
}

function getCentroidOfSelectedNodes() {
    const selectedNodes = getSelectedNodes();
    if (selectedNodes.length === 0) return null;

    let sumPos = new vec2(0, 0);
    selectedNodes.forEach(node => {
        sumPos = sumPos.plus(node.pos);
    });
    return sumPos.scale(1 / selectedNodes.length);
}

function edgeFromJSON(o, nodeMap) {
    let pts = o.p.map((k) => nodeMap[k]);

    if (pts.includes(undefined)) {
        console.warn("missing keys", o, nodeMap);
    }

    // Check if edge already exists
    for (let e of edges) {
        let e_pts = e.pts.map(n => n.uuid).sort();
        let o_pts = o.p.sort();
        if (JSON.stringify(e_pts) === JSON.stringify(o_pts)) {
            // Edge already exists, return without creating new edge
            return;
        }
    }

    let e = new Edge(pts, o.l, o.s, o.g);

    for (let pt of pts) {
        pt.addEdge(e); // add edge to all points
    }

    edges.push(e);
    return e;
}

function updateNodeEdgesLength(node) {
    node.edges.forEach(edge => {
        const currentLength = edge.currentLength;
        if (currentLength) {
            edge.length = currentLength;
        }
    });
}

function scaleSelectedNodes(scaleFactor, centralPoint) {
    const selectedNodes = getSelectedNodes();

    selectedNodes.forEach(node => {
        // Scale the node
        node.scale *= scaleFactor;


        // Adjust position to maintain relative spacing only if the node is not anchored
        if (node.anchorForce !== 1) {
            let directionToCentroid = node.pos.minus(centralPoint);
            node.pos = centralPoint.plus(directionToCentroid.scale(scaleFactor));
        }

        updateNodeEdgesLength(node);
    });

    // If needed, scale the user screen (global zoom)
    //zoom = zoom.scale(scaleFactor);
    //pan = centralPoint.scale(1 - scaleFactor).plus(pan.scale(scaleFactor));
}

function findNodeByUUID(uuid) {
    return nodes.find(node => node.uuid === uuid);
}

function getSelectedNodes() {
    // Return an array of node objects based on the selected UUIDs
    return Array.from(selectedNodeUUIDs).map(uuid => nodeMap[uuid]);
}

function getNodeByTitle(title) {
    const lowerCaseTitle = title.toLowerCase();
    let matchingNodes = [];

    for (let n of nodes) {
        let nodeTitle = n.getTitle();

        if (nodeTitle !== null && nodeTitle.toLowerCase() === lowerCaseTitle) {
            matchingNodes.push(n);
        }
    }

    // Debugging: Show all matching nodes and their count
    //console.log(`Found ${matchingNodes.length} matching nodes for title ${title}.`);
    //console.log("Matching nodes:", matchingNodes);

    return matchingNodes.length > 0 ? matchingNodes[0] : null;
}
function getTextareaContentForNode(node) {
    if (!node || !node.content) {
        console.warn('Node or node.content is not available');
        return null;
    }

    if (!node.isTextNode) {
        console.warn('Node is not a text node. Skipping text area and editable div logic.');
        return null;
    }

    const editableDiv = node.contentEditableDiv;
    const hiddenTextarea = node.textarea;

    if (!editableDiv || !hiddenTextarea) {
        console.warn('Either editableDiv or hiddenTextarea is not found.');
        return null;
    }

    // Sync and log content before and after syncing
    //console.log('Before Sync:', editableDiv.innerText, hiddenTextarea.value);
    syncTextareaWithContentEditable(hiddenTextarea, editableDiv);
    //console.log('After Sync:', editableDiv.innerText, hiddenTextarea.value);

    // Trigger input to process any dependent logic
    hiddenTextarea.dispatchEvent(new Event('input'));

    // Return the textarea content
    return hiddenTextarea.value;
}

function testNodeText(title) {
    const node = getNodeByTitle(title);
    if (node) {
        console.log(`Fetching text for node with title: ${title}`);
        const text = getTextareaContentForNode(node);
        console.log(`Text fetched: ${text}`);
        return text;
    } else {
        console.warn(`Node with title ${title} not found`);
        return null;
    }
}

function getNodeText() {
    const nodes = [];
    for (const child of htmlnodes_parent.children) {
        if (child.firstChild && child.firstChild.win) {
            const node = child.firstChild.win;

            const titleInput = node.content.querySelector("input.title-input");
            //console.log(`Title Input for ${titleInput ? titleInput.value : 'Unnamed Node'}:`, titleInput); // Debugging line

            const contentText = getTextareaContentForNode(node);
            //console.log(`Content Text for ${titleInput ? titleInput.value : 'Unnamed Node'}:`, contentText); // Debugging line

            nodes.push({
                ...node,
                titleInput: titleInput ? titleInput.value : '',
                contentText: contentText ? contentText : ''
            });
        } else {
            console.warn('Node or child.firstChild.win not found'); // Debugging line
        }
    }
    return nodes;
}