

var zoomTo = new vec2(4, 0);
var panTo = new vec2(0, 0);
var autopilotReferenceFrame = undefined;
var autopilotSpeed = 0;

function skipAutopilot() {
    zoom = zoomTo
    pan = autopilotReferenceFrame ? autopilotReferenceFrame.pos.plus(panTo) : panTo;
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

function performZoom(amount, dest) {
    // Invert the zoom factor by taking the reciprocal of the scale amount
    zoom = zoom.scale(1 / amount);
    pan = dest.scale(1 - (1 / amount)).plus(pan.scale(1 / amount));
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

// Flag to track if a control drag occurred
let controlDragOccurred = false;

// Modified 'mousemove' Event Listener
svg.addEventListener("mousemove", (event) => {
    if (isDraggingDragBox) { return; }
    mousePos = new vec2(event.pageX, event.pageY);

    if (isRotating) {
        // Rotating logic
        let currentPos = new vec2(event.pageX, event.pageY);
        let deltaPos = currentPos.minus(rotatePrevPos);

        // Compute angle delta based on mouse movement
        let angleDelta = (deltaPos.x - deltaPos.y) * settings.dragRotateSpeed;

        // Update rotation incrementally
        let deltaRotation = new vec2(Math.cos(angleDelta), Math.sin(angleDelta));
        rotation = rotation.cmult(deltaRotation);

        // Adjust zoom and pan to reflect rotation around the pivot point
        let p = toZ(rotateStartPos);
        let zc = p.minus(pan);

        zoom = zoom.cmult(deltaRotation);
        pan = pan.plus(zc.cmult(new vec2(1, 0).minus(deltaRotation)));

        // Update rotatePrevPos for the next movement
        rotatePrevPos = currentPos;

        // Check if movement exceeds drag threshold
        if (deltaPos.mag() > DRAG_THRESHOLD) {
            controlDragOccurred = true;
        }

        event.preventDefault();
    } else if (isMouseZooming) {
        // Zooming logic
        let dragDistance = event.clientY - mouseZoomStartY;
        let amount = Math.exp(-dragDistance * settings.dragZoomSpeed);
        let dest = toZ(mousePos);
        performZoom(amount, dest);
        mouseZoomStartY = event.clientY;
        regenAmount += Math.abs(dragDistance);

        // Check if movement exceeds drag threshold
        if (Math.abs(dragDistance) > DRAG_THRESHOLD) {
            controlDragOccurred = true;
        }

        event.preventDefault();
    } else if (isMousePanning) {
        // Panning logic
        isAnimating = false;
        autopilotSpeed = 0;
        coordsLive = true;
        let delta = mousePos.minus(mouseDownPos);
        pan = pan.minus(toDZ(delta));
        regenAmount += delta.mag() * 0.25;
        mouseDownPos = mousePos.scale(1);

        // Check if movement exceeds drag threshold
        if (delta.mag() > DRAG_THRESHOLD) {
            controlDragOccurred = true;
        }
    }
});

// Modified 'mousedown' Event Listener
svg.addEventListener("mousedown", (event) => {

    // Record the initial position on mousedown
    mouseDownPos = new vec2(event.pageX, event.pageY);

    // Reset controlDragOccurred flag
    controlDragOccurred = false;

    // Handle zooming and rotating
    if (
        settings.zoomClick !== "scroll" &&
        event.button === mouseZoomButton &&
        event.getModifierState(settings.rotateModifier)
    ) {
        // Start rotating
        isRotating = true;
        rotateStartPos = new vec2(event.pageX, event.pageY);
        rotatePrevPos = rotateStartPos; // Initialize rotatePrevPos
        event.preventDefault();
    } else if (event.button === mouseZoomButton) {
        // Start zooming
        isMouseZooming = true;
        mouseZoomStartY = event.clientY;
        event.preventDefault();
    }

    // Handle panning
    if (event.button === mousePanButton) {
        // Start panning
        autopilotSpeed = 0;
        mouseDownPos = mousePos.scale(1);
        isMousePanning = true;
        event.preventDefault();
    }

    // Handle context menu button press
    if (event.button === parseInt(settings.contextKey)) {
        // Reset controlDragOccurred flag
        controlDragOccurred = false;

        // Prevent default behavior to suppress browser context menu if it's the assigned button
        if (controls.contextMenuButton.value === 2) { // Assuming 2 is right-click
            event.preventDefault();
        }
    }
});

// Modified 'mouseup' Event Listener
addEventListener("mouseup", (event) => {
    if (isRotating && event.button === mouseZoomButton) {
        // End rotating
        isRotating = false;
        event.preventDefault();
    }
    if (event.button === mouseZoomButton && isMouseZooming) {
        // End zooming
        isMouseZooming = false;
        event.preventDefault();
    }
    if (event.button === mousePanButton && isMousePanning) {
        // End panning
        isMousePanning = false;
    }

    // Handle context menu opening
    if (event.button === parseInt(settings.contextKey)) {
        // If a control drag did NOT occur, open the custom context menu
        if (!controlDragOccurred) {
            // Open custom context menu
            openCustomContextMenu(event.pageX, event.pageY, event.target);
        }
        // Do not reset 'controlDragOccurred' here; let 'contextmenu' handler manage it
        event.preventDefault();
    }

    if (movingNode !== undefined) {
        movingNode.onmouseup(event);
    }
    isDraggingIcon = false;
});

// Modified 'contextmenu' Event Listener
document.addEventListener('contextmenu', function (event) {
    // Function to check if the default context menu should be used
    function shouldUseDefaultContextMenu(target) {
        return target.closest('.dropdown, .CodeMirror, #customContextMenu, #suggestions-container, .modal-content, .tooltip') ||
            target.tagName === 'IFRAME' ||
            target.tagName === 'IMG' ||
            target.tagName === 'VIDEO';
    }

    // If a control drag occurred, prevent both native and custom context menus
    if (controlDragOccurred) {
        event.preventDefault();
        // Reset the flag after preventing context menu
        controlDragOccurred = false;
        return;
    }

    // Allow context menu if not dragging
    // The rest of the existing logic remains intact

    // If the control for context menu is not set to right-click, allow the default context menu
    if (controls.contextMenuButton.value !== 2) {
        return; // Allow the default context menu
    }

    // If the default context menu should be used, do nothing
    if (event.ctrlKey || shouldUseDefaultContextMenu(event.target)) {
        hideContextMenu();
        return; // Allow the default context menu
    }

    // Prevent the default context menu when right-click is configured for custom context
    event.preventDefault();
});

// Wheel event listener
svg.addEventListener('wheel', (event) => {
    isAnimating = false;

    // Only perform rotation via Alt + scroll wheel when zoomClick is "scroll"
    if (settings.zoomClick === "scroll" && nodeMode !== 1 && event.getModifierState(settings.rotateModifier)) {
        autopilotSpeed = 0;
        coordsLive = true;

        let amount = event.deltaY * settings.rotateModifierSpeed;
        let p = toZ(mousePos);
        let zc = p.minus(pan);

        // Update the rotation by rotating the vector by the given amount
        let newRotation = new vec2(Math.cos(amount), Math.sin(amount));
        rotation = rotation.cmult(newRotation); // Compose rotations

        // Apply zoom rotation and adjust pan
        zoom = zoom.cmult(newRotation); // Rotate the zoom
        pan = pan.plus(zc.cmult(new vec2(1, 0).minus(newRotation)));

        cancel(event);
        return;
    }

    if (settings.zoomClick === "scroll") {
        // Zooming via scroll wheel
        autopilotSpeed = 0;
        deselectCoordinate();
        hideContextMenu();
        coordsLive = true;
        let dest = toZ(mousePos);
        regenAmount += Math.abs(event.deltaY);
        let amount = Math.exp(event.deltaY * settings.zoomSpeed);
        performZoom(amount, dest);
        cancel(event);
    } else if (settings.panClick === "scroll") {
        // Panning via scroll wheel
        autopilotSpeed = 0;
        coordsLive = true;
        let dest = toZ(mousePos);
        let dp = toDZ(new vec2(event.deltaX, event.deltaY).scale(settings.panSpeed));
        regenAmount += Math.hypot(event.deltaX, event.deltaY);
        pan = pan.plus(dp);
        cancel(event);
    }
});


//Touchpad controls (WIP)
let touches = new Map();
svg.addEventListener("touchstart", (ev) => {
    for (let i = 0; i < ev.changedTouches.length; i++) {
        const touch = ev.changedTouches.item(i);
        touches.set(touch.identifier, {
            prev: touch,
            now: touch
        });
    }
}, false);
svg.addEventListener("touchcancel", (ev) => {
    for (let i = 0; i < ev.changedTouches.length; i++) {
        const touch = ev.changedTouches.item(i);
        touches.delete(touch.identifier);
    }
}, false);
svg.addEventListener("touchend", (ev) => {
    for (let i = 0; i < ev.changedTouches.length; i++) {
        const touch = ev.changedTouches.item(i);
        touches.delete(touch.identifier);
    }
}, false);
svg.addEventListener("touchmove", (ev) => {
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
            let rotationDelta = new vec2(Math.cos(rotationAngle), Math.sin(rotationAngle));
            rotation = rotation.cmult(rotationDelta); // Update rotation

            // Rotate the zoom based on the new rotation angle
            zoom = zoom.rot(rotationAngle);

            // Continue updating the pan as you already do
            const zoomDiff = newZoom.minus(zoom);
            const panDiff = midpointNow.minus(midpointPrev).cmult(zoom);
            pan = pan.minus(panDiff);
            zoom = newZoom;

            ev.preventDefault();
            cancel(ev);
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