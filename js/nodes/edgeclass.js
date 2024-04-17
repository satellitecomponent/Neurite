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
        // Additional property to store the current length
        this.currentLength = this.length;

        this.strength = strength;
        this.style = style;
        this.html = document.createElementNS("http://www.w3.org/2000/svg", "path");
        for (const [key, value] of Object.entries(style)) {
            this.html.setAttribute(key, value);
        }
        htmledges.appendChild(this.html);
        this.attach();

        this.directionality = { start: null, end: null };

        this.maxWidth = 0.05;

        // Predefine the arrow SVG and initially set it to not display
        this.arrowSvg = document.createElementNS("http://www.w3.org/2000/svg", "path");
        this.arrowSvg.classList.add('edge-arrow');
        this.arrowSvg.style.display = 'none';

        htmledges.appendChild(this.arrowSvg);  // Assuming 'htmledges' is your SVG container

        // Predefine the border SVG
        this.borderSvg = document.createElementNS("http://www.w3.org/2000/svg", "path");
        this.borderSvg.style.display = 'none';
        this.borderSvg.classList.add('edge-border');
        htmledges.insertBefore(this.borderSvg, this.arrowSvg);


        this.attachEventListenersToArrow();

        this.edgeKey = this.createEdgeKey(pts);
        if (edgeDirectionalityMap.has(this.edgeKey)) {
            this.directionality = edgeDirectionalityMap.get(this.edgeKey);
        }
        //console.log("Creating edge with pts:", pts);
        //console.log("Directionality after assignment:", this.directionality);
    }
    createEdgeKey(pts) {
        return pts.map(p => p.uuid).sort().join('-');
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
    attach() {
        this.html.onwheel = this.onwheel.bind(this);
        this.html.onmouseover = this.onmouseover.bind(this);
        this.html.onmouseout = this.onmouseout.bind(this);
        this.html.ondblclick = this.ondblclick.bind(this);
        this.html.onclick = this.onclick.bind(this); // Attach click event handler
    }

    // Method to check if this edge intersects with another edge
    intersects(otherEdge) {
        // Unpack points for easier access
        const p1 = this.pts[0].anchor;
        const p2 = this.pts[1].anchor;
        const p3 = otherEdge.pts[0].anchor;
        const p4 = otherEdge.pts[1].anchor;

        // Calculate parts of intersection formulas
        const denominator = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);

        // If the denominator in intersection calculations is 0, lines are parallel (no intersection)
        if (denominator === 0) return false;

        const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denominator;
        const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denominator;

        // If both ua and ub are between 0 and 1, lines intersect
        return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
    }

    attachEventListenersToArrow() {
        // Define a helper function to add the same event listeners to both SVGs
        const addEventListeners = (svgElement) => {
            svgElement.addEventListener('wheel', this.onwheel.bind(this));
            svgElement.addEventListener('mouseover', this.onmouseover.bind(this));
            svgElement.addEventListener('mouseout', this.onmouseout.bind(this));
            svgElement.addEventListener('dblclick', this.ondblclick.bind(this));
            svgElement.addEventListener('click', this.onclick.bind(this));
        };

        // Attach event listeners to both arrow and border SVGs
        addEventListeners(this.arrowSvg);
        addEventListeners(this.borderSvg);
    }
    toggleDirection() {
        //console.log(`Current directionality: start=${this.directionality.start ? this.directionality.start.getTitle() : 'null'}, end=${this.directionality.end ? this.directionality.end.getTitle() : 'null'}`);

        // Determine the current state and transition to the next
        if (this.directionality.start === null) {
            this.directionality.start = this.pts[0];
            this.directionality.end = this.pts[1];
        } else if (this.directionality.start === this.pts[0]) {
            this.directionality.start = this.pts[1];
            this.directionality.end = this.pts[0];
        } else if (this.directionality.start === this.pts[1]) {
            // Bidirectional
            this.directionality.start = null;
            this.directionality.end = null;
        }

        // Check if both nodes are text nodes
        if (this.pts[0].isTextNode && this.pts[1].isTextNode) {
            // Get node titles
            const startTitle = this.pts[0].getTitle();
            const endTitle = this.pts[1].getTitle();

            // Update edge references based on the new state
            if (this.directionality.start === this.pts[0]) {
                // Direction is from start to end
                addEdgeToZettelkasten(startTitle, endTitle, myCodeMirror);
                removeEdgeFromZettelkasten(endTitle, startTitle, true);
            } else if (this.directionality.start === this.pts[1]) {
                // Direction is from end to start
                addEdgeToZettelkasten(endTitle, startTitle, myCodeMirror);
                removeEdgeFromZettelkasten(startTitle, endTitle, true);
            } else {
                // Bidirectional
                addEdgeToZettelkasten(startTitle, endTitle, myCodeMirror);
                addEdgeToZettelkasten(endTitle, startTitle, myCodeMirror);
            }
        }


        edgeDirectionalityMap.set(this.edgeKey, this.directionality);

        //console.log(`Directionality relative to ${startTitle}: ${this.getDirectionRelativeTo(this.pts[0])}`);
        //console.log(`Directionality relative to ${endTitle}: ${this.getDirectionRelativeTo(this.pts[1])}`);
        //console.log(`New directionality: start=${this.directionality.start ? this.directionality.start.getTitle() : 'null'}, end=${this.directionality.end ? this.directionality.end.getTitle() : 'null'}`);
    }


    // Method to check directionality relative to a given node
    getDirectionRelativeTo(node) {
        if (this.directionality.start === node) {
            return "outgoing";
        } else if (this.directionality.end === node) {
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
        let wscale = this.style['stroke-width'] / (0.5 + stressValue) * (this.mouseIsOver ? 1.5 : 1.0);
        wscale = Math.min(wscale, this.maxWidth);
        let path = "M ";
        let c = this.center();
        let validPath = true;

        // Constructing the main path
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

        // Closing the main path
        let firstPoint = this.pts[0].pos.minus(this.pts[0].pos.minus(c).rot90().normed(this.pts[0].scale * wscale));
        if (!isNaN(firstPoint.x) && !isNaN(firstPoint.y)) {
            path += " " + toSVG(firstPoint).str() + "z";
        } else {
            validPath = false;
        }


        if (validPath) {
            this.html.setAttribute("d", path);

            if (this.directionality.start && this.directionality.end) {
                let startPoint = this.directionality.start.pos;
                let endPoint = this.directionality.end.pos;

                let startScale = this.directionality.start.scale;
                let endScale = this.directionality.end.scale;

                // Introduce a perspective factor (adjust this value to tweak the effect)
                let perspectiveFactor = 0.5; // Range [0, 1], where 0 is no effect and 1 is maximum effect

                // Adjust scales based on the perspective factor
                let adjustedStartScale = 1 + (startScale - 1) * perspectiveFactor;
                let adjustedEndScale = 1 + (endScale - 1) * perspectiveFactor;

                // Calculate weights for the midpoint based on adjusted scales
                let totalAdjustedScale = adjustedStartScale + adjustedEndScale;
                let startWeight = adjustedEndScale / totalAdjustedScale;
                let endWeight = adjustedStartScale / totalAdjustedScale;

                // Calculate the weighted midpoint
                let midPoint = startPoint.scale(startWeight).plus(endPoint.scale(endWeight));

                // Introduce factors for scaling the length and width of the arrow
                let arrowScaleFactor = 1.2;

                let arrowLength = ((startScale + endScale) / 2 * wscale * 5) * arrowScaleFactor;
                let arrowWidth = ((startScale + endScale) / 2 * wscale * 3) * arrowScaleFactor;

                let direction = endPoint.minus(startPoint);
                let directionNormed = direction.normed(arrowLength);
                let perp = new vec2(-directionNormed.y, directionNormed.x).normed(arrowWidth);

                // Calculate arrow points relative to the midpoint
                let arrowBase1 = midPoint.minus(perp);
                let arrowBase2 = midPoint.plus(perp);
                let arrowTip = midPoint.plus(directionNormed);

                // Adjustable factor for arrow flipping [0, 1]
                let arrowFlipFactor = 0.85; // Adjust this value as needed

                // Calculate the adjusted center of the arrow
                let arrowBaseCenterX = (arrowBase1.x + arrowBase2.x) / 2;
                let arrowBaseCenterY = (arrowBase1.y + arrowBase2.y) / 2;
                let arrowCenterX = arrowBaseCenterX * arrowFlipFactor + arrowTip.x * (1 - arrowFlipFactor);
                let arrowCenterY = arrowBaseCenterY * arrowFlipFactor + arrowTip.y * (1 - arrowFlipFactor);
                let arrowCenter = new vec2(arrowCenterX, arrowCenterY);

                // Function to rotate a point around a center by 180 degrees
                function rotatePoint(point, center) {
                    let dx = point.x - center.x;
                    let dy = point.y - center.y;
                    return new vec2(center.x - dx, center.y - dy);
                }

                // Rotate the arrow points around the adjusted center
                arrowBase1 = rotatePoint(arrowBase1, arrowCenter);
                arrowBase2 = rotatePoint(arrowBase2, arrowCenter);
                arrowTip = rotatePoint(arrowTip, arrowCenter);

                // Arrow path
                let arrowPath = `M ${toSVG(arrowBase1).str()} L ${toSVG(arrowTip).str()} L ${toSVG(arrowBase2).str()} Z`;
                this.arrowSvg.setAttribute("d", arrowPath);
                this.arrowSvg.style.display = '';

                // Calculate the midpoint of the arrow
                let arrowMidX = (arrowBase1.x + arrowBase2.x + arrowTip.x) / 3;
                let arrowMidY = (arrowBase1.y + arrowBase2.y + arrowTip.y) / 3;
                let arrowMidPoint = new vec2(arrowMidX, arrowMidY);

                // Calculate offset for border points
                const offsetScale = 1.4; // Slightly larger than 1 to make the border bigger
                let borderBase1 = arrowMidPoint.plus(arrowBase1.minus(arrowMidPoint).scale(offsetScale));
                let borderBase2 = arrowMidPoint.plus(arrowBase2.minus(arrowMidPoint).scale(offsetScale));
                let borderTip = arrowMidPoint.plus(arrowTip.minus(arrowMidPoint).scale(offsetScale));

                // Border path
                let borderPath = `M ${toSVG(borderBase1).str()} L ${toSVG(borderTip).str()} L ${toSVG(borderBase2).str()} Z`;
                this.borderSvg.setAttribute("d", borderPath);
                this.borderSvg.style.display = '';
            } else {
                this.arrowSvg.style.display = 'none';
                this.borderSvg.style.display = 'none';
            }
        }
    }
    step(dt) {
        if (dt === undefined || isNaN(dt)) {
            dt = 0;
        } else {
            if (dt > 1) {
                dt = 1;
            }
        }
        let avg = this.center();
        for (let n of this.pts) {
            let d = n.pos.minus(avg);
            let dMag = d.mag();

            // Update the current length of the edge
            this.currentLength = dMag;

            // Apply force to either shorten or lengthen the edge to the desired length
            if (dMag !== this.length) {
                let dampingFactor = 0.4;
                let f = d.scale((1 - this.length / (dMag + 1e-300)) * dampingFactor);
                n.force = n.force.plus(f.scale(-this.strength));
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
    onwheel = (event) => {
        if (nodeMode) {
            let amount = Math.exp(event.wheelDelta * -settings.zoomSpeed);
            this.length *= amount;
            let avg = this.center();
            for (let n of this.pts) {
                n.pos = n.pos.minus(avg).scale(amount).plus(avg);
            }
            if (this.pts[0] !== undefined) {
                this.pts[0].updateEdgeData();
            }
            cancel(event);
        }
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
                removeEdgeFromZettelkasten(connectedNodes[0].title, connectedNodes[1].title);
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