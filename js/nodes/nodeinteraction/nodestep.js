//frame();
let nodeMode_v = 0;
let mousePathPos;
let current_time;
let regenAmount = 0;
let regenDebt = 0;
let avgfps = 0;
let panToI = new vec2(0, 0);
let panToI_prev;

//let manualConnectionOverride = false;

class NodeSimulation {
    mousePath = [];
    prevNodeScale = 1;
    svg_mousePath = svg.getElementById('mousePath');
    current_time = undefined;

    processSelectedNodes() {
        processScalingKeys();

        const movementAngle = getDirectionAngleFromKeyState();
        if (movementAngle === null) return;

        App.selectedNodes.forEach(Node.moveAtThisAngle, movementAngle);
    }

    updateAutopilot(time) {
        let autopilot_travelDist = 0;
        let newPan = pan;

        if (autopilotReferenceFrame && autopilotSpeed !== 0) {
            if (panToI_prev === undefined) {
                panToI_prev = autopilotReferenceFrame.pos.scale(1);
                this.prevNodeScale = autopilotReferenceFrame.scale;
            }
            panToI = panToI.scale(1 - settings.autopilotRF_Iscale).plus(autopilotReferenceFrame.pos.minus(panToI_prev).scale(settings.autopilotRF_Iscale));
            newPan = pan.scale(1 - autopilotSpeed).plus(autopilotReferenceFrame.pos.scale(autopilotSpeed).plus(panToI));
            panToI_prev = autopilotReferenceFrame.pos.scale(1);

            if (autopilotReferenceFrame.scale !== this.prevNodeScale) {
                let scaleFactor = autopilotReferenceFrame.scale / this.prevNodeScale;
                const maxScaleChangePerFrame = 0.1;
                scaleFactor = Math.max(Math.min(scaleFactor, 1 + maxScaleChangePerFrame), 1 - maxScaleChangePerFrame);

                zoomTo = zoomTo.scale(scaleFactor);
                this.prevNodeScale = autopilotReferenceFrame.scale;
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
        } else {
            zoom = zoom.scale(1 - autopilotSpeed).plus(zoomTo.scale(autopilotSpeed));
        }
        pan = newPan;
        if (coordsLive) {
            panInput.value = pan.ctostring();
            zoomInput.value = String(zoom.mag());
        }
    }

    updateMousePath() {
        if (this.mousePath.length < 1) {
            mousePathPos = toZ(mousePos);
            this.mousePath = ["M ", toSVG(mousePathPos), " L "];
        }

        const step = Fractal.step;
        for (let i = 0; i < settings.orbitStepRate; i++) {
            mousePathPos = step(mousePathPos, toZ(mousePos));
            if (toSVG(mousePathPos).isFinite() && toSVG(mousePathPos).mag2() < 1e60) {
                this.mousePath.push(toSVG(mousePathPos), " ")
            }
        }
    }

    updateMousePathWidth() {
        const svg_mousePath = this.svg_mousePath;
        let width = zoom.mag() * 0.0005 * Svg.zoom;

        if (App.nodeMode && Node.prev) {
            const m = toSVG(Node.prev.pos);
            const l = toSVG(toZ(mousePos));
            svg_mousePath.setAttribute('d', "M " + m + " L " + l);
            width *= 50;
        } else {
            svg_mousePath.setAttribute('d', this.mousePath.join(''));
        }

        if (!App.nodeMode && !Node.prev) {
            Node.prev = null;
            this.mousePath = [];
            svg_mousePath.setAttribute('d', '');
        }

        svg_mousePath.setAttribute('stroke-width', String(width));
    }

    updateFPS(time) {
        if (this.current_time === undefined) {
            this.current_time = time;
        }
        let dt = time - this.current_time;
        this.current_time = time;
        if (dt > 0) {
            const alpha = Math.exp(-1 * dt / 1000);
            avgfps = avgfps * alpha + (1 - alpha) * 1000 / dt;
        }
        Elem.byId('debug_layer').children[1].textContent = "fps:" + avgfps;
        Elem.byId('fps').textContent = Math.round(avgfps).toString() + " fps";
        return dt;
    }

    updateNodes(dt) {
        dt *= (1 - nodeMode_v) ** 5;
        Graph.forEachNode(this.updateForThisDt, dt);
        return this;
    }
    updateForThisDt(item){
        item.step(this);
        //let d = toZ(mousePos).minus(n.pos);
    }
    updateEdges(dt) {
        Graph.forEachEdge(this.updateForThisDt, dt);
        return this;
    }

    updateRegen() {
        const lerp = Math.lerp;
        const random = Math.random;
        regenDebt = Math.min(16, regenDebt + lerp(settings.regenDebtAdjustmentFactor, regenAmount, Math.min(1, (nodeMode_v ** 5) * 1.01)));
        for (; regenDebt > 0; regenDebt--) {
            Fractal.render_hair(random() * settings.renderSteps);
        }
        regenAmount = 0;
        nodeMode_v = lerp(nodeMode_v, App.nodeMode, 0.125);
    }

    nodeStep = (time)=>{
        if (App.selectedNodes.uuids.size > 0) this.processSelectedNodes();

        this.updateAutopilot(time);
        Svg.updateViewbox();
        this.updateMousePath();
        this.updateMousePathWidth();
        const dt = this.updateFPS(time);
        this.updateNodes(dt).updateEdges(dt).updateRegen();

        window.requestAnimationFrame(this.nodeStep);
    }

    start() {
        window.requestAnimationFrame(this.nodeStep);
    }
}
