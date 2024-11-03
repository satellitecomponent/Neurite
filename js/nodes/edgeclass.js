function findExistingEdge(node1, node2) {
    return node1.edges.find(node2.edges.includes, node2.edges);
}

class Edge {
    static directionalityMap = new Map(); // directionality states of edges
    static SvgMap = new Map(); // references to Edge instances

    constructor(pts, length = 0.6, strength = 0.1, style){
        this.pts = pts;
        this.length = length;
        this.currentLength = this.length;
        this.strength = strength;
        this.style = style || {
            stroke: "red",
            "stroke-width": "0.01",
            fill: "red"
        };
        this.maxWidth = 0.05;

        this.directionality = { start: null, end: null };
        const svgMap = Edge.SvgMap;

        this.html = Svg.new.path();
        svgMap.set(this.html, this);
        for (const [key, value] of Object.entries(style)) {
            this.html.setAttribute(key, value);
        }
        htmledges.appendChild(this.html);

        this.arrowSvg = Svg.new.path();
        svgMap.set(this.arrowSvg, this);
        this.arrowSvg.classList.add('edge-arrow');
        this.arrowSvg.style.display = 'none';

        htmledges.appendChild(this.arrowSvg);

        this.borderSvg = Svg.new.path();
        svgMap.set(this.borderSvg, this);
        this.borderSvg.style.display = 'none';
        this.borderSvg.classList.add('edge-border');
        htmledges.insertBefore(this.borderSvg, this.arrowSvg);

        this.edgeKey = this.createEdgeKey(pts);
        this.restoreDirectionality();

        this.attachEventListeners(this.html);
        this.attachEventListeners(this.arrowSvg);
        this.attachEventListeners(this.borderSvg);

        Logger.debug("Creating edge with pts:", pts);
        Logger.debug("Directionality after assignment:", this.directionality);
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

    attachEventListeners(elem){
        On.wheel(elem, this.onWheel);
        On.mouseover(elem, this.onMouseOver);
        On.mouseout(elem, this.onMouseOut);
        On.dblclick(elem, this.onDblClick);
        On.click(elem, this.onClick);
    }
    onClick = (e)=>{
        if (NodeMode.val) return;

        this.toggleDirection();
        this.draw();
    }
    removeEdgeInstance() {
        const connectedNodes = this.pts.map(node => ({ title: node.getTitle(), isTextNode: node.isTextNode }));
        if (connectedNodes[0].isTextNode && connectedNodes[1].isTextNode) {
            const startTitle = connectedNodes[0].title;
            const endTitle = connectedNodes[1].title;
            removeEdgeFromAllInstances(startTitle, endTitle);
        } else {
            this.remove();
        }
    }

    onDblClick = (e)=>{
        if (!NodeMode.val) return;

        this.removeEdgeInstance();
        e.stopPropagation();
    }
    onMouseOver = (e)=>{
        this.mouseIsOver = true;
        this.arrowSvg.classList.add('edge-arrow-hover');
        this.borderSvg.classList.add('edge-border-hover'); // hovered state of the border
    }
    onMouseOut = (e)=>{
        this.mouseIsOver = false;
        this.arrowSvg.classList.remove('edge-arrow-hover');
        this.borderSvg.classList.remove('edge-border-hover'); // normal state of the border
    }
    onWheel = (e)=>{
        if (!NodeMode.val) return;

        const amount = Math.exp(e.wheelDelta * -settings.zoomSpeed);

        // Determine if this edge should be scaled based on both nodes being selected
        if (SelectedNodes.uuids.size > 0 && this.pts.every(pt => SelectedNodes.uuids.has(pt))) {
            SelectedNodes.collectEdges().forEach(edge => edge.scaleLength(amount));
        } else {
            this.scaleLength(amount);
        }

        e.stopPropagation();
    }

    scaleLength(amount) {
        const avg = this.center();
        this.length *= amount;
        const pts = this.pts;
        pts.forEach(n => {
            n.pos = n.pos.minus(avg).scale(amount).plus(avg);
        });
        if (pts[0]) pts[0].updateEdgeData();
    }

    createEdgeKey(pts) {
        return pts.map(p => p.uuid).sort().join('-');
    }

    restoreDirectionality() {
        this.directionality = Edge.directionalityMap.get(this.edgeKey)
                            || { start: null, end: null }; // Explicitly handle null directionality
    }
    toggleDirection() {
        const pts = this.pts;
        const direction = this.directionality;
        // Initialize direction if it's null
        if (!direction.start || !direction.end) {
            direction.start = pts[0];
            direction.end = pts[1];
        } else {
            // Switch direction or reset
            if (direction.start === pts[0]) {
                direction.start = pts[1];
                direction.end = pts[0];
            } else if (direction.start === pts[1]) {
                direction.start = null;
                direction.end = null;
            }
        }

        // Update all instances of CodeMirror that include these nodes
        if (pts[0].isTextNode && pts[1].isTextNode) {
            const startTitle = pts[0].getTitle();
            const endTitle = pts[1].getTitle();
            const { startNodeInfo, endNodeInfo } = getEdgeInfo(startTitle, endTitle);
            // Handle edge additions and removals based on new direction
            if (direction.start === pts[0]) {
                if (endNodeInfo) {
                    addEdgeToZettelkasten(endTitle, startTitle, endNodeInfo.cm);
                }
                if (startNodeInfo) {
                    removeEdgeFromZettelkasten(startTitle, endTitle, startNodeInfo.cm);
                }
            } else if (direction.start === pts[1]) {
                if (startNodeInfo) {
                    addEdgeToZettelkasten(startTitle, endTitle, startNodeInfo.cm);
                }
                if (endNodeInfo) {
                    removeEdgeFromZettelkasten(endTitle, startTitle, endNodeInfo.cm);
                }
            } else {
                if (startNodeInfo) {
                    addEdgeToZettelkasten(startTitle, endTitle, startNodeInfo.cm);
                }
                if (endNodeInfo) {
                    addEdgeToZettelkasten(endTitle, startTitle, endNodeInfo.cm);
                }
            }
        }

        Edge.directionalityMap.set(this.edgeKey, direction);
    }
    getDirectionRelativeTo(node) {
        if (this.directionality.end === node) return 'outgoing';
        if (this.directionality.start === node) return 'incoming';
        return 'none';
    }
    center() {
        const cb = (t, n)=>t.plus(n.pos) ;
        return this.pts.reduce(cb, new vec2(0, 0)).unscale(this.pts.length);
    }
    draw() {
        this.html.setAttribute('stroke', this.mouseIsOver ? "lightskyblue" : this.style.stroke);
        this.html.setAttribute('fill', this.mouseIsOver ? "lightskyblue" : this.style.fill);

        const stressValue = Math.max(this.stress(), 0.01);
        let wscale = this.style['stroke-width'] / (0.5 + stressValue) * (this.mouseIsOver ? 2 : 1.6);
        wscale = Math.min(wscale, this.maxWidth);

        const direction = this.directionality;
        const hasDirection = (direction.start && direction.end);

        let path = '';
        if (hasDirection) {
            path = this.createStraightEdgePath(wscale);
        } else {
            path = this.createCurvedEdgePath(wscale);
        }
        if (!path) return;
        this.html.setAttribute('d', path);

        if (!hasDirection) {
            this.arrowSvg.style.display = 'none';
            this.borderSvg.style.display = 'none';
            return;
        }

        const arrowSvg = createArrowSvg(
            direction.start.pos,
            direction.end.pos,
            direction.start.scale,
            direction.end.scale,
            wscale
        );
        this.arrowSvg.setAttribute('d', arrowSvg.arrowPath);
        this.arrowSvg.style.display = '';

        const borderPath = createBorderSvg(arrowSvg);
        this.borderSvg.setAttribute('d', borderPath);
        this.borderSvg.style.display = '';
    }

    createStraightEdgePath(wscale) {
        const path = ["M "];
        const c = this.center();

        // Constructing the straight edge path
        for (const n of this.pts) {
            if (n.pos.isInvalid()) return '';

            const rotated = n.pos.minus(c).rot90();
            if (rotated.x !== 0 || rotated.y !== 0) {
                const left = rotated.normed(n.scale * wscale);
                if (left.isInvalid()) return '';

                path.push(toSVG(n.pos.minus(left)).str(),
                          " L ",
                          toSVG(left.plus(n.pos)).str(), " ");
            }
        }

        // Closing the straight edge path
        const argMinus = this.pts[0].pos.minus(c).rot90().normed(this.pts[0].scale * wscale);
        const firstPoint = this.pts[0].pos.minus(argMinus);
        if (firstPoint.isInvalid()) return '';

        path.push(" ", toSVG(firstPoint).str(), "z");
        return path.join('');
    }

    createCurvedEdgePath(wscale) {
        if (this.pts.length < 2) return '';

        // Constructing the curved edge path
        const startPoint = this.pts[0].pos;
        const endPoint = this.pts[this.pts.length - 1].pos;
        const startScale = this.pts[0].scale || 1; // Provide a default value if undefined
        const endScale = this.pts[this.pts.length - 1].scale || 1; // Provide a default value if undefined

        const horizontal = (startPoint.x - endPoint.x) / 1.1;
        const vertical = (startPoint.y - endPoint.y);
        const distance = Math.sqrt(horizontal * horizontal + vertical * vertical);

        // Calculate the perpendicular vector with adjusted scale based on node scales
        const startPerp = new vec2(vertical, -horizontal).normed(startScale * wscale);
        const endPerp = new vec2(vertical, -horizontal).normed(endScale * wscale);

        // Calculate the points for the curved path
        const startLeft = startPoint.minus(startPerp);
        if (startLeft.isInvalid()) return '';

        const startRight = startPoint.plus(startPerp);
        if (startRight.isInvalid()) return '';

        const endLeft = endPoint.minus(endPerp);
        if (endLeft.isInvalid()) return '';

        const endRight = endPoint.plus(endPerp);
        if (endRight.isInvalid()) return '';

        const curve = Math.min(1, Math.abs(vertical)) / 2;
        const vecLeft = new vec2(0, (vertical > 0 ? 1 : -1) * curve * distance);
        const vecRight = new vec2(0, (vertical > 0 ? -1 : 1) * curve * distance);
        const vecBase = new vec2(horizontal, 0);

        // Adjust the control points based on the distance
        const controlPointLeft1 = startLeft.minus(vecBase).minus(vecLeft);
        if (controlPointLeft1.isInvalid()) return '';

        const controlPointLeft2 = endLeft.plus(vecBase).plus(vecLeft);
        if (controlPointLeft2.isInvalid()) return '';

        const controlPointRight1 = startRight.minus(vecBase).plus(vecRight);
        if (controlPointRight1.isInvalid()) return '';

        const controlPointRight2 = endRight.plus(vecBase).minus(vecRight);
        if (controlPointRight2.isInvalid()) return '';

        // Construct the curved path
        return "M "
            + toSVG(startLeft).str()
            + " C "
            + toSVG(controlPointLeft1).str() + ", "
            + toSVG(controlPointLeft2).str() + ", "
            + toSVG(endLeft).str()
            + " L "
            + toSVG(endRight).str()
            + " C "
            + toSVG(controlPointRight2).str() + ", "
            + toSVG(controlPointRight1).str() + ", "
            + toSVG(startRight).str()
            + " Z";
    }
    step(dt) {
        dt = (isNaN(dt) ? 0 : Math.min(dt, 1));  // Clamp dt to a maximum of 1

        const avg = this.center();
        for (let n of this.pts) {
            if (n.anchorForce !== 0) continue; // Only apply force if the anchor force is zero

            const d = n.pos.minus(avg);
            const dMag = d.mag();

            // Update the current length of the edge
            this.currentLength = dMag;

            // Apply force to either shorten or lengthen the edge to the desired length
            if (dMag === this.length) continue;

            const dampingFactor = 0.4;
            const forceAdjustment = (1 - this.length / (dMag + 1e-300)) * dampingFactor;
            const f = d.scale(forceAdjustment);
            n.force = n.force.plus(f.scale(-this.strength));
        }
        this.draw();
    }
    stress() {
        const avg = this.center();
        const cb = (t, n)=>(t + n.pos.minus(avg).mag() - this.length) ;
        return this.pts.reduce(cb, 0) / (this.length + 1);
    }
    scaleEdge(amount) {
        this.length *= amount;
    }

    remove() {
        Edge.directionalityMap.set(this.edgeKey, this.directionality);

        // Remove the edge from the global edge array
        const edges = Graph.edges;
        const index = edges.indexOf(this);
        if (index > -1) edges.splice(index, 1);

        // Remove this edge from both connected nodes' edges arrays
        this.pts.forEach((node) => {
            const index = node.edges.indexOf(this);
            if (index < 0) return;

            node.edges.splice(index, 1);
            node.updateEdgeData();
        });

        const arrowSvg = this.arrowSvg;
        const borderSvg = this.borderSvg;
        const svgMap = Edge.SvgMap;
        svgMap.delete(this.html);
        svgMap.delete(arrowSvg);
        svgMap.delete(borderSvg);

        // Remove from the DOM
        if (arrowSvg?.parentNode) arrowSvg.parentNode.removeChild(arrowSvg);
        if (borderSvg?.parentNode) borderSvg.parentNode.removeChild(borderSvg);
        const html = this.html;
        if (html?.parentNode) html.parentNode.removeChild(html);
    }
}
function createArrowSvg(startPoint, endPoint, startScale, endScale, wscale) {
    const perspectiveFactor = 0.5; // Range [0, 1]
    const adjustedStartScale = 1 + (startScale - 1) * perspectiveFactor;
    const adjustedEndScale = 1 + (endScale - 1) * perspectiveFactor;
    const totalAdjustedScale = adjustedStartScale + adjustedEndScale;
    const startWeight = adjustedEndScale / totalAdjustedScale;
    const endWeight = adjustedStartScale / totalAdjustedScale;
    const midPoint = startPoint.scale(startWeight).plus(endPoint.scale(endWeight));

    const arrowScaleFactor = 1.5;
    const arrowLength = ((startScale + endScale) / 2 * wscale * 5) * arrowScaleFactor;
    const arrowWidth = ((startScale + endScale) / 2 * wscale * 3) * arrowScaleFactor;
    const direction = endPoint.minus(startPoint);
    const directionNormed = direction.normed(arrowLength);
    const perp = new vec2(-directionNormed.y, directionNormed.x).normed(arrowWidth);

    let arrowBase1 = midPoint.minus(perp);
    let arrowBase2 = midPoint.plus(perp);
    let arrowTip = midPoint.plus(directionNormed);

    const arrowFlipFactor = 0.85;
    const arrowBaseCenterX = (arrowBase1.x + arrowBase2.x) / 2;
    const arrowBaseCenterY = (arrowBase1.y + arrowBase2.y) / 2;
    const arrowCenterX = arrowBaseCenterX * arrowFlipFactor + arrowTip.x * (1 - arrowFlipFactor);
    const arrowCenterY = arrowBaseCenterY * arrowFlipFactor + arrowTip.y * (1 - arrowFlipFactor);
    const arrowCenter = new vec2(arrowCenterX, arrowCenterY);

    arrowBase1 = rotatePoint(arrowBase1, arrowCenter);
    arrowBase2 = rotatePoint(arrowBase2, arrowCenter);
    arrowTip = rotatePoint(arrowTip, arrowCenter);

    const arrowPath = "M " + toSVG(arrowBase1).str()
                    + " L " + toSVG(arrowTip).str()
                    + " L " + toSVG(arrowBase2).str() + " Z";
    return { arrowPath, arrowBase1, arrowBase2, arrowTip };
}

function createBorderSvg(arrowSvg) {
    const { arrowBase1, arrowBase2, arrowTip } = arrowSvg;

    const arrowMidX = (arrowBase1.x + arrowBase2.x + arrowTip.x) / 3;
    const arrowMidY = (arrowBase1.y + arrowBase2.y + arrowTip.y) / 3;
    const arrowMidPoint = new vec2(arrowMidX, arrowMidY);

    const offsetScale = 1.4;
    const borderBase1 = arrowMidPoint.plus(arrowBase1.minus(arrowMidPoint).scale(offsetScale));
    const borderBase2 = arrowMidPoint.plus(arrowBase2.minus(arrowMidPoint).scale(offsetScale));
    const borderTip = arrowMidPoint.plus(arrowTip.minus(arrowMidPoint).scale(offsetScale));

    return "M " + toSVG(borderBase1).str()
         + " L " + toSVG(borderTip).str()
         + " L " + toSVG(borderBase2).str() + " Z";
}

function rotatePoint(point, center) {
    return new vec2(2 * center.x - point.x, 2 * center.y - point.y);
}
