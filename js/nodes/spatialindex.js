class SpatialIndex {
    constructor(cellSize = 0.5) {
        this.cellSize = cellSize;
        this.grid = new Map();
        this.nodeCells = new Map();
    }

    _toGridKey(x, y) {
        const gx = Math.floor(x / this.cellSize);
        const gy = Math.floor(y / this.cellSize);
        return `${gx},${gy}`;
    }

    _getCellKey(pos) {
        return this._toGridKey(pos.x, pos.y);
    }

    _getCellsForBounds(minX, minY, maxX, maxY) {
        const cells = [];
        const startGx = Math.floor(minX / this.cellSize);
        const endGx = Math.floor(maxX / this.cellSize);
        const startGy = Math.floor(minY / this.cellSize);
        const endGy = Math.floor(maxY / this.cellSize);
        
        for (let gx = startGx; gx <= endGx; gx++) {
            for (let gy = startGy; gy <= endGy; gy++) {
                cells.push(`${gx},${gy}`);
            }
        }
        return cells;
    }

    insert(node) {
        const key = this._getCellKey(node.pos);
        
        if (!this.grid.has(key)) {
            this.grid.set(key, new Set());
        }
        this.grid.get(key).add(node);
        this.nodeCells.set(node.uuid, key);
    }

    remove(node) {
        const key = this.nodeCells.get(node.uuid);
        if (key === undefined) return;
        
        const cell = this.grid.get(key);
        if (cell) {
            cell.delete(node);
            if (cell.size === 0) {
                this.grid.delete(key);
            }
        }
        this.nodeCells.delete(node.uuid);
    }

    update(node) {
        const oldKey = this.nodeCells.get(node.uuid);
        const newKey = this._getCellKey(node.pos);
        
        if (oldKey === newKey) return;
        
        if (oldKey !== undefined) {
            const cell = this.grid.get(oldKey);
            if (cell) {
                cell.delete(node);
                if (cell.size === 0) {
                    this.grid.delete(oldKey);
                }
            }
        }
        
        if (!this.grid.has(newKey)) {
            this.grid.set(newKey, new Set());
        }
        this.grid.get(newKey).add(node);
        this.nodeCells.set(node.uuid, newKey);
    }

    queryNodesInBounds(minX, minY, maxX, maxY) {
        const cells = this._getCellsForBounds(minX, minY, maxX, maxY);
        const nodes = new Set();
        
        for (const key of cells) {
            const cell = this.grid.get(key);
            if (cell) {
                for (const node of cell) {
                    if (node.pos.x >= minX && node.pos.x <= maxX &&
                        node.pos.y >= minY && node.pos.y <= maxY) {
                        nodes.add(node);
                    }
                }
            }
        }
        return nodes;
    }

    clear() {
        this.grid.clear();
        this.nodeCells.clear();
    }

    rebuild(nodes) {
        this.clear();
        for (const uuid in nodes) {
            this.insert(nodes[uuid]);
        }
    }
}

class ViewportCulling {
    constructor(spatialIndex, bufferMultiplier = 2.0) {
        this.spatialIndex = spatialIndex;
        this.bufferMultiplier = bufferMultiplier;
        this.lastVisibleBounds = null;
        this.visibleNodes = new Set();
        this.nearbyNodes = new Set();
        this.visibleEdges = new Set();
        this.stats = {
            totalNodes: 0,
            visibleNodes: 0,
            culledNodes: 0,
            totalEdges: 0,
            visibleEdges: 0,
            culledEdges: 0
        };
    }

    calculateVisibleBounds() {
        const svgbb = svg.getBoundingClientRect();
        if (svgbb.width === 0 || svgbb.height === 0) {
            return null;
        }

        const centerZ = Graph.vecToZ();
        const zoomMag = Graph.zoom.mag();
        
        const w = Math.min(svgbb.width, svgbb.height);
        const viewRadius = zoomMag * 2;
        
        const buffer = viewRadius * (this.bufferMultiplier - 1);
        
        return {
            minX: centerZ.x - viewRadius - buffer,
            maxX: centerZ.x + viewRadius + buffer,
            minY: centerZ.y - viewRadius - buffer,
            maxY: centerZ.y + viewRadius + buffer,
            centerX: centerZ.x,
            centerY: centerZ.y,
            zoom: zoomMag
        };
    }

    update() {
        const bounds = this.calculateVisibleBounds();
        if (!bounds) return;

        this.lastVisibleBounds = bounds;
        
        const allNodes = Graph.nodes;
        this.stats.totalNodes = Object.keys(allNodes).length;
        
        this.visibleNodes = this.spatialIndex.queryNodesInBounds(
            bounds.minX, bounds.minY, bounds.maxX, bounds.maxY
        );

        this.nearbyNodes = new Set(this.visibleNodes);

        this.stats.visibleNodes = this.nearbyNodes.size;
        this.stats.culledNodes = this.stats.totalNodes - this.stats.visibleNodes;

        this._updateVisibleEdges();
    }

    _updateVisibleEdges() {
        this.visibleEdges.clear();
        const edges = Graph.edges;
        this.stats.totalEdges = Object.keys(edges).length;
        
        for (const edgeKey in edges) {
            const edge = edges[edgeKey];
            const pts = edge.pts;
            
            if (pts.length < 2) continue;
            
            if (this.nearbyNodes.has(pts[0]) || this.nearbyNodes.has(pts[1])) {
                this.visibleEdges.add(edge);
            }
        }
        
        this.stats.visibleEdges = this.visibleEdges.size;
        this.stats.culledEdges = this.stats.totalEdges - this.stats.visibleEdges;
    }

    isNodeVisible(node) {
        return this.nearbyNodes.has(node);
    }

    isEdgeVisible(edge) {
        return this.visibleEdges.has(edge);
    }

    forEachVisibleNode(callback, context) {
        this.nearbyNodes.forEach(callback, context);
    }

    forEachVisibleEdge(callback, context) {
        this.visibleEdges.forEach(callback, context);
    }

    getStats() {
        return { ...this.stats };
    }
}
