function findExistingEdge(node1, node2) {
    // Assuming each node's edges array contains references to edges
    for (let edge of node1.edges) {
        if (node2.edges.includes(edge)) {
            return edge; // Return the common edge if found
        }
    }
    return null; // Return null if no common edge exists
}


// Global map to store directionality states of edges
const edgeDirectionalityMap = new Map();

class Edge {
    constructor(pts, length = 0.6, strength = 0.1, style = {
        stroke: "red",
        "stroke-width": "0.01",
        fill: "red"
    }) {
        this.pts = pts;
        this.length = length;
        this.currentLength = this.length;
        this.strength = strength;
        this.style = style;
        this.maxWidth = 0.05;

        this.directionality = { start: null, end: null };

        this.html = document.createElementNS("http://www.w3.org/2000/svg", "path");
        for (const [key, value] of Object.entries(style)) {
            this.html.setAttribute(key, value);
        }
        htmledges.appendChild(this.html);


        // Predefine the arrow SVG and initially set it to not display
        this.arrowSvg = document.createElementNS("http://www.w3.org/2000/svg", "path");
        this.arrowSvg.classList.add('edge-arrow');
        this.arrowSvg.style.display = 'none';

        htmledges.appendChild(this.arrowSvg);

        // Predefine the border SVG
        this.borderSvg = document.createElementNS("http://www.w3.org/2000/svg", "path");
        this.borderSvg.style.display = 'none';
        this.borderSvg.classList.add('edge-border');
        htmledges.insertBefore(this.borderSvg, this.arrowSvg);

        this.edgeKey = this.createEdgeKey(pts);
        this.restoreDirectionality();
        this.attachEventListeners();
        //console.log("Creating edge with pts:", pts);
        //console.log("Directionality after assignment:", this.directionality);
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

    attachEventListeners() {
        const addEventListeners = (svgElement) => {
            svgElement.addEventListener('wheel', this.onwheel.bind(this));
            svgElement.addEventListener('mouseover', this.onmouseover.bind(this));
            svgElement.addEventListener('mouseout', this.onmouseout.bind(this));
            svgElement.addEventListener('dblclick', this.ondblclick.bind(this));
            svgElement.addEventListener('click', this.onclick.bind(this));
        };

        addEventListeners(this.html); // Also attach to main path element
        addEventListeners(this.arrowSvg);
        addEventListeners(this.borderSvg);
    }
    onclick = (event) => {
        if (!nodeMode) {
            this.toggleDirection();
            this.draw();
        }
    }
    ondblclick = (event) => {
        if (nodeMode) {
            // Capture the titles and textNode flags of the connected nodes for later use
            const connectedNodes = this.pts.map(node => ({ title: node.getTitle(), isTextNode: node.isTextNode }));
            // only if both nodes have the isTextNode flag
            if (connectedNodes[0].isTextNode && connectedNodes[1].isTextNode) {
                // Remove edges from all relevant CodeMirror instances
                const startTitle = connectedNodes[0].title;
                const endTitle = connectedNodes[1].title;

                // Call the function to remove edges from all instances
                removeEdgeFromAllInstances(startTitle, endTitle);
            } else {
                this.remove();
            }
            // Prevent the event from propagating further
            cancel(event);
        }
    }
    onmouseover = (event) => {
        this.mouseIsOver = true;
        this.arrowSvg.classList.add('edge-arrow-hover');
        this.borderSvg.classList.add('edge-border-hover'); // Class for hovered state of the border
    }

    onmouseout = (event) => {
        this.mouseIsOver = false;
        this.arrowSvg.classList.remove('edge-arrow-hover');
        this.borderSvg.classList.remove('edge-border-hover'); // Class for normal state of the border
    }

    onwheel = (event) => {
        if (nodeMode) {
            let amount = Math.exp(event.wheelDelta * -settings.zoomSpeed);
            let selectedNodes = getSelectedNodes(); // Function to get currently selected nodes
            let scaleAllConnectedEdges = false;

            // Determine if this edge should be scaled based on both nodes being selected
            if (selectedNodes.length > 0 && this.pts.every(pt => selectedNodes.includes(pt))) {
                scaleAllConnectedEdges = true;
                let uniqueEdges = collectEdgesFromSelectedNodes(selectedNodes);
                uniqueEdges.forEach(edge => edge.scaleLength(amount));
            }

            // Default behavior when not both nodes are selected
            if (!scaleAllConnectedEdges) {
                this.scaleLength(amount);
            }

            cancel(event);  // Prevent default behavior and stop propagation
        }
    };


    scaleLength(amount) {
        let avg = this.center();
        this.length *= amount;
        this.pts.forEach(n => {
            n.pos = n.pos.minus(avg).scale(amount).plus(avg);
        });
        if (this.pts.length > 0 && this.pts[0]) {
            this.pts[0].updateEdgeData();  // Update the first point's edge data
        }
    }

    createEdgeKey(pts) {
        return pts.map(p => p.uuid).sort().join('-');
    }

    restoreDirectionality() {
        if (edgeDirectionalityMap.has(this.edgeKey)) {
            this.directionality = edgeDirectionalityMap.get(this.edgeKey);
        } else {
            this.directionality = { start: null, end: null }; // Explicitly handle null directionality
        }
    }
    toggleDirection() {
        // Initialize directionality if it's null
        if (!this.directionality.start || !this.directionality.end) {
            this.directionality.start = this.pts[0];
            this.directionality.end = this.pts[1];
        } else {
            // Switch direction or reset
            if (this.directionality.start === this.pts[0]) {
                this.directionality.start = this.pts[1];
                this.directionality.end = this.pts[0];
            } else if (this.directionality.start === this.pts[1]) {
                this.directionality.start = null;
                this.directionality.end = null;
            }
        }

        // Update all instances of CodeMirror that include these nodes
        if (this.pts[0].isTextNode && this.pts[1].isTextNode) {
            const startTitle = this.pts[0].getTitle();
            const endTitle = this.pts[1].getTitle();

            // Get the edge information
            const { startNodeInfo, endNodeInfo } = getEdgeInfo(startTitle, endTitle);

            // Handle edge additions and removals based on new directionality
            if (this.directionality.start === this.pts[0]) {
                if (endNodeInfo) {
                    addEdgeToZettelkasten(endTitle, startTitle, endNodeInfo.cmInstance);
                }
                if (startNodeInfo) {
                    removeEdgeFromZettelkasten(startTitle, endTitle, startNodeInfo.cmInstance);
                }
            } else if (this.directionality.start === this.pts[1]) {
                if (startNodeInfo) {
                    addEdgeToZettelkasten(startTitle, endTitle, startNodeInfo.cmInstance);
                }
                if (endNodeInfo) {
                    removeEdgeFromZettelkasten(endTitle, startTitle, endNodeInfo.cmInstance);
                }
            } else {
                if (startNodeInfo) {
                    addEdgeToZettelkasten(startTitle, endTitle, startNodeInfo.cmInstance);
                }
                if (endNodeInfo) {
                    addEdgeToZettelkasten(endTitle, startTitle, endNodeInfo.cmInstance);
                }
            }
        }

        edgeDirectionalityMap.set(this.edgeKey, this.directionality);
    }
    // Method to check directionality relative to a given node
    getDirectionRelativeTo(node) {
        if (this.directionality.end === node) {
            return "outgoing";
        } else if (this.directionality.start === node) {
            return "incoming";
        }
        return "none";
    }
    center() {
        return this.pts.reduce((t, n, i, a) => {
            return t.plus(n.pos);
        }, new vec2(0, 0)).unscale(this.pts.length);
    }
    draw() {
        this.html.setAttribute("stroke", this.mouseIsOver ? "lightskyblue" : this.style.stroke);
        this.html.setAttribute("fill", this.mouseIsOver ? "lightskyblue" : this.style.fill);

        const stressValue = Math.max(this.stress(), 0.01);
        let wscale = this.style['stroke-width'] / (0.5 + stressValue) * (this.mouseIsOver ? 2 : 1.8);
        wscale = Math.min(wscale, this.maxWidth);

        let validPath = true;
        let path = "";

        if (this.directionality.start && this.directionality.end) {
            // Use straight edge for directionality cases
            path = this.createStraightEdgePath(wscale);
        } else {
            // Use curved edge for non-directionality cases
            path = this.createCurvedEdgePath(wscale);
        }

        if (validPath) {
            this.html.setAttribute("d", path);

            if (this.directionality.start && this.directionality.end) {
                let startPoint = this.directionality.start.pos;
                let endPoint = this.directionality.end.pos;
                let startScale = this.directionality.start.scale;
                let endScale = this.directionality.end.scale;

                // Create the main arrow SVG and retrieve points
                let { arrowPath, arrowBase1, arrowBase2, arrowTip } = createArrowSvg(startPoint, endPoint, startScale, endScale, wscale);
                this.arrowSvg.setAttribute("d", arrowPath);
                this.arrowSvg.style.display = '';

                // Create the border SVG using the points from the arrow SVG
                let borderPath = createBorderSvg(arrowBase1, arrowBase2, arrowTip);
                this.borderSvg.setAttribute("d", borderPath);
                this.borderSvg.style.display = '';
            } else {
                this.arrowSvg.style.display = 'none';
                this.borderSvg.style.display = 'none';
            }
        }
    }

    createStraightEdgePath(wscale) {
        let path = "M ";
        let c = this.center();
        let validPath = true;

        // Constructing the straight edge path
        for (let n of this.pts) {
            let r = n.scale * wscale;
            let minusC = n.pos.minus(c);
            let rotated = minusC.rot90();

            if (rotated.x !== 0 || rotated.y !== 0) {
                let left = rotated.normed(r);

                if (!isNaN(left.x) && !isNaN(left.y) && !isNaN(n.pos.x) && !isNaN(n.pos.y)) {
                    path += toSVG(n.pos.minus(left)).str();
                    path += " L ";
                    path += toSVG(left.plus(n.pos)).str() + " ";
                } else {
                    validPath = false;
                    break;
                }
            }
        }

        // Closing the straight edge path
        let firstPoint = this.pts[0].pos.minus(this.pts[0].pos.minus(c).rot90().normed(this.pts[0].scale * wscale));
        if (!isNaN(firstPoint.x) && !isNaN(firstPoint.y)) {
            path += " " + toSVG(firstPoint).str() + "z";
        } else {
            validPath = false;
        }

        return validPath ? path : "";
    }

    createCurvedEdgePath(wscale) {
        let path = "M ";
        let validPath = true;

        // Constructing the curved edge path
        if (this.pts.length >= 2) {
            let startPoint = this.pts[0].pos;
            let endPoint = this.pts[this.pts.length - 1].pos;
            let startScale = this.pts[0].scale || 1; // Provide a default value if undefined
            let endScale = this.pts[this.pts.length - 1].scale || 1; // Provide a default value if undefined

            let horizontal = (startPoint.x - endPoint.x) / 1.3;
            let vertical = (startPoint.y - endPoint.y);
            let distance = Math.sqrt(horizontal * horizontal + vertical * vertical);
            let curve = 1;

            let positiveVertical = vertical > 0;
            curve = Math.min(curve, Math.abs(vertical)) / 2;

            // Calculate the perpendicular vector with adjusted scale based on node scales
            let startPerp = new vec2(vertical, -horizontal).normed(startScale * wscale);
            let endPerp = new vec2(vertical, -horizontal).normed(endScale * wscale);

            // Calculate the points for the curved path
            let startLeft = startPoint.minus(startPerp);
            let startRight = startPoint.plus(startPerp);
            let endLeft = endPoint.minus(endPerp);
            let endRight = endPoint.plus(endPerp);

            // Adjust the control points based on the distance
            let controlPointLeft1 = startLeft.minus(new vec2(horizontal, 0)).minus(new vec2(0, positiveVertical ? curve * distance : -curve * distance));
            let controlPointLeft2 = endLeft.plus(new vec2(horizontal, 0)).plus(new vec2(0, positiveVertical ? curve * distance : -curve * distance));
            let controlPointRight1 = startRight.minus(new vec2(horizontal, 0)).plus(new vec2(0, positiveVertical ? -curve * distance : curve * distance));
            let controlPointRight2 = endRight.plus(new vec2(horizontal, 0)).minus(new vec2(0, positiveVertical ? -curve * distance : curve * distance));

            // Validate the calculated points before adding them to the path string
            if (
                !isNaN(startLeft.x) && !isNaN(startLeft.y) &&
                !isNaN(controlPointLeft1.x) && !isNaN(controlPointLeft1.y) &&
                !isNaN(controlPointLeft2.x) && !isNaN(controlPointLeft2.y) &&
                !isNaN(endLeft.x) && !isNaN(endLeft.y) &&
                !isNaN(endRight.x) && !isNaN(endRight.y) &&
                !isNaN(controlPointRight2.x) && !isNaN(controlPointRight2.y) &&
                !isNaN(controlPointRight1.x) && !isNaN(controlPointRight1.y) &&
                !isNaN(startRight.x) && !isNaN(startRight.y)
            ) {
                // Construct the curved path
                path += toSVG(startLeft).str();
                path += " C ";
                path += toSVG(controlPointLeft1).str() + ", ";
                path += toSVG(controlPointLeft2).str() + ", ";
                path += toSVG(endLeft).str();
                path += " L ";
                path += toSVG(endRight).str();
                path += " C ";
                path += toSVG(controlPointRight2).str() + ", ";
                path += toSVG(controlPointRight1).str() + ", ";
                path += toSVG(startRight).str();
                path += " Z";
            } else {
                validPath = false;
            }
        } else {
            validPath = false;
        }

        return validPath ? path : "";
    }
    step(dt) {
        if (dt === undefined || isNaN(dt)) {
            dt = 0;
        } else {
            dt = Math.min(dt, 1);  // Clamp dt to a maximum of 1
        }

        let avg = this.center();
        for (let n of this.pts) {
            if (n.anchorForce === 0) {  // Only apply force if the anchor force is zero
                let d = n.pos.minus(avg);
                let dMag = d.mag();

                // Update the current length of the edge
                this.currentLength = dMag;

                // Apply force to either shorten or lengthen the edge to the desired length
                if (dMag !== this.length) {
                    let dampingFactor = 0.4;
                    let forceAdjustment = (1 - this.length / (dMag + 1e-300)) * dampingFactor;
                    let f = d.scale(forceAdjustment);
                    n.force = n.force.plus(f.scale(-this.strength));
                }
            }
        }
        this.draw();
    }
    stress() {
        let avg = this.center();
        return this.pts.reduce((t, n, i, a) => {
            return t + n.pos.minus(avg).mag() - this.length;
        }, 0) / (this.length + 1);
    }
    scaleEdge(amount) {
        this.length *= amount;
    }

    remove() {
        edgeDirectionalityMap.set(this.edgeKey, this.directionality);

        // Remove the edge from the global edge array
        let index = edges.indexOf(this);
        if (index !== -1) {
            edges.splice(index, 1);
        }

        // Remove this edge from both connected nodes' edges arrays
        this.pts.forEach((node) => {
            index = node.edges.indexOf(this);
            if (index !== -1) {
                node.edges.splice(index, 1);
                node.updateEdgeData();
            }
        });

        // Remove SVG elements from the DOM
        if (this.arrowSvg && this.arrowSvg.parentNode) {
            this.arrowSvg.parentNode.removeChild(this.arrowSvg);
        }
        if (this.borderSvg && this.borderSvg.parentNode) {
            this.borderSvg.parentNode.removeChild(this.borderSvg);
        }

        // Remove the main path of the edge
        if (this.html && this.html.parentNode) {
            this.html.parentNode.removeChild(this.html);
        }
    }
}
function createArrowSvg(startPoint, endPoint, startScale, endScale, wscale) {
    let perspectiveFactor = 0.5; // Range [0, 1]

    let adjustedStartScale = 1 + (startScale - 1) * perspectiveFactor;
    let adjustedEndScale = 1 + (endScale - 1) * perspectiveFactor;

    let totalAdjustedScale = adjustedStartScale + adjustedEndScale;
    let startWeight = adjustedEndScale / totalAdjustedScale;
    let endWeight = adjustedStartScale / totalAdjustedScale;

    let midPoint = startPoint.scale(startWeight).plus(endPoint.scale(endWeight));

    let arrowScaleFactor = 1.5;
    let arrowLength = ((startScale + endScale) / 2 * wscale * 5) * arrowScaleFactor;
    let arrowWidth = ((startScale + endScale) / 2 * wscale * 3) * arrowScaleFactor;

    let direction = endPoint.minus(startPoint);
    let directionNormed = direction.normed(arrowLength);
    let perp = new vec2(-directionNormed.y, directionNormed.x).normed(arrowWidth);

    let arrowBase1 = midPoint.minus(perp);
    let arrowBase2 = midPoint.plus(perp);
    let arrowTip = midPoint.plus(directionNormed);

    let arrowFlipFactor = 0.85;
    let arrowBaseCenterX = (arrowBase1.x + arrowBase2.x) / 2;
    let arrowBaseCenterY = (arrowBase1.y + arrowBase2.y) / 2;
    let arrowCenterX = arrowBaseCenterX * arrowFlipFactor + arrowTip.x * (1 - arrowFlipFactor);
    let arrowCenterY = arrowBaseCenterY * arrowFlipFactor + arrowTip.y * (1 - arrowFlipFactor);
    let arrowCenter = new vec2(arrowCenterX, arrowCenterY);

    arrowBase1 = rotatePoint(arrowBase1, arrowCenter);
    arrowBase2 = rotatePoint(arrowBase2, arrowCenter);
    arrowTip = rotatePoint(arrowTip, arrowCenter);

    let arrowPath = `M ${toSVG(arrowBase1).str()} L ${toSVG(arrowTip).str()} L ${toSVG(arrowBase2).str()} Z`;
    return { arrowPath, arrowBase1, arrowBase2, arrowTip }; // Return the points along with the path
}

function createBorderSvg(arrowBase1, arrowBase2, arrowTip) {
    let arrowMidX = (arrowBase1.x + arrowBase2.x + arrowTip.x) / 3;
    let arrowMidY = (arrowBase1.y + arrowBase2.y + arrowTip.y) / 3;
    let arrowMidPoint = new vec2(arrowMidX, arrowMidY);

    const offsetScale = 1.4;
    let borderBase1 = arrowMidPoint.plus(arrowBase1.minus(arrowMidPoint).scale(offsetScale));
    let borderBase2 = arrowMidPoint.plus(arrowBase2.minus(arrowMidPoint).scale(offsetScale));
    let borderTip = arrowMidPoint.plus(arrowTip.minus(arrowMidPoint).scale(offsetScale));

    let borderPath = `M ${toSVG(borderBase1).str()} L ${toSVG(borderTip).str()} L ${toSVG(borderBase2).str()} Z`;
    return borderPath;
}

function rotatePoint(point, center) {
    let dx = point.x - center.x;
    let dy = point.y - center.y;
    return new vec2(center.x - dx, center.y - dy);
}