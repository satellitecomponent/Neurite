function animateTransition(startValue, endValue, duration, updateFunction, easingFunction, onComplete, completionCheck) {
    const startTime = Date.now();

    function step() {
        const currentTime = Date.now();
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        const easedProgress = easingFunction(progress);

        updateFunction(easedProgress);

        if (completionCheck) {
            // If completionCheck is provided, continue animation until it returns true
            if (!completionCheck()) {
                requestAnimationFrame(step);
            } else {
                onComplete && onComplete(); // Call onComplete when completionCheck is true
            }
        } else {
            // If completionCheck is not provided, use duration-based completion
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                onComplete && onComplete();
            }
        }
    }

    requestAnimationFrame(step);
}

function interpolate(startValue, endValue, t) {
    return startValue + (endValue - startValue) * t;
}

// Use logarithmic interpolate for zoom  (a,b,t) => interpolateVec2(a.clog(),b.clog(),t).cexp()
function interpolateVec2(startVec, endVec, t) {
    return new vec2(
        interpolate(startVec.x, endVec.x, t),
        interpolate(startVec.y, endVec.y, t)
    );
}

const linterpolateVec2 = (a, b, t) => interpolateVec2(a.clog(), b.clog(), t).cexp()

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}



function neuriteZoom(zoomFactor, targetX = window.innerWidth / 2, targetY = window.innerHeight / 2, duration = 1000) {
    const dest = toZ(new vec2(targetX, targetY));
    const adjustedZoomFactor = 1 / zoomFactor;

    const startZoom = zoom;
    const endZoom = startZoom.scale(adjustedZoomFactor);
    const startPan = pan;
    const endPan = dest.scale(1 - adjustedZoomFactor).plus(startPan.scale(adjustedZoomFactor));

    animateTransition(0, 1, duration, (t) => {
        zoom = linterpolateVec2(startZoom.clog(), endZoom.clog(), t).cexp();
        pan = interpolateVec2(startPan, endPan, t);
        updateViewbox();
    }, easeInOutCubic);
}

function neuritePan(deltaX, deltaY, duration = 1000) {
    const dp = toDZ(new vec2(deltaX, deltaY).scale(settings.panSpeed));
    const startPan = pan;
    const endPan = startPan.plus(dp);

    animateTransition(0, 1, duration, (t) => {
        pan = interpolateVec2(startPan, endPan, t);
        updateViewbox();
    }, easeInOutCubic);
}

function neuriteRotate(rotationAngle, pivotX, pivotY, duration = 1000) {
    const p = toZ(new vec2(pivotX, pivotY));
    const zc = p.minus(pan);
    const r = new vec2(Math.cos(rotationAngle), Math.sin(rotationAngle));
    const startZoom = zoom;
    const endZoom = startZoom.cmult(r);
    const startPan = pan;
    const endPan = startPan.plus(zc.cmult(new vec2(1, 0).minus(r)));

    animateTransition(0, 1, duration, (t) => {
        zoom = linterpolateVec2(startZoom.clog(), endZoom.clog(), t).cexp();
        pan = interpolateVec2(startPan, endPan, t);
        updateViewbox();
    }, easeInOutCubic);
}

let activeAnimationsCount = 0;

const defaultMovements = {
    panLeft: { panParams: { deltaX: -200, deltaY: 0 } },
    panRight: { panParams: { deltaX: 200, deltaY: 0 } },
    panUp: { panParams: { deltaX: 0, deltaY: -150 } },
    panDown: { panParams: { deltaX: 0, deltaY: 150 } },
    zoomIn: { zoomParams: { zoomFactor: 0.3 } },
    zoomOut: { zoomParams: { zoomFactor: 3 } },
    // Add more default movements as needed
};

function neuriteMovement(movementTypes = [], customZoomParams = {}, customPanParams = {}, customRotateParams = {}, customDuration = 1000) {
    return new Promise((resolve, reject) => {
        activeAnimationsCount++;

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

        // Extract parameters with defaults
        const { zoomFactor = 1, zoomX = window.innerWidth / 2, zoomY = window.innerHeight / 2 } = combinedZoomParams;
        const { deltaX = 0, deltaY = 0 } = combinedPanParams;
        const { rotationAngle = 0, pivotX = window.innerWidth / 2, pivotY = window.innerHeight / 2 } = combinedRotateParams;

        // Determine if rotation is needed
        const isRotationNeeded = rotationAngle !== 0;

        // Starting states
        const startZoom = zoom;
        const startPan = pan;

        // Calculate final states for zoom and pan
        const destZoom = toZ(new vec2(zoomX, zoomY));
        const adjustedZoomFactor = zoomFactor;
        const finalZoom = startZoom.scale(adjustedZoomFactor);
        const dp = toDZ(new vec2(deltaX, deltaY).scale(settings.panSpeed));
        const finalPan = destZoom.scale(1 - adjustedZoomFactor).plus(startPan.scale(adjustedZoomFactor)).plus(dp);

        // Rotation calculations
        const startRotation = 0; // Assuming the rotation starts from 0
        const endRotation = rotationAngle * Math.PI / 180; // Convert degrees to radians

        // Animation
        try {
            animateTransition(0, 1, duration, (t) => {
                // Interpolate zoom and pan
                zoom = linterpolateVec2(startZoom.clog(), finalZoom.clog(), t).cexp();
                pan = interpolateVec2(startPan, finalPan, t);

                // Apply rotation only if needed
                if (isRotationNeeded) {
                    const currentRotation = interpolate(startRotation, endRotation, t);
                    const pivot = toZ(new vec2(pivotX, pivotY));
                    const zc = pivot.minus(pan);
                    const r = new vec2(Math.cos(currentRotation), Math.sin(currentRotation));
                    zoom = zoom.cmult(r);
                    pan = pan.plus(zc.cmult(new vec2(1, 0).minus(r)));
                }

                updateViewbox();
            }, easeInOutCubic, () => {
                activeAnimationsCount--;
                console.log("Animation completed, count:", activeAnimationsCount);
                resolve(); // Resolve the promise when the animation completes
            });
        } catch (error) {
            console.error("Error in animation:", error);
            activeAnimationsCount--;
            reject(error); // Reject the promise in case of an error
        }
    });
}


/*
panTo = new vec2(0, 0); //this.pos;
let gz = zoom.mag2() * ((this.scale * s) ** (-1 / settings.zoomContentExp));
zoomTo = zoom.unscale(gz ** 0.5);
autopilotReferenceFrame = this;
panToI = new vec2(0, 0); */


function neuriteSetMandelbrotCoords(zoomMagnitude, panReal, panImaginary, speed = 0.1, animate = true) {
    return new Promise((resolve) => {
        const newZoomMagnitude = parseFloat(zoomMagnitude);
        const newPanReal = parseFloat(panReal);
        const newPanImaginary = parseFloat(panImaginary);

        if (animate) {
            activeAnimationsCount++;
            autopilotReferenceFrame = undefined;
            const targetZoom = zoom.scale(newZoomMagnitude / zoom.mag());
            const targetPan = new vec2(newPanReal, newPanImaginary);

            if (speed > 1) {
                autopilotSpeed = settings.autopilotSpeed;
            } else {
                autopilotSpeed = speed; // Use provided speed if within acceptable range
            }

            // duration does not matter here
            const duration = 1;

            try {
                animateTransition(0, 1, duration, (t) => {
                    zoomTo = targetZoom;
                    panTo = targetPan;
                }, easeInOutCubic, () => {
                    activeAnimationsCount--;
                    autopilotSpeed = 0;
                    console.log("Animation completed, count:", activeAnimationsCount);
                    resolve(); // Resolve the promise on completion
                }, () => {
                    return zoom.closeEnough(targetZoom, autopilotThreshold) && pan.closeEnough(targetPan, autopilotThreshold);
                });
            } catch (error) {
                console.error("Error in animation:", error);
                activeAnimationsCount--;
                autopilotSpeed = 0;
                autopilotReferenceFrame = undefined;
            }
        } else {
            // Directly set the new zoom and pan values
            if (newZoomMagnitude !== 0) {
                zoom = zoom.scale(newZoomMagnitude / zoom.mag());
            }
            pan = new vec2(newPanReal, newPanImaginary);
            resolve(); // Resolve immediately for non-animated change
        }
    });
}

const autopilotThreshold = 0.000001; // Define a suitable threshold

// Helper function to check if two vectors are close enough (within a threshold)
vec2.prototype.closeEnough = function (target, autopilotThreshold) {
    return this.minus(target).mag() < autopilotThreshold;
};


function neuriteResetView(animate = true, duration = 2000) {
    return new Promise((resolve, reject) => {
        const defaultZoomMagnitude = 1.3;
        const defaultPanReal = -0.3;
        const defaultPanImaginary = 0;

        const defaultZoom = zoom.scale(defaultZoomMagnitude / zoom.mag());
        const defaultPan = new vec2(defaultPanReal, defaultPanImaginary);

        if (animate) {
            activeAnimationsCount++;
            try {
                animateTransition(0, 1, duration, (t) => {
                    zoom = interpolateVec2(zoom, defaultZoom, t);
                    pan = interpolateVec2(pan, defaultPan, t);
                }, easeInOutCubic, () => {
                    activeAnimationsCount--;
                    console.log("Animation completed, count:", activeAnimationsCount);
                    resolve(); // Resolve the promise when the animation completes
                });
            } catch (error) {
                console.error("Error in animation:", error);
                activeAnimationsCount--;
                reject(error); // Reject the promise in case of an error
            }
        } else {
            zoom = defaultZoom;
            pan = defaultPan;
            resolve(); // Resolve immediately for non-animated changes
        }
    });
}

function neuriteGetMandelbrotCoords(forFunctionCall = false) {
    // Extract and format zoom and pan values
    const zoomValue = zoom.x.toString();
    const panReal = pan.x.toString();
    const panImaginary = pan.y.toString();

    if (forFunctionCall) {
        // Format for setMandelbrotCoords function call
        const functionCall = `setMandelbrotCoords(${zoomValue}, ${panReal}, ${panImaginary}, 0.1, true);`;
        return functionCall;
    } else {
        // Standard format
        return {
            zoom: zoomValue,
            pan: panReal + "+i" + panImaginary // Format: "real+iimaginary"
        };
    }
}

function neuriteReceiveCurrentView() {
    // Get current coordinates in standard format
    const standardCoords = neuriteGetMandelbrotCoords();

    // Get current coordinates in function call format
    const functionCallFormat = neuriteGetMandelbrotCoords(true);

    // Prompt user for a title for the saved view
    const title = prompt("Enter a title for the saved view:");

    // Return an object containing the title, standard format, and function call
    return {
        title: title,
        standardCoords: standardCoords,
        functionCall: functionCallFormat
    };
}


const defaultSavedViews = [
    // Example format for each saved view
    {
        title: "Default View 1",
        standardCoords: { zoom: "1.0", pan: "0.0+i0.0" },
        functionCall: "setMandelbrotCoords(1.0, 0.0, 0.0, true, 0.1);"
    },
    // Add more predefined views here
];

function generateCopyPasteSavedViews() {
    return JSON.stringify(savedViews, null, 2);
}

let savedViews = [...defaultSavedViews];

function neuriteSaveCurrentView() {
    const view = neuriteReceiveCurrentView();
    savedViews.push(view);
    console.log("View saved:", view.title);
}



function neuriteReturnToSavedView(savedView, animate = true, speed = 0.1) {
    if (savedView && savedView.standardCoords) {
        // Extract real and imaginary parts from pan
        const panParts = savedView.standardCoords.pan.split('+i');
        const panReal = parseFloat(panParts[0]);
        const panImaginary = panParts.length > 1 ? parseFloat(panParts[1]) : 0;

        // Call neuriteSetMandelbrotCoords with the parsed coordinates
        neuriteSetMandelbrotCoords(
            parseFloat(savedView.standardCoords.zoom),
            panReal,
            panImaginary,
            animate,
            speed
        );
    } else {
        console.log("Saved view not found or invalid:", savedView);
    }
}

function listSavedViews() {
    return savedViews.map(v => v.title);
}

function selectAndReturnToSavedView(animate = true, speed = 0.1) {
    // List saved view titles and prompt user to select one
    const titles = listSavedViews();
    console.log("Saved Views:", titles.join(", "));
    const selectedTitle = prompt("Enter the title of the view to return to:");

    // Find the saved view with the selected title
    const selectedView = savedViews.find(v => v.title === selectedTitle);

    // Return to the selected view with specified animation settings
    if (selectedView) {
        neuriteReturnToSavedView(selectedView, animate, speed);
    } else {
        console.log("View not found with title:", selectedTitle);
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

        if (promptForSave) {
            await promptToSaveView();
        }
    }
}

async function promptToSaveView() {
    const save = confirm("Save this view?");
    if (save) {
        neuriteSaveCurrentView();
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
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



async function neuriteAnimationQueue(animations) {
    for (const animation of animations) {
        const { action, params, delayBefore = 0, delayAfter = 0 } = animation;

        // Delay before the animation
        if (delayBefore > 0) {
            await new Promise(resolve => setTimeout(resolve, delayBefore));
        }

        // Execute the animation with spread parameters
        await action(...params);

        // Delay after the animation
        if (delayAfter > 0) {
            await new Promise(resolve => setTimeout(resolve, delayAfter));
        }

    }
}

async function neuriteQueueAnimations(animations) {
    // Artificially increment the animation count
    activeAnimationsCount++;

    const transformedAnimations = animations.map(animation => {
        // Handle case where only a single array is passed as parameters
        if (!Array.isArray(animation[1])) {
            animation[1] = [animation[1]]; // Wrap single argument into an array
        }

        return {
            action: animation[0], // Direct reference to the function
            params: animation[1],
            delayAfter: animation[2] !== undefined ? animation[2] : 0 // Default delay to 0 if not provided
        };
    });

    await neuriteAnimationQueue(transformedAnimations);

    // Artificially decrement the animation count
    activeAnimationsCount--;
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

document.getElementById('screenshotButton').addEventListener('click', neuriteCaptureScreenshot);


async function neuriteReturnScreenshot() {
    return new Promise(async (resolve, reject) => {
        if (window.startedViaPlaywright) {
            // Playwright controlled session, use fetch to request screenshot
            fetch('http://localhost:8081/screenshot')
                .then(response => response.text())
                .then(base64Image => {
                    resolve(`data:image/png;base64,${base64Image}`);
                })
                .catch(error => {
                    console.error('Error:', error);
                    reject(error);
                });
        } else {
            // If not in a Playwright session, use captureScreenToBase64
            try {
                const base64Image = await captureScreenToBase64();
                resolve(`${base64Image}`);
            } catch (error) {
                console.error('Error capturing display:', error);
                reject(error);
            }
        }
    });
}

async function neuriteCallMovementAi(movementIntention, totalIterations = 1, currentIteration = 0) {
    if (currentIteration < totalIterations) {
        const screenshotBase64 = await neuriteReturnScreenshot();

        if (screenshotBase64) {

            const neuralTelemetryPrompt = createTelemetryPrompt(neuralTelemetry, true); //set vision model to true

            let messages = [
                {
                    role: 'system',
                    content: neuriteNeuralVisionPrompt
                },
                {
                    role: 'system',
                    content: neuralTelemetryPrompt
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

                    // Wait for all animations to complete
                    await waitForAllAnimations();
                    console.log(`awaited`);
                    // Recursive call for the next iteration
                    await neuriteCallMovementAi(movementIntention, totalIterations, currentIteration + 1);
                });
            } catch (error) {
                console.error("Error in API call:", error);
            }
        } else {
            console.log("Not in a Playwright session or unable to capture screenshot.");
        }
    }
}



/* 

const autopilotThreshold2 = 0.1;
function neuriteZoomToNodeTitle(nodeTitle, zoomLevel = 1.5) {
    return new Promise((resolve, reject) => {
        const cm = window.myCodemirror;
        const node = scrollToTitle(nodeTitle, cm);
        if (!node) {
            reject("Node not found");
            return;
        }

        let bb = node.content.getBoundingClientRect();
        if (bb && bb.width > 0 && bb.height > 0) {
            node.zoom_to_fit();
        } else {
            node.zoom_to(.5);
        }

        autopilotSpeed = settings.autopilotSpeed;

        // Set initial zoom and pan targets
        const targetZoom = zoom.scale(zoomLevel); // Assuming 'zoom' is the current zoom level
        const targetPan = autopilotReferenceFrame ? autopilotReferenceFrame.pos.plus(panTo) : panTo; // Assuming 'panTo' is the target pan position

        // Function to check if zoom and pan targets are reached
        function checkTargetReached() {
            let currentZoom = zoom; // Assuming 'zoom' is the current zoom level
            let currentPan = pan; // Assuming 'pan' is the current pan position

            // Check if the current zoom and pan are close enough to the targets
            return currentZoom.closeEnough(targetZoom, autopilotThreshold2) &&
                currentPan.closeEnough(targetPan, autopilotThreshold2);
        }

        // Interval to check if target is reached
        const checkInterval = setInterval(() => {
            if (checkTargetReached()) {
                clearInterval(checkInterval);
                resolve("Zoom and pan complete");
            }
        }, 100); // Polling interval

        // Set a timeout as a fallback
        setTimeout(() => {
            clearInterval(checkInterval);
            reject("Zoom and pan operation timed out");
        }, 10000); // Timeout duration
    });
}

*/


function neuriteZoomToNodeTitle(nodeTitle, zoomLevel = 1.0) {
    return new Promise((resolve, reject) => {
        activeAnimationsCount++;
        autopilotReferenceFrame = undefined;
        const cm = window.myCodemirror;
        // Scroll to the title
        const node = scrollToTitle(nodeTitle, cm);
        if (node) {
            let bb = node.content.getBoundingClientRect();

            // Check if the bounding rectangle exists
            if (bb && bb.width > 0 && bb.height > 0) {
                // Zoom to fit the node if the bounding rectangle exists
                node.zoom_to_fit();
                zoomTo = zoomTo.scale(1.5);
            } else {
                // Use alternative zoom method if the bounding rectangle does not exist
                node.zoom_to(.5);
            }
            autopilotSpeed = settings.autopilotSpeed;
        }

        // Resolve the promise after 4 seconds
        setTimeout(() => {
            activeAnimationsCount--;
            autopilotSpeed = 0;
            autopilotReferenceFrame = undefined;
            console.log("Animation completed, count:", activeAnimationsCount);
            resolve();
        }, 4000);
    });
}

let resolveAiMessage;
let aiMessagePromise;
let isPromiseResolved = true; // Track if the promise is resolved

function resolveAiMessageIfAppropriate(response, isError = false) {
    if ((isError || !document.getElementById("auto-mode-checkbox")?.checked) && !isPromiseResolved) {
        resolveAiMessage(response);
        isPromiseResolved = true; // Update the state to indicate promise has been resolved
    }
}

async function neuritePromptZettelkasten(message) {
    activeAnimationsCount++;
    isPromiseResolved = false;

    // Initialize the promise when a new message is sent
    aiMessagePromise = new Promise(resolve => {
        resolveAiMessage = resolve;
    });

    // Set the message and trigger the submit event
    const promptTextArea = document.getElementById('prompt');
    const form = document.getElementById('prompt-form');
    if (!promptTextArea) {
        console.error('Prompt textarea not found.');
        return;
    }
    if (!form) {
        console.error('Prompt form not found.');
        return;
    }

    promptTextArea.value = message;
    const event = new Event('submit', { cancelable: true });
    form.dispatchEvent(event);

    // Wait for the promise to resolve and get the full streamed response
    await aiMessagePromise;

    // Decrement the count after the promise is resolved
    activeAnimationsCount--;
    console.log("AI message processing completed, count:", activeAnimationsCount);

    // Access the full streamed response
    return streamedResponse;
}

function neuriteGetUserResponse(message) {
    // Display a prompt dialog with the specified message
    let userResponse = prompt(message);

    // Return the response
    return userResponse;
}


function neuriteAddNote(nodeTitle, nodeText) {
    return new Promise((resolve) => {
        let formattedNodeTitle = nodeTitle.replace(/\n/g, ' ');
        formattedNodeTitle = neuriteGetUniqueNodeTitle(formattedNodeTitle);

        if (nodeText === undefined || nodeText === null) {
            nodeText = '';
        }

        let contentToAdd = nodeTag + ' ' + formattedNodeTitle + '\n' + nodeText;
        let codeMirror = window.myCodemirror;

        let lastLine = codeMirror.lastLine();
        let lastLineText = codeMirror.getLine(lastLine);
        let secondLastLineText = codeMirror.getLine(lastLine - 1);

        let newLinesToAdd = '';
        if (lastLineText !== '') {
            newLinesToAdd = '\n\n';
        } else if (secondLastLineText !== '') {
            newLinesToAdd = '\n';
        }

        let position = { line: lastLine, ch: lastLineText.length };
        processAll = true;
        codeMirror.replaceRange(newLinesToAdd + contentToAdd, position);
        processAll = false;

        scrollToTitle(formattedNodeTitle, codeMirror); // returns the node

        // Resolve the promise after a short timeout
        setTimeout(() => resolve(formattedNodeTitle), 300);
    });
}

function neuriteGetUniqueNodeTitle(baseTitle) {
    let counter = 2;
    let uniqueTitle = baseTitle;
    while (nodeTitleToLineMap.has(uniqueTitle)) {
        uniqueTitle = `${baseTitle}(${counter})`;
        counter++;
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
        alternateNames: ['addNote', 'createNote', 'zettelkastenAddNote']
    },
    {
        baseFunctionName: 'neuritePromptZettelkasten',
        baseFunction: neuritePromptZettelkasten,
        alternateNames: ['promptZettelkasten', 'zettelkastenPrompt', 'promptZettelkastenAi', 'callZettelkastenAi']
    },
    {
        baseFunctionName: 'neuriteGetUserResponse',
        baseFunction: neuriteMovement,
        alternateNames: ['getUserResponse', 'promptUser', 'requestUserResponse']
    },
    {
        baseFunctionName: 'neuriteZoomToNodeTitle',
        baseFunction: neuriteZoomToNodeTitle,
        alternateNames: ['zoomToNodeTitle', 'focusNode', 'zoomToNote']
    },
    {
        baseFunctionName: 'neuriteCallMovementAi',
        baseFunction: neuriteCallMovementAi,
        alternateNames: ['callMovementAi', 'promptMovementAi', 'initiateMovementAi']
    },
    {
        baseFunctionName: 'neuriteQueueAnimations',
        baseFunction: neuriteQueueAnimations,
        alternateNames: ['queueAnimations', 'performSequence', 'sequenceAnimations']
    },
    {
        baseFunctionName: 'neuriteResetView',
        baseFunction: neuriteResetView,
        alternateNames: ['resetView', 'returnToStart', 'reinitializeView']
    },
    {
        baseFunctionName: 'neuriteSetMandelbrotCoords',
        baseFunction: neuriteSetMandelbrotCoords,
        alternateNames: ['setMandelbrotCoords', 'updateMandelbrotPosition', 'changeMandelbrotCoords']
    },
    {
        baseFunctionName: 'neuriteMovement',
        baseFunction: neuriteMovement,
        alternateNames: ['movement', 'startMovement', 'performMovement']
    }
    // Add any additional functions and their alternate names here...
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