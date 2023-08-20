// aicursor.js

class AiCursor {
    constructor(brotcordmode = 1) {
        this.brotcordmode = brotcordmode;
        this.aiNode = null;
        this.followingAiCursor = false;
        this.aiCursorAnchor = new vec2(0, 0); // Initial anchor point
        this.scale = new vec2(1, 1); // Initial scale
        this.viewboxCenter = this.calculateViewboxCenter();
        this.position = new vec2(0, 0); // Initialize position
    }

    calculateViewboxCenter() {
        let svgbb = svg.getBoundingClientRect();
        return new vec2(svgbb.width / 2, svgbb.height / 2);
    }

    addAiCursorNode(content) {
        this.aiNode = createTextNode("AI", content, undefined, undefined, undefined, undefined, false);
        htmlnodes_parent.appendChild(this.aiNode.content);
        this.aiNode.aiCursor = this;
        this.followingAiCursor = true;
        this.aiNode.draw();
        this.aiNode.aiCursorAnchor = toDZ(new vec2(0, -this.aiNode.content.offsetHeight / 2 + 6));
        this.aiNode.content.children[0].children[1].children[0].value = content;
        this.aiNode.aiCursorAnchor = this.aiCursorAnchor;
        const scaleFactors = extractScalingFactors(this.aiNode.content);
        this.scale = new vec2(scaleFactors.scaleX, scaleFactors.scaleY);
        this.aiNode.content.style.transform = `scale(${this.scale.x}, ${this.scale.y})`;

        if (this.brotcordmode === 0) {
            // Update viewboxCenter
            this.viewboxCenter = this.calculateViewboxCenter();
            // Directly use viewboxCenter as node position
            this.aiNode.pos = this.viewboxCenter;
        } else if (this.brotcordmode === 1) {
            this.aiNode.pos = toZ(new vec2(0, 0)); // position in the Mandelbrot set
        }
    }

    removeAiNode() {
        if (this.aiNode) {
            htmlnodes_parent.removeChild(this.aiNode.content);
            removenode(this.aiNode);
            this.aiNode = null;
        }
    }

    move(x, y, scale = this.scale) {
        let svgbb = svg.getBoundingClientRect();
        let viewboxCenter = new vec2(svgbb.width / 2, svgbb.height / 2);

        if (this.brotcordmode === 0) {
            // In this case, viewboxCenter should be used as the origin
            this.position = this.viewboxCenter.plus(new vec2(x * scale.x, y * scale.y));
        } else if (this.brotcordmode === 1) {
            // In this case, the Mandelbrot set's origin is used
            this.position = toZ(new vec2(x, y));
        }

        if (this.aiNode) {
            this.aiNode.pos = this.position;
        }
    }


    releaseNode() {
        if (this.aiNode) {
            this.aiNode.aiCursor = null;
            this.followingAiCursor = false;
        }
    }
}

// An example of using AiCursor with brotcordmode = 0
let shiftPressed = false;

window.addEventListener('keydown', (event) => {
    if (event.key === 'Shift') {
        shiftPressed = true;
    }
});

window.addEventListener('keyup', (event) => {
    if (event.key === 'Shift') {
        shiftPressed = false;
    }
});

document.getElementById('ai-cursor-button').addEventListener('click', (event) => {
    let brotcordmode = shiftPressed ? 0 : 1;
    let aiCursor = new AiCursor(brotcordmode);

    // If brotcordmode is 0, initialize the aiCursor's position to the center of the viewbox
    if (brotcordmode === 0) {
        let svgbb = svg.getBoundingClientRect();
        let viewboxCenter = new vec2(svgbb.width / 2, svgbb.height / 2);
        aiCursor.position = toZ(viewboxCenter);
    }
    aiCursor.addAiCursorNode('This is AI node content');

    setTimeout(() => {
        aiCursor.move(100, 50);
        aiCursor.releaseNode();
    }, 2000);
});