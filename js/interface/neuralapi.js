class Transition {
    constructor(startValue, endValue, duration, funcEasy, funcUpdate){
        // this.startValue = startValue;
        // this.endValue = endValue;
        this.duration = duration;
        this.funcUpdate = funcUpdate;
        this.funcEasy = funcEasy;
        this.onStep = null;

        this.setParams();
    }
    static interpolateZoomAndPan(t){
        pan = interpolateVec2(this.startPan, this.endPan, t);
        if (this.endZoom !== null) {
            zoom = linterpolateVec2(this.startZoom.clog(), this.endZoom.clog(), t).cexp();
            if (this.rotationAngle !== null) {
                const currentRotation = interpolate(this.startRotation, this.endRotation, t);
                const r = new vec2(Math.cos(currentRotation), Math.sin(currentRotation));
                zoom = zoom.cmult(r);

                const pivot = toZ(new vec2(this.pivotX, this.pivotY));
                const zc = pivot.minus(pan);
                pan = pan.plus(zc.cmult(new vec2(1, 0).minus(r)));
            }
        }
        SVG.updateViewbox(pan, zoom);
    }
    static onStep(startTime, onComplete, funcIsComplete, timestamp){
        const progress = Math.min((Date.now() - startTime) / this.duration, 1);
        this.funcUpdate.call(this, this.funcEasy(progress));

        if (funcIsComplete) { // continue animation until it returns true
            if (!funcIsComplete()) return requestAnimationFrame(this.onStep);
        } else { // use duration-based completion
            if (progress < 1) return requestAnimationFrame(this.onStep);
        }

        onComplete && onComplete();
    }
    animate(onComplete, funcIsComplete){
        this.onStep = Transition.onStep.bind(this, Date.now(), onComplete, funcIsComplete);
        requestAnimationFrame(this.onStep);
    }
    setParams(startPan, endPan, startZoom = null, endZoom = null, rotateParams){
        this.startPan = startPan;
        this.endPan = endPan;
        this.startZoom = startZoom;
        this.endZoom = endZoom;

        const rotationAngle = this.rotationAngle = rotateParams?.rotationAngle ?? null;
        if (rotationAngle !== null) {
            this.startRotation = 0;
            this.endRotation = rotationAngle * Math.PI / 180; // Convert degrees to radians
            this.pivotX = rotateParams.pivotX ?? window.innerWidth / 2;
            this.pivotY = rotateParams.pivotY ?? window.innerHeight / 2;
        }

        return this;
    }
}

function interpolate(startValue, endValue, t) {
    return startValue + (endValue - startValue) * t;
}

// Use logarithmic interpolate for zoom  (a,b,t) => interpolateVec2(a.clog(),b.clog(),t).cexp()
function interpolateVec2(startVec, endVec, t) {
    const x = interpolate(startVec.x, endVec.x, t);
    const y = interpolate(startVec.y, endVec.y, t);
    return new vec2(x, y);
}

const linterpolateVec2 = (a, b, t) => interpolateVec2(a.clog(), b.clog(), t).cexp()

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}



function neuriteZoom(zoomFactor, targetX = window.innerWidth / 2, targetY = window.innerHeight / 2, duration = 1000) {
    const inverseFactor = 1 / zoomFactor;
    const dest = toZ(new vec2(targetX, targetY));
    const endPan = dest.scale(1 - inverseFactor).plus(pan.scale(inverseFactor));
    const endZoom = zoom.scale(inverseFactor);

    (new Transition(0, 1, duration, easeInOutCubic, Transition.interpolateZoomAndPan))
    .setParams(pan, endPan, zoom, endZoom).animate();
}

function neuritePan(deltaX, deltaY, duration = 1000) {
    const dp = toDZ(new vec2(deltaX, deltaY).scale(settings.panSpeed));
    const endPan = pan.plus(dp);

    (new Transition(0, 1, duration, easeInOutCubic, Transition.interpolateZoomAndPan))
    .setParams(pan, endPan).animate();
}

function neuriteRotate(rotationAngle, pivotX, pivotY, duration = 1000) {
    const p = toZ(new vec2(pivotX, pivotY));
    const zc = p.minus(pan);
    const r = new vec2(Math.cos(rotationAngle), Math.sin(rotationAngle));
    const endPan = pan.plus(zc.cmult(new vec2(1, 0).minus(r)));
    const endZoom = zoom.cmult(r);

    (new Transition(0, 1, duration, easeInOutCubic, Transition.interpolateZoomAndPan))
    .setParams(pan, endPan, zoom, endZoom).animate();
}

let activeAnimationsCount = 0;

const defaultMovements = {
    panLeft: { panParams: { deltaX: -200, deltaY: 0 } },
    panRight: { panParams: { deltaX: 200, deltaY: 0 } },
    panUp: { panParams: { deltaX: 0, deltaY: -150 } },
    panDown: { panParams: { deltaX: 0, deltaY: 150 } },
    zoomIn: { zoomParams: { zoomFactor: 0.3 } },
    zoomOut: { zoomParams: { zoomFactor: 3 } },
    rotateClockwise: { rotateParams: { rotationAngle: 90 } },
    rotateCounterClockwise: { rotateParams: { rotationAngle: -90 } },
    rotate180: { rotateParams: { rotationAngle: 180 } },
    // Add more default movements as needed
};

function neuriteMovement(movementTypes = [], customZoomParams = {}, customPanParams = {}, customRotateParams = {}, customDuration = 1000) {
    return new Promise((resolve, reject) => {
        activeAnimationsCount += 1;

        // Ensure movementTypes is always treated as an array
        if (!Array.isArray(movementTypes)) {
            movementTypes = [movementTypes]; // Convert to array if it's not already
        }

        let combinedZoomParams = {};
        let combinedPanParams = {};
        let combinedRotateParams = {};
        let duration = customDuration;

        // Combine defaults from each movement type
        movementTypes.forEach(movementType => {
            if (defaultMovements[movementType]) {
                combinedZoomParams = { ...defaultMovements[movementType].zoomParams, ...combinedZoomParams };
                combinedPanParams = { ...defaultMovements[movementType].panParams, ...combinedPanParams };
                combinedRotateParams = { ...defaultMovements[movementType].rotateParams, ...combinedRotateParams };
                duration = defaultMovements[movementType].duration || duration;
            }
        });

        // Override with custom parameters
        combinedZoomParams = { ...combinedZoomParams, ...customZoomParams };
        combinedPanParams = { ...combinedPanParams, ...customPanParams };
        combinedRotateParams = { ...combinedRotateParams, ...customRotateParams };

        const { zoomFactor = 0, zoomX = window.innerWidth / 2, zoomY = window.innerHeight / 2 } = combinedZoomParams;
        const { deltaX = 0, deltaY = 0 } = combinedPanParams;
        const destZoom = toZ(new vec2(zoomX, zoomY));
        const endZoom = zoom.scale(zoomFactor + 1);
        const dp = toDZ(new vec2(deltaX, deltaY).scale(settings.panSpeed));
        const endPan = pan.plus(dp);

        function onComplete(){
            activeAnimationsCount -= 1;
            console.log("Animation completed, count:", activeAnimationsCount);
            resolve();
        }

        try {
            (new Transition(0, 1, duration, easeInOutCubic, Transition.interpolateZoomAndPan))
            .setParams(pan, endPan, zoom, endZoom, combinedRotateParams).animate(onComplete)
        } catch (err) {
            console.error("Error in animation:", err);
            activeAnimationsCount -= 1;
            reject(err);
        }
    });
}

/*
panTo = new vec2(0, 0); //this.pos;
let gz = zoom.mag2() * ((this.scale * s) ** (-1 / settings.zoomContentExp));
zoomTo = zoom.unscale(gz ** 0.5);
autopilotReferenceFrame = this;
panToI = new vec2(0, 0); */

function neuriteSetMandelbrotCoords(zoomMagnitude, panReal, panImaginary, speed = 0.1) {
    return new Promise((resolve) => {
        let animate = true;
        let userBailedOut = false;

        const newZoomMagnitude = parseFloat(zoomMagnitude);
        const newPanReal = parseFloat(panReal);
        const newPanImaginary = parseFloat(panImaginary);

        if (!animate) {
            // Directly set the new zoom and pan values
            if (newZoomMagnitude !== 0) {
                zoom = zoom.scale(newZoomMagnitude / zoom.mag());
            }
            pan = new vec2(newPanReal, newPanImaginary);
            return resolve(); // Resolve immediately for non-animated change
        }

        activeAnimationsCount++;
        autopilotReferenceFrame = undefined;
        const targetZoom = zoom.scale(newZoomMagnitude / zoom.mag());
        const targetPan = new vec2(newPanReal, newPanImaginary);

        autopilotSpeed = (speed > 1 ? settings.autopilotSpeed : speed);

        // duration does not matter here
        const duration = 1;

        function update(t){
            // Regular animation steps
            const currentZoom = zoom.mag();
            const stepZoom = currentZoom + (targetZoom.mag() - currentZoom) * t;

            // Ensure zoom does not undershoot or overshoot
            if (Math.abs(stepZoom - targetZoom.mag()) < autopilotThreshold) {
                zoomTo = targetZoom;
            } else {
                zoomTo = zoom.scale(stepZoom / currentZoom);
            }

            const currentPan = pan;
            const stepPanX = currentPan.x + (targetPan.x - currentPan.x) * t;
            const stepPanY = currentPan.y + (targetPan.y - currentPan.y) * t;
            panTo = new vec2(stepPanX, stepPanY);
        }

        function onComplete(){
            if (!userBailedOut) {
                // Ensure the final zoom and pan values are set to the target values
                zoom = targetZoom;
                pan = targetPan;
            }
            activeAnimationsCount -= 1;
            autopilotSpeed = 0;
            autopilotReferenceFrame = undefined;
            console.log("Animation completed, count:", activeAnimationsCount);
            resolve();
        }
        function isComplete(){
            if (autopilotSpeed === 0) {
                userBailedOut = true;
                console.log("Animation interrupted by user interaction.");
                return true;
            }
            return zoom.closeEnough(targetZoom, autopilotThreshold) && pan.closeEnough(targetPan, autopilotThreshold);
        }

        try {
            (new Transition(0, 1, duration, easeInOutCubic, update)).animate(onComplete, isComplete)
        } catch (err) {
            console.error("Error in animation:", err);
            activeAnimationsCount -= 1;
            autopilotSpeed = 0;
            autopilotReferenceFrame = undefined;
        }
    });
}

const autopilotThreshold = 0.000001; // Define a suitable threshold

// Helper function to check if two vectors are close enough (within a threshold)
vec2.prototype.closeEnough = function (target, autopilotThreshold) {
    return this.minus(target).mag() < autopilotThreshold;
};


function neuriteZoomToNodeTitle(nodeOrTitle, zoomLevel = 1.0) {
    return new Promise((resolve) => {
        activeAnimationsCount++;
        autopilotReferenceFrame = undefined;
        let node;

        // First check if the argument is a node object
        if (typeof nodeOrTitle === 'object' && nodeOrTitle !== null) {
            node = nodeOrTitle; // Use the node object directly
        } else if (typeof nodeOrTitle === 'string') {
            ui = getZetNodeCMInstance(nodeOrTitle).ui;
            node = ui.scrollToTitle(nodeOrTitle); // Find the node by title
        } else {
            console.error("Invalid argument. Must be a node title or a node object.");
            resolve();
            return;
        }

        if (node) {
            let bb = node.content.getBoundingClientRect();
            if (bb && bb.width > 0 && bb.height > 0) {
                node.zoom_to_fit();
                zoomTo = zoomTo.scale(1.5);
            } else {
                node.zoom_to(0.5);
            }
            autopilotSpeed = settings.autopilotSpeed;
        }

        let intervalCheck;
        const checkForInterruption = () => {
            if (autopilotSpeed === 0) {
                console.log("Animation interrupted by user interaction.");
                clearInterval(intervalCheck);
                autopilotSpeed = 0;
                autopilotReferenceFrame = undefined;
                activeAnimationsCount--;
                resolve(node);
            }
        };

        intervalCheck = setInterval(checkForInterruption, 100); // Check every 100 milliseconds

        // Use a 3-second timeout to end animation
        setTimeout(() => {
            clearInterval(intervalCheck); // Clear interval check regardless of the state
            if (autopilotSpeed !== 0) {
                //console.log("Animation completed normally.");
            }
            activeAnimationsCount--;
            autopilotSpeed = 0;
            autopilotReferenceFrame = undefined;
            resolve(node);
        }, 3000); // 3 seconds
    });
}

async function neuriteSearchNotes(searchTerm, maxNodesOverride) {
    Graph.nodes.forEach(clearSearchHighlight);
    const matchedPartialNodes = await embeddedSearch(searchTerm, maxNodesOverride);

    const fullMatchedNodes = [];
    for (const partialNode of matchedPartialNodes) {
        const fullNode = Graph.nodes.find(n => n.uuid === partialNode.uuid);
        if (!fullNode) continue;

        const content = fullNode.content;
        if (content) content.classList.add("search_matched"); // highlight

        fullMatchedNodes.push(fullNode);
    }
    return fullMatchedNodes;
}


async function neuriteSearchAndZoom(searchTerm, maxNodesOverride = null, zoomLevel = 1.0, delayBetweenNodes = 2000) {
    return new Promise(async (resolve, reject) => {
        try {
            activeAnimationsCount += 1;

            // Search for nodes based on the searchTerm
            const matchedNodes = await neuriteSearchNotes(searchTerm, maxNodesOverride);

            // Loop through each matched node and zoom to it
            for (const node of matchedNodes) {
                await neuriteZoomToNodeTitle(node, zoomLevel);

                // Wait for the specified delay before moving to the next node
                await new Promise(r => setTimeout(r, delayBetweenNodes));
            }

            activeAnimationsCount -= 1;
            console.log("Search and Zoom sequence completed!", activeAnimationsCount);
            resolve(matchedNodes); // Resolve the promise with the matched nodes when the sequence is completed
        } catch (error) {
            console.error("An error occurred during the Search and Zoom sequence:", error);
            activeAnimationsCount -= 1;
            reject(error); // Reject the promise in case of an error
        }
    });
}


// Example usage
// neuriteSearchAndZoom("desired search term", null, 1.0, 3000);

function neuriteResetView(animate = true, duration = 2000) {
    return new Promise((resolve, reject) => {
        const defaultZoomMagnitude = 1.3;
        const defaultPanReal = -0.3;
        const defaultPanImaginary = 0;
        const defaultZoom = zoom.scale(defaultZoomMagnitude / zoom.mag());
        const defaultPan = new vec2(defaultPanReal, defaultPanImaginary);

        if (!animate) { // Resolve immediately
            zoom = defaultZoom;
            pan = defaultPan;
            return resolve();
        }

        function update(t){
            zoom = interpolateVec2(zoom, defaultZoom, t);
            pan = interpolateVec2(pan, defaultPan, t);
        }

        function onComplete(){
            activeAnimationsCount -= 1;
            console.log("Animation completed, count:", activeAnimationsCount);
            resolve();
        }

        activeAnimationsCount += 1;
        try {
            (new Transition(0, 1, duration, easeInOutCubic, update)).animate(onComplete)
        } catch (err) {
            console.error("Error in animation:", err);
            activeAnimationsCount -= 1;
            reject(err);
        }
    });
}
function neuriteGetMandelbrotCoords(forFunctionCall = false) {
    // Extract and format zoom and pan values
    const zoomValue = zoom.x.toExponential();
    const panReal = pan.x.toExponential();
    const panImaginary = pan.y.toExponential();

    if (forFunctionCall) {
        // Format for setMandelbrotCoords function call
        const functionCall = `setMandelbrotCoords(${zoomValue}, ${panReal}, ${panImaginary}, 0.1);`;
        return functionCall;
    } else {
        // Standard format
        return {
            zoom: zoomValue,
            pan: panReal + "+i" + panImaginary // Format: "real+iimaginary"
        };
    }
}

async function exploreBoundaryPoints({
    numPoints = 100,
    zoomLevel = 0.0005,
    randomizePan = false,
    randomizeZoom = false,
    sequential = true,
    methods = ["cardioid", "disk", "spike"],
    promptForSave = false
}) {
    const points = generateBoundaryPoints(numPoints, methods);
    const shuffledPoints = sequential ? points : shuffleArray(points);

    for (const point of shuffledPoints) {
        const effectiveZoom = randomizeZoom ? (Math.random() * zoomLevel) : zoomLevel;
        const panX = randomizePan ? (point.x + (Math.random() - 0.5) * 0.002) : point.x;
        const panY = randomizePan ? (point.y + (Math.random() - 0.5) * 0.002) : point.y;

        await setMandelbrotCoords(effectiveZoom, panX, panY, 0.1, true);

        if (promptForSave) await promptToSaveView();
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function neuriteDelay(delay) {
    return Promise.delay(delay)
}

// Verbose Schema
async function neuriteAnimationQueue(animations) {
    for (const animation of animations) {
        const { action, params, delayBefore = 0, delayAfter = 0 } = animation;

        if (delayBefore > 0) await Promise.delay(delayBefore);
        await action(...params);
        if (delayAfter > 0) await Promise.delay(delayAfter);
    }
}

// Enchanced to reduce size of request format.
async function neuriteQueueAnimations(animations) {
    // Artificially increment the animation count
    activeAnimationsCount += 1;

    const transformedAnimations = animations.map(animation => {
        // Handle case where only a single array is passed as parameters
        if (!Array.isArray(animation[1])) {
            animation[1] = [animation[1]]; // Wrap single argument into an array
        }

        return {
            action: animation[0], // Direct reference to the function
            params: animation[1],
            delayAfter: animation[2] !== undefined ? animation[2] : 0
        };
    });

    await neuriteAnimationQueue(transformedAnimations);

    // Artificially decrement the animation count
    activeAnimationsCount -= 1;
}
async function waitForAllAnimations(additionalDelay = 0) {
    return new Promise(resolve => {
        console.log("Waiting for animations to complete...");
        const checkInterval = setInterval(() => {
            console.log("Active animations count:", activeAnimationsCount);
            if (activeAnimationsCount === 0) {
                clearInterval(checkInterval);
                console.log("All animations completed. Waiting additional delay...");
                setTimeout(() => {
                    console.log("Additional delay completed.");
                    resolve();
                }, additionalDelay); // Wait for the additional delay after animations complete
            }
        }, 100); // Check every 100 milliseconds
    });
}

function neuriteCaptureScreenshot() {
    if (window.startedViaPlaywright) {
        // Playwright controlled session, use fetch to request screenshot
        fetch('http://localhost:8081/screenshot')
            .then(response => response.text())
            .then(base64Image => {
                // Create an image element from the base64 data
                const img = new Image();
                img.src = `data:image/png;base64,${base64Image}`;

                // Create and add the image node
                createImageNode(img, 'Screenshot', false); // false because it's not a direct URL
            })
            .catch(error => console.error('Error:', error));
    } else {
        // Regular session, use existing screenshot mechanism
        captureScreenshot();
    }
}

Elem.byId('screenshotButton').addEventListener('click', neuriteCaptureScreenshot);


async function neuriteReturnScreenshot() {
    return new Promise(async (resolve, reject) => {
        if (window.startedViaPlaywright) {
            // Playwright controlled session, use fetch to request screenshot
            fetch('http://localhost:8081/screenshot')
                .then(response => response.text())
                .then(base64Image => {
                    resolve("data:image/png;base64," + base64Image);
                })
                .catch(error => {
                    console.error('Error:', error);
                    reject(error);
                });
        } else {
            // If not in a Playwright session, use captureScreenToBase64
            try {
                const base64Image = await captureScreenToBase64();
                resolve(base64Image);
            } catch (error) {
                console.error("Error capturing display:", error);
                reject(error);
            }
        }
    });
}


async function neuriteCallMovementAi(movementIntention, totalIterations = 1, currentIteration = 0) {
    if (currentIteration >= totalIterations) return;

    const screenshotBase64 = await neuriteReturnScreenshot();
    if (!screenshotBase64) {
        console.log("Not in a Playwright session or unable to capture screenshot.");
        return;
    }

    const messages = [
        {
            role: 'system',
            content: neuriteNeuralVisionPrompt
        },
        {
            role: 'system',
            content: createTelemetryPrompt(neuralTelemetry, true) //set vision model to true
        },
        {
            role: 'user',
            content: [
                {
                    type: 'image_url',
                    image_url: screenshotBase64 // PNG format is already included in the return value
                }
            ]
        },
        {
            role: 'user',
            content: movementIntention
        }
    ];

    try {
        await callVisionModel(messages, async () => {
            runNeuriteCode(true); // Run code with increment and decrement of activeAnimations.

            await waitForAllAnimations();
            console.log('awaited');
            // Recursive call for the next iteration
            await neuriteCallMovementAi(movementIntention, totalIterations, currentIteration + 1);
        });
    } catch (err) {
        console.error("Error in API call:", err);
    }
}



let resolveAiMessage;
let aiMessagePromise;
let isPromiseResolved = true; // Track if the promise is resolved

function resolveAiMessageIfAppropriate(response, isError = false) {
    if ((isError || !Elem.byId('auto-mode-checkbox')?.checked) && !isPromiseResolved) {
        resolveAiMessage(response);
        isPromiseResolved = true; // Update the state to indicate promise has been resolved
    }
}

async function neuritePromptZettelkasten(message) {
    activeAnimationsCount += 1;
    isPromiseResolved = false;

    // Initialize the promise when a new message is sent
    aiMessagePromise = new Promise(resolve => {
        resolveAiMessage = resolve;
    });

    const promptTextArea = Elem.byId('prompt');
    if (!promptTextArea) {
        console.error("Prompt textarea not found.");
        return;
    }

    const form = Elem.byId('prompt-form');
    if (!form) {
        console.error("Prompt form not found.");
        return;
    }

    promptTextArea.value = message;
    const event = new Event('submit', { cancelable: true });
    form.dispatchEvent(event);

    await aiMessagePromise;

    activeAnimationsCount -= 1;
    console.log("AI message processing completed, count:", activeAnimationsCount);

    return streamedResponse;
}

function neuriteGetUserResponse(message) {
    const response = prompt(message);
    return response;
}

function neuriteAddNote(nodeTitle, nodeText) {
    return new Promise((resolve) => {
        activeAnimationsCount += 1;
        let formattedNodeTitle = nodeTitle.replace(/\n/g, ' ');
        formattedNodeTitle = neuriteGetUniqueNodeTitle(formattedNodeTitle);

        const contentToAdd = Tag.node + ' ' + formattedNodeTitle + '\n' + (nodeText ?? '');
        const codeMirror = window.currentActiveZettelkastenMirror;

        const lastLine = codeMirror.lastLine();
        const lastLineText = codeMirror.getLine(lastLine);

        let newLinesToAdd = '';
        if (lastLineText !== '') {
            newLinesToAdd = '\n\n';
        } else if (codeMirror.getLine(lastLine - 1) !== '') {
            newLinesToAdd = '\n';
        }

        const position = { line: lastLine, ch: lastLineText.length };
        processAll = true;
        codeMirror.replaceRange(newLinesToAdd + contentToAdd, position);
        processAll = false;

        ui = getZetNodeCMInstance(nodeTitle).ui;
        const node = ui.scrollToTitle(formattedNodeTitle); // returns the node

        setTimeout(() => {
            resolve(node);
            activeAnimationsCount -= 1;
        }, 300);
    });
}

function neuriteGetUniqueNodeTitle(baseTitle) {
    let counter = 2;
    let uniqueTitle = baseTitle;
    while (nodeTitles.has(uniqueTitle)) {
        uniqueTitle = baseTitle + '(' + counter + `)`;
        counter += 1;
    }
    return uniqueTitle;
}

const functionRegistry = {};

function registerFunctions(functions) {
    functions.forEach(({ baseFunctionName, baseFunction, alternateNames }) => {
        functionRegistry[baseFunctionName] = { baseFunction, alternateNames };
    });
}

function initializeFunctionMappings() {
    for (const [baseFunctionName, { baseFunction, alternateNames }] of Object.entries(functionRegistry)) {
        // Assign the base function to its name
        window[baseFunctionName] = baseFunction;

        // Assign base function to each of its alternate names
        alternateNames.forEach(alternateName => {
            window[alternateName] = baseFunction;
        });
    }
}

// Register the base function with its alternate names
registerFunctions([
    {
        baseFunctionName: 'neuriteAddNote',
        baseFunction: neuriteAddNote,
        alternateNames: ['addNote', 'createNote', 'zettelkastenAddNote', `promptNote`]
    },
    {
        baseFunctionName: 'neuritePromptZettelkasten',
        baseFunction: neuritePromptZettelkasten,
        alternateNames: ['promptZettelkasten', 'zettelkastenPrompt', 'promptZettelkastenAi', 'callZettelkastenAi', `zettelkastenAi`]
    },
    {
        baseFunctionName: 'neuriteGetUserResponse',
        baseFunction: neuriteGetUserResponse,
        alternateNames: ['getUserResponse', 'promptUser', 'requestUserResponse']
    },
    {
        baseFunctionName: 'neuriteZoomToNodeTitle',
        baseFunction: neuriteZoomToNodeTitle,
        alternateNames: ['zoomToNodeTitle', 'focusNode', 'zoomToNote', 'zoomToNoteByTitle', `zoomToNode`]
    },
    {
        baseFunctionName: 'neuriteCallMovementAi',
        baseFunction: neuriteCallMovementAi,
        alternateNames: ['callMovementAi', 'promptMovementAi', 'initiateMovementAi']
    },
    {
        baseFunctionName: 'neuriteQueueAnimations',
        baseFunction: neuriteQueueAnimations,
        alternateNames: ['queueAnimations', 'performSequence', 'neuritePerformSequence']
    },
    {
        baseFunctionName: 'neuriteResetView',
        baseFunction: neuriteResetView,
        alternateNames: ['resetView', 'returnToStart', 'reinitializeView']
    },
    {
        baseFunctionName: 'neuriteSetMandelbrotCoords',
        baseFunction: neuriteSetMandelbrotCoords,
        alternateNames: ['setMandelbrotCoords', 'updateMandelbrotPosition', 'mandelbrotCoords']
    },
    {
        baseFunctionName: 'neuriteMovement',
        baseFunction: neuriteMovement,
        alternateNames: ['movement', 'startMovement', 'performMovement']
    },
    {
        baseFunctionName: 'neuriteDelay',
        baseFunction: neuriteDelay,
        alternateNames: ['delay', 'setDelay']
    },
    {
        baseFunctionName: 'neuriteSearchNotes',
        baseFunction: neuriteSearchNotes,
        alternateNames: ['searchNotes', 'returnSearchedNodes', `searchNodes`]
    },
    {
        baseFunctionName: 'neuriteSearchAndZoom',
        baseFunction: neuriteSearchAndZoom,
        alternateNames: ['searchAndZoom', 'searchZoom', `zoomToRelevantNodes`]
    },
]);



function buildFunctionNameList() {
    let allFunctionNames = [];
    for (const [baseFunctionName, { alternateNames }] of Object.entries(functionRegistry)) {
        allFunctionNames.push(baseFunctionName);

        if (alternateNames && Array.isArray(alternateNames)) {
            allFunctionNames.push(...alternateNames);
        }
    }
    return allFunctionNames;
}

// Initialize and build the list
initializeFunctionMappings();
const functionNameList = buildFunctionNameList();
//console.log(functionNameList);
