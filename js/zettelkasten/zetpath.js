class ZetPath {
    constructor(options) {
        this.options = options;
        this.path = [];
    }

    generatePath() {
        // To be implemented by subclasses
    }
    generateRadialNodes(numNodes, nodeSpacing, scale, startNodeIndex) {
        const radialNodes = [];
        for (let i = 0; i < numNodes; i++) {
            const angle = (2 * Math.PI * i) / numNodes;
            const x = Math.cos(angle) * nodeSpacing;
            const y = Math.sin(angle) * nodeSpacing;
            radialNodes.push({
                x,
                y,
                scale,
                startNodeIndex,
                startFromBeginning: true,
            });
        }
        return radialNodes;
    }
}

class SpiralZetPath extends ZetPath {
    constructor(options) {
        super(options);
        this.options = {
            ...options,
        };
    }
    generatePath() {
        //console.log('Generating spiral path...');
        this.path = [];
        let angle = 0;
        let radius = this.options.spiralPathDistance * this.options.spiralScale;
        let curl = this.options.curl;

        let angleIncrement = 0.1 + Math.abs(curl) * 0.3;
        let radiusIncrement = 0.1 + Math.abs(curl) * 0.3;
        for (let i = 0; i < this.options.spiralPathLength; i++) {
            // Calculate the position of the current node
            let x = Math.cos(angle) * radius;
            let y = Math.sin(angle) * radius;
            // Add the current node to the path
            this.path.push({ x, y, scale: this.options.spiralScale });
            // Increment the angle and radius for the next node based on the curl value
            angle += angleIncrement * Math.sign(curl);
            radius += radiusIncrement;
            // Adjust the radius based on the desired node spacing
            let targetDistance = this.options.spiralPathDistance * this.options.spiralScale;
            let currentDistance = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
            let distanceRatio = targetDistance / currentDistance;
            radius *= distanceRatio;
        }
        //console.log('Spiral path generated:', this.path);
    }
}
class BranchingZetPath extends ZetPath {
    generatePath() {
        //console.log('Generating branching path...');
        this.path = [];
        const branchingFactor = this.options.branchingFactor;
        const nodeSpacing = this.options.branchingPathDistance;
        const scale = this.options.branchingScale;
        const branchingInterval = 2; // Determines how often branches occur
        const totalDepth = Math.floor(Math.log(this.options.branchingPathLength) / Math.log(branchingFactor));
        const angleDelta = (2 * Math.PI) / branchingFactor;

        const generateBranch = (depth, parentNodeIndex, angle, currentInterval) => {
            if (depth === 0 || currentInterval < branchingInterval) return;

            for (let i = 0; i < branchingFactor; i++) {
                const branchAngle = angle + (i - (branchingFactor - 1) / 2) * angleDelta;
                const radius = nodeSpacing * (totalDepth - depth + 1);
                const x = Math.cos(branchAngle) * radius;
                const y = Math.sin(branchAngle) * radius;

                this.path.push({
                    x,
                    y,
                    scale: Math.pow(scale, totalDepth - depth + 1),
                    startNodeIndex: parentNodeIndex,
                    startFromBeginning: false,
                });

                // Reset the interval every time a branch is created
                generateBranch(depth - 1, this.path.length - 1, branchAngle, branchingInterval);
            }
        };

        // Start with the branching interval at its max to place the first branch correctly
        generateBranch(totalDepth, 0, 0, branchingInterval);

        //console.log('Updated Branching Path:', this.path);
        return this.path;
    }
}

class RadialZetPath extends ZetPath {
    generatePath() {
        //console.log('Generating radial path...');
        this.path = [];
        const numBranches = this.options.radialDepth;
        const nodesPerBranch = Math.floor(this.options.radialPathLength / numBranches);
        const nodeSpacing = this.options.radialPathDistance;
        const firstRadiusMultiplier = 3;
        const radiusDecreaseRate = 0.4;

        // Generate the first branch from the initial origin
        for (let j = 0; j < nodesPerBranch; j++) {
            const angle = (2 * Math.PI * j) / nodesPerBranch;
            const x = Math.cos(angle) * nodeSpacing * firstRadiusMultiplier;
            const y = Math.sin(angle) * nodeSpacing * firstRadiusMultiplier;
            this.path.push({
                x,
                y,
                scale: this.options.radialScale,
                startNodeIndex: 0,
                startFromBeginning: true,
            });
        }

        let currentScale = this.options.radialScale;
        let currentRadiusMultiplier = firstRadiusMultiplier;
        // Generate branches for each subsequent layer
        for (let i = 1; i < numBranches; i++) {
            const startNodeIndex = (i - 1) * nodesPerBranch + 1;
            const endNodeIndex = startNodeIndex + nodesPerBranch - 1;
            // Decrease the scale and radius multiplier for the current layer
            currentScale *= this.options.radialScale;
            currentRadiusMultiplier *= radiusDecreaseRate;
            for (let k = startNodeIndex; k <= endNodeIndex; k++) {
                const originNode = this.path[k];
                for (let j = 0; j < nodesPerBranch - 1; j++) {
                    const angle = (2 * Math.PI * (j + 1)) / nodesPerBranch;
                    const x = Math.cos(angle) * nodeSpacing * currentRadiusMultiplier;
                    const y = Math.sin(angle) * nodeSpacing * currentRadiusMultiplier;
                    this.path.push({
                        x,
                        y,
                        scale: currentScale,
                        startNodeIndex: k,
                        startFromBeginning: true,
                    });
                }
            }
        }
        //console.log('Updated Radial Path:', this.path);
        return this.path;
    }
}


function createZetPath(style, options) {
    let zetPath;
    switch (style) {
        case 'Spiral':
            zetPath = new SpiralZetPath(options);
            break;
        case 'Branching':
            zetPath = new BranchingZetPath(options);
            break;
        case 'Radial':
            zetPath = new RadialZetPath(options);
            break;
        default:
            throw new Error(`Invalid ZetPath style: ${style}`);
    }
    // Return both the path instance and the override flag
    return {
        zetPath,
        zetPlacementOverride: options.zetPlacementOverride
    };
}

// Create the zetPath instance with default options
const defaultZetPathOptions = {
    // Shared Defaults
    pathLength: 64, // Default for "Number of Nodes" slider
    scale: 0.8, // Default for "Node Size" slider
    nodeSpacing: 1, // Assumed generic default for "Node Spacing"

    // Spiral Specific Defaults
    spiralPathLength: 64,
    spiralScale: 1,
    spiralPathDistance: 1,
    curl: 0.2,

    // Branching Specific Defaults
    branchingPathLength: 64,
    branchingScale: 0.98,
    branchingPathDistance: 1,
    branchingFactor: 4,

    // Radial Specific Defaults
    radialPathLength: 64,
    radialScale: 0.8,
    radialPathDistance: 5,
    radialDepth: 8,
};

let zetPath = createZetPath('Radial', defaultZetPathOptions);

function updatePathOptions() {
    //console.log('Updating path options...');
    const style = modalInputValues.zetPathTypeDropdown || 'Radial';

    const spiralPathLength = parseInt(modalInputValues.spiralPathLengthSlider);
    const spiralScale = parseFloat(modalInputValues.spiralScaleSlider);
    const spiralPathDistance = parseFloat(modalInputValues.spiralPathDistanceSlider);

    const branchingPathLength = parseInt(modalInputValues.branchingPathLengthSlider);
    const branchingScale = parseFloat(modalInputValues.branchingScaleSlider);
    const branchingPathDistance = parseFloat(modalInputValues.branchingPathDistanceSlider);

    const radialPathLength = parseInt(modalInputValues.radialPathLengthSlider);
    const radialScale = parseFloat(modalInputValues.radialScaleSlider);
    const radialPathDistance = parseFloat(modalInputValues.radialPathDistanceSlider);


    const branchingFactor = parseInt(modalInputValues.branchingFactorSlider);
    const radialDepth = parseFloat(modalInputValues.radialDepthSlider);
    const curl = parseFloat(modalInputValues.curlSlider);

    const zetPlacementOverride = !!modalInputValues.zetPlacementOverride;

    // Update the options object with the new slider values
    const options = {
        // For Spiral-specific options
        spiralPathLength: isNaN(spiralPathLength) ? defaultZetPathOptions.spiralPathLength : spiralPathLength,
        spiralScale: isNaN(spiralScale) ? defaultZetPathOptions.spiralScale : spiralScale,
        spiralPathDistance: isNaN(spiralPathDistance) ? defaultZetPathOptions.spiralPathDistance : spiralPathDistance,
        curl: isNaN(curl) ? defaultZetPathOptions.curl : curl,

        // For Branching-specific options
        branchingPathLength: isNaN(branchingPathLength) ? defaultZetPathOptions.branchingPathLength : branchingPathLength,
        branchingScale: isNaN(branchingScale) ? defaultZetPathOptions.branchingScale : branchingScale,
        branchingPathDistance: isNaN(branchingPathDistance) ? defaultZetPathOptions.branchingPathDistance : branchingPathDistance,
        branchingFactor: isNaN(branchingFactor) ? defaultZetPathOptions.branchingFactor : branchingFactor,

        // For Radial-specific options
        radialPathLength: isNaN(radialPathLength) ? defaultZetPathOptions.radialPathLength : radialPathLength,
        radialScale: isNaN(radialScale) ? defaultZetPathOptions.radialScale : radialScale,
        radialPathDistance: isNaN(radialPathDistance) ? defaultZetPathOptions.radialPathDistance : radialPathDistance,
        radialDepth: isNaN(radialDepth) ? defaultZetPathOptions.radialDepth : radialDepth,

        zetPlacementOverride,
    };

    let pathObject = createZetPath(style, options);
    pathObject.zetPath.generatePath(); // Generate the path
    // Pass the complete pathObject, which now includes the path and the override flag
    window.zettelkastenProcessor.updatePlacementPath(pathObject);

    //console.log('Updated path options:', pathObject.zetPath.options);

    // Adjust visibility of sliders based on path type
    adjustSliderVisibilityBasedOnPathType(style);
}

function adjustSliderVisibilityBasedOnPathType(style) {
    // Show general sliders (without any specific class) by default
    document.querySelectorAll('.settingsSlider:not(.spiral-slider):not(.branching-slider)').forEach(slider => {
        slider.style.display = 'block';
    });

    // Hide all specific sliders first to prevent overlap in visibility settings
    document.querySelectorAll('.spiral-slider, .branching-slider, .radial-slider').forEach(slider => {
        slider.style.display = 'none';
    });

    // Conditional display logic for specific sliders
    if (style === 'Branching') {
        document.querySelectorAll('.branching-slider').forEach(slider => slider.style.display = 'block');
    } else if (style === 'Spiral') {
        document.querySelectorAll('.spiral-slider').forEach(slider => slider.style.display = 'block');
    } else if (style === 'Radial') {
        document.querySelectorAll('.radial-slider').forEach(slider => slider.style.display = 'block');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // Radial Sliders
    document.getElementById('radialPathLengthSlider').value = defaultZetPathOptions.radialPathLength;
    document.getElementById('radialScaleSlider').value = defaultZetPathOptions.radialScale;
    document.getElementById('radialPathDistanceSlider').value = defaultZetPathOptions.radialPathDistance;
    document.getElementById('radialDepthSlider').value = defaultZetPathOptions.radialDepth;

    // Spiral Sliders
    document.getElementById('spiralPathLengthSlider').value = defaultZetPathOptions.spiralPathLength;
    document.getElementById('spiralScaleSlider').value = defaultZetPathOptions.spiralScale;
    document.getElementById('spiralPathDistanceSlider').value = defaultZetPathOptions.spiralPathDistance;
    document.getElementById('curlSlider').value = defaultZetPathOptions.curl;

    // Branching Sliders
    document.getElementById('branchingPathLengthSlider').value = defaultZetPathOptions.branchingPathLength;
    document.getElementById('branchingScaleSlider').value = defaultZetPathOptions.branchingScale;
    document.getElementById('branchingPathDistanceSlider').value = defaultZetPathOptions.branchingPathDistance;
    document.getElementById('branchingFactorSlider').value = defaultZetPathOptions.branchingFactor;

    updatePathOptions()
});