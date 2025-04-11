const Autopilot = {
    panToI: new vec2(0, 0),
    panToI_prev: null,
    referenceFrame: null,
    referenceScalePrev: 1,
    speed: 0,
    targetPan: new vec2(0, 0),
    targetZoom: new vec2(4, 0),
    threshold: 0.000001,

    isMoving(){ return this.speed !== 0 },
    reset(){
        Autopilot.speed = 0;
        return Autopilot.setNode();
    },
    setNode(node = null){
        this.referenceFrame = node;
        return this;
    },
    skip(){
        Graph.zoom_set(this.targetZoom)
            .pan_set(!this.referenceFrame ? this.targetPan
                    : this.referenceFrame.pos.plus(this.targetPan));
        return this;
    },
    start(speed = settings.autopilotSpeed){
        this.speed = speed;
        return this;
    },
    stop(){
        this.speed = 0;
        return this;
    },
    targetZoom_scaleBy(scale){
        this.targetZoom = this.targetZoom.scale(scale);
        return this;
    },
    vectorsCloseEnough(vec1, vec2){
        return vec1.minus(vec2).mag() < this.threshold
    },
    zoomToFitFrame(frame, margin = 1){
        const bb = frame.content.getBoundingClientRect();
        const svgbb = svg.getBoundingClientRect();
        const aspect = svgbb.width / svgbb.height;
        const scale = bb.height * aspect > bb.width ? svgbb.height / (margin * bb.height) : svgbb.width / (margin * bb.width);
        const gz = (1 / scale) ** (-1 / settings.zoomContentExp);
        return this.zoomToFrameByGz(frame, gz);
    },
    zoomToFrame(frame, s = 1){
        const gz = Graph.zoom.mag2() * ((frame.scale * s) ** (-1 / settings.zoomContentExp));
        return this.zoomToFrameByGz(frame, gz);
    },
    zoomToFrameByGz(frame, gz){
        this.panToI = new vec2(0, 0);
        this.referenceFrame = frame;
        this.targetPan = new vec2(0, 0); //frame.pos;
        this.targetZoom = Graph.zoom.unscale(gz ** 0.5);
        return this;
    }
}

var gen = iter();

function frame() {
    gen.next();
    Promise.delay(100).then(frame);
}

const panInput = Elem.byId('pan');
const zoomInput = Elem.byId('zoom');

const coords = Elem.byId('coordinates');

On.input(panInput, (e)=>{
    App.interface.coordsLive = false;
    const r = /([+-]?(([0-9]*\.[0-9]*)|([0-9]+))([eE][+-]?[0-9]+)?)\s*,?\s*([+-]?i?(([0-9]*\.[0-9]*)|([0-9]+))([eE][+-]?[0-9]+)?)/;
    const m = panInput.value.match(r);
    if (m === null) return;

    Graph.pan_set(new vec2(parseFloat(m[0]), parseFloat(m[6].replace(/[iI]/, ''))));
});
On.input(zoomInput, (e)=>{
    App.interface.coordsLive = false;
    const r = /([+-]?(([0-9]*\.[0-9]*)|([0-9]+))([eE][+-]?[0-9]+)?)/;
    const m = zoomInput.value.match(r);
    if (m === null) return;

    const z = parseFloat(m);
    if (z !== 0) Graph.zoom_scaleBy(z / Graph.zoom.mag());
});
['paste', 'mousemove', 'mousedown', 'dblclick', 'click'].forEach( (eName)=>{
    On[eName](panInput, Event.stopPropagation);
    On[eName](zoomInput, Event.stopPropagation);
});

function performZoom(amount, dest) {
    const inverseAmount = 1 / amount;
    Graph.zoom_scaleBy(inverseAmount)
        .pan_set(dest.scale(1 - inverseAmount).plus(Graph.pan.scale(inverseAmount)));
}

// Constants
const DRAG_THRESHOLD = 1; // pixels

class Interface {
    altHeld = false;
    controlDragOccurred = false;
    coordsLive = true;
    isMousePanning = false;
    isMouseZooming = false;
    isRotating = false;
    mousePanButton = settings.panClick;
    mouseZoomButton = settings.zoomClick;
    mouseZoomStartY = 0;
    nodeMode = new NodeMode(this.autoToggleAllOverlays.bind(this));
    overlays = [];
    rotateStartPos = new vec2(0, 0);
    rotatePrevPos = new vec2(0, 0);
    init(){
        On.keydown(document, this.onAltKeyDown);
        On.keyup(document, this.onAltKeyUp);
        On.message(window, this.onMessage);

        On.mousemove(svg, this.onMouseMove);
        On.mousedown(svg, this.onMouseDown);
        On.mouseup(window, this.onMouseUp);
        On.contextmenu(document, this.onContextMenu);
        On.wheel(svg, this.onWheel);
    }

    autoToggleAllOverlays(){
        const condition = (this.altHeld || this.nodeMode.val === 1);
        for (const overlay of this.overlays) {
            overlay.style.display = (condition ? 'block' : 'none');
        }
    }
    onAltKeyDown = (e)=>{
        if (e.altKey) {
            this.altHeld = true;
            this.autoToggleAllOverlays();
            e.preventDefault(); // e.g. focusing on the iframe
        }
    }
    onAltKeyUp = (e)=>{
        if (!e.altKey) {
            this.altHeld = false;
            this.autoToggleAllOverlays();
        }
    }
    onMessage = (e)=>{
        const data = e.data;
        if (data.altHeld !== undefined) {
            this.altHeld = data.altHeld;
            this.autoToggleAllOverlays();
        }
        this.nodeMode.val = data.nodeMode ?? 0;
    }

    onMouseMove = (e)=>{
        if (isDraggingDragBox) return;

        Graph.mousePos_setXY(e.pageX, e.pageY);

        if (this.isRotating) {
            const currentPos = new vec2(e.pageX, e.pageY);
            const deltaPos = currentPos.minus(this.rotatePrevPos);

            const angleDelta = (deltaPos.x - deltaPos.y) * settings.dragRotateSpeed;
            // Adjust zoom and pan to reflect rotation around the pivot point
            const zc = Graph.vecToZ(this.rotateStartPos).minus(Graph.pan);
            const deltaRotation = Graph.applyRotationDelta(angleDelta);
            Graph.zoom_cmultWith(deltaRotation)
                 .pan_incBy(zc.cmult(new vec2(1, 0).minus(deltaRotation)));

            this.rotatePrevPos = currentPos;

            if (deltaPos.mag() > DRAG_THRESHOLD) this.controlDragOccurred = true;

            e.preventDefault();
        } else if (this.isMouseZooming) {
            const dragDistance = e.clientY - this.mouseZoomStartY;
            const amount = Math.exp(-dragDistance * settings.dragZoomSpeed * settings.zoomSpeedMultiplier);
            const dest = Graph.vecToZ();
            performZoom(amount, dest);
            this.mouseZoomStartY = e.clientY;
            regenAmount += Math.abs(dragDistance);

            if (Math.abs(dragDistance) > DRAG_THRESHOLD) this.controlDragOccurred = true;

            e.preventDefault();
        } else if (this.isMousePanning) {
            Autopilot.stop();
            this.coordsLive = true;
            const delta = Graph.mousePos.minus(Graph.mouseDownPos);
            Graph.pan_decBy(toDZ(delta));
            regenAmount += delta.mag() * 0.25;
            Graph.mouseDownPos_setXY();

            if (delta.mag() > DRAG_THRESHOLD) this.controlDragOccurred = true;
        }
    }

    onMouseDown = (e)=>{
        Graph.mouseDownPos_setXY(e.pageX, e.pageY);
        this.controlDragOccurred = false;

        Node.prev = null;

        document.activeElement.blur();

        // Handle zooming and rotating
        if (
            settings.zoomClick !== "scroll" &&
            e.button === this.mouseZoomButton &&
            e.getModifierState(settings.rotateModifier)
        ) {
            this.isRotating = true;
            this.rotateStartPos = new vec2(e.pageX, e.pageY);
            this.rotatePrevPos = this.rotateStartPos;
            e.preventDefault();
        } else if (e.button === this.mouseZoomButton) {
            this.isMouseZooming = true;
            this.mouseZoomStartY = e.clientY;
            e.preventDefault();
        }

        // Handle panning
        if (e.button === this.mousePanButton) {
            Autopilot.stop();
            Graph.mouseDownPos_setXY();
            this.isMousePanning = true;
            e.preventDefault();
        }

        // Handle context menu button press
        if (e.button === parseInt(settings.contextKey)) {
            this.controlDragOccurred = false;

            if (controls.contextMenuButton.value === 2) { // Assuming 2 is right-click
                e.preventDefault(); // suppress browser context menu
            }
        }
    }

    onMouseUp = (e)=>{
        if (e.button === this.mouseZoomButton) {
            if (this.isMouseZooming || this.isRotating) {
                this.isMouseZooming = false;
                this.isRotating = false;
                e.preventDefault();
            }
        }
        if (e.button === this.mousePanButton && this.isMousePanning) {
            this.isMousePanning = false;
        }

        // Handle context menu opening
        if (e.button === parseInt(settings.contextKey)) {
            if (!this.controlDragOccurred) App.menuContext.open(e.pageX, e.pageY, e.target);
            // Do not reset 'controlDragOccurred' here; let 'contextmenu' handler manage it
            e.preventDefault();
        }

        if (Graph.movingNode !== undefined) Graph.movingNode.stopFollowingMouse(e);
        Mouse.isDragging = false;
    }

    onContextMenu = (e)=>{
        // Function to check if the default context menu should be used
        function shouldUseDefaultContextMenu(target) {
            return target.closest('.dropdown, .CodeMirror, #customContextMenu, #suggestions-container, .modal-content, .tooltip') ||
                target.tagName === 'IFRAME' ||
                target.tagName === 'IMG' ||
                target.tagName === 'VIDEO';
        }

        if (this.controlDragOccurred) { // prevent both native and custom context menus
            e.preventDefault();
            this.controlDragOccurred = false;
            return;
        }

        // Allow browser context menu if not dragging

        if (controls.contextMenuButton.value !== 2) { // not right-click
            return; // allow browser context menu
        }

        // If the default context menu should be used, do nothing
        if (e.ctrlKey || shouldUseDefaultContextMenu(e.target)) {
            App.menuContext.hide();
            return; // allow browser context menu
        }

        e.preventDefault(); // // suppress browser context menu
    }

    onWheel = (e)=>{
        // Only perform rotation via Alt + scroll wheel when zoomClick is "scroll"
        if (settings.zoomClick === "scroll" && App.nodeMode !== 1 && e.getModifierState(settings.rotateModifier)) {
            Autopilot.stop();
            this.coordsLive = true;

            const angle = e.deltaY * settings.rotateModifierSpeed;
            const zc = Graph.vecToZ().minus(Graph.pan);
            const deltaRotation = Graph.applyRotationDelta(angle);

            Graph.zoom_cmultWith(deltaRotation)
                 .pan_incBy(zc.cmult(new vec2(1, 0).minus(deltaRotation)));
            e.stopPropagation();
            return;
        }

        if (settings.zoomClick === "scroll") {
            // Zooming via scroll wheel
            Autopilot.stop();
            Coordinate.deselect();
            App.menuContext.hide();
            this.coordsLive = true;
            const dest = Graph.vecToZ();
            regenAmount += Math.abs(e.deltaY);
            const amount = Math.exp(e.deltaY * settings.zoomSpeed * settings.zoomSpeedMultiplier);
            performZoom(amount, dest);
            e.stopPropagation();
        } else if (settings.panClick === "scroll") {
            // Panning via scroll wheel
            Autopilot.stop();
            this.coordsLive = true;
            let dest = Graph.vecToZ();
            const dp = toDZ(new vec2(e.deltaX, e.deltaY).scale(settings.panSpeed));
            regenAmount += Math.hypot(e.deltaX, e.deltaY);
            Graph.pan_incBy(dp);
            e.stopPropagation();
        }
    }
}



//Touchpad controls (WIP)
let touches = new Map();
On.touchstart(svg, (e)=>{
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches.item(i);
        touches.set(touch.identifier, {
            prev: touch,
            now: touch
        });
    }
}, false);
On.touchcancel(svg, (e)=>{
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches.item(i);
        touches.delete(touch.identifier);
    }
}, false);
On.touchend(svg, (e)=>{
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches.item(i);
        touches.delete(touch.identifier);
    }
}, false);
On.touchmove(svg, (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches.item(i);
        touches.set(touch.identifier, {
            prev: touches.get(touch.identifier)?.now,
            now: touch
        });
    }

    switch (touches.size) {
        case 1: {
            Autopilot.stop();
            App.interface.coordsLive = true;
            const t = [...touches.values()][0];
            const prev = new vec2(t.prev.clientX, t.prev.clientY);
            const now = new vec2(t.now.clientX, t.now.clientY);
            Graph.pan_incBy(toDZ(prev.minus(now)));
            e.stopPropagation();
            break;
        }

        case 2: {
            const pts = [...touches.values()];
            const p1p = toS(new vec2(pts[0].prev.clientX, pts[0].prev.clientY));
            const p2p = toS(new vec2(pts[1].prev.clientX, pts[1].prev.clientY));
            const p1n = toS(new vec2(pts[0].now.clientX, pts[0].now.clientY));
            const p2n = toS(new vec2(pts[1].now.clientX, pts[1].now.clientY));

            const midpointPrev = p1p.plus(p2p).scale(0.5);
            const midpointNow = p1n.plus(p2n).scale(0.5);

            const zPrev = Graph.vecToZ(midpointPrev);
            const zNow = Graph.vecToZ(midpointNow);
            const zc = zNow.minus(Graph.pan); // relative center

            const zoomFactor = p2n.minus(p1n).mag() / p2p.minus(p1p).mag();

            const anglePrev = Math.atan2(p2p.y - p1p.y, p2p.x - p1p.x);
            const angleNow = Math.atan2(p2n.y - p1n.y, p2n.x - p1n.x);
            const rotationAngle = angleNow - anglePrev;
            const deltaRotation = Graph.applyRotationDelta(rotationAngle);

            const deltaZoom = new vec2(zoomFactor, 0);
            Graph.zoom = Graph.zoom.cmult(deltaRotation).scale(zoomFactor);
            Graph.pan = Graph.pan
                .plus(zc.cmult(new vec2(1, 0).minus(deltaRotation.cmult(deltaZoom))))
                .minus(zNow.minus(zPrev));

            e.preventDefault();
            e.stopPropagation();
            break;
        }

        default:
            break;
    }
}, false);



var gestureStartParams = {
    rotation: 0,
    x: 0,
    y: 0,
    scale: 0,
    zoom: new vec2(0, 0),
    pan: new vec2(0, 0)
};
On.gesturestart(window, (e)=>{
    e.preventDefault();
    Logger.debug(e);
    gestureStartParams.rotation = e.rotation;
    gestureStartParams.scale = e.scale;
    gestureStartParams.x = e.pageX;
    gestureStartParams.y = e.pageY;
    gestureStartParams.zoom = Graph.zoom;
    gestureStartParams.pan = Graph.pan;
});
On.gesturechange(window, (e)=>{
    e.preventDefault();
    Logger.debug(e);
    let d_theta = e.rotation - gestureStartParams.rotation;
    let d_scale = e.scale;
    const r = -e.rotation * settings.gestureRotateSpeed;
    const o = new vec2(Math.cos(r), Math.sin(r));
    Graph.pan_set(gestureStartParams.pan)
        .zoom_set(gestureStartParams.zoom.cmult(o));

    const r_center = Graph.xyToZ(e.pageX, e.pageY);
    let s = 0;
    if (e.scale !== 0) {
        let s = 1 / e.scale;
        Graph.zoom_scaleBy(s);
        regenAmount += Math.abs(Math.log(s)) * settings.maxLines;
    }
    let dest = r_center;
    let amount = s;
    const dp = r_center.minus(gestureStartParams.pan);
    Graph.pan_set(gestureStartParams.pan.plus(dp.minus(
                    dp.cmult(Graph.zoom.cdiv(gestureStartParams.zoom)))));
    //Graph.pan_set(dest.scale(1-amount).plus(gestureStartParams.pan.scale(amount)));

});
On.gestureend(window, Event.preventDefault);
