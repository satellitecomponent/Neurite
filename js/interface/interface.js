var zoomTo = new vec2(4, 0);
var panTo = new vec2(0, 0);
var autopilotReferenceFrame = undefined;
var autopilotSpeed = 0;

function resetAutopilot() {
    autopilotSpeed = 0;
    autopilotReferenceFrame = undefined;
}
function skipAutopilot() {
    zoom = zoomTo
    pan = autopilotReferenceFrame ? autopilotReferenceFrame.pos.plus(panTo) : panTo;
}

var gen = iter();

function frame() {
    gen.next();
    Promise.delay(100).then(frame);
}

const panInput = Elem.byId('pan');
const zoomInput = Elem.byId('zoom');

let coordsLive = true;
const coords = Elem.byId('coordinates');

On.input(panInput, (e)=>{
    coordsLive = false;
    const r = /([+-]?(([0-9]*\.[0-9]*)|([0-9]+))([eE][+-]?[0-9]+)?)\s*,?\s*([+-]?i?(([0-9]*\.[0-9]*)|([0-9]+))([eE][+-]?[0-9]+)?)/;
    const m = panInput.value.match(r);
    if (m === null) return;

    pan = new vec2(parseFloat(m[0]), parseFloat(m[6].replace(/[iI]/, '')));
});
On.input(zoomInput, (e)=>{
    coordsLive = false;
    const r = /([+-]?(([0-9]*\.[0-9]*)|([0-9]+))([eE][+-]?[0-9]+)?)/;
    const m = zoomInput.value.match(r);
    if (m === null) return;

    const z = parseFloat(m);
    if (z !== 0) zoom = zoom.scale(z / zoom.mag());
});
['paste', 'mousemove', 'mousedown', 'dblclick', 'click'].forEach( (eName)=>{
    On[eName](panInput, Event.stopPropagation);
    On[eName](zoomInput, Event.stopPropagation);
});

function performZoom(amount, dest) {
    const inverseAmount = 1 / amount;
    zoom = zoom.scale(inverseAmount);
    pan = dest.scale(1 - inverseAmount).plus(pan.scale(inverseAmount));
}

// Variables for Mouse Interaction
let isMouseZooming = false;
let mouseZoomStartY = 0;

let isMousePanning = false;
let mouseDownPos = new vec2(0, 0);

let mousePanButton = settings.panClick;
let mouseZoomButton = settings.zoomClick;

let isRotating = false;
let rotateStartPos = new vec2(0, 0);
let rotatePrevPos = new vec2(0, 0);

// Constants
const DRAG_THRESHOLD = 1; // pixels

let controlDragOccurred = false;

On.mousemove(svg, (e)=>{
    if (isDraggingDragBox) return;

    mousePos = new vec2(e.pageX, e.pageY);

    if (isRotating) {
        const currentPos = new vec2(e.pageX, e.pageY);
        const deltaPos = currentPos.minus(rotatePrevPos);

        const angleDelta = (deltaPos.x - deltaPos.y) * settings.dragRotateSpeed;

        // Update rotation incrementally
        const deltaRotation = new vec2(Math.cos(angleDelta), Math.sin(angleDelta));
        rotation = rotation.cmult(deltaRotation);

        // Adjust zoom and pan to reflect rotation around the pivot point
        const zc = toZ(rotateStartPos).minus(pan);

        zoom = zoom.cmult(deltaRotation);
        pan = pan.plus(zc.cmult(new vec2(1, 0).minus(deltaRotation)));

        rotatePrevPos = currentPos;

        if (deltaPos.mag() > DRAG_THRESHOLD) controlDragOccurred = true;

        e.preventDefault();
    } else if (isMouseZooming) {
        const dragDistance = e.clientY - mouseZoomStartY;
        const amount = Math.exp(-dragDistance * settings.dragZoomSpeed);
        const dest = toZ(mousePos);
        performZoom(amount, dest);
        mouseZoomStartY = e.clientY;
        regenAmount += Math.abs(dragDistance);

        if (Math.abs(dragDistance) > DRAG_THRESHOLD) controlDragOccurred = true;

        e.preventDefault();
    } else if (isMousePanning) {
        isAnimating = false;
        autopilotSpeed = 0;
        coordsLive = true;
        const delta = mousePos.minus(mouseDownPos);
        pan = pan.minus(toDZ(delta));
        regenAmount += delta.mag() * 0.25;
        mouseDownPos = mousePos.scale(1);

        if (delta.mag() > DRAG_THRESHOLD) controlDragOccurred = true;
    }
});
On.mousedown(svg, (e) => {
    mouseDownPos = new vec2(e.pageX, e.pageY);
    controlDragOccurred = false;
    Node.prev = null;

    // Handle focus on background click
    if (e.target === svg) {
        svg.focus(); // Assuming the SVG element can be focused
    }

    // Handle zooming and rotating
    if (
        settings.zoomClick !== "scroll" &&
        e.button === mouseZoomButton &&
        e.getModifierState(settings.rotateModifier)
    ) {
        isRotating = true;
        rotateStartPos = new vec2(e.pageX, e.pageY);
        rotatePrevPos = rotateStartPos;
        e.preventDefault();
    } else if (e.button === mouseZoomButton) {
        isMouseZooming = true;
        mouseZoomStartY = e.clientY;
        e.preventDefault();
    }

    // Handle panning
    if (e.button === mousePanButton) {
        autopilotSpeed = 0;
        mouseDownPos = mousePos.scale(1);
        isMousePanning = true;
        e.preventDefault();
    }

    // Handle context menu button press
    if (e.button === parseInt(settings.contextKey)) {
        controlDragOccurred = false;

        if (controls.contextMenuButton.value === 2) { // Assuming 2 is right-click
            e.preventDefault(); // suppress browser context menu
        }
    }
});


On.mouseup(window, (e)=>{
    if (e.button === mouseZoomButton) {
        if (isMouseZooming || isRotating) {
            isMouseZooming = false;
            isRotating = false;
            e.preventDefault();
        }
    }
    if (e.button === mousePanButton && isMousePanning) {
        isMousePanning = false;
    }

    // Handle context menu opening
    if (e.button === parseInt(settings.contextKey)) {
        if (!controlDragOccurred) App.menuContext.open(e.pageX, e.pageY, e.target);
        // Do not reset 'controlDragOccurred' here; let 'contextmenu' handler manage it
        e.preventDefault();
    }

    if (Graph.movingNode !== undefined) Graph.movingNode.onMouseUp(e);
    Mouse.isDragging = false;
});

On.contextmenu(document, (e)=>{
    // Function to check if the default context menu should be used
    function shouldUseDefaultContextMenu(target) {
        return target.closest('.dropdown, .CodeMirror, #customContextMenu, #suggestions-container, .modal-content, .tooltip') ||
            target.tagName === 'IFRAME' ||
            target.tagName === 'IMG' ||
            target.tagName === 'VIDEO';
    }

    if (controlDragOccurred) { // prevent both native and custom context menus
        e.preventDefault();
        controlDragOccurred = false;
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
});

On.wheel(svg, (e)=>{
    isAnimating = false;

    // Only perform rotation via Alt + scroll wheel when zoomClick is "scroll"
    if (settings.zoomClick === "scroll" && App.nodeMode !== 1 && e.getModifierState(settings.rotateModifier)) {
        autopilotSpeed = 0;
        coordsLive = true;

        const amount = e.deltaY * settings.rotateModifierSpeed;
        const zc = toZ(mousePos).minus(pan);

        // Update the rotation by rotating the vector by the given amount
        const newRotation = new vec2(Math.cos(amount), Math.sin(amount));
        rotation = rotation.cmult(newRotation); // Compose rotations

        // Apply zoom rotation and adjust pan
        zoom = zoom.cmult(newRotation); // Rotate the zoom
        pan = pan.plus(zc.cmult(new vec2(1, 0).minus(newRotation)));

        e.stopPropagation();
        return;
    }

    if (settings.zoomClick === "scroll") {
        // Zooming via scroll wheel
        autopilotSpeed = 0;
        Coordinate.deselect();
        App.menuContext.hide();
        coordsLive = true;
        const dest = toZ(mousePos);
        regenAmount += Math.abs(e.deltaY);
        const amount = Math.exp(e.deltaY * settings.zoomSpeed);
        performZoom(amount, dest);
        e.stopPropagation();
    } else if (settings.panClick === "scroll") {
        // Panning via scroll wheel
        autopilotSpeed = 0;
        coordsLive = true;
        let dest = toZ(mousePos);
        const dp = toDZ(new vec2(e.deltaX, e.deltaY).scale(settings.panSpeed));
        regenAmount += Math.hypot(e.deltaX, e.deltaY);
        pan = pan.plus(dp);
        e.stopPropagation();
    }
});



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
On.touchmove(svg, (e)=>{
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches.item(i);
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
            e.stopPropagation();
            break;
        case 2:
            const pts = [...touches.values()];
            const p1p = toS(new vec2(pts[0].prev.clientX, pts[0].prev.clientY));
            const p2p = toS(new vec2(pts[1].prev.clientX, pts[1].prev.clientY));
            const p1n = toS(new vec2(pts[0].now.clientX, pts[0].now.clientY));
            const p2n = toS(new vec2(pts[1].now.clientX, pts[1].now.clientY));

            // Calculate the midpoint between the two touch points
            const midpointPrev = p1p.plus(p2p).scale(0.5);
            const midpointNow = p1n.plus(p2n).scale(0.5);

            // Calculate the zoom factor based on the distance between the touch points
            const zoomFactor = p2p.minus(p1p).mag() / p2n.minus(p1n).mag();

            // Calculate the rotation angle between the previous and current touch points
            const anglePrev = Math.atan2(p2p.y - p1p.y, p2p.x - p1p.x);
            const angleNow = Math.atan2(p2n.y - p1n.y, p2n.x - p1n.x);
            const rotationAngle = anglePrev - angleNow; // Calculate rotation between previous and current touch points

            // Update the global rotation vector
            const rotationDelta = new vec2(Math.cos(rotationAngle), Math.sin(rotationAngle));
            rotation = rotation.cmult(rotationDelta); // Update rotation

            zoom = zoom.rot(rotationAngle);

            const zoomDiff = newZoom.minus(zoom);
            const panDiff = midpointNow.minus(midpointPrev).cmult(zoom);
            pan = pan.minus(panDiff);
            zoom = newZoom;

            e.preventDefault();
            e.stopPropagation();
            break;
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
On.gesturestart(window, (e)=>{
    e.preventDefault();
    Logger.debug(e);
    gestureStartParams.rotation = e.rotation;
    gestureStartParams.scale = e.scale;
    gestureStartParams.x = e.pageX;
    gestureStartParams.y = e.pageY;
    gestureStartParams.zoom = zoom;
    gestureStartParams.pan = pan;

});
On.gesturechange(window, (e)=>{
    e.preventDefault();
    Logger.debug(e);
    let d_theta = e.rotation - gestureStartParams.rotation;
    let d_scale = e.scale;
    const r = -e.rotation * settings.gestureRotateSpeed;
    pan = gestureStartParams.pan;
    zoom = gestureStartParams.zoom;
    const r_center = toZ(new vec2(e.pageX, e.pageY));
    let s = 0;
    zoom = gestureStartParams.zoom.cmult(new vec2(Math.cos(r), Math.sin(r)));
    if (e.scale !== 0) {
        let s = 1 / e.scale;
        zoom = zoom.scale(s);
        regenAmount += Math.abs(Math.log(s)) * settings.maxLines;
    }
    let dest = r_center;
    let amount = s;
    const dp = r_center.minus(gestureStartParams.pan);
    pan = gestureStartParams.pan.plus(
        dp.minus(dp.cmult(zoom.cdiv(gestureStartParams.zoom))));
    //pan = dest.scale(1-amount).plus(gestureStartParams.pan.scale(amount));

});
On.gestureend(window, Event.preventDefault);
