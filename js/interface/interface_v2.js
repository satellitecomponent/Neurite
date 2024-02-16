//https://github.com/tc39/proposal-regex-escaping/blob/main/specInJs.js
// this is a direct translation to code of the spec
if (!RegExp.escape) {
    RegExp.escape = (S) => {
        // 1. let str be ToString(S).
        // 2. ReturnIfAbrupt(str).
        let str = String(S);
        // 3. Let cpList be a List containing in order the code
        // points as defined in 6.1.4 of str, starting at the first element of str.
        let cpList = Array.from(str[Symbol.iterator]());
        // 4. let cuList be a new List
        let cuList = [];
        // 5. For each code point c in cpList in List order, do:
        for (let c of cpList) {
            // i. If c is a SyntaxCharacter then do:
            if ("^$\\.*+?()[]{}|".indexOf(c) !== -1) {
                // a. Append "\" to cuList.
                cuList.push("\\");
            }
            // Append c to cpList.
            cuList.push(c);
        }
        //6. Let L be a String whose elements are, in order, the elements of cuList.
        let L = cuList.join("");
        // 7. Return L.
        return L;
    };
}

var zoomTo = new vec2(4, 0);
var panTo = new vec2(0, 0);
var autopilotReferenceFrame = undefined;
var autopilotSpeed = 0;

function skipAutopilot() {
    zoom = zoomTo
    pan = autopilotReferenceFrame ? autopilotReferenceFrame.pos.plus(panTo) : panTo;
}


let prevNode = undefined;


function nextUUID() {
    while (nodeMap[NodeUUID] !== undefined) {
        NodeUUID++;
    }
    return NodeUUID;
}
class Node {
    constructor(p, thing, scale = 1, intrinsicScale = 1, createEdges = true) {
        this.anchor = new vec2(0, 0);
        this.anchorForce = 0;
        this.mouseAnchor = new vec2(0, 0);
        this.edges = [];
        this.createdAt = new Date().toISOString();
        this.init = (nodeMap) => { };
        if (p === undefined) {
            let n = thing;
            let o = JSON.parse(n.dataset.node_json)
            for (const k of ['anchor', 'mouseAnchor', 'vel', 'pos', 'force']) {
                o[k] = new vec2(o[k]);
            }
            for (const k in o) {
                this[k] = o[k];
            }
            this.save_extras = [];
            this.content = thing;
            if (n.dataset.node_extras) {
                o = JSON.parse(n.dataset.node_extras);
                for (const e of o) {
                    NodeExtensions[e.f](this, e.a);
                }
            }
            this.attach();
            this.content.setAttribute("data-uuid", this.uuid);
            if (n.dataset.edges !== undefined && createEdges) {
                let es = JSON.parse(n.dataset.edges);
                this.init = ((nodeMap) => {
                    for (let e of es) {
                        edgeFromJSON(e, nodeMap);
                    }
                }).bind(this);
            }
            return;
        } else {
            this.uuid = nextUUID();
        }
        this.uuid = "" + this.uuid;

        this.pos = p;
        this.scale = scale;
        this.intrinsicScale = intrinsicScale;

        this.content = thing;

        this.vel = new vec2(0, 0);
        this.force = new vec2(0, 0);
        this.followingMouse = 0;
        this.followingAiCursor = false;
        this.aiCursorAnchor = new vec2(0, 0);

        this.removed = false;

        this.content.setAttribute("data-uuid", this.uuid);
        this.attach();
        this.save_extras = [];
    }
    attach() {
        let div = this.content;
        let node = this;
        div.onclick = node.onclick.bind(node);
        div.ondblclick = node.ondblclick.bind(node);
        div.onmousedown = node.onmousedown.bind(node);
        document.onmousemove = this.onmousemove.bind(this);
        document.onmouseup = this.onmouseup.bind(this);
        div.onwheel = node.onwheel.bind(node);
    }
    json() {
        return JSON.stringify(this, (k, v) => {
            if (k === "content" || k === "edges" || k === "save_extras" ||
                k === "aiResponseEditor" || k === "aiCursor" || k === "responseHandler" ||
                k === "windowDiv") { // Exclude windowDiv as well
                return undefined;
            }
            return v;
        });
    }
    push_extra_cb(f) {
        this.save_extras.push(f);
    }
    push_extra(func_name, args = undefined) {
        this.save_extras.push({
            f: func_name,
            a: args
        });
    }


    draw() {
        put(this.content, this.pos, this.intrinsicScale * this.scale * (zoom.mag2() ** -settings.zoomContentExp));

        // Before saving, get the current title input value and store it in a data-attribute
        let titleInput = this.content.querySelector('.title-input');
        if (titleInput) {
            this.content.setAttribute('data-title', titleInput.value);
        }

        this.content.setAttribute("data-node_json", this.json());
        let se = [];
        for (let e of this.save_extras) {
            se.push(typeof e === "function" ? e(this) : e);
        }
        this.content.setAttribute("data-node_extras", JSON.stringify(se));
    }

    step(dt) {
        if (dt === undefined || isNaN(dt)) {
            dt = 0;
        } else {
            if (dt > 1) {
                dt = 1;
            }
        }
        if (!this.followingMouse) {
            this.pos = this.pos.plus(this.vel.scale(dt / 2));
            this.vel = this.vel.plus(this.force.scale(dt));
            this.pos = this.pos.plus(this.vel.scale(dt / 2));
            this.force = this.vel.scale(-Math.min(this.vel.mag() + 0.4 + this.anchorForce, 1 / (dt + 1e-300)));
        } else {
            this.vel = new vec2(0, 0);
            this.force = new vec2(0, 0);
        }
        /*if (this.followingAiCursor) {
            let p = toZ(this.aiCursor.position).minus(this.aiCursorAnchor);
            this.vel = p.minus(this.pos).unscale(nodeMode ? 1 : dt);
            this.pos = p;
            this.anchor = this.pos;
        }
        if (this.followingAiCursor && this.aiCursor) {
            let finalPosition = this.aiCursor.initialPosition.plus(this.aiCursor.updatePosition);
            this.pos = toDZ(finalPosition);
        }*/
        let g = mandGrad(settings.iterations, this.pos);
        //g.y *= -1; //why?
        this.force = this.force.plus(g.unscale((g.mag2() + 1e-10) * 300));
        this.force = this.force.plus(this.anchor.minus(this.pos).scale(this.anchorForce));
        //let d = toZ(mousePos).minus(this.pos);
        //this.force = this.force.plus(d.scale(this.followingMouse/(d.mag2()+1)));
        if (this.followingMouse) {
            let p = toZ(mousePos).minus(this.mouseAnchor);
            let velocity = p.minus(this.pos).unscale(nodeMode ? 1 : dt);

            this.vel = velocity;
            this.pos = p;
            this.anchor = this.pos;

            // Update the edges of the current node being dragged
            if (nodeMode === 1) {
                updateNodeEdgesLength(this);
            }

            // Check if the current node's UUID is in the selected nodes
            if (selectedNodeUUIDs.has(this.uuid)) {
                const selectedNodes = getSelectedNodes();
                selectedNodes.forEach(node => {
                    if (node.uuid !== this.uuid && node.anchorForce !== 1) { // Skip the current node and any anchored node
                        node.vel = velocity;

                        // Update the edges for each selected node
                        if (nodeMode === 1) {
                            updateNodeEdgesLength(node);
                        }
                    }
                });
            }
        }
        //this.force = this.force.plus((new vec2(-.1,-1.3)).minus(this.pos).scale(0.1));
        this.draw();
    }

    moveNode(direction) {
        const forceMagnitude = 0.01; // Base force intensity
        const adjustedForce = forceMagnitude * this.scale; // Scale the force

        let forceDirection = new vec2(0, 0);

        // Check for diagonal movements
        const isDiagonal = (direction.includes('up') || direction.includes('down')) &&
            (direction.includes('left') || direction.includes('right'));

        const diagonalAdjustment = isDiagonal ? Math.sqrt(2) : 1;

        if (direction.includes('up')) {
            forceDirection.y -= adjustedForce / diagonalAdjustment;
        }
        if (direction.includes('down')) {
            forceDirection.y += adjustedForce / diagonalAdjustment;
        }
        if (direction.includes('left')) {
            forceDirection.x -= adjustedForce / diagonalAdjustment;
        }
        if (direction.includes('right')) {
            forceDirection.x += adjustedForce / diagonalAdjustment;
        }

        // Apply the force to the node
        this.force = this.force.plus(forceDirection);

        return forceDirection; // Return the applied force direction
    }


    zoom_to_fit(margin = 1) {
        let bb = this.content.getBoundingClientRect();
        let svgbb = svg.getBoundingClientRect();
        let so = windowScaleAndOffset();
        let aspect = svgbb.width / svgbb.height;
        let scale = bb.height * aspect > bb.width ? svgbb.height / (margin * bb.height) : svgbb.width / (margin * bb.width);
        this.zoom_by(1 / scale);
    }
    zoom_by(s = 1) {
        panTo = new vec2(0, 0); //this.pos;
        let gz = ((s) ** (-1 / settings.zoomContentExp));
        zoomTo = zoom.unscale(gz ** 0.5);
        autopilotReferenceFrame = this;
        panToI = new vec2(0, 0);
    }
    zoom_to(s = 1) {
        panTo = new vec2(0, 0); //this.pos;
        let gz = zoom.mag2() * ((this.scale * s) ** (-1 / settings.zoomContentExp));
        zoomTo = zoom.unscale(gz ** 0.5);
        autopilotReferenceFrame = this;
        panToI = new vec2(0, 0);
    }

    searchStrings() {
        function* search(e) {
            yield e.textContent;
            if (e.value)
                yield e.value;
            for (let c of e.children) {
                yield* search(c);
            }
        }
        return search(this.content);
    }
    onclick(event) {

    }
    toggleWindowAnchored(anchored) {
        let windowDiv = this.content.querySelector('.window');
        if (windowDiv && !windowDiv.collapsed) { // Check if not collapsed
            if (anchored) {
                windowDiv.classList.add("window-anchored");
            } else {
                windowDiv.classList.remove("window-anchored");
            }
        }
    }
    ondblclick(event) {
        this.anchor = this.pos;
        this.anchorForce = 1 - this.anchorForce;
        this.toggleWindowAnchored(this.anchorForce === 1);
        //let connectednodes = getAllConnectedNodesData(this)
        //console.log(connectednodes)
        cancel(event);
    }
    onmousedown(event) {
        this.mouseAnchor = toZ(new vec2(event.clientX, event.clientY)).minus(this.pos);
        this.followingMouse = 1;
        window.draggedNode = this;
        movingNode = this;
        if (nodeMode) {
            if (prevNode === undefined) {
                prevNode = this;
            } else {
                // Get titles once and store them in variables
                const thisTitle = this.getTitle();
                const prevNodeTitle = prevNode.getTitle();

                // Check conditions before calling addEdgeToZettelkasten
                if (thisTitle !== prevNodeTitle && this.isTextNode && prevNode.isTextNode) {
                    // Add edge from prevNode to this node
                    addEdgeToZettelkasten(prevNodeTitle, thisTitle, myCodeMirror);
                    // Add edge from this node to prevNode
                    addEdgeToZettelkasten(thisTitle, prevNodeTitle, myCodeMirror);
                } else {
                    // If conditions are not met, call the original connectDistance
                    connectDistance(this, prevNode, this.pos.minus(prevNode.pos).mag() / 2, undefined, true);
                }

                // Reset prevNode
                prevNode = undefined;
            }
        }
        // Add an event listener to window.mouseup that stops the node from following the mouse
        window.addEventListener('mouseup', () => this.stopFollowingMouse());
        cancel(event);
    }

    stopFollowingMouse() {
        this.followingMouse = 0;
        movingNode = undefined;
        // Remove the event listener to clean up
        window.removeEventListener('mouseup', this.stopFollowingMouse);
    }
    onmouseup(event) {
        if (this === window.draggedNode) {
            this.followingMouse = 0;
            window.draggedNode = undefined;
        }
    }
    onmousemove(event) {
        if (this === window.draggedNode) {
            prevNode = undefined;
        }
        /*if (this.followingMouse){
        this.pos = this.pos.plus(toDZ(new vec2(event.movementX,event.movementY)));
        this.draw()
        //cancel(event);
        }*/
    }
    onwheel(event) {
        if (nodeMode) {
            let amount = Math.exp(event.wheelDelta * -settings.zoomSpeed);

            if (autopilotSpeed !== 0 && this.uuid === autopilotReferenceFrame.uuid) {
                zoomTo = zoomTo.scale(1 / amount);
            } else {
                // Scale selected nodes or individual node
                let targetWindow = event.target.closest('.window');
                if (targetWindow && targetWindow.classList.contains('selected')) {
                    const selectedNodes = getSelectedNodes();
                    selectedNodes.forEach((node) => {
                        node.scale *= amount;

                        // Only update position if the node is not anchored
                        if (node.anchorForce !== 1) {
                            node.pos = node.pos.lerpto(toZ(mousePos), 1 - amount);
                        }

                        updateNodeEdgesLength(node);
                    });
                } else {
                    this.scale *= amount;

                    // Only update position if not anchored
                    if (this.anchorForce !== 1) {
                        this.pos = this.pos.lerpto(toZ(mousePos), 1 - amount);
                    }
                }
            }
            cancel(event);
        }
    }

    getTitle() {
        return this.content.getAttribute('data-title');
    }

    getEdgeDirectionalities() {
        return this.edges.map(edge => ({
            edge: edge,
            directionality: edge.getDirectionRelativeTo(this)
        }));
    }
    addEdge(edge) {
        this.edges.push(edge);
        this.updateEdgeData();
    }
    updateEdgeData() {
        let es = JSON.stringify(this.edges.map((e) => e.dataObj()));
        //console.log("Saving edge data:", es); // Debug log
        this.content.setAttribute("data-edges", es);
    }
    removeEdges() {
        for (let i = this.edges.length - 1; i >= 0; i--) {
            this.edges[i].remove();
            this.edges.splice(i, 1);
        }
    }

    remove() {
        let dels = [];
        for (let n of nodes) {
            for (let e of n.edges) {
                if (e.pts.includes(this)) {
                    dels.push(e);
                }
            }
        }
        for (let e of dels) {
            e.remove();
        }

        // Remove this node from the edges array of any nodes it was connected to
        for (let n of nodes) {
            n.edges = n.edges.filter(edge => !edge.pts.includes(this));
        }

        // Remove the node from the global nodes array
        let index = nodes.indexOf(this);
        if (index !== -1) {
            nodes.splice(index, 1);
        }

        // Remove the node from the nodeMap if it exists
        if (nodeMap[this.uuid] === this) {
            delete nodeMap[this.uuid];
        }

        // Remove the node UUID from the selectedNodeUUIDs set
        if (selectedNodeUUIDs.has(this.uuid)) {
            selectedNodeUUIDs.delete(this.uuid);
        }

        // Mark the node as removed and remove its content
        this.removed = true;
        this.content.remove();
    }

}

// Global or scoped array for selected UUIDs
let selectedNodeUUIDs = new Set();

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

function clearNodeSelection() {
    selectedNodeUUIDs.forEach(uuid => {
        const node = findNodeByUUID(uuid); // Implement this function based on how your nodes are stored
        if (node) {
            node.windowDiv.classList.remove('selected');
        }
    });
    selectedNodeUUIDs.clear(); // Clear the set of selected UUIDs
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
       // console.warn('Node or node.content is not available');
        return null;
    }

    if (!node.isTextNode) {
       // console.warn('Node is not a text node. Skipping text area and editable div logic.');
        return null;
    }

    const editableDiv = node.contentEditableDiv;
    const hiddenTextarea = node.textarea;
    //console.log(editableDiv, hiddenTextarea);
    if (!editableDiv || !hiddenTextarea) {
        console.warn('Either editableDiv or hiddenTextarea is not found.');
        return null;
    }

    // Explicitly sync the content
    syncTextareaWithContentEditable(hiddenTextarea, editableDiv);

    hiddenTextarea.dispatchEvent(new Event('input'));
    // Now get the textarea content
    if (hiddenTextarea) {
        return hiddenTextarea.value;
    } else {
        console.warn('Textarea not found in node');
        return null;
    }
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

// Global map to store directionality states of edges
const edgeDirectionalityMap = new Map();

class Edge {
    constructor(pts, length = 0.6, strength = 0.1, style = {
        stroke: "red",
        "stroke-width": "0.01",
        fill: "red"
    }) {
        this.pts = pts;
        this.length = length;
        // Additional property to store the current length
        this.currentLength = this.length;

        this.strength = strength;
        this.style = style;
        this.html = document.createElementNS("http://www.w3.org/2000/svg", "path");
        for (const [key, value] of Object.entries(style)) {
            this.html.setAttribute(key, value);
        }
        htmledges.appendChild(this.html);
        this.attach();

        this.directionality = { start: null, end: null };

        this.maxWidth = 0.05;

        // Predefine the arrow SVG and initially set it to not display
        this.arrowSvg = document.createElementNS("http://www.w3.org/2000/svg", "path");
        this.arrowSvg.classList.add('edge-arrow');
        this.arrowSvg.style.display = 'none';

        htmledges.appendChild(this.arrowSvg);  // Assuming 'htmledges' is your SVG container

        // Predefine the border SVG
        this.borderSvg = document.createElementNS("http://www.w3.org/2000/svg", "path");
        this.borderSvg.style.display = 'none';
        this.borderSvg.classList.add('edge-border');
        htmledges.insertBefore(this.borderSvg, this.arrowSvg);


        this.attachEventListenersToArrow();

        this.edgeKey = this.createEdgeKey(pts);
        if (edgeDirectionalityMap.has(this.edgeKey)) {
            this.directionality = edgeDirectionalityMap.get(this.edgeKey);
        }
        //console.log("Creating edge with pts:", pts);
        //console.log("Directionality after assignment:", this.directionality);
    }
    createEdgeKey(pts) {
        return pts.map(p => p.uuid).sort().join('-');
    }
    dataObj() {
        let o = {};
        o.l = this.length;
        o.s = this.strength;
        o.g = this.style;
        o.p = this.pts.map((n) => n.uuid);

        // Simplified directionality data using UUIDs
        o.directionality = {
            start: this.directionality.start ? this.directionality.start.uuid : null,
            end: this.directionality.end ? this.directionality.end.uuid : null
        };

        o.edgeKey = this.edgeKey;
        return o;
    }
    attach() {
        this.html.onwheel = this.onwheel.bind(this);
        this.html.onmouseover = this.onmouseover.bind(this);
        this.html.onmouseout = this.onmouseout.bind(this);
        this.html.ondblclick = this.ondblclick.bind(this);
        this.html.onclick = this.onclick.bind(this); // Attach click event handler
    }

    attachEventListenersToArrow() {
        // Define a helper function to add the same event listeners to both SVGs
        const addEventListeners = (svgElement) => {
            svgElement.addEventListener('wheel', this.onwheel.bind(this));
            svgElement.addEventListener('mouseover', this.onmouseover.bind(this));
            svgElement.addEventListener('mouseout', this.onmouseout.bind(this));
            svgElement.addEventListener('dblclick', this.ondblclick.bind(this));
            svgElement.addEventListener('click', this.onclick.bind(this));
        };

        // Attach event listeners to both arrow and border SVGs
        addEventListeners(this.arrowSvg);
        addEventListeners(this.borderSvg);
    }
    toggleDirection() {
        //console.log(`Current directionality: start=${this.directionality.start ? this.directionality.start.getTitle() : 'null'}, end=${this.directionality.end ? this.directionality.end.getTitle() : 'null'}`);

        // Determine the current state and transition to the next
        if (this.directionality.start === null) {
            this.directionality.start = this.pts[0];
            this.directionality.end = this.pts[1];
        } else if (this.directionality.start === this.pts[0]) {
            this.directionality.start = this.pts[1];
            this.directionality.end = this.pts[0];
        } else if (this.directionality.start === this.pts[1]) {
            // Bidirectional
            this.directionality.start = null;
            this.directionality.end = null;
        }

        // Check if both nodes are text nodes
        if (this.pts[0].isTextNode && this.pts[1].isTextNode) {
            // Get node titles
            const startTitle = this.pts[0].getTitle();
            const endTitle = this.pts[1].getTitle();

            // Update edge references based on the new state
            if (this.directionality.start === this.pts[0]) {
                // Direction is from start to end
                addEdgeToZettelkasten(startTitle, endTitle, myCodeMirror);
                removeEdgeFromZettelkasten(endTitle, startTitle, true);
            } else if (this.directionality.start === this.pts[1]) {
                // Direction is from end to start
                addEdgeToZettelkasten(endTitle, startTitle, myCodeMirror);
                removeEdgeFromZettelkasten(startTitle, endTitle, true);
            } else {
                // Bidirectional
                addEdgeToZettelkasten(startTitle, endTitle, myCodeMirror);
                addEdgeToZettelkasten(endTitle, startTitle, myCodeMirror);
            }
        }


        edgeDirectionalityMap.set(this.edgeKey, this.directionality);

        //console.log(`Directionality relative to ${startTitle}: ${this.getDirectionRelativeTo(this.pts[0])}`);
        //console.log(`Directionality relative to ${endTitle}: ${this.getDirectionRelativeTo(this.pts[1])}`);
        //console.log(`New directionality: start=${this.directionality.start ? this.directionality.start.getTitle() : 'null'}, end=${this.directionality.end ? this.directionality.end.getTitle() : 'null'}`);
    }


    // Method to check directionality relative to a given node
    getDirectionRelativeTo(node) {
        if (this.directionality.start === node) {
            return "outgoing";
        } else if (this.directionality.end === node) {
            return "incoming";
        }
        return "none";
    }
    center() {
        return this.pts.reduce((t, n, i, a) => {
            return t.plus(n.pos);
        }, new vec2(0, 0)).unscale(this.pts.length);
    }
    draw() {
        this.html.setAttribute("stroke", this.mouseIsOver ? "lightskyblue" : this.style.stroke);
        this.html.setAttribute("fill", this.mouseIsOver ? "lightskyblue" : this.style.fill);

        const stressValue = Math.max(this.stress(), 0.01);
        let wscale = this.style['stroke-width'] / (0.5 + stressValue) * (this.mouseIsOver ? 1.5 : 1.0);
        wscale = Math.min(wscale, this.maxWidth);
        let path = "M ";
        let c = this.center();
        let validPath = true;

        // Constructing the main path
        for (let n of this.pts) {
            let r = n.scale * wscale;
            let minusC = n.pos.minus(c);
            let rotated = minusC.rot90();

            if (rotated.x !== 0 || rotated.y !== 0) {
                let left = rotated.normed(r);

                if (!isNaN(left.x) && !isNaN(left.y) && !isNaN(n.pos.x) && !isNaN(n.pos.y)) {
                    path += toSVG(n.pos.minus(left)).str();
                    path += " L ";
                    path += toSVG(left.plus(n.pos)).str() + " ";
                } else {
                    validPath = false;
                    break;
                }
            }
        }

        // Closing the main path
        let firstPoint = this.pts[0].pos.minus(this.pts[0].pos.minus(c).rot90().normed(this.pts[0].scale * wscale));
        if (!isNaN(firstPoint.x) && !isNaN(firstPoint.y)) {
            path += " " + toSVG(firstPoint).str() + "z";
        } else {
            validPath = false;
        }


        if (validPath) {
            this.html.setAttribute("d", path);

            if (this.directionality.start && this.directionality.end) {
                let startPoint = this.directionality.start.pos;
                let endPoint = this.directionality.end.pos;

                let startScale = this.directionality.start.scale;
                let endScale = this.directionality.end.scale;

                // Introduce a perspective factor (adjust this value to tweak the effect)
                let perspectiveFactor = 0.5; // Range [0, 1], where 0 is no effect and 1 is maximum effect

                // Adjust scales based on the perspective factor
                let adjustedStartScale = 1 + (startScale - 1) * perspectiveFactor;
                let adjustedEndScale = 1 + (endScale - 1) * perspectiveFactor;

                // Calculate weights for the midpoint based on adjusted scales
                let totalAdjustedScale = adjustedStartScale + adjustedEndScale;
                let startWeight = adjustedEndScale / totalAdjustedScale;
                let endWeight = adjustedStartScale / totalAdjustedScale;

                // Calculate the weighted midpoint
                let midPoint = startPoint.scale(startWeight).plus(endPoint.scale(endWeight));

                // Introduce factors for scaling the length and width of the arrow
                let arrowScaleFactor = 1.2; 

                let arrowLength = ((startScale + endScale) / 2 * wscale * 5) * arrowScaleFactor;
                let arrowWidth = ((startScale + endScale) / 2 * wscale * 3) * arrowScaleFactor;

                let direction = endPoint.minus(startPoint);
                let directionNormed = direction.normed(arrowLength);
                let perp = new vec2(-directionNormed.y, directionNormed.x).normed(arrowWidth);

                // Calculate arrow points relative to the midpoint
                let arrowBase1 = midPoint.minus(perp);
                let arrowBase2 = midPoint.plus(perp);
                let arrowTip = midPoint.plus(directionNormed);

                // Adjustable factor for arrow flipping [0, 1]
                let arrowFlipFactor = 0.85; // Adjust this value as needed

                // Calculate the adjusted center of the arrow
                let arrowBaseCenterX = (arrowBase1.x + arrowBase2.x) / 2;
                let arrowBaseCenterY = (arrowBase1.y + arrowBase2.y) / 2;
                let arrowCenterX = arrowBaseCenterX * arrowFlipFactor + arrowTip.x * (1 - arrowFlipFactor);
                let arrowCenterY = arrowBaseCenterY * arrowFlipFactor + arrowTip.y * (1 - arrowFlipFactor);
                let arrowCenter = new vec2(arrowCenterX, arrowCenterY);

                // Function to rotate a point around a center by 180 degrees
                function rotatePoint(point, center) {
                    let dx = point.x - center.x;
                    let dy = point.y - center.y;
                    return new vec2(center.x - dx, center.y - dy);
                }

                // Rotate the arrow points around the adjusted center
                arrowBase1 = rotatePoint(arrowBase1, arrowCenter);
                arrowBase2 = rotatePoint(arrowBase2, arrowCenter);
                arrowTip = rotatePoint(arrowTip, arrowCenter);

                // Arrow path
                let arrowPath = `M ${toSVG(arrowBase1).str()} L ${toSVG(arrowTip).str()} L ${toSVG(arrowBase2).str()} Z`;
                this.arrowSvg.setAttribute("d", arrowPath);
                this.arrowSvg.style.display = '';

                // Calculate the midpoint of the arrow
                let arrowMidX = (arrowBase1.x + arrowBase2.x + arrowTip.x) / 3;
                let arrowMidY = (arrowBase1.y + arrowBase2.y + arrowTip.y) / 3;
                let arrowMidPoint = new vec2(arrowMidX, arrowMidY);

                // Calculate offset for border points
                const offsetScale = 1.4; // Slightly larger than 1 to make the border bigger
                let borderBase1 = arrowMidPoint.plus(arrowBase1.minus(arrowMidPoint).scale(offsetScale));
                let borderBase2 = arrowMidPoint.plus(arrowBase2.minus(arrowMidPoint).scale(offsetScale));
                let borderTip = arrowMidPoint.plus(arrowTip.minus(arrowMidPoint).scale(offsetScale));

                // Border path
                let borderPath = `M ${toSVG(borderBase1).str()} L ${toSVG(borderTip).str()} L ${toSVG(borderBase2).str()} Z`;
                this.borderSvg.setAttribute("d", borderPath);
                this.borderSvg.style.display = '';
            } else {
                this.arrowSvg.style.display = 'none';
                this.borderSvg.style.display = 'none';
            }
        }
    }
    step(dt) {
        if (dt === undefined || isNaN(dt)) {
            dt = 0;
        } else {
            if (dt > 1) {
                dt = 1;
            }
        }
        let avg = this.center();
        for (let n of this.pts) {
            let d = n.pos.minus(avg);
            let dMag = d.mag();

            // Update the current length of the edge
            this.currentLength = dMag;

            // Apply force to either shorten or lengthen the edge to the desired length
            if (dMag !== this.length) {
                let f = d.scale(1 - this.length / (dMag + 1e-300));
                n.force = n.force.plus(f.scale(-this.strength));
            }
        }
        this.draw();
    }
    stress() {
        let avg = this.center();
        return this.pts.reduce((t, n, i, a) => {
            return t + n.pos.minus(avg).mag() - this.length;
        }, 0) / (this.length + 1);
    }
    scaleEdge(amount) {
        this.length *= amount;
    }
    onwheel = (event) => {
        if (nodeMode) {
            let amount = Math.exp(event.wheelDelta * -settings.zoomSpeed);
            this.length *= amount;
            let avg = this.center();
            for (let n of this.pts) {
                n.pos = n.pos.minus(avg).scale(amount).plus(avg);
            }
            if (this.pts[0] !== undefined) {
                this.pts[0].updateEdgeData();
            }
            cancel(event);
        }
    }
    onclick = (event) => {
        if (!nodeMode) {
            this.toggleDirection();
            this.draw();
        }
    }
    ondblclick = (event) => {
        if (nodeMode) {
            // Capture the titles and textNode flags of the connected nodes for later use
            const connectedNodes = this.pts.map(node => ({ title: node.getTitle(), isTextNode: node.isTextNode }));

            // only if both nodes have the isTextNode flag
            if (connectedNodes[0].isTextNode && connectedNodes[1].isTextNode) {
                removeEdgeFromZettelkasten(connectedNodes[0].title, connectedNodes[1].title);
            } else {
                this.remove();
            }

            // Prevent the event from propagating further
            cancel(event);
        }
    }
    onmouseover = (event) => {
        this.mouseIsOver = true;
        this.arrowSvg.classList.add('edge-arrow-hover');
        this.borderSvg.classList.add('edge-border-hover'); // Class for hovered state of the border
    }

    onmouseout = (event) => {
        this.mouseIsOver = false;
        this.arrowSvg.classList.remove('edge-arrow-hover');
        this.borderSvg.classList.remove('edge-border-hover'); // Class for normal state of the border
    }
    
    remove() {
        edgeDirectionalityMap.set(this.edgeKey, this.directionality);

        // Remove the edge from the global edge array
        let index = edges.indexOf(this);
        if (index !== -1) {
            edges.splice(index, 1);
        }

        // Remove this edge from both connected nodes' edges arrays
        this.pts.forEach((node) => {
            index = node.edges.indexOf(this);
            if (index !== -1) {
                node.edges.splice(index, 1);
                node.updateEdgeData();
            }
        });

        // Remove SVG elements from the DOM
        if (this.arrowSvg && this.arrowSvg.parentNode) {
            this.arrowSvg.parentNode.removeChild(this.arrowSvg);
        }
        if (this.borderSvg && this.borderSvg.parentNode) {
            this.borderSvg.parentNode.removeChild(this.borderSvg);
        }

        // Remove the main path of the edge
        if (this.html && this.html.parentNode) {
            this.html.parentNode.removeChild(this.html);
        }
    }
}


var gen = iter();


function frame() {
    gen.next();
    setTimeout(frame, 100);
}

const panInput = document.getElementById("pan");
const zoomInput = document.getElementById("zoom");

let coordsLive = true;
const coords = document.getElementById("coordinates");

panInput.addEventListener("input", (e) => {
    const r = /([+-]?(([0-9]*\.[0-9]*)|([0-9]+))([eE][+-]?[0-9]+)?)\s*,?\s*([+-]?i?(([0-9]*\.[0-9]*)|([0-9]+))([eE][+-]?[0-9]+)?)/;
    const m = panInput.value.match(r);
    coordsLive = false;
    if (m === null) return;
    pan = new vec2(parseFloat(m[0]), parseFloat(m[6].replace(/[iI]/, "")));
});
zoomInput.addEventListener("input", (e) => {
    const r = /([+-]?(([0-9]*\.[0-9]*)|([0-9]+))([eE][+-]?[0-9]+)?)/;
    const m = zoomInput.value.match(r);
    coordsLive = false;
    if (m === null) return;
    const z = parseFloat(m);
    if (z !== 0) {
        zoom = zoom.scale(z / zoom.mag());
    }
});
for (const k of ["paste", "mousemove", "mousedown", "dblclick", "click"]) {
    panInput.addEventListener(k, (e) => {
        cancel(e);
    })
    zoomInput.addEventListener(k, (e) => {
        cancel(e);
    })
}
//frame();
var mousePathPos;
var current_time = undefined;
let regenAmount = 0;
let regenDebt = 0;
let avgfps = 0;
let panToI = new vec2(0, 0);
let panToI_prev = undefined;

function clearTextSelection() {
    if (window.getSelection) {
        if (window.getSelection().empty) {  // Chrome
            window.getSelection().empty();
        } else if (window.getSelection().removeAllRanges) {  // Firefox (not working)
            window.getSelection().removeAllRanges();
        }
    } else if (document.selection) {  // IE?
        document.selection.empty();
    }
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

let prevNodeScale = 1;

function nodeStep(time) {
    const selectedNodes = getSelectedNodes();

    // Determine the combined direction from the key state
    const combinedDirection = getDirectionFromKeyState();

    // Process scaling keys
    Object.keys(keyState).forEach(key => {
        if (keyState[key]) {
            const action = directionMap[key];

            if (action === 'scaleUp' || action === 'scaleDown') {
                const scaleFactor = action === 'scaleUp' ? SCALE_UP_FACTOR : SCALE_DOWN_FACTOR;
                const centroid = getCentroidOfSelectedNodes();
                if (centroid) {
                    scaleSelectedNodes(scaleFactor, centroid);
                }
            }
        }
    });

    // Handle directional movement
    if (combinedDirection.length > 0 && selectedNodes.length > 0) {
        // Find the node with the largest scale
        let largestScaleNode = selectedNodes.reduce((max, node) => node.scale > max.scale ? node : max, selectedNodes[0]);

        // Apply movement to the node with the largest scale
        let forceApplied = largestScaleNode.moveNode(combinedDirection);

        // Apply the same force to the remaining nodes
        selectedNodes.forEach(node => {
            if (node !== largestScaleNode) {
                node.force = node.force.plus(forceApplied);
            }
        });
    }


    let autopilot_travelDist = 0;
    let newPan = pan;

    if (autopilotReferenceFrame && autopilotSpeed !== 0) {
        if (panToI_prev === undefined) {
            panToI_prev = autopilotReferenceFrame.pos.scale(1);
            prevNodeScale = autopilotReferenceFrame.scale; // Initialize prevNodeScale
        }
        panToI = panToI.scale(1 - settings.autopilotRF_Iscale).plus(autopilotReferenceFrame.pos.minus(panToI_prev).scale(settings.autopilotRF_Iscale));
        newPan = pan.scale(1 - autopilotSpeed).plus(autopilotReferenceFrame.pos.scale(autopilotSpeed).plus(panToI));
        panToI_prev = autopilotReferenceFrame.pos.scale(1);

        if (autopilotReferenceFrame.scale !== prevNodeScale) {
            let nodeScaleFactor = autopilotReferenceFrame.scale / prevNodeScale;

            // Adjust zoomTo.scale based on nodeScaleFactor
            zoomTo = zoomTo.scale(nodeScaleFactor);

            prevNodeScale = autopilotReferenceFrame.scale; // Update the previous scale
        }
    } else {
        newPan = pan.scale(1 - autopilotSpeed).plus(panTo.scale(autopilotSpeed));
        panToI_prev = undefined;
    }
    autopilot_travelDist = pan.minus(newPan).mag() / zoom.mag();
    if (autopilot_travelDist > settings.autopilotMaxSpeed) {
        newPan = pan.plus(newPan.minus(pan).scale(settings.autopilotMaxSpeed / autopilot_travelDist));
        const speedCoeff = Math.tanh(Math.log(settings.autopilotMaxSpeed / autopilot_travelDist + 1e-300) / 10) * 2;
        zoom = zoom.scale(1 - speedCoeff * autopilotSpeed);
        //*Math.log(autopilot_travelDist/settings.autopilotMaxSpeed));
    } else {
        zoom = zoom.scale(1 - autopilotSpeed).plus(zoomTo.scale(autopilotSpeed));
    }
    pan = newPan;
    //zoom = zoom.scale(0.9).plus(zoom_to.scale(0.1));
    //pan = pan.scale(0.9).plus(pan_to.scale(0.1));
    if (coordsLive) {
        panInput.value = pan.ctostring();
        zoomInput.value = zoom.mag() + "";
    }

    //const inpColor = scol(Math.log(zoom.mag()),undefined,64,128);
    //coords.style.color = inpColor;

    updateViewbox();

    if (mousePath == "") {
        mousePathPos = toZ(mousePos);
        mousePath = "M " + toSVG(mousePathPos).str() + " L ";
    }
    for (let i = 0; i < settings.orbitStepRate; i++) {
        //let g = mandGrad(settings.iterations,mousePathPos);
        //mousePathPos = mousePathPos.plus(g.unscale((g.mag()+1e-10)*1000));

        mousePathPos = mand_step(mousePathPos, toZ(mousePos));

        //let p = findPeriod(mousePathPos);
        //mousePathPos = mand_iter_n(p,mousePathPos,mousePathPos);
        if (toSVG(mousePathPos).isFinite() && toSVG(mousePathPos).mag2() < 1e60)
            mousePath += toSVG(mousePathPos).str() + " ";


    }
    let width = zoom.mag() * 0.0005 * SVGzoom;

    if (nodeMode && prevNode !== undefined) {
        clearTextSelection();
        svg_mousePath.setAttribute("d", "M " + toSVG(prevNode.pos).str() + " L " + toSVG(toZ(mousePos)).str());
        width *= 50; // This will increase the width when connecting nodes. Adjust as needed.
    } else {
        svg_mousePath.setAttribute("d", mousePath);
    }

    // Moved the check to clear prevNode outside of the if-else block
    if (!nodeMode && prevNode !== undefined) {
        prevNode = undefined;

        // Clear the mouse path
        mousePath = "";
        svg_mousePath.setAttribute("d", "");
        clearTextSelection();
    }

    svg_mousePath.setAttribute("stroke-width", width + "");
    if (current_time === undefined) {
        current_time = time;
    }
    let dt = time - current_time;
    current_time = time;
    if (dt > 0) {
        const alpha = Math.exp(-1 * dt / 1000);
        avgfps = avgfps * alpha + (1 - alpha) * 1000 / dt;
    }
    document.getElementById("debug_layer").children[1].textContent = "fps:" + avgfps;
    document.getElementById("fps").textContent = Math.round(avgfps).toString() + " fps";

    dt *= (1 - nodeMode_v) ** 5;
    for (let n of nodes) {
        n.step(dt);
        let d = toZ(mousePos).minus(n.pos);
        //n.force = n.force.plus(d.unscale(-((d.mag2()**2)*500+1e-5)));
    }
    for (let e of edges) {
        e.step(dt); //line 2703
    }
    regenDebt = Math.min(16, regenDebt + lerp(settings.regenDebtAdjustmentFactor, regenAmount, Math.min(1, (nodeMode_v ** 5) * 1.01)));
    for (; regenDebt > 0; regenDebt--) {
        render_hair(Math.random() * settings.renderSteps);
    }
    regenAmount = 0;
    nodeMode_v = lerp(nodeMode_v, nodeMode, 0.125);
    window.requestAnimationFrame(nodeStep);
}
nodeStep();


//connectRandom(10);



document.addEventListener('wheel', (event) => {
    isAnimating = false;

    // Get the element that the user is scrolling on
    let targetElement = event.target;

    while (targetElement) {
        // Check if the target is a textarea or contenteditable
        if (targetElement.tagName.toLowerCase() === 'textarea' ||
            targetElement.contentEditable === 'true') {
            return;
        }
        targetElement = targetElement.parentElement;
    }
    if (nodeMode !== 1 && event.getModifierState(settings.rotateModifier)) {
        autopilotSpeed = 0;
        coordsLive = true;
        let amount = event.wheelDelta * settings.rotateModifierSpeed;
        let p = toZ(new vec2(event.pageX, event.pageY));
        let zc = p.minus(pan);
        // p = zoom*center+pan = zoom'*center+pan'
        // zoom' = zoom*rot
        // pan' = pan + (zoom*center-zoom*rot*center)
        //      = pan + (1-rot) * zoom*center
        let r = new vec2(Math.cos(amount), Math.sin(amount));
        zoom = zoom.cmult(r);
        pan = pan.plus(zc.cmult(new vec2(1, 0).minus(r)));
        cancel(event);
        return;
    }
    if (settings.scroll === "zoom") {
        autopilotSpeed = 0;
        deselectCoordinate();

        coordsLive = true;
        let dest = toZ(mousePos);
        regenAmount += Math.abs(event.wheelDelta);
        let amount = Math.exp(event.wheelDelta * settings.zoomSpeed);
        zoom = zoom.scale(amount);
        pan = dest.scale(1 - amount).plus(pan.scale(amount));
        cancel(event);
    } else if (settings.scroll === "pan") {
        autopilotSpeed = 0;
        coordsLive = true;
        let dest = toZ(mousePos);
        let dp;
        let amount;
        if (event.ctrlKey) {
            dp = new vec2(0, 0);
            amount = event.deltaY * settings.zoomSpeed;
        } else {
            dp = toDZ(new vec2(event.deltaX, event.deltaY).scale(settings.panSpeed));
            amount = event.deltaZ * settings.zoomSpeed;
        }
        regenAmount += Math.hypot(event.deltaX, event.deltaY, event.deltaZ);
        amount = Math.exp(amount)
        zoom = zoom.scale(amount);
        pan = dest.scale(1 - amount).plus(pan.scale(amount)).plus(dp);
        cancel(event);
        event.preventDefault();
    }
});


let mouseDown = false;
let mouseDownPos = new vec2(0, 0);
addEventListener("mousedown", (event) => {
    autopilotSpeed = 0;
    mouseDownPos = mousePos.scale(1);
    mouseDown = true;
    cancel(event);
});
addEventListener("mouseup", (event) => {
    mouseDown = false;
    if (movingNode !== undefined) {
        movingNode.onmouseup(event);
    }
    isDraggingIcon = false; // Reset the flag
});
addEventListener("mousemove", (event) => {
    if (mouseDown) {
        isAnimating = false;
        autopilotSpeed = 0;
        coordsLive = true;
        let delta = mousePos.minus(mouseDownPos);
        pan = pan.minus(toDZ(delta));
        regenAmount += delta.mag() * 0.25;
        mouseDownPos = mousePos.scale(1);
    }
});




//Touchpad controls (WIP)

let touches = new Map();

addEventListener("touchstart", (ev) => {
    //pan = pan.plus(new vec2(0,1))
    for (let i = 0; i < ev.changedTouches.length; i++) {
        const touch = ev.changedTouches.item(i);
        touches.set(touch.identifier, {
            prev: touch,
            now: touch
        });
    }
}, false);
addEventListener("touchcancel", (ev) => {
    for (let i = 0; i < ev.changedTouches.length; i++) {
        const touch = ev.changedTouches.item(i);
        touches.delete(touch.identifier);
    }
}, false);
addEventListener("touchend", (ev) => {
    //pan = pan.plus(new vec2(0,-1))
    switch (touches.size) {
        case 2: //tap to zoom
            if (ev.changedTouches.length == 1) {
                const id = ev.changedTouches.item(0).identifier;
                const t = touches.get(id);
                if (t && t.prev == t.now) { //hasn't moved
                    const ts = [...touches.keys()];
                    const other = touches.get(ts[0] === id ? ts[1] : ts[0])
                    const {
                        s,
                        o
                    } = windowScaleAndOffset();
                    const amount = Math.exp(-(other.now.clientY - t.now.clientY) / s);
                    const dest = toZ(new vec2(other.now.clientX, other.now.clientY));
                    zoom = zoom.scale(amount);
                    pan = dest.scale(1 - amount).plus(pan.scale(amount));
                }
            }
            break;

    }
    for (let i = 0; i < ev.changedTouches.length; i++) {
        const touch = ev.changedTouches.item(i);
        touches.delete(touch.identifier);
    }
}, false);
addEventListener("touchmove", (ev) => {
    for (let i = 0; i < ev.changedTouches.length; i++) {
        const touch = ev.changedTouches.item(i);
        touches.set(touch.identifier, {
            prev: touches.get(touch.identifier)?.now,
            now: touch
        });
    }
    switch (touches.size) {
        case 1:
            autopilotSpeed = 0;
            coordsLive = true;
            const t = [...touches.values()][0];
            pan = pan.plus(toDZ(new vec2(t.prev.clientX, t.prev.clientY).minus(new vec2(t.now.clientX, t.now.clientY))));
            cancel(ev);
            break;
        case 2:
        /*
        const pts = [...touches.values()];
        const p1p = toS(new vec2(pts[0].prev.clientX,pts[0].prev.clientY));
        const p2p = toS(new vec2(pts[1].prev.clientX,pts[1].prev.clientY));
        const p1n = toS(new vec2(pts[0].now.clientX,pts[0].now.clientY));
        const p2n = toS(new vec2(pts[1].now.clientX,pts[1].now.clientY));
        //want to find new zoom,pan such that
        // old toZ(p1p) = new toZ(p1n)
        // old toZ(p2p) = new toZ(p2n)
        //
        //  toZ(x) ≈ x*zoom + pan
        //
        // so, we want zoom' pan' s.t.
        //  p1p*zoom + pan = p1n*zoom' + pan'
        //  p2p*zoom + pan = p2n*zoom' + pan'
        //
        //  (p2p-p1p) * zoom = (p2n-p1n) * zoom'
        //  (p1p+p2p)*zoom + 2pan = (p1p+p2p)*zoom' + 2pan'
        //
        //  zoom' = zoom * (p2p-p1p)/(p2n-p1n)
        //  pan' = pan + (p1p+p2p)*zoom/2 - (p1p+p2p)*zoom'/2
        //       = pan + (p1p+p2p)*(zoom - zoom')/2
        const nzoom = zoom.cmult( p2p.minus(p1p).cdiv( p2n.minus(p1n)));
        pan = pan.plus(p2p.plus(p1p).cmult(zoom.minus(nzoom)).scale(0.5));
        zoom = nzoom;


        ev.preventDefault();
        cancel(ev);
        break;
        */
        default:
            break;
    }


}, false);




var gestureStartParams = {
    rotation: 0,
    x: 0,
    y: 0,
    scale: 0,
    zoom: new vec2(),
    pan: new vec2()
};
addEventListener("gesturestart", (e) => {
    e.preventDefault();
    //console.log(e);
    gestureStartParams.rotation = e.rotation;
    gestureStartParams.scale = e.scale;
    gestureStartParams.x = e.pageX;
    gestureStartParams.y = e.pageY;
    gestureStartParams.zoom = zoom;
    gestureStartParams.pan = pan;

});
addEventListener("gesturechange", (e) => {
    e.preventDefault();
    //console.log(e);
    let d_theta = e.rotation - gestureStartParams.rotation;
    let d_scale = e.scale;
    let r = -e.rotation * settings.gestureRotateSpeed;
    pan = gestureStartParams.pan;
    zoom = gestureStartParams.zoom;
    let r_center = toZ(new vec2(e.pageX, e.pageY));
    let s = 0;
    zoom = gestureStartParams.zoom.cmult(new vec2(Math.cos(r), Math.sin(r)));
    if (e.scale !== 0) {
        let s = 1 / e.scale;
        zoom = zoom.scale(s);
        regenAmount += Math.abs(Math.log(s)) * settings.maxLines;
    }
    let dest = r_center;
    let amount = s;
    let dp = r_center.minus(gestureStartParams.pan);
    pan = gestureStartParams.pan.plus(
        dp.minus(dp.cmult(zoom.cdiv(gestureStartParams.zoom))));
    //pan = dest.scale(1-amount).plus(gestureStartParams.pan.scale(amount));

});
addEventListener("gestureend", (e) => {
    e.preventDefault();
});


// Check if a string is valid JSON
function isJSON(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}


// Check if the user's message is a URL
const isUrl = (text) => {
    try {
        const url = new URL(text);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

const isIframe = (text) => {
    try {
        const doc = new DOMParser().parseFromString(text, "text/html");
        return doc.body.childNodes[0] && doc.body.childNodes[0].nodeName.toLowerCase() === 'iframe';
    } catch (_) {
        return false;
    }
}

function getIframeUrl(iframeContent) {
    // Function to extract URL from the iframe content
    // Using a simple regex to get the 'src' attribute value
    const match = iframeContent.match(/src\s*=\s*"([^"]+)"/);
    return match ? match[1] : null; // Return URL or null if not found
}


function nodemousedown(id) {
    if (id < nodes.length) {
        nodes[id].mousedown();
    }
}

function nodemouseup(id) {
    if (id < nodes.length) {
        nodes[id].mouseup();
    }
}

function nodemousemove(id) {
    if (id < nodes.length) {
        nodes[id].mousemove();
    }
}

function nodeclick(id) {
    if (id < nodes.length) {
        nodes[id].mouseclick();
    }
}


function cancel(event) {
    if (event.stopPropagation) {
        event.stopPropagation(); // W3C model
    } else {
        event.cancelBubble = true; // IE model
    }
}