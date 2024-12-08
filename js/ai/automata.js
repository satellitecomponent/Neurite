Node.processedById = function(nodeUuid){
    return App.processedNodes.map[nodeUuid]
}
Node.processedByNode = function(node){ return Node.processedById(node.uuid) }

class MovementAgentState {
    isMoving = false;
    constructor(node) {
        this.agent = node;
        this.state = {
            baseSeparation: 0.3, // Minimum separation
            maxSeparation: 4,  // Maximum separation possible
            // Adding desiredSeparation to the initial state to ensure it's always defined
            desiredSeparation: 0.5,
        };
    }
    nodesAreConnected(node1, node2) {
        return node1.neighborsUuids.includes(node2.uuid)
            || node2.neighborsUuids.includes(node1.uuid)
    }
    findAllConnectedNodes(node, visited = new Set()) {
        visited.add(node.uuid);
        node.neighborsUuids.forEach( (uuid)=>{
            if (visited.has(uuid)) return;

            this.findAllConnectedNodes(Node.processedById(uuid), visited);
        });
        return Array.from(visited); // Returns all connected node UUIDs, including the starting node
    }
    calculateCentroidOfConnectedComponent(connectedNodesUuids) {
        let sumX = 0, sumY = 0;
        let validNodeCount = 0;
        connectedNodesUuids.forEach(nodeUuid => {
            const node = Node.processedById(nodeUuid);
            if (!node) return;

            sumX += node.pos.x;
            sumY += node.pos.y;
            validNodeCount += 1;
        });
        return (validNodeCount < 1) ? this.agent.pos
             : new vec2(sumX / validNodeCount, sumY / validNodeCount)
    }
    calculateScaleFactorForComponents(componentUuidsA, componentUuidsB) {
        const scaleA = this.calculateAverageScaleForComponent(componentUuidsA);
        const scaleB = this.calculateAverageScaleForComponent(componentUuidsB);
        return 1 + Math.tanh((scaleA - scaleB) / this.agent.scale);
    }
    calculateAverageScaleForComponent(componentUuids) {
        const totalScale = componentUuids.reduce(
            (totalScale, uuid)=>(totalScale + Node.processedById(uuid).scale) , 0
        );
        return totalScale / componentUuids.length;
    }
    update(){
        if (this.isMoving) return Promise.resolve(); // skip this update cycle

        const sensor = this.agent.sensor;
        sensor.callUpdate();
        const nearbyNodes = sensor.nearbyNodes.map(Node.processedByNode, Node);
        const extendedNodes = sensor.nodesWithinExtendedRadius.map(Node.processedByNode, Node);
        this.adjustDesiredSeparation(extendedNodes.length);
        return this.calculateAndSetNewPosition(nearbyNodes);
    }
    adjustDesiredSeparation(extendedNodeCount) {
        const minScaleFactor = Math.min(1, this.agent.scale); // Ensure the scale factor is at least 1 or less if the scale is smaller
        const separationRange = (this.state.maxSeparation - this.state.baseSeparation) * minScaleFactor;
        const adjustmentFactor = Math.min(separationRange, separationRange * (extendedNodeCount / 40));
        // Update the desired separation, ensuring it stays within dynamically adjusted bounds
        this.state.desiredSeparation = this.state.baseSeparation * minScaleFactor + adjustmentFactor;
    }
    componentsFromNodes(nodes, agentConnectedComponentUuids){
        const components = new Map();
        nodes.forEach( (node)=>{
            // Skip nodes that are part of the agent's connected component.
            if (agentConnectedComponentUuids.includes(node.uuid)) return;
            if (components.has(node.uuid)) return; // i.e. already processed

            // Determine the connected component for the nearby node.
            const componentUuids = this.findAllConnectedNodes(node);
            const componentCentroid = this.calculateCentroidOfConnectedComponent(componentUuids);
            componentUuids.forEach(
                (uuid)=>{ components.set(uuid, {centroid: componentCentroid, uuids: componentUuids}) }
            );
        });
        return components;
    }
    calculateAndSetNewPosition(nearbyNodes) {
        const agentConnectedComponentUuids = this.findAllConnectedNodes(this.agent);
        const agentCentroid = this.calculateCentroidOfConnectedComponent(agentConnectedComponentUuids);
        let movementVector = new vec2(0, 0);
        let adjustmentNeeded = false;

        // A map to keep track of distinct connected components identified among nearby nodes.
        const nearbyComponents = this.componentsFromNodes(nearbyNodes, agentConnectedComponentUuids);

        const pos = this.agent.pos;
        // Aggregate external influences based on distinct connected components.
        nearbyComponents.forEach(({ centroid, uuids }) => {
            // Find the distance to the closest node in the component
            const minDistanceToAgent = uuids.reduce( (curMin, uuid)=>{
                const node = Node.processedById(uuid);
                return (!node) ? curMin
                     : Math.min(curMin, pos.distanceTo(node.pos));
            }, Infinity);

            const scaleFactor = this.calculateScaleFactorForComponents(uuids, agentConnectedComponentUuids);
            const adjustedDesiredSeparation = this.state.desiredSeparation * scaleFactor;
            if (minDistanceToAgent >= adjustedDesiredSeparation) return;

            let directionAway = agentCentroid.minus(centroid).normed();
            // Adjust the movement vector based on the closest node rather than centroid distance
            const weightedMovementVector = directionAway.scale((adjustedDesiredSeparation - minDistanceToAgent) * scaleFactor / this.agent.scale);
            movementVector = movementVector.plus(weightedMovementVector);
            adjustmentNeeded = true;
        });

        return (!adjustmentNeeded) ? Promise.resolve()
             : this.moveConnectedNodes(movementVector);
    }
    moveConnectedNodes(movementVector){
        return Promise.all(this.findAllConnectedNodes(this.agent).map(
            (nodeUuid)=>(new NodeMovement(nodeUuid))
                        .promiseForVector(movementVector)
        ))
    }
}
class NodeMovement {
    constructor(nodeUuid){
        this.node = Node.processedById(nodeUuid);
    }
    promiseForVector(vector){
        const pos = this.node.pos;
        this.newPosition = new vec2(pos.x + vector.x, pos.y + vector.y);
        this.node.isMoving = true;
        return new Promise(this.#exec);
    }

    #resolve = Function.nop;
    #exec = (resolve)=>{
        this.#resolve = resolve;
        this.node.actions.moveTo(this.newPosition.x, this.newPosition.y,
                                 0.05, this.#onComplete);
    }
    #onComplete = ()=>{
        this.node.isMoving = false;
        this.#resolve();
    }
}

Manager.CellularAutomata = class {
    intervalMs = 0;
    interval = null;
    currentAgentIndex = 0; // Tracks the current node being processed

    updateNextAgent = ()=>{
        const nodeKeys = App.processedNodes.getUuids();
        const nofAgents = nodeKeys.length;
        if (nofAgents < 1) return;

        if (this.currentAgentIndex >= nofAgents) this.currentAgentIndex = 0;

        const currentNodeData = Node.processedById(nodeKeys[this.currentAgentIndex]);
        (new MovementAgentState(currentNodeData)).update();

        this.currentAgentIndex += 1;
    }

    start(){
        Logger.info("Automata starting...");
        App.processedNodes.update();
        clearInterval(this.interval);
        this.interval = setInterval(this.updateNextAgent, this.intervalMs);
    }
    stop(){
        Logger.info("Automata stopping...");
        clearInterval(this.interval);
        this.interval = null;
        this.currentAgentIndex = 0; // Reset index for safety
    }
    toggle(){
        if (this.interval) this.stop()
        else this.start()
    }
}
