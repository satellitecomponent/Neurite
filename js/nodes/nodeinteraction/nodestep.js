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

//let manualConnectionOverride = false;

let prevNodeScale = 1;

function nodeStep(time) {
    const selectedNodes = getSelectedNodes();
    const movementAngle = getDirectionAngleFromKeyState();

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
    if (movementAngle !== null && selectedNodes.length > 0) {
        selectedNodes.forEach(node => {
            node.moveNode(movementAngle); // Apply movement based on the angle
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
            let scaleFactor = autopilotReferenceFrame.scale / prevNodeScale;
            // Introduce a moderated scale factor change
            const maxScaleChangePerFrame = 0.1; // Allow up to 10% change per frame
            scaleFactor = Math.max(Math.min(scaleFactor, 1 + maxScaleChangePerFrame), 1 - maxScaleChangePerFrame);

            zoomTo = zoomTo.scale(scaleFactor);
            prevNodeScale = autopilotReferenceFrame.scale;
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