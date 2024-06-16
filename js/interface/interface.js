

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

        if (targetElement.tagName.toLowerCase() === 'textarea' ||
            targetElement.contentEditable === 'true') {
            return;
        }

        // Check if the target is an instance of the custom dropdown
        if (targetElement.classList.contains('options-replacer')) {
            return;
        }

        // Check if the target is a node title
        if (targetElement.classList.contains('node-title-sd')) {
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
        hideContextMenu();
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
            const rotationAngle = anglePrev - angleNow; // Flip the rotation direction

            // Apply the rotation to the zoom vector
            const rotatedZoom = zoom.rot(rotationAngle);

            // Update the zoom and pan based on the midpoint, zoom factor, and rotation
            const newZoom = rotatedZoom.scale(zoomFactor);
            const zoomDiff = newZoom.minus(zoom);
            const panDiff = midpointNow.minus(midpointPrev).cmult(zoom); // Optimize pan calculation
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