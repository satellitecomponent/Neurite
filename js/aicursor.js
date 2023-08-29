// aicursor.js

class AiCursor {
    constructor(randomInit = false) {
        let viewBox = getSvgViewBox();  // Assuming you have a function to get the current viewbox
        this.initialPosition = new vec2((Math.random() - 0.5) * 1.8 + viewBox.x, (Math.random() - 0.5) * 1.8 + viewBox.y);
        this.updatePosition = this.initialPosition;  // for subsequent moves
        this.aiNode = null;
        this.followingAiCursor = false;
        this.aiCursorAnchor = new vec2(0, 0); // Initial anchor point
        this.scale = new vec2(1, 1); // Initial scale
    }

    calculateViewboxCenter() {
        let svgbb = svg.getBoundingClientRect();
        return new vec2(svgbb.width / 2, svgbb.height / 2);
    }

    addAiCursorNode(content) {
        console.log("Entering addAiCursorNode");
        this.aiNode = createTextNode(`Ai`, '', this.initialPosition.x, this.initialPosition.y);
        this.aiNode.pos = this.initialPosition;
        this.aiNode.aiCursor = this;
        this.followingAiCursor = true;
        this.aiNode.aiCursorAnchor = toDZ(new vec2(0, -this.aiNode.content.offsetHeight / 2 + 6));
        this.aiNode.aiCursorAnchor = this.aiCursorAnchor;
    }

    removeAiNode() {
        if (this.aiNode) {
            htmlnodes_parent.removeChild(this.aiNode.content);
            removenode(this.aiNode);
            this.aiNode = null;
        }
    }

    move(x, y, scale = this.scale) {
        // Update the updatePosition vector
        this.updatePosition = this.updatePosition.plus(new vec2(x * scale.x, y * scale.y));
        // The final position would be the sum of initialPosition and updatePosition
        let finalPosition = this.initialPosition.plus(this.updatePosition);

        if (this.aiNode) {
            this.aiNode.pos = finalPosition;
            this.aiNode.draw();
        }
    }


    releaseNode() {
        if (this.aiNode) {
            this.aiNode.aiCursor = null;
            this.followingAiCursor = false;
        }
    }
}

document.getElementById('ai-cursor-button').addEventListener('click', (event) => {
    // Instantiate AiCursor with random initial position
    let aiCursor = new AiCursor(true);
    aiCursor.addAiCursorNode('This is AI node content');

    if (!aiCursor.aiNode) {
        console.log("AI Node was not created.");
        return;
    }

    // After creation, move the node by a certain amount. Adjust x and y as you see fit.
    aiCursor.move(0.1, 0.2);
});