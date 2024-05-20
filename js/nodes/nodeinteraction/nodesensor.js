
class NodeSensor {
    constructor(originNode, maxNodeCount, extendedRadiusFactor = 1.1) {
        this.originNode = originNode;
        this.maxNodeCount = maxNodeCount;

        this.searchRadius = 1;

        this.sensorDataCanvas = document.getElementById('sensorData');

        this.nearbyNodes = [];

        this.extendedRadiusFactor = extendedRadiusFactor;
        this.nodesWithinExtendedRadius = [];

        this.extendedSearchPosition = null;
        this.extendedSearchRadius = null;
        this.farthestNodeInfo = null;  // Storing the farthest node info
    }


    processNodeMap(nodeMap) {
        // Use the global function to update the global map
        updateGlobalProcessedNodeMap(nodeMap);
    }

    // Method to calculate the distance considering scale as a proportional factor
    getDistance(node) {
        const dx = this.originNode.pos.x - node.pos.x;
        const dy = this.originNode.pos.y - node.pos.y;
        let ds = this.originNode.scale - node.scale; // Difference in scale

        // Bias factor for larger nodes
        const largerNodeBiasFactor = 0.03; // Reduce the scale difference for larger nodes by this factor

        // If the target node is larger, apply the bias factor to reduce the scale difference
        if (node.scale > this.originNode.scale) {
            ds *= largerNodeBiasFactor;
        }

        // Factor to determine the influence of scale in the distance calculation
        const scaleInfluenceFactor = 1; // Adjust this value based on desired influence

        // Calculate a '3D' distance considering x, y, and the adjusted scale (ds)
        return Math.sqrt(dx * dx + dy * dy + (ds * ds * scaleInfluenceFactor));
    }

    isWithinRange(node, radius) {
        const distance = this.getDistance(node);
        return distance <= radius;
    }

    findNearbyNodes(radius) {
        let foundNodes = [];
        for (let key in globalProcessedNodeMap) {
            const node = globalProcessedNodeMap[key];
            if (this.isWithinRange(node, radius) && node.uuid !== this.originNode.uuid) {
                foundNodes.push(node);
            }
        }
        return foundNodes;
    }

    update(nodeMap) {
        this.processNodeMap(nodeMap);
        this.nearbyNodes = [];

        // Determine if total nodes are fewer than maxNodeCount
        if (Object.keys(nodeMap).length <= this.maxNodeCount) {
            this.nearbyNodes = this.findNearbyNodes(Infinity);
        } else {
            let searchComplete = false;
            while (!searchComplete) {
                let potentialNearbyNodes = this.findNearbyNodes(this.searchRadius);

                if (potentialNearbyNodes.length >= this.maxNodeCount) {
                    this.nearbyNodes = potentialNearbyNodes
                        .sort((a, b) => this.getDistance(a) - this.getDistance(b))
                        .slice(0, this.maxNodeCount);

                    searchComplete = true;
                } else {
                    this.searchRadius += 1;
                }
            }
        }

        this.farthestNodeInfo = this.findFarthestNodePosition();

        this.farthestNodeInfo = this.findFarthestNodePosition();

        if (this.farthestNodeInfo) {
            // Calculate the vector from the origin node to the farthest node
            let vectorToFarthestNode = this.farthestNodeInfo.position.minus(this.originNode.pos);

            // Normalize this vector
            let normalizedVector = vectorToFarthestNode.normed();

            // Extend the vector by a factor that accounts for the scale of the origin node
            let extendedVector = normalizedVector.scale(this.extendedRadiusFactor * this.originNode.scale);

            // Add this extended vector to the farthest node's position to get the extended position
            this.extendedSearchPosition = this.farthestNodeInfo.position.plus(extendedVector);

            // Calculate the extended search radius
            this.extendedSearchRadius = this.getDistance({
                pos: this.extendedSearchPosition,
                scale: this.originNode.scale
            });

            // Filter out nodes already in nearbyNodes
            this.nodesWithinExtendedRadius = this.findNearbyNodes(this.extendedSearchRadius)
                .filter(node => !this.nearbyNodes.some(nearbyNode => nearbyNode.uuid === node.uuid));
        }
    }

    callUpdate() {
        this.update(nodeMap);
        //this.clearSensorDrawings();
        //this.drawDetections();

        // Draw the standard search area using the farthest node info
        //if (this.farthestNodeInfo) {
        //    const standardSearchArea = new SearchArea(this.originNode, this.farthestNodeInfo.position, this.farthestNodeInfo.scale);
        //    standardSearchArea.draw(this.sensorDataCanvas);
        //}

        // Draw the extended search area
        //if (this.extendedSearchPosition && this.extendedSearchRadius) {
        //    const extendedSearchArea = new SearchArea(this.originNode, this.extendedSearchPosition, this.farthestNodeInfo.scale, { stroke: "blue", fill: "none" });
        //    extendedSearchArea.draw(this.sensorDataCanvas);
        //}
    }
        

    findFarthestNodePosition() {
        let farthestNode = null;
        let maxDistance = 0;
        this.nearbyNodes.forEach(node => {
            const distance = this.getDistance(node);
            if (distance > maxDistance) {
                maxDistance = distance;
                farthestNode = node;
            }
        });
        return farthestNode ? { position: farthestNode.pos, scale: farthestNode.scale } : null;
    }

    drawSearchArea(farthestNodeInfo) {
        if (farthestNodeInfo) {
            const searchArea = new SearchArea(this.originNode, farthestNodeInfo.position, farthestNodeInfo.scale);
            searchArea.draw(this.sensorDataCanvas);
        }
    }

    drawDetections() {
        // Draw new sensor edges
        this.nearbyNodes.forEach(nodeData => {
            const sensorEdge = new SensorEdge(this.originNode, nodeData);
            sensorEdge.draw(this.sensorDataCanvas); // Draw within the sensor data group
        });

        this.nodesWithinExtendedRadius.forEach(nodeData => {
            const sensorEdge = new SensorEdge(this.originNode, nodeData, { stroke: "none", fill: "blue" });
            sensorEdge.draw(this.sensorDataCanvas); // Draw within the sensor data group
        });
    }

    clearSensorDrawings() {
        while (this.sensorDataCanvas.firstChild) {
            this.sensorDataCanvas.removeChild(this.sensorDataCanvas.firstChild);
        }
    }
    // Additional methods as needed...
}


// SearchArea class
class SearchArea {
    constructor(originNode, farthestPoint, farthestScale, style = {
        stroke: "red",
        fill: "none"
    }) {
        this.originNode = originNode;
        this.farthestPoint = farthestPoint;
        this.style = style;
        this.style["stroke-width"] = farthestScale * 52; // Scale the stroke width
        this.html = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        this.applyStyle();
    }

    applyStyle() {
        for (const [key, value] of Object.entries(this.style)) {
            this.html.setAttribute(key, value);
        }
    }

    draw(svgGroup) {
        if (!this.farthestPoint) return; // Do nothing if farthestPoint is not set

        // Transform both the origin position and farthest point for SVG rendering
        let transformedOrigin = toSVG(this.originNode.pos);
        let transformedFarthestPoint = toSVG(this.farthestPoint);

        // Calculate radius as the direct distance to farthest point after transformation
        const radius = Math.sqrt(
            Math.pow(transformedOrigin.x - transformedFarthestPoint.x, 2) +
            Math.pow(transformedOrigin.y - transformedFarthestPoint.y, 2)
        );

        this.html.setAttribute('cx', transformedOrigin.x);
        this.html.setAttribute('cy', transformedOrigin.y);
        this.html.setAttribute('r', radius);

        svgGroup.appendChild(this.html);
    }
}


class SensorEdge {
    constructor(originNode, targetData, style = {
        fill: "red",
        "stroke-width": "0" // No border stroke
    }) {
        this.originNode = originNode;
        this.targetData = targetData;
        this.style = style;
        this.html = document.createElementNS("http://www.w3.org/2000/svg", "path");
        this.applyStyle();
    }

    applyStyle() {
        for (const [key, value] of Object.entries(this.style)) {
            this.html.setAttribute(key, value);
        }
    }

    draw(svgGroup) {
        let path = this.calculatePath();
        this.html.setAttribute('d', path);
        svgGroup.appendChild(this.html);
    }

    calculatePath() {
        let path = "M ";
        let origin = toSVG(this.originNode.pos);
        let target = toSVG(this.targetData.pos);

        let direction = target.minus(origin);
        let normalizedDirection = direction.normed();
        let perpendicular = normalizedDirection.rot90();

        // Increase the influence of node's scale and add perspective factor
        const widthFactor = 20; // Adjust this value to increase edge thickness
        const perspectiveFactor = 1.5; // Adjust this to enhance perspective effect

        let originScale = this.originNode.scale * widthFactor;
        let targetScale = this.targetData.scale * widthFactor * perspectiveFactor;

        let originPerpendicular = perpendicular.scale(originScale);
        let targetPerpendicular = perpendicular.scale(targetScale);

        let corner1 = origin.plus(originPerpendicular);
        let corner2 = origin.minus(originPerpendicular);
        let corner3 = target.plus(targetPerpendicular);
        let corner4 = target.minus(targetPerpendicular);

        path += corner1.str() + " L " + corner3.str() + " L " + corner4.str() + " L " + corner2.str() + " Z";

        return path;
    }
}