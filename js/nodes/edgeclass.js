function findExistingEdge(node1, node2) {
    return node1.edges.find(node2.edges.includes, node2.edges);
}

class Edge {
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

        const edgeKey = this.edgeKey = pts.map(String.uuidOf).sort().join('-');
        this.directionality = Graph.edgeDirectionalities[edgeKey]
                           || {start: null, end: null};
        this.view = new EdgeView(this, edgeKey, style);

        Logger.debug("Creating edge with pts:", pts);
        Logger.debug("Directionality after assignment:", this.directionality);
    }
    static directionalityFromData = (direction)=>({
        start: Node.byUuid(direction.start),
        end: Node.byUuid(direction.end)
    })
    static dataForEdge(edge){ return edge.dataObj() }
    dataObj() {
        return {
            l: this.length,
            s: this.strength,
            g: this.style,
            p: this.pts.map(String.uuidOf),
            directionality: { // Simplified data using UUIDs
                start: this.directionality.start?.uuid ?? null,
                end: this.directionality.end?.uuid ?? null
            },
            edgeKey: this.edgeKey
        }
    }

    removeInstance() {
        const pts = this.pts;
        if (pts[0].isTextNode && pts[1].isTextNode) {
            removeEdgeFromAllInstances(pts[0], pts[1]);
        } else {
            this.remove();
        }
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
    static scaleLengthByThisAmount(edge){
        return edge.scaleLength(this.valueOf())
    }

    toggleDirection() {
        const pts = this.pts;
        const direction = this.directionality;
        const status = (direction.start === pts[0]) ? '0-1'
                     : (direction.start === pts[1]) ? '1-0' : 'dflt';
        direction.start = (status === '0-1') ? pts[1]
                        : (status === '1-0') ? null : pts[0];
        direction.end = (status === '0-1') ? pts[0]
                      : (status === '1-0') ? null : pts[1];

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

        Graph.edgeDirectionalities[this.edgeKey] = direction;
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

    remove(){ Graph.deleteEdge(this) }
    scaleEdge(amount) {
        this.length *= amount;
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
        this.view.draw();
    }
    stress(){
        const avg = this.center();
        const cb = (t, n)=>(t + n.pos.minus(avg).mag() - this.length) ;
        return this.pts.reduce(cb, 0) / (this.length + 1);
    }
}



class EdgeView {
    funcPopulate = 'populateForEdge';
    maxWidth = 0.05;
    mouseIsOver = false;
    constructor(model, id, style){
        this.model = model;
        this.id = id;
        this.style = style;
        this.svgArrow = this.makePath('edge-arrow');
        this.svgBorder = this.makePath('edge-border');
        this.svgLink = this.makeLink();
    }

    attachEventListeners(elem){
        On.wheel(elem, this.onWheel);
        On.mouseover(elem, this.toggleMouseOver.bind(this, true));
        On.mouseout(elem, this.toggleMouseOver.bind(this, false));
        On.dblclick(elem, this.onDblClick);
        On.click(elem, this.onClick);
    }
    draw(){
        const mouseIsOver = this.mouseIsOver;
        this.svgLink.setAttribute('stroke', mouseIsOver ? "lightskyblue" : this.style.stroke);
        this.svgLink.setAttribute('fill', mouseIsOver ? "lightskyblue" : this.style.fill);

        const stressValue = Math.max(this.model.stress(), 0.01);
        let wscale = this.style['stroke-width'] / (0.5 + stressValue) * (mouseIsOver ? 2 : 1.6);
        wscale = Math.min(wscale, this.maxWidth);

        const direction = this.model.directionality;
        const hasDirection = (direction.start && direction.end);

        const funcMakePath = (hasDirection ? 'makeStraightPath' : 'makeCurvedPath');
        const path = this[funcMakePath](this.model.pts, wscale);
        if (!path) return;
        this.svgLink.setAttribute('d', path);

        if (!hasDirection) {
            this.svgArrow.style.display = 'none';
            this.svgBorder.style.display = 'none';
            return;
        }

        const svgArrow = this.makeSvgArrow(
            direction.start.pos,
            direction.end.pos,
            direction.start.scale,
            direction.end.scale,
            wscale
        );
        this.svgArrow.setAttribute('d', svgArrow.arrowPath);
        this.svgArrow.style.display = '';

        const borderPath = this.makeBorderPath(svgArrow);
        this.svgBorder.setAttribute('d', borderPath);
        this.svgBorder.style.display = '';
    }
    toggleMouseOver(status){
        this.mouseIsOver = status;
        this.svgArrow.classList.toggle('edge-arrow-hover', status);
        this.svgBorder.classList.toggle('edge-border-hover', status);
    }

    makeLink(){
        const path = Svg.new.path();
        for (const [key, value] of Object.entries(this.style)) {
            path.setAttribute(key, value)
        }
        path.dataset.viewType = 'edgeViews';
        path.dataset.viewId = this.id;
        this.attachEventListeners(path);
        return path;
    }
    makePath(className){
        const path = Svg.new.path();
        path.classList.add(className);
        path.style.display = 'none';
        path.dataset.viewType = 'edgeViews';
        path.dataset.viewId = this.id;
        this.attachEventListeners(path);
        return path;
    }
    makeStraightPath(pts, wscale){
        const path = ["M "];
        const c = this.model.center();

        // Constructing the straight edge path
        for (const n of pts) {
            if (n.pos.isInvalid()) return '';

            const rotated = n.pos.minus(c).rot90();
            if (rotated.x !== 0 || rotated.y !== 0) {
                const left = rotated.normed(n.scale * wscale);
                if (left.isInvalid()) return '';

                path.push(toSVG(n.pos.minus(left)),
                          " L ",
                          toSVG(left.plus(n.pos)), " ");
            }
        }

        // Closing the straight edge path
        const argMinus = pts[0].pos.minus(c).rot90().normed(pts[0].scale * wscale);
        const firstPoint = pts[0].pos.minus(argMinus);
        if (firstPoint.isInvalid()) return '';

        path.push(" ", toSVG(firstPoint), "z");
        return path.join('');
    }
    makeCurvedPath(pts, wscale){
        if (pts.length < 2) return '';

        const startPoint = pts[0].pos;
        const endPoint = pts[1].pos;
        const startScale = pts[0].scale || 1;
        const endScale = pts[1].scale || 1;

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

        return "M "
            + toSVG(startLeft)
            + " C "
            + toSVG(controlPointLeft1) + ", "
            + toSVG(controlPointLeft2) + ", "
            + toSVG(endLeft)
            + " L "
            + toSVG(endRight)
            + " C "
            + toSVG(controlPointRight2) + ", "
            + toSVG(controlPointRight1) + ", "
            + toSVG(startRight)
            + " Z";
    }
    makeSvgArrow(startPoint, endPoint, startScale, endScale, wscale){
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

        arrowBase1 = this.rotatePoint(arrowBase1, arrowCenter);
        arrowBase2 = this.rotatePoint(arrowBase2, arrowCenter);
        arrowTip = this.rotatePoint(arrowTip, arrowCenter);

        const arrowPath = "M " + toSVG(arrowBase1)
                        + " L " + toSVG(arrowTip)
                        + " L " + toSVG(arrowBase2) + " Z";
        return { arrowPath, arrowBase1, arrowBase2, arrowTip };
    }
    makeBorderPath(svgArrow){
        const { arrowBase1, arrowBase2, arrowTip } = svgArrow;

        const arrowMidX = (arrowBase1.x + arrowBase2.x + arrowTip.x) / 3;
        const arrowMidY = (arrowBase1.y + arrowBase2.y + arrowTip.y) / 3;
        const arrowMidPoint = new vec2(arrowMidX, arrowMidY);

        const offsetScale = 1.4;
        const borderBase1 = arrowMidPoint.plus(arrowBase1.minus(arrowMidPoint).scale(offsetScale));
        const borderBase2 = arrowMidPoint.plus(arrowBase2.minus(arrowMidPoint).scale(offsetScale));
        const borderTip = arrowMidPoint.plus(arrowTip.minus(arrowMidPoint).scale(offsetScale));

        return "M " + toSVG(borderBase1)
            + " L " + toSVG(borderTip)
            + " L " + toSVG(borderBase2) + " Z";
    }

    rotatePoint(point, center){
        return new vec2(2 * center.x - point.x, 2 * center.y - point.y);
    }

    onClick = (e)=>{
        if (App.nodeMode) return;

        this.model.toggleDirection();
        this.draw();
    }
    onDblClick = (e)=>{
        if (!App.nodeMode) return;

        this.model.removeInstance();
        e.stopPropagation();
    }
    onWheel = (e)=>{
        if (!App.nodeMode) return;

        const amount = Math.exp(e.wheelDelta * -settings.zoomSpeed);

        // Determine if this edge should be scaled based on both nodes being selected
        const selectedNodes = App.selectedNodes;
        if (selectedNodes.uuids.size > 0 && this.model.pts.every(selectedNodes.hasNode, selectedNodes)) {
            selectedNodes.getUniqueEdges()
            .forEach(Edge.scaleLengthByThisAmount, amount)
        } else {
            this.model.scaleLength(amount);
        }

        e.stopPropagation();
    }
}
