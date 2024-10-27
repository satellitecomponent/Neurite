class NodePlacementStrategy {
    constructor(pathObject, nodeObjects = {}) {
        this.nodeObjects = nodeObjects;
        this.path = pathObject.path || [];
        this.zetPlacementOverride = pathObject.zetPlacementOverride || false;
        this.currentPathIndex = 0;
    }

    updatePath(pathObject) {
        // Assuming pathObject has the structure { zetPath: { path: [...] }, zetPlacementOverride: boolean }
        this.path = pathObject.zetPath.path || [];
        this.zetPlacementOverride = pathObject.zetPlacementOverride;
    }

    calculatePositionAndScale(currentNodeTitle) {
        Logger.debug("Calculating position and scale...");
        Logger.debug("Current path index:", this.currentPathIndex);
        Logger.debug("Path length:", this.path.length);
        Logger.debug("random?", this.zetPlacementOverride);

        if (this.zetPlacementOverride) { // Use the directly passed flag
            Logger.debug("Placement override active, creating random node");
            return this.createRandomNode(currentNodeTitle);
        }

        const nodeKeys = Object.keys(this.nodeObjects);

        if (nodeKeys.length === 0) {
            Logger.debug("No nodes in nodeObjects, starting from -1,0.");
            return createTextNodeWithPosAndScale(currentNodeTitle, '', 0.05, -.5, 0);
        }

        if (this.currentPathIndex >= this.path.length) {
            Logger.debug("Current path index exceeds path length, resetting to 0");
            this.currentPathIndex = 0;
        }

        const currentPathPoint = this.path[this.currentPathIndex];
        Logger.debug("Current path point:", currentPathPoint);

        if (!currentPathPoint) {
            Logger.debug("Current path point is undefined, creating random node");
            this.currentPathIndex = (this.currentPathIndex + 1) % this.path.length;
            return this.createRandomNode(currentNodeTitle);
        }

        if (currentPathPoint.useCreateTextNode) {
            Logger.debug("Current path point indicates creating random node");
            this.currentPathIndex = (this.currentPathIndex + 1) % this.path.length;
            return this.createRandomNode(currentNodeTitle);
        }

        const startNode = this.getStartNode(currentPathPoint);
        Logger.debug("Start node:", startNode);

        if (!startNode) {
            Logger.debug("Start node not found, moving to the next path point");
            this.currentPathIndex = (this.currentPathIndex + 1) % this.path.length;
            return this.calculatePositionAndScale(currentNodeTitle);
        }

        const { newX, newY, newScale } = this.calculateNewPosition(startNode, currentPathPoint);
        Logger.debug("Calculated position:", { x: newX, y: newY });
        Logger.debug("Calculated scale:", newScale);

        this.currentPathIndex = (this.currentPathIndex + 1) % this.path.length;

        return createTextNodeWithPosAndScale(currentNodeTitle, '', newScale, newX, newY);
    }

    createRandomNode(currentNodeTitle) {
        return TextNode.create(currentNodeTitle, '', (Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8)
    }

    getStartNode(currentPathPoint) {
        const nodeKeys = Object.keys(this.nodeObjects);
        let startNodeIndex = nodeKeys.length - 1;

        if (currentPathPoint.startNodeIndex !== undefined) {
            startNodeIndex = currentPathPoint.startFromBeginning
                ? currentPathPoint.startNodeIndex
                : nodeKeys.length - 1 - currentPathPoint.startNodeIndex;
        }

        Logger.debug("Start node index:", startNodeIndex);

        if (startNodeIndex >= 0 && startNodeIndex < nodeKeys.length) {
            const startNode = this.nodeObjects[nodeKeys[startNodeIndex]];
            Logger.debug("Selected start node:", startNode);
            return startNode;
        } else {
            const lastNode = this.nodeObjects[nodeKeys[nodeKeys.length - 1]];
            Logger.debug("Start node index out of range, using the last node:", lastNode);
            return lastNode;
        }
    }

    calculateNewPosition(startNode, currentPathPoint) {
        const newX = startNode.pos.x + currentPathPoint.x * startNode.scale;
        const newY = startNode.pos.y + currentPathPoint.y * startNode.scale;
        const newScale = startNode.scale * currentPathPoint.scale;
        return { newX, newY, newScale };
    }

    getPreviewPoints(startX, startY, startScale) {
        const previewPoints = [];
        let currentX = startX;
        let currentY = startY;
        let currentScale = startScale;

        let currentPathIndex = this.currentPathIndex;
        for (let i = 0; i < this.path.length; i++) {
            const currentPathPoint = this.path[currentPathIndex];
            if (currentPathPoint.useCreateTextNode) {
                previewPoints.push({ x: currentX, y: currentY }); // Placeholder for random node
            } else {
                const newX = currentX + currentPathPoint.x * currentScale;
                const newY = currentY + currentPathPoint.y * currentScale;
                const newScale = currentScale * currentPathPoint.scale;
                previewPoints.push({ x: newX, y: newY });
                currentX = newX;
                currentY = newY;
                currentScale = newScale;
            }
            currentPathIndex = (currentPathIndex + 1) % this.path.length;
        }
        return previewPoints;
    }
}

function drawPlacementPreview(event) {
    const placementPreview = Elem.byId('placementPreview');
    placementPreview.innerHTML = ''; // Clear previous preview points

    const startX = event.clientX;
    const startY = event.clientY;
    const startScale = 0.1; // Adjust the starting scale as needed

    const points = window.zettelkastenProcessor.placementStrategy.getPreviewPoints(startX, startY, startScale);
    points.forEach(point => {
        const circle = SVG.create.circle();
        circle.setAttribute('cx', point.x);
        circle.setAttribute('cy', point.y);
        circle.setAttribute('r', '5'); // radius
        circle.setAttribute('fill', 'red');
        placementPreview.appendChild(circle);
    });
}

//document.addEventListener('mousemove', drawPlacementPreview);
