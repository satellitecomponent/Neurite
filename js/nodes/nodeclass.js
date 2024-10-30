const NodeExtensions = {
    "window": (node, a) => {
        rewindowify(node);
    },
    "textarea": (node, o) => {
        let e = node.content;
        for (const w of o.p) {
            e = e.children[w];
        }

        const p = o.p;
        const v = e.value = o.v;

        node.push_extra_cb( (n)=>({
            f: "textarea",
            a: { p, v }
        }) );
    },
    "textareaId": (node, o) => {
        const textarea = node.content.querySelector('#' + o.p);
        if (textarea) textarea.value = o.v;

        node.push_extra_cb( (n)=>({
            f: "textareaId",
            a: {
                p: textarea.id,
                v: textarea.value
            }
        }) );
    },
    "checkboxId": (node, o) => {
        // Query for checkboxes based on a specific ID and update their state
        const checkbox = node.content.querySelector(`input[type="checkbox"][id='${o.p}']`);
        if (!checkbox) return;

        checkbox.checked = o.v;
        node.push_extra_cb( (n)=>({
            f: "checkboxId",
            a: {
                p: o.p,  // Pass the ID of the checkbox
                v: checkbox.checked  // Save the current state
            }
        }) );
    },
    "sliderId": (node, o) => {
        // Query for sliders based on a specific ID and update their value
        const slider = node.content.querySelector(`input[type="range"][id='${o.p}']`);
        if (!slider) return;

        slider.value = o.v ?? o.d;  // Set the slider's value based on the value provided or the default value
        node.push_extra_cb( (n)=>({
            f: "sliderId",
            a: {
                p: o.p,  // Pass the ID of the slider
                v: slider.value  // Save the current value
            }
        }) );
    },
}

function put(e, p, s = 1) {
    const svgbb = svg.getBoundingClientRect();
    e.style.position = 'absolute';
    e.style.transform = 'scale(' + s + ',' + s + ')';
    p = fromZtoUV(p);
    const cond = p.minus(new vec2(0.5, 0.5)).mag2() > 16;
    e.style.display = (cond ? 'none' : 'initial');

    const w = Math.min(svgbb.width, svgbb.height);
    const off = svgbb.width < svgbb.height ? svgbb.right : svgbb.bottom;
    p.x = w * p.x - (off - svgbb.right) / 2;
    p.y = w * p.y - (off - svgbb.bottom) / 2;

    const bb = e.getBoundingClientRect();
    p = p.minus(new vec2(bb.width, bb.height).scale(0.5 / s));
    e.style.left = p.x + 'px';
    e.style.top = p.y + 'px';

    //e.style['margin-top'] = "-"+(e.offsetHeight/2)+'px';//"-50%";
    //e.style['margin-left'] = "-"+(e.offsetWidth/2)+'px';//"-50%";
    //e.style['vertical-align']= 'middle';
    //e.style['text-align']= 'center';
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
            const dataset = thing.dataset;
            let o = JSON.parse(dataset.node_json)
            for (const k of ['anchor', 'mouseAnchor', 'vel', 'pos', 'force']) {
                o[k] = new vec2(o[k]);
            }
            for (const k in o) {
                this[k] = o[k];
            }
            this.save_extras = [];
            this.content = thing;
            if (dataset.node_extras) {
                o = JSON.parse(dataset.node_extras);
                for (const e of o) {
                    NodeExtensions[e.f](this, e.a);
                }
            }
            this.attach();
            this.content.setAttribute('data-uuid', this.uuid);
            if (dataset.edges !== undefined && createEdges) {
                const edges = JSON.parse(dataset.edges);
                this.init = ((nodeMap) => {
                    for (const edge of edges) {
                        edgeFromJSON(edge, nodeMap);
                    }
                }).bind(this);
            }
            return;
        }

        this.uuid = String(nextUUID());
        this.pos = p;
        this.scale = scale;
        this.intrinsicScale = intrinsicScale;

        this.content = thing;

        this.vel = new vec2(0, 0);
        this.force = new vec2(0, 0);
        this.frictionConstant = 0.2;
        this.intervalID = null;
        this.followingMouse = 0;

        this.randomNodeFlowRange = (Math.random() - 0.5) * settings.flowDirectionRandomRange;

        this.sensor = new NodeSensor(this, 3);

        this.removed = false;

        this.content.setAttribute('data-uuid', this.uuid);
        this.attach();
        this.save_extras = [];
    }
    attach() {
        const div = this.content;
        On.click(div, this.onClick);
        On.dblclick(div, this.onDblClick);
        On.mousedown(div, this.onMouseDown);
        On.mousemove(document, this.onMouseMove);
        On.mouseup(document, this.onMouseUp);
        On.wheel(div, this.onWheel);
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
    updateNodeData() {
        const saveExtras = [];
        for (const extra of this.save_extras) {
            saveExtras.push(typeof extra === "function" ? extra(this) : extra);
        }
        this.content.setAttribute('data-node_extras', JSON.stringify(saveExtras));
        this.content.setAttribute('data-node_json', this.json());
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
        Logger.debug(this.sensor.nearbyNodes);
        Logger.debug("extended radius", this.sensor.nodesWithinExtendedRadius);
    }

    draw() {
        put(this.content, this.pos, this.intrinsicScale * this.scale * (zoom.mag2() ** -settings.zoomContentExp));
    }

    step(dt) {
        dt = this.clampDt(dt);
        this.updatePosition(dt);
        this.applyMandelbrotForce();
        this.applyAnchorForce();
        this.handleMouseInteraction(dt);
        this.draw();
    }

    clampDt(dt) {
        return (isNaN(dt) ? 0 : Math.min(dt, 1))
    }

    updatePosition(dt) {
        if (!this.followingMouse && this.anchorForce == 0) {
            this.pos = this.pos.plus(this.vel.scale(dt / 2));
            this.vel = this.vel.plus(this.force.scale(dt));
            this.pos = this.pos.plus(this.vel.scale(dt / 2));
            this.force = this.vel.scale(-Math.min(this.vel.mag() + this.frictionConstant + this.anchorForce, 1 / (dt + 1e-300)));
        } else {
            this.vel = new vec2(0, 0);
            this.force = new vec2(0, 0);
        }
    }

    applyMandelbrotForce() {
        if (this.anchorForce !== 0) return;

        const g = Fractal.mandGrad(settings.iterations, this.pos);

        if (settings.useFlowDirection && g.mag2() > 0) {
            const randomRotation = this.randomNodeFlowRange;
            const flowDirection = g.rot(settings.flowDirectionRotation + randomRotation).normed();
            const forceMagnitude = g.mag();

            this.force = this.force.plus(flowDirection.scale(forceMagnitude).unscale((g.mag2() + 1e-10) * 300));
        }

        if (!settings.useFlowDirection && g.mag2() > 0) {
            this.force = this.force.plus(g.unscale((g.mag2() + 1e-10) * 300))
        }
    }

    applyAnchorForce() {
        this.force = this.force.plus(this.anchor.minus(this.pos).scale(this.anchorForce))
    }

    handleMouseInteraction(dt) {
        if (!this.followingMouse) return;

        const p = toZ(mousePos).minus(this.mouseAnchor);
        const velocity = p.minus(this.pos).unscale(NodeMode.val ? 1 : dt);

        this.vel = velocity;
        this.pos = p;
        this.anchor = this.pos;

        if (NodeMode.val === 1) updateNodeEdgesLength(this);

        if (!SelectedNodes.uuids.has(this.uuid)) return;

        SelectedNodes.forEach(node => {
            if (node.uuid === this.uuid || node.anchorForce === 1) return;

            node.vel = velocity;
            if (NodeMode.val === 1) updateNodeEdgesLength(node);
        });
    }

    moveNode(angle, forceMagnitude = 0.01) {
        const adjustedForce = forceMagnitude * this.scale; // Scale the force
        const forceDirection = new vec2(Math.cos(angle) * adjustedForce, Math.sin(angle) * adjustedForce);

        // Apply the force to the node
        this.force = this.force.plus(forceDirection);
        return forceDirection; // optional
    }

    moveTo(x, y, baseTolerance = 1, onComplete = ()=>{} ) {
        const targetComplexCoords = new vec2(x, y);
        const tolerance = baseTolerance * this.scale;

        const update = () => {
            const distanceVector = targetComplexCoords.minus(this.pos);
            const distance = distanceVector.mag();
            if (distance < tolerance) {
                clearInterval(this.intervalID);
                clearTimeout(this.timeoutID);
                this.intervalID = null;
                onComplete();
            } else {
                const forceMagnitude = Math.min(0.002 * this.scale, distance);
                const forceDirection = distanceVector.normed().scale(forceMagnitude);
                this.force = this.force.plus(forceDirection);
            }
        };

        if (this.intervalID !== null) clearInterval(this.intervalID);
        if (this.timeoutID !== null) clearTimeout(this.timeoutID);

        this.intervalID = setInterval(update, 20); // Start the movement updates

        // Set a fixed timeout to stop the movement after 4 seconds
        this.timeoutID = setTimeout(() => {
            clearInterval(this.intervalID);
            this.intervalID = null;
            Logger.debug("Movement stopped after 4 seconds.");
            onComplete(); // even if the target hasn't been reached
        }, 4000); // 4 secs
    }

    zoom_to_fit(margin = 1) {
        const bb = this.content.getBoundingClientRect();
        const svgbb = svg.getBoundingClientRect();
        const aspect = svgbb.width / svgbb.height;
        const scale = bb.height * aspect > bb.width ? svgbb.height / (margin * bb.height) : svgbb.width / (margin * bb.width);
        this.zoom_by(1 / scale);
    }
    zoom_to(s = 1) {
        panTo = new vec2(0, 0); //this.pos;
        const gz = zoom.mag2() * ((this.scale * s) ** (-1 / settings.zoomContentExp));
        zoomTo = zoom.unscale(gz ** 0.5);
        autopilotReferenceFrame = this;
        panToI = new vec2(0, 0);
    }
    zoom_by(s = 1) {
        panTo = new vec2(0, 0); //this.pos;
        const gz = ((s) ** (-1 / settings.zoomContentExp));
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
    onClick = (e)=>{

    }
    toggleWindowAnchored(anchored) {
        const windowDiv = this.content.querySelector('.window');
        if (windowDiv && !windowDiv.collapsed) { // Check if not collapsed
            if (anchored) {
                windowDiv.classList.add("window-anchored");
            } else {
                windowDiv.classList.remove("window-anchored");
            }
        }
    }
    onDblClick = (e)=>{
        this.anchor = this.pos;
        this.anchorForce = 1 - this.anchorForce;
        this.toggleWindowAnchored(this.anchorForce === 1);
        Logger.debug(getAllConnectedNodesData(this));
        e.stopPropagation();
    }
    onMouseDown = (e)=>{
        this.mouseAnchor = toZ(new vec2(e.clientX, e.clientY)).minus(this.pos);
        this.followingMouse = 1;
        window.draggedNode = this;
        movingNode = this;
        if (NodeMode.val) {
            if (prevNode === undefined) {
                prevNode = this;
            } else {
                connectNodes(this, prevNode);
                prevNode = undefined;
            }
            clearTextSelections();
        }

        On.mouseup(window, this.stopFollowingMouse);
        this.disableIframePointerEvents();
        e.stopPropagation();
    }

    stopFollowingMouse = (e)=>{
        this.followingMouse = 0;
        movingNode = undefined;

        Off.mouseup(window, this.stopFollowingMouse);
        this.enableIframePointerEvents();
    }

    disableIframePointerEvents(){ this.setIframePointerEvents('none') }
    enableIframePointerEvents(){ this.setIframePointerEvents('auto') }
    setIframePointerEvents(value){
        this.content.querySelectorAll('iframe').forEach(iframe => {
            iframe.style.pointerEvents = value
        })
    }

    onMouseUp = (e)=>{
        if (this === window.draggedNode) {
            this.followingMouse = 0;
            window.draggedNode = undefined;
        }
    }
    onMouseMove = (e)=>{
        if (this === window.draggedNode) prevNode = undefined;
        /*if (this.followingMouse){
        this.pos = this.pos.plus(toDZ(new vec2(e.movementX,e.movementY)));
        this.draw()
        //e.stopPropagation();
        }*/
    }
    onWheel = (e)=>{
        if (!NodeMode.val) return;

        let amount = Math.exp(e.wheelDelta * -settings.zoomSpeed);

        if (autopilotSpeed !== 0 && this.uuid === autopilotReferenceFrame.uuid) {
            zoomTo = zoomTo.scale(1 / amount);
        } else {
            // Scale selected nodes or individual node
            let targetWindow = e.target.closest('.window');
            if (targetWindow && targetWindow.classList.contains('selected')) {
                SelectedNodes.forEach((node) => {
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
        e.stopPropagation();
    }

    getTitle() {
        return this.content.querySelector('.title-input').value
    }

    getEdgeDirectionalities() {
        return this.edges.map( (edge)=>({
            edge,
            directionality: edge.getDirectionRelativeTo(this)
        }) );
    }

    addEdge(edge) {
        this.edges.push(edge);
        this.updateEdgeData();
    }
    static addEdgeThis(node){
        node.addEdge(this)
    }

    updateEdgeData() {
        const es = JSON.stringify(this.edges.map((e) => e.dataObj()));
        Logger.debug("Saving edge data:", es);
        this.content.setAttribute('data-edges', es);
    }

    removeEdgeByIndex(index){
        this.edges[index].remove();
        this.edges.splice(index, 1);
    }
    removeEdges() {
        for (const i = this.edges.length - 1; i >= 0; i--) {
            this.removeEdgeByIndex(i)
        }
    }

    remove() {
        const nodes = Graph.nodes;

        const dels = [];
        for (const node of nodes) {
            for (const e of node.edges) {
                if (e.pts.includes(this)) dels.push(e);
            }
        }
        for (const e of dels) {
            e.remove();
        }

        // Remove this node from the edges array of any nodes it was connected to
        for (const node of nodes) {
            node.edges = node.edges.filter(edge => !edge.pts.includes(this));
        }

        // Remove the node from the global nodes array
        const index = nodes.indexOf(this);
        if (index !== -1) nodes.splice(index, 1);

        delete nodeMap[this.uuid];
        SelectedNodes.uuids.delete(this.uuid);

        this.removed = true;
        this.content.remove();
    }

    static getType(node){
        if (node.isTextNode) return 'text';
        if (node.isLLM) return 'llm';
        if (node.isLink) return 'link';
        return 'base';
    }
}
