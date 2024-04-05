class BaseAgentState {
    constructor(node) {
        this.agent = node;
        this.state = {};
    }

    updateState() {
        // User-defined logic goes here
    }

    performActions() {
        // User-defined logic goes here
    }

// Utility methods // 
    findNearbyNodes() {
        this.agent.sensor.callUpdate();
        const sparseNodes = this.agent.sensor.nearbyNodes;
        return sparseNodes.map(sparseNode => globalProcessedNodeMap[sparseNode.uuid]);
    }

    findNodesWithinExtendedRadius() {
        this.agent.sensor.callUpdate();
        const sparseNodes = this.agent.sensor.nodesWithinExtendedRadius;
        return sparseNodes.map(sparseNode => globalProcessedNodeMap[sparseNode.uuid]);
    }

    switchState(newState) {
        this.state = newState;
    }
}

// Global object to track moving nodes
const globalMovingNodes = {};

class MovementAgentState extends BaseAgentState {
    constructor(node) {
        super(node);
        this.state = {
            baseSeparation: 0.3, // Minimum separation
            maxSeparation: 4,  // Maximum separation possible
            // Adding desiredSeparation to the initial state to ensure it's always defined
            desiredSeparation: 0.5,
        };
    }
    nodesAreConnected(node1, node2) {
        // Check if node1's edges contain node2's uuid and vice versa
        const isConnected = node1.edges.includes(node2.uuid) || node2.edges.includes(node1.uuid);
        return isConnected;
    }
    findAllConnectedNodes(node, visited = new Set()) {
        visited.add(node.uuid);
        node.edges.forEach(edgeUuid => {
            if (!visited.has(edgeUuid)) {
                this.findAllConnectedNodes(globalProcessedNodeMap[edgeUuid], visited);
            }
        });
        return Array.from(visited); // Returns all connected node UUIDs, including the starting node
    }
    calculateCentroidOfConnectedComponent(connectedNodesUuids) {
        let sumX = 0, sumY = 0;
        let validNodeCount = 0;
        connectedNodesUuids.forEach(nodeUuid => {
            const node = globalProcessedNodeMap[nodeUuid];
            if (node) {
                sumX += node.pos.x;
                sumY += node.pos.y;
                validNodeCount++;
            }
        });
        if (validNodeCount > 0) {
            return new vec2(sumX / validNodeCount, sumY / validNodeCount);
        } else {
            // If no valid nodes are found, return the agent's position as the centroid
            return this.agent.pos;
        }
    }
    calculateScaleFactorForComponents(componentUuidsA, componentUuidsB) {
        const scaleA = this.calculateAverageScaleForComponent(componentUuidsA);
        const scaleB = this.calculateAverageScaleForComponent(componentUuidsB);
        const scaleDifference = scaleA - scaleB;
        const scaleFactor = 1 + Math.tanh(scaleDifference / this.agent.scale);
        return scaleFactor;
    }
    calculateAverageScaleForComponent(componentUuids) {
        let totalScale = 0;
        componentUuids.forEach(uuid => {
            const node = globalProcessedNodeMap[uuid];
            totalScale += node.scale;
        });
        return totalScale / componentUuids.length;
    }
    updateState() {
        if (globalMovingNodes[this.agent.uuid]) {
            // Node is already moving, skip this update cycle
            return Promise.resolve();
        } else {
            const nearbyNodes = this.findNearbyNodes();
            const extendedNodes = this.findNodesWithinExtendedRadius();
            this.adjustDesiredSeparation(extendedNodes.length);
            return this.calculateAndSetNewPosition(nearbyNodes);
        }
    }
    adjustDesiredSeparation(extendedNodeCount) {
        const minScaleFactor = Math.min(1, this.agent.scale); // Ensure the scale factor is at least 1 or less if the scale is smaller
        const separationRange = (this.state.maxSeparation - this.state.baseSeparation) * minScaleFactor;
        const adjustmentFactor = Math.min(separationRange, separationRange * (extendedNodeCount / 40));
        // Update the desired separation, ensuring it stays within dynamically adjusted bounds
        this.state.desiredSeparation = this.state.baseSeparation * minScaleFactor + adjustmentFactor;
    }
    calculateAndSetNewPosition(nearbyNodes) {
        const agentConnectedComponentUuids = this.findAllConnectedNodes(this.agent);
        const agentCentroid = this.calculateCentroidOfConnectedComponent(agentConnectedComponentUuids);
        let movementVector = new vec2(0, 0);
        let adjustmentNeeded = false;

        // A map to keep track of distinct connected components identified among nearby nodes.
        const nearbyComponents = new Map();
        nearbyNodes.forEach(nearbyNode => {
            // Skip nodes that are part of the agent's connected component.
            if (agentConnectedComponentUuids.includes(nearbyNode.uuid)) return;
            // Determine the connected component for the nearby node, if not already processed.
            if (!nearbyComponents.has(nearbyNode.uuid)) {
                const componentUuids = this.findAllConnectedNodes(nearbyNode);
                const componentCentroid = this.calculateCentroidOfConnectedComponent(componentUuids);
                componentUuids.forEach(uuid => nearbyComponents.set(uuid, { centroid: componentCentroid, uuids: componentUuids }));
            }
        });

        // Aggregate external influences based on distinct connected components.
        nearbyComponents.forEach(({ centroid, uuids }) => {
            // Find the distance to the closest node in the component
            let minDistanceToAgent = Infinity;
            uuids.forEach(uuid => {
                const node = globalProcessedNodeMap[uuid];
                if (node) {
                    const distanceToAgentNode = this.agent.pos.distanceTo(node.pos);
                    minDistanceToAgent = Math.min(minDistanceToAgent, distanceToAgentNode);
                }
            });

            const scaleFactor = this.calculateScaleFactorForComponents(uuids, agentConnectedComponentUuids);
            const adjustedDesiredSeparation = this.state.desiredSeparation * scaleFactor;
            if (minDistanceToAgent < adjustedDesiredSeparation) {
                let directionAway = agentCentroid.minus(centroid).normed();
                // Adjust the movement vector based on the closest node rather than centroid distance
                const weightedMovementVector = directionAway.scale((adjustedDesiredSeparation - minDistanceToAgent) * scaleFactor / this.agent.scale);
                movementVector = movementVector.plus(weightedMovementVector);
                adjustmentNeeded = true;
            }
        });

        if (adjustmentNeeded) {
            return this.moveConnectedNodes(movementVector);
        } else {
            return Promise.resolve();
        }
    }
    moveConnectedNodes(movementVector) {
        const movePromises = [];
        const connectedNodes = this.findAllConnectedNodes(this.agent);
        connectedNodes.forEach(nodeUuid => {
            const node = globalProcessedNodeMap[nodeUuid];
            const nodeActions = node.actions;
            // Calculate new position for each node using the movement vector
            const newPosition = new vec2(node.pos.x + movementVector.x, node.pos.y + movementVector.y);
            // Mark the node as moving globally
            globalMovingNodes[nodeUuid] = true;
            movePromises.push(new Promise(resolve => {
                nodeActions.moveTo(newPosition.x, newPosition.y, 0.05, () => {
                    delete globalMovingNodes[nodeUuid]; // Mark the move as complete
                    resolve();
                });
            }));
        });
        return Promise.all(movePromises);
    }
}

class CellularAutomataManager {
    constructor(agentStateClass) {
        this.AgentStateClass = agentStateClass;
        this.intervalMs = 0; // Adjust as needed
        this.automataInterval = null;
        this.currentAgentIndex = 0; // Tracks the current node being processed
    }

    // No longer need to store a static list of agents. We'll dynamically reference the latest node data.

    updateNextAgent() {
        const nodeKeys = Object.keys(globalProcessedNodeMap); // Get an array of node UUIDs

        if (nodeKeys.length === 0) return; // If no nodes, do nothing

        if (this.currentAgentIndex >= nodeKeys.length) {
            this.currentAgentIndex = 0; // Reset index if it exceeds the number of nodes
        }

        const currentNodeData = globalProcessedNodeMap[nodeKeys[this.currentAgentIndex]];
        const agentState = new this.AgentStateClass(currentNodeData); // Dynamically create an agent state for the current node
        agentState.updateState(); // Update state
        agentState.performActions(); // Perform actions based on the updated state

        this.currentAgentIndex = (this.currentAgentIndex + 1) % nodeKeys.length; // Move to the next node
    }

    startAutomata() {
        updateGlobalProcessedNodeMap(nodeMap);
        if (this.automataInterval) clearInterval(this.automataInterval);
        this.automataInterval = setInterval(() => this.updateNextAgent(), this.intervalMs);
    }

    stopAutomata() {
        if (this.automataInterval) clearInterval(this.automataInterval);
        this.automataInterval = null;
        this.currentAgentIndex = 0; // Reset index for safety
    }

    toggleAutomata() {
        if (this.automataInterval) {
            console.log("Automata stopping...");
            this.stopAutomata();
        } else {
            console.log("Automata starting...");
            this.startAutomata();
        }
    }
}

let automataManager = null;

function updateNodeStartAutomataAction() {
    if (!automataManager) {
        automataManager = new CellularAutomataManager(MovementAgentState);
    }
    automataManager.toggleAutomata(); // Toggle the state of the automata
}

/* Usage 
// Creating an instance of the CellularAutomataManager
const automataManager = new CellularAutomataManager();

// Adding nodes
nodes.forEach(node => {
    automataManager.addNode(node, ExampleCustomAgentState);
});

// Starting the automata
automataManager.startAutomata();

// Stopping the automata
automataManager.stopAutomata();

// Updating agent state (if needed)
automataManager.updateAgentState(AnotherCustomAgentState);

    */