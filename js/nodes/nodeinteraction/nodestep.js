//frame();
let nodeMode_v = 0;
let current_time;
let regenAmount = 0;
let regenDebt = 0;
let avgfps = 0;

//let manualConnectionOverride = false;

Autopilot.update = function(time){
    const oldPan = Graph.pan;
    let newPan;
    if (this.referenceFrame && this.speed !== 0) {
        if (!this.panToI_prev) {
            this.panToI_prev = this.referenceFrame.pos.scale(1);
            this.referenceScalePrev = this.referenceFrame.scale;
        }
        this.panToI = this.panToI.scale(1 - settings.autopilotRF_Iscale).plus(this.referenceFrame.pos.minus(this.panToI_prev).scale(settings.autopilotRF_Iscale));
        newPan = oldPan.scale(1 - this.speed).plus(this.referenceFrame.pos.scale(this.speed).plus(this.panToI));
        this.panToI_prev = this.referenceFrame.pos.scale(1);

        if (this.referenceFrame.scale !== this.referenceScalePrev) {
            let scaleFactor = this.referenceFrame.scale / this.referenceScalePrev;
            const maxScaleChangePerFrame = 0.1;
            scaleFactor = Math.max(Math.min(scaleFactor, 1 + maxScaleChangePerFrame), 1 - maxScaleChangePerFrame);

            this.targetZoom = this.targetZoom.scale(scaleFactor);
            this.referenceScalePrev = this.referenceFrame.scale;
        }
    } else {
        newPan = oldPan.scale(1 - this.speed)
                .plus(this.targetPan.scale(this.speed));
        this.panToI_prev = null;
    }

    const autopilot_travelDist = oldPan.minus(newPan).mag() / Graph.zoom.mag();
    if (autopilot_travelDist > settings.autopilotMaxSpeed) {
        newPan = oldPan.plus(newPan.minus(oldPan).scale(settings.autopilotMaxSpeed / autopilot_travelDist));
        const speedCoeff = Math.tanh(Math.log(settings.autopilotMaxSpeed / autopilot_travelDist + 1e-300) / 10) * 2;
        Graph.zoom_scaleBy(1 - speedCoeff * this.speed);
    } else {
        Graph.zoom_set(Graph.zoom.scale(1 - this.speed)
                        .plus(this.targetZoom.scale(this.speed)));
    }
    Graph.pan_set(newPan);
    if (App.interface.coordsLive) {
        panInput.value = Graph.pan.ctostring();
        zoomInput.value = String(Graph.zoom.mag());
    }
}

class NodeSimulation {
    framesLeftToSkip = 0;
    mousePath = [];
    mousePathPos = new vec2(0, 0);
    svg_mousePath = svg.getElementById('mousePath');
    current_time = undefined;
    _lastSpatialUpdate = 0;
    _spatialUpdateInterval = 10;
    _frameCount = 0;
    _cullingStats = { visible: 0, total: 0, culled: 0 };

    processSelectedNodes() {
        processScalingKeys();

        const movementAngle = getDirectionAngleFromKeyState();
        if (movementAngle === null) return;

        App.selectedNodes.forEach(Node.moveAtThisAngle, movementAngle);
    }

    updateMousePath() {
        if (this.mousePath.length < 1) {
            this.mousePathPos = Graph.vecToZ();
            this.mousePath = ["M ", this.mousePathPos.toSvg(), " L "];
        }

        const step = Fractal.step;
        for (let i = 0; i < settings.orbitStepRate; i += 1) {
            this.mousePathPos = step(this.mousePathPos, Graph.vecToZ());
            const vecSvg = this.mousePathPos.toSvg();
            if (vecSvg.isFinite() && vecSvg.mag2() < 1e60) {
                this.mousePath.push(vecSvg, " ")
            }
        }
    }

    updateMousePathWidth() {
        const svg_mousePath = this.svg_mousePath;
        let width = Graph.zoom.mag() * 0.0005 * Svg.zoom;

        if (Node.prev) {
            const m = Node.prev.pos.toSvg();
            const l = Graph.vecToZ().toSvg();
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
        const rounded = (avgfps > 1) ? Math.round(avgfps)
                      : Math.round(avgfps * 10) / 10;
        Elem.byId('debug_layer').children[1].textContent = "fps:" + rounded;
        Elem.byId('fps').textContent = rounded + " fps";
        return dt;
    }

    updateSpatialIndexPeriodically() {
        this._frameCount++;
        if (this._frameCount - this._lastSpatialUpdate >= this._spatialUpdateInterval) {
            this._lastSpatialUpdate = this._frameCount;
            Graph.forEachNode((node) => {
                if (node._spatialDirty || node.followingMouse) {
                    Graph.spatialIndex.update(node);
                    node._spatialDirty = false;
                }
            });
        }
    }

    updateNodes(dt) {
        dt *= (1 - nodeMode_v) ** 5;
        const totalNodes = Object.keys(Graph.nodes).length;
        
        if (totalNodes > 100 && Graph._useSpatialCulling) {
            const visibleNodes = Graph.getVisibleNodes();
            this._cullingStats.visible = visibleNodes.length;
            this._cullingStats.total = totalNodes;
            this._cullingStats.culled = totalNodes - visibleNodes.length;
            
            for (const node of visibleNodes) {
                node.step(dt);
                node._spatialDirty = true;
            }
            
            const invisibleNodes = Object.values(Graph.nodes).filter(n => !visibleNodes.includes(n));
            for (const node of invisibleNodes) {
                node.step(dt, true);
                node._spatialDirty = true;
            }
        } else {
            Graph.forEachNode(this.updateForThisDt, dt);
        }
        
        this.updateSpatialIndexPeriodically();
        return this;
    }
    updateForThisDt(item, dt){
        item.step(dt);
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
        this.framesLeftToSkip -= 1;
        if (this.framesLeftToSkip > 0) {
            return window.requestAnimationFrame(this.nodeStep)
        }

        const delay = settings.framesDelay;
        this.framesLeftToSkip = Math.round((delay + 2) ** 2 / 4);

        if (App.selectedNodes.uuids.size > 0) this.processSelectedNodes();

        Autopilot.update(time);
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
