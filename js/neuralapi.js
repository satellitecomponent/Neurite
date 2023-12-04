function animateTransition(startValue, endValue, duration, updateFunction, easingFunction, onComplete) {
    const startTime = Date.now();

    function step() {
        const currentTime = Date.now();
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        const easedProgress = easingFunction(progress);

        updateFunction(easedProgress);

        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            onComplete && onComplete();
        }
    }

    requestAnimationFrame(step);
}

function interpolate(startValue, endValue, t) {
    return startValue + (endValue - startValue) * t;
}

// Use logarithmic interpolate for zoom instead of...  (a,b,t) => interpolateVec2(a.clog(),b.clog(),t).cexp()
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

    activeAnimationsCount++;

    // Starting states
    const startZoom = zoom;
    const startPan = pan;

    // Calculate final states for zoom and pan
    const destZoom = toZ(new vec2(zoomX, zoomY));
    const adjustedZoomFactor = zoomFactor; // Always use the reciprocal
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

        // Interpolate rotation
        const currentRotation = interpolate(startRotation, endRotation, t);
        const pivot = toZ(new vec2(pivotX, pivotY));
        const zc = pivot.minus(pan);
        const r = new vec2(Math.cos(currentRotation), Math.sin(currentRotation));
        zoom = zoom.cmult(r);
        pan = pan.plus(zc.cmult(new vec2(1, 0).minus(r)));

        updateViewbox();
        }, easeInOutCubic, () => {
            activeAnimationsCount--; // Decrement on animation completion
            console.log("Animation completed, count:", activeAnimationsCount);
        });
    } catch (error) {
        console.error("Error in animation:", error);
        activeAnimationsCount--; // Ensure decrement even in case of error
    }
}

function neuriteGetMandelbrotCoords() {
    return {
        zoom: zoom.x.toString(), // Assuming zoom is a scalar and only has a real part
        pan: pan.x.toString() + "+i" + pan.y.toString() // Format: "real+iimaginary"
    };
}
/*
panTo = new vec2(0, 0); //this.pos;
let gz = zoom.mag2() * ((this.scale * s) ** (-1 / settings.zoomContentExp));
zoomTo = zoom.unscale(gz ** 0.5);
autopilotReferenceFrame = this;
panToI = new vec2(0, 0); */

function neuriteSetMandelbrotCoords(zoomMagnitude, panReal, panImaginary, duration = 2000, animate = true,) {
    const newZoomMagnitude = parseFloat(zoomMagnitude);
    const newPanReal = parseFloat(panReal);
    const newPanImaginary = parseFloat(panImaginary);
    const startZoom = zoom;

    if (animate) {
        activeAnimationsCount++;
        // Animate the transition to the new zoom and pan values
        const targetZoom = zoom.scale(newZoomMagnitude / zoom.mag());
        const targetPan = new vec2(newPanReal, newPanImaginary);

        autopilotSpeed = 0.1
        try {
            animateTransition(0, 1, duration, (t) => {
            //zoom = linterpolateVec2(startZoom.clog(), targetZoom.clog(), t).cexp();
            //pan = interpolateVec2(pan, targetPan, t);
                zoomTo = targetZoom;
                panTo = targetPan;
            }, easeInOutCubic, () => {
                activeAnimationsCount--; // Decrement on animation completion
                console.log("Animation completed, count:", activeAnimationsCount);
            });
        } catch (error) {
            console.error("Error in animation:", error);
            activeAnimationsCount--; // Ensure decrement even in case of error
        }
    } else {
        // Directly set the new zoom and pan values
        if (newZoomMagnitude !== 0) {
            zoom = zoom.scale(newZoomMagnitude / zoom.mag());
        }
        pan = new vec2(newPanReal, newPanImaginary);
    }
}

function neuriteResetView(animate = true, duration = 2000) {
    // Default zoom and pan values
    const defaultZoomMagnitude = 1.5;
    const defaultPanReal = -0.3;
    const defaultPanImaginary = 0;

    const defaultZoom = zoom.scale(defaultZoomMagnitude / zoom.mag());
    const defaultPan = new vec2(defaultPanReal, defaultPanImaginary);

    if (animate) {
        activeAnimationsCount++;
        // Animate back to the default view
        try {
            animateTransition(0, 1, duration, (t) => {
            zoom = interpolateVec2(zoom, defaultZoom, t);
            pan = interpolateVec2(pan, defaultPan, t);
            }, easeInOutCubic, () => {
                activeAnimationsCount--; // Decrement on animation completion
                console.log("Animation completed, count:", activeAnimationsCount);
            });
        } catch (error) {
            console.error("Error in animation:", error);
            activeAnimationsCount--; // Ensure decrement even in case of error
        }
    } else {
        // Directly set the new zoom and pan values
        zoom = defaultZoom;
        pan = defaultPan;
    }
}

function neuriteSaveCurrentView() {
    const savedView = { zoom: zoom, pan: pan };
    // Store savedView in a way that can be accessed later
}

function neuriteReturnToSavedView(savedView, animate = true, duration = 2000) {
    if (savedView) {
        neuriteSetMandelbrotCoords(savedView.zoom, savedView.pan.x, savedView.pan.y, animate, duration);
    }
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

document.getElementById('screenshotButton').addEventListener('click', neuriteCaptureScreenshot);


async function neuriteReturnScreenshot() {
    return new Promise(async (resolve, reject) => {
        if (window.startedViaPlaywright) {
            // Playwright controlled session, use fetch to request screenshot
            fetch('http://localhost:8081/screenshot')
                .then(response => response.text())
                .then(base64Image => {
                    resolve(`${base64Image}`);
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

async function neuriteCallMovementAi(movementIntention, totalIterations = 1, currentIteration = 0) {
    if (currentIteration < totalIterations) {
        const screenshotBase64 = await neuriteReturnScreenshot();

        if (screenshotBase64) {

            const neuralTelemetryPrompt = createTelemetryPrompt(neuralTelemetry);

            let messages = [
                {
                    role: 'system',
                    content: neuriteVisionPrompt
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
                    runNeuriteCode(); // Execute the code

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


function neuriteZoomToNodeTitle(nodeTitle, zoomLevel = 1.5) {
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
            // Use alternative zoom method if the bounding rectangle does not exist (allows best of both options, i.e. zoomto with exact height calculations when available, and when not currently in the viewport, a set value.)
            node.zoom_to(.5);
        }
        autopilotSpeed = settings.autopilotSpeed;
    }
}

function neuritePromptZettelkasten(message) {
    // Locate the textarea within the form
    const promptTextArea = document.getElementById('prompt');
    if (!promptTextArea) {
        console.error('Prompt textarea not found.');
        return;
    }

    // Set the message as the value of the textarea
    promptTextArea.value = message;

    // Programmatically trigger the submit event
    const form = document.getElementById('prompt-form');
    if (form) {
        const event = new Event('submit', { cancelable: true });
        form.dispatchEvent(event);
    } else {
        console.error('Prompt form not found.');
    }
}

function neuriteAddNote(message) {
}