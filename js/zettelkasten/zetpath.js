class ZetPath {
    constructor(options) {
        this.options = options;
        this.path = [];
    }
    static newOption(sliderId, funcParse){
        return {sliderId, funcParse}
    }

    generatePath() {
        // To be implemented by subclasses
    }
    generateRadialNodes(numNodes, nodeSpacing, scale, startNodeIndex) {
        const radialNodes = [];
        for (let i = 0; i < numNodes; i++) {
            const angle = (2 * Math.PI * i) / numNodes;
            radialNodes.push({
                x: Math.cos(angle) * nodeSpacing,
                y: Math.sin(angle) * nodeSpacing,
                scale,
                startNodeIndex,
                startFromBeginning: true,
            });
        }
        return radialNodes;
    }
}

ZetPath.Spiral = class extends ZetPath {
    constructor(options) {
        super(options);
        this.options = {...options};
    }
    generatePath() {
        //console.log('Generating spiral path...');
        const path = this.path = [];
        let angle = 0;
        const options = this.options;
        let radius = options.pathDistance * options.scale;
        const curl = options.curl;

        let angleIncrement = 0.1 + Math.abs(curl) * 0.3;
        let radiusIncrement = 0.1 + Math.abs(curl) * 0.3;
        for (let i = 0; i < options.pathLength; i++) {
            // Calculate the position of the current node
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            // Add the current node to the path
            path.push({ x, y, scale: options.scale });
            // Increment the angle and radius for the next node based on the curl value
            angle += angleIncrement * Math.sign(curl);
            radius += radiusIncrement;
            // Adjust the radius based on the desired node spacing
            const targetDistance = options.pathDistance * options.scale;
            const currentDistance = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
            const distanceRatio = targetDistance / currentDistance;
            radius *= distanceRatio;
        }
        //console.log('Spiral path generated:', path);
    }
}

ZetPath.Branching = class extends ZetPath {
    generatePath() {
        //console.log('Generating branching path...');
        const path = this.path = [];
        const options = this.options;
        const branchingFactor = options.factor;
        const nodeSpacing = options.pathDistance;
        const scale = options.scale;
        const branchingInterval = 2; // Determines how often branches occur
        const totalDepth = Math.floor(Math.log(options.pathLength) / Math.log(branchingFactor));
        const angleDelta = (2 * Math.PI) / branchingFactor;

        const generateBranch = (depth, parentNodeIndex, angle, currentInterval) => {
            if (depth === 0 || currentInterval < branchingInterval) return;

            for (let i = 0; i < branchingFactor; i++) {
                const branchAngle = angle + (i - (branchingFactor - 1) / 2) * angleDelta;
                const radius = nodeSpacing * (totalDepth - depth + 1);
                path.push({
                    x: Math.cos(branchAngle) * radius,
                    y: Math.sin(branchAngle) * radius,
                    scale: Math.pow(scale, totalDepth - depth + 1),
                    startNodeIndex: parentNodeIndex,
                    startFromBeginning: false,
                });

                // Reset the interval every time a branch is created
                generateBranch(depth - 1, path.length - 1, branchAngle, branchingInterval);
            }
        };

        // Start with the branching interval at its max to place the first branch correctly
        generateBranch(totalDepth, 0, 0, branchingInterval);

        //console.log('Updated Branching Path:', path);
        return path;
    }
}

ZetPath.Radial = class extends ZetPath {
    generatePath() {
        const path = this.path = [];
        const options = this.options;
        const numBranches = Math.min(Math.floor(options.depth), 8);
        const nodesPerBranch = Math.min(Math.floor(options.pathLength / numBranches), 50);
        const nodeSpacing = Math.max(options.pathDistance, 1);
        const maxPathLength = options.pathLength * numBranches; // Set a limit to the path length
        let currentScale = options.scale;
        let currentLayerNodes = [0]; // Start with the initial parent node as the first layer
        // Generate branches for each subsequent layer
        for (let i = 0; i < numBranches - 1 && path.length < maxPathLength; i++) {
            const nextLayerNodes = [];
            // Decrease the scale for the current layer
            currentScale = Math.max(currentScale * options.scale, 0.1);
            // Generate child nodes for each parent node in the current layer
            for (let j = 0; j < currentLayerNodes.length && path.length < maxPathLength; j++) {
                const parentNodeIndex = currentLayerNodes[j];
                const childNodes = this.generateRadialNodes(nodesPerBranch, nodeSpacing, currentScale, parentNodeIndex);
                path.push(...childNodes.slice(0, maxPathLength - path.length)); // Limit the number of child nodes added
                nextLayerNodes.push(...childNodes.map((_, index) => path.length - childNodes.length + index));
            }
            currentLayerNodes = nextLayerNodes;
        }
        return path;
    }
}

ZetPath.Empty = class extends ZetPath {
    generatePath() {
        //console.log("Generating radial path...");
        this.path = [];
        //console.log("Updated Radial Path:", this.path);
        return this.path;
    }
}

function createZetPath(styleName, options) {
    let zetPath;
    const zetPlacementOverride = (styleName === 'Random');

    if (styleName === 'Random') {
        zetPath = new ZetPath.Empty();
    } else {
        const styleOptions = options[styleName];
        if (!styleOptions) throw new Error("Invalid ZetPath style: " + styleName);

        zetPath = new ZetPath[styleName](styleOptions);
    }

    return { zetPath, zetPlacementOverride };
}

ZetPath.options = {
    default: {
        // Shared Defaults
        pathLength: 64, // Default for "Number of Nodes" slider
        scale: 0.8, // Default for "Node Size" slider
        nodeSpacing: 1,

        Branching: {
            factor: 4,
            pathDistance: 1,
            pathLength: 64,
            scale: 0.98
        },
        Radial: {
            depth: 8,
            pathDistance: 5,
            pathLength: 64,
            scale: 0.8
        },
        Spiral: {
            curl: 0.2,
            pathDistance: 1,
            pathLength: 64,
            scale: 1
        }
    },
    Branching: {
        factor: ZetPath.newOption("branchingFactorSlider", parseInt),
        pathDistance: ZetPath.newOption("branchingPathDistanceSlider", parseFloat),
        pathLength: ZetPath.newOption("branchingPathLengthSlider", parseInt),
        scale: ZetPath.newOption("branchingScaleSlider", parseFloat)
    },
    Radial: {
        depth: ZetPath.newOption("radialDepthSlider", parseFloat),
        pathDistance: ZetPath.newOption("radialPathDistanceSlider", parseFloat),
        pathLength: ZetPath.newOption("radialPathLengthSlider", parseInt),
        scale: ZetPath.newOption("radialScaleSlider", parseFloat)
    },
    Spiral: {
        curl: ZetPath.newOption("curlSlider", parseFloat),
        pathDistance: ZetPath.newOption("spiralPathDistanceSlider", parseFloat),
        pathLength: ZetPath.newOption("spiralPathLengthSlider", parseInt),
        scale: ZetPath.newOption("spiralScaleSlider", parseFloat)
    }
}

let zetPath = createZetPath('Radial', ZetPath.options.default);

function updatePathOptions(targetProcessor = null) {
    //console.log('Updating path options...');
    const styleName = Modal.inputValues.zetPathTypeDropdown || 'Radial';
    const options = {
        zetPlacementOverride: (styleName === 'Random')
    };

    function updateStyle(styleName){
        const pathOptions = options[styleName] = {};
        const defaultOptions = ZetPath.options.default[styleName];
        const style = ZetPath.options[styleName];
        for (const optionName in style) {
            const option = style[optionName];
            const value = option.funcParse(Modal.inputValues[option.sliderId]);
            pathOptions[optionName] = (isNaN(value) ? defaultOptions[optionName] : value);
        }
    }
    ['Branching', 'Radial', 'Spiral'].forEach(updateStyle);

    let pathObject = createZetPath(styleName, options);
    pathObject.zetPath.generatePath(); // Generate the path
    // Pass the complete pathObject, which now includes the path and the override flag
    if (targetProcessor) {
        targetProcessor.updatePlacementPath(pathObject);
    } else {
        window.zettelkastenProcessors.forEach(processor => {
            processor.updatePlacementPath(pathObject);
        });
    }

    //console.log('Updated path options:', pathObject.zetPath.options);

    // Adjust visibility of sliders based on path type
    adjustSliderVisibilityBasedOnPathType(styleName);
}

function adjustSliderVisibilityBasedOnPathType(styleName) {
    // Show general sliders (without any specific class) by default
    document.querySelectorAll('.settingsSlider:not(.spiral-slider):not(.branching-slider)').forEach(slider => {
        slider.style.display = 'block';
    });

    // Hide all specific sliders first to prevent overlap in visibility settings
    document.querySelectorAll('.spiral-slider, .branching-slider, .radial-slider').forEach(slider => {
        slider.style.display = 'none';
    });

    // Conditional display logic for specific sliders
    if (styleName === 'Branching') {
        document.querySelectorAll('.branching-slider').forEach(slider => slider.style.display = 'block');
    } else if (styleName === 'Spiral') {
        document.querySelectorAll('.spiral-slider').forEach(slider => slider.style.display = 'block');
    } else if (styleName === 'Radial') {
        document.querySelectorAll('.radial-slider').forEach(slider => slider.style.display = 'block');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    function setDefaultValue(styleName){
        const defaultOptions = ZetPath.options.default[styleName];
        const style = ZetPath.options[styleName];
        for (const optionName in style) {
            Elem.byId(style[optionName].sliderId).value = defaultOptions[optionName];
        }
    }
    ['Branching', 'Radial', 'Spiral'].forEach(setDefaultValue);

    updatePathOptions()
});
