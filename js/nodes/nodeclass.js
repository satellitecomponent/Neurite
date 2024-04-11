
const NodeExtensions = {
    "window": (node, a) => {
        rewindowify(node);
    },
    "textarea": (node, o) => {
        let e = node.content;
        for (let w of o.p) {
            e = e.children[w];
        }
        let p = o.p;
        e.value = o.v;
        node.push_extra_cb((n) => {
            return {
                f: "textarea",
                a: {
                    p: p,
                    v: e.value
                }
            };
        });
    },
}


let prevNode = undefined;


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
        this.frictionConstant = 0.2;
        this.intervalID = null;
        this.followingMouse = 0;
        //this.followingAiCursor = false;
        //this.aiCursorAnchor = new vec2(0, 0);

        this.sensor = new NodeSensor(this, 3);

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
                k === "aiResponseEditor" || k === "sensor" || k === "responseHandler" ||
                k === "windowDiv" || k === "agent") { // Exclude windowDiv as well
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

    updateSensor() {
        this.sensor.callUpdate();
        //console.log(this.sensor.nearbyNodes);
        //console.log('extended radius', this.sensor.nodesWithinExtendedRadius);
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
            this.force = this.vel.scale(-Math.min(this.vel.mag() + this.frictionConstant + this.anchorForce, 1 / (dt + 1e-300)));
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

    moveNode(angle, forceMagnitude = 0.01) {
        const adjustedForce = forceMagnitude * this.scale; // Scale the force

        let forceDirection = new vec2(Math.cos(angle) * adjustedForce, Math.sin(angle) * adjustedForce);

        // Apply the force to the node
        this.force = this.force.plus(forceDirection);

        return forceDirection; // Optionally return the force direction if needed
    }

    moveTo(x, y, baseTolerance = 1, onComplete = () => { }) {
        const targetComplexCoords = new vec2(x, y);
        // Adjust tolerance based on the node's current scale
        const tolerance = baseTolerance * this.scale;

        const update = () => {
            const distanceVector = targetComplexCoords.minus(this.pos);
            const distance = distanceVector.mag();

            // Check if the node is within the tolerance distance of the target
            if (distance < tolerance) {
                clearInterval(this.intervalID);
                clearTimeout(this.timeoutID); // Clear the movement timeout
                this.intervalID = null; // Reset the intervalID
                onComplete(); // Call the completion callback
                return;
            }

            // Apply movement
            const forceMagnitude = Math.min(0.002 * this.scale, distance);
            const forceDirection = distanceVector.normed().scale(forceMagnitude);
            this.force = this.force.plus(forceDirection);
        };

        // Clear any existing interval and timeout to avoid multiple intervals or timeouts running
        if (this.intervalID !== null) {
            clearInterval(this.intervalID);
        }
        if (this.timeoutID !== null) {
            clearTimeout(this.timeoutID);
        }

        this.intervalID = setInterval(update, 20); // Start the movement updates

        // Set a fixed timeout to stop the movement after 4 seconds
        this.timeoutID = setTimeout(() => {
            clearInterval(this.intervalID); // Stop the movement updates
            this.intervalID = null; // Reset the intervalID
            //console.log("Movement stopped after 4 seconds.");
            onComplete(); // Call the completion callback even if the target hasn't been reached
        }, 4000); // Timeout duration of 4 seconds
    }


    zoom_to_fit(margin = 1) {
        let bb = this.content.getBoundingClientRect();
        let svgbb = svg.getBoundingClientRect();
        let so = windowScaleAndOffset();
        let aspect = svgbb.width / svgbb.height;
        let scale = bb.height * aspect > bb.width ? svgbb.height / (margin * bb.height) : svgbb.width / (margin * bb.width);
        this.zoom_by(1 / scale);
    }
    zoom_to(s = 1) {
        panTo = new vec2(0, 0); //this.pos;
        let gz = zoom.mag2() * ((this.scale * s) ** (-1 / settings.zoomContentExp));
        zoomTo = zoom.unscale(gz ** 0.5);
        autopilotReferenceFrame = this;
        panToI = new vec2(0, 0);
    }

    zoom_by(s = 1) {
        panTo = new vec2(0, 0); //this.pos;
        let gz = ((s) ** (-1 / settings.zoomContentExp));
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
                connectNodes(this, prevNode);

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