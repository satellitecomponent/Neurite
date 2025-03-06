// If funcUpdate depends on requestAnimationFrame, duration should be positive.
Promise.forAnimation = function(name, duration, funcUpdate, funcIsComplete){
    return (new Animation(duration, funcUpdate, funcIsComplete))
    .executeProm(name)
}

class Animation {
    static activeCount = 0;
    funcEase = easeInOutCubic;
    name = "unnamed";
    reject = Function.nop;
    resolve = Function.nop;
    startTime = Date.now();
    // startValue = 0;
    // endValue = 1;
    constructor(duration, funcUpdate, funcIsComplete){
        this.duration = duration;
        this.funcUpdate = funcUpdate;
        this.funcIsComplete = funcIsComplete || Animation.onDurationCompleted;

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
        Svg.updateViewbox(pan, zoom);
    }
    static onDurationCompleted(progress){ return progress >= 1 }
    onStep = ()=>{
        let res;
        const progress = Math.min((Date.now() - this.startTime) / this.duration, 1);
        try {
            res = this.funcUpdate.call(this, this.funcEase(progress));
        } catch (err) {
            if (!this.reject) throw(err);

            return this.onError(err);
        }
        if (!this.funcIsComplete(progress)) {
            requestAnimationFrame(this.onStep);
            return;
        }
        if (!this.resolve) return;

        this.onComplete(res);
    }
    onComplete(res){
        Animation.activeCount -= 1;
        Logger.info(this.name, "completed, left:", Animation.activeCount);
        this.resolve(res);
    }
    onError(err){
        Animation.activeCount -= 1;
        Logger.err("In", this.name, "animation:", err);
        this.reject(err);
    }
    execute(){ requestAnimationFrame(this.onStep) }
    executeProm(name = "unnamed"){
        this.name = name;
        return new Promise( (resolve, reject)=>{
            this.resolve = resolve;
            this.reject = reject;
            Animation.activeCount += 1;
            if (this.duration > 0) return this.execute();

            const onError = this.onError.bind(this);
            const onComplete = this.onComplete.bind(this);
            this.funcUpdate().then(onComplete).catch(onError);
        });
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

    (new Animation(duration, Animation.interpolateZoomAndPan))
    .setParams(pan, endPan, zoom, endZoom).execute();
}

function neuritePan(deltaX, deltaY, duration = 1000) {
    const dp = toDZ(new vec2(deltaX, deltaY).scale(settings.panSpeed));
    const endPan = pan.plus(dp);

    (new Animation(duration, Animation.interpolateZoomAndPan))
    .setParams(pan, endPan).execute();
}

function neuriteRotate(rotationAngle, pivotX, pivotY, duration = 1000) {
    const p = toZ(new vec2(pivotX, pivotY));
    const zc = p.minus(pan);
    const r = new vec2(Math.cos(rotationAngle), Math.sin(rotationAngle));
    const endPan = pan.plus(zc.cmult(new vec2(1, 0).minus(r)));
    const endZoom = zoom.cmult(r);

    (new Animation(duration, Animation.interpolateZoomAndPan))
    .setParams(pan, endPan, zoom, endZoom).execute();
}

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

function neuriteMovement(movements = [], cz = {}, cp = {}, cr = {}, d = 1000) {
    movements = [].concat(movements);
    const { z, p, r, duration } = movements.reduce(
      (acc, m) => {
        const def = defaultMovements[m] || {};
        if (def.zoomParams) Object.assign(acc.z, def.zoomParams);
        if (def.panParams) Object.assign(acc.p, def.panParams);
        if (def.rotateParams?.rotationAngle !== undefined) Object.assign(acc.r, def.rotateParams);
        acc.duration = def.duration || acc.duration;
        return acc;
      },
      { z: {}, p: {}, r: {}, duration: d }
    );
    Object.assign(z, cz);
    Object.assign(p, cp);
    Object.assign(r, "rotationAngle" in cr ? cr : {});
    let endPan = Object.keys(p).length
        ? pan.plus(toDZ(new vec2(p.deltaX || 0, p.deltaY || 0).scale(settings.panSpeed)))
        : pan;
    let endZoom = zoom;
    const { zoomFactor = 1, zoomX = window.innerWidth / 2, zoomY = window.innerHeight / 2 } = z;
    ({ endPan, endZoom } =
      Object.keys(z).length && zoomFactor !== 1
        ? {
            endPan: toZ(new vec2(zoomX, zoomY))
              .scale(1 - zoomFactor)
              .plus(endPan.scale(zoomFactor)),
            endZoom: zoom.scale(zoomFactor)
          }
        : { endPan, endZoom }
    );
    return new Animation(duration, Animation.interpolateZoomAndPan)
      .setParams(pan, endPan, zoom, endZoom, Object.keys(r).length ? r : null)
      .executeProm("Movement");
  }

/*
panTo = new vec2(0, 0); //this.pos;
let gz = zoom.mag2() * ((this.scale * s) ** (-1 / settings.zoomContentExp));
zoomTo = zoom.unscale(gz ** 0.5);
autopilotReferenceFrame = this;
panToI = new vec2(0, 0); */

function neuriteSetMandelbrotCoords(zoomMagnitude, panReal, panImaginary, speed = 0.1) {
    let animate = true;

    const newZoomMagnitude = parseFloat(zoomMagnitude);
    const newPanReal = parseFloat(panReal);
    const newPanImaginary = parseFloat(panImaginary);

    if (!animate) { // Resolve immediately
        // Directly set the new zoom and pan values
        if (newZoomMagnitude !== 0) {
            zoom = zoom.scale(newZoomMagnitude / zoom.mag());
        }
        pan = new vec2(newPanReal, newPanImaginary);
        return Promise.resolve();
    }

    const targetZoom = zoom.scale(newZoomMagnitude / zoom.mag());
    const targetPan = new vec2(newPanReal, newPanImaginary);
    return (new Animation.SetCoords(targetPan, targetZoom, speed)).promise();
}
Animation.SetCoords = class {
    constructor(targetPan, targetZoom, speed){
        this.targetPan = targetPan;
        this.targetZoom = targetZoom;
        this.speed = speed;
    }
    promise(){
        const speed = this.speed;
        autopilotSpeed = (speed > 1 ? settings.autopilotSpeed : speed);
        autopilotReferenceFrame = undefined;

        return Promise.forAnimation("Set Coords", 1, this.update, this.isComplete) // positive duration
        .finally(resetAutopilot);
    }
    update = (t)=>{
        // Regular animation steps
        const targetZoom = this.targetZoom;
        const currentZoom = zoom.mag();
        const stepZoom = currentZoom + (targetZoom.mag() - currentZoom) * t;

        // Ensure zoom does not undershoot or overshoot
        if (Math.abs(stepZoom - targetZoom.mag()) < autopilotThreshold) {
            zoomTo = targetZoom;
        } else {
            zoomTo = zoom.scale(stepZoom / currentZoom);
        }

        const stepPanX = pan.x + (this.targetPan.x - pan.x) * t;
        const stepPanY = pan.y + (this.targetPan.y - pan.y) * t;
        panTo = new vec2(stepPanX, stepPanY);
    }
    isComplete = ()=>{
        if (autopilotSpeed === 0) {
            Logger.info("Animation interrupted by user interaction.");
            return true;
        }

        const res = zoom.closeEnough(this.targetZoom, autopilotThreshold)
                 && pan.closeEnough(this.targetPan, autopilotThreshold);
        if (res) { // If close-enough, equate them
            pan = this.targetPan;
            zoom = this.targetZoom;
        }
        return res;
    }
}

const autopilotThreshold = 0.000001; // Define a suitable threshold

// Helper function to check if two vectors are close enough (within a threshold)
vec2.prototype.closeEnough = function (target, autopilotThreshold) {
    return this.minus(target).mag() < autopilotThreshold;
};


function neuriteZoomToNodeTitle(nodeOrTitle, zoomLevel = 1.0) {
    let node;
    if (typeof nodeOrTitle === 'object' && nodeOrTitle !== null) {
        node = nodeOrTitle
    } else if (typeof nodeOrTitle === 'string') {
        ui = getZetNodeCMInstance(nodeOrTitle).ui;
        node = ui.scrollToTitle(nodeOrTitle);
    }
    if (!node) {
        Logger.err("Invalid argument. Must be a node title or a node object.");
        return Promise.resolve();
    }

    return (new Animation.ZoomToNode(node)).promise();
}
Animation.ZoomToNode = class {
    constructor(node){ this.node = node }
    launch(){
        const bb = this.node.content.getBoundingClientRect();
        if (bb && bb.width > 0 && bb.height > 0) {
            this.node.zoom_to_fit();
            zoomTo = zoomTo.scale(1.5);
        } else {
            this.node.zoom_to(0.5);
        }
        autopilotSpeed = settings.autopilotSpeed;
    }
    finish(){
        clearInterval(this.#idInterval);
        resetAutopilot();
        this.#resolve(this.node);
    }
    promise(){ return Promise.forAnimation("Zoom to Node", 0, this.run) }
    run = ()=>(new Promise(this.#runExec))

    #idInterval = 0;
    #resolve = Function.nop;
    #onCheck = ()=>{
        if (autopilotSpeed !== 0) return;

        Logger.info("Animation interrupted by user interaction.");
        this.finish();
    }
    #onTimeout = ()=>{
        if (autopilotSpeed !== 0) Logger.debug("Animation completed normally.");
        this.finish();
    }
    #runExec = (resolve)=>{
        this.#resolve = resolve;
        this.launch();
        this.#idInterval = setInterval(this.#onCheck, 100); // every 100 msecs
        Promise.delay(3000).then(this.#onTimeout); // after 3 secs
    }
}

async function neuriteSearchNotes(searchTerm, maxNodesOverride) {
    Graph.forEachNode(clearSearchHighlight);
    const matchedPartialNodes = await embeddedSearch(searchTerm, maxNodesOverride);

    const fullMatchedNodes = [];
    for (const partialNode of matchedPartialNodes) {
        const fullNode = Node.byUuid(partialNode.uuid);
        if (!fullNode) continue;

        const content = fullNode.content;
        if (content) content.classList.add("search_matched"); // highlight

        fullMatchedNodes.push(fullNode);
    }
    return fullMatchedNodes;
}

function neuriteSearchAndZoom(searchTerm, maxNodesOverride = null, zoomLevel = 1.0, delayBetweenNodes = 2000) {
    return Promise.forAnimation("Search and Zoom", 0, async ()=>{
        // Search for nodes based on the searchTerm
        const matchedNodes = await neuriteSearchNotes(searchTerm, maxNodesOverride);

        // Loop through each matched node and zoom to it
        for (const node of matchedNodes) {
            await neuriteZoomToNodeTitle(node, zoomLevel);
            await Promise.delay(delayBetweenNodes);
        }
    })
}
// Example usage
// neuriteSearchAndZoom("desired search term", null, 1.0, 3000);

function neuriteResetView(animate = true, duration = 2000) {
    const defaultZoomMagnitude = 1.3;
    const defaultPanReal = -0.3;
    const defaultPanImaginary = 0;
    const defaultZoom = zoom.scale(defaultZoomMagnitude / zoom.mag());
    const defaultPan = new vec2(defaultPanReal, defaultPanImaginary);

    if (!animate) { // Resolve immediately
        zoom = defaultZoom;
        pan = defaultPan;
        return Promise.resolve();
    }

    return Promise.forAnimation("Reset View", duration, (t)=>{
        zoom = interpolateVec2(zoom, defaultZoom, t);
        pan = interpolateVec2(pan, defaultPan, t);
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
function neuriteQueueAnimations(animations) {
    const transformedAnimations = animations.map(animation => {
        if (!Array.isArray(animation[1])) {
            animation[1] = [animation[1]]; // Wrap single argument into an array
        }

        return {
            action: animation[0], // Direct reference to the function
            params: animation[1],
            delayAfter: animation[2] ?? 0
        };
    });

    const processQueue = neuriteAnimationQueue.bind(null, transformedAnimations);
    return Promise.forAnimation("Queue Animations", 0, processQueue);
}
Animation.waitForAllActive = class {
    constructor(additionalDelay = 0){ this.additionalDelay = additionalDelay }
    promise(){ return new Promise(this.#exec) }

    #idInterval = 0;
    #resolve = Function.nop;
    #exec = (resolve)=>{
        this.#resolve = resolve;
        Logger.info("Waiting for animations to complete...");
        this.#idInterval = setInterval(this.#onCheck, 100); // every 100 msecs
    }
    #onCheck = ()=>{
        Logger.info("Active animations count:", Animation.activeCount);
        if (Animation.activeCount > 0) return;

        clearInterval(this.#idInterval);
        Logger.info("All animations completed. Waiting additional delay...");
        Promise.delay(this.additionalDelay).then(this.#onTimeout);
    }
    #onTimeout = ()=>{
        Logger.info("Additional delay completed.");
        this.#resolve();
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
            .catch(Logger.err.bind(Logger));
    } else {
        // Regular session, use existing screenshot mechanism
        captureScreenshot();
    }
}
On.click(Elem.byId('screenshotButton'), neuriteCaptureScreenshot);

async function neuriteReturnScreenshot() {
    return new Promise(async (resolve, reject) => {
        if (window.startedViaPlaywright) {
            // Playwright controlled session, use fetch to request screenshot
            fetch('http://localhost:8081/screenshot')
                .then(response => response.text())
                .then(base64Image => {
                    resolve("data:image/png;base64," + base64Image);
                })
                .catch(err => {
                    Logger.err(err);
                    reject(err);
                });
        } else {
            // If not in a Playwright session, use captureScreenToBase64
            try {
                const base64Image = await captureScreenToBase64();
                resolve(base64Image);
            } catch (err) {
                Logger.err("In capturing display:", err);
                reject(err);
            }
        }
    });
}

async function neuriteCallMovementAi(movementIntention, totalIterations = 1, currentIteration = 0) {
    if (currentIteration >= totalIterations) return;

    const screenshotBase64 = await neuriteReturnScreenshot();
    if (!screenshotBase64) {
        Logger.info("Not in a Playwright session or unable to capture screenshot.");
        return;
    }

    const messages = [
        Message.system(Prompt.vision()),
        Message.system(Prompt.forTelemetry(App.telemetry, true)), // true for vision
        Message.user([{
            type: 'image_url',
            image_url: screenshotBase64 // PNG format is already included in the return value
        }]),
        Message.user(movementIntention)
    ];

    try {
        await App.viewCode.callVisionModel(messages, async ()=>{
            App.viewCode.runCode(true); // Run code with increment and decrement of activeAnimations.

            await (new Animation.waitForAllActive).promise();
            Logger.info("awaited");
            // Recursive call for the next iteration
            await neuriteCallMovementAi(movementIntention, totalIterations, currentIteration + 1);
        });
    } catch (err) {
        Logger.err("In API call:", err);
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

function neuritePromptZettelkasten(message) {
    const promptTextArea = Elem.byId('prompt');
    if (!promptTextArea) {
        Logger.err("Prompt textarea not found.");
        return Promise.resolve();
    }

    const form = Elem.byId('prompt-form');
    if (!form) {
        Logger.err("Prompt form not found.");
        return Promise.resolve();
    }

    return Promise.forAnimation("Prompt Zettelkasten", 0, async ()=>{
        isPromiseResolved = false;

        // Initialize the promise when a new message is sent
        aiMessagePromise = new Promise(
            (resolve)=>{ resolveAiMessage = resolve }
        );

        promptTextArea.value = message;
        const event = new Event('submit', { cancelable: true });
        form.dispatchEvent(event);

        await aiMessagePromise;

        return streamedResponse;
    });
}

async function neuriteGetUserResponse(message) {
    try {
        const response = await window.prompt(message); // Assuming window.prompt() is now async
        return response;
    } catch (error) {
        Logger.err("Failed to get user response:", error);
        return null; // Handle error gracefully
    }
}

function neuriteAddNote(nodeTitle, nodeText) {
    const instanceInfo = getActiveZetCMInstanceInfo();
    if (!instanceInfo) {
        Logger.warn("No active Zettelkasten instance found.");
        return;
    }

    const { cm, ui, paneId, zettelkastenProcessor } = instanceInfo;

    const formattedTitle = neuriteGetUniqueNodeTitle(nodeTitle.replace(/\n/g, ' '));
    const contentToAdd = Tag.node + ' ' + formattedTitle + '\n' + (nodeText ?? '');

    // Enable random node placement
    zettelkastenProcessor.placementStrategy.zetPlacementOverride = true;

    const lastLine = cm.lastLine();
    const lastLineText = cm.getLine(lastLine);

    let newLinesToAdd = '';
    if (lastLineText !== '') {
        newLinesToAdd = '\n\n';
    } else if (cm.getLine(lastLine - 1) !== '') {
        newLinesToAdd = '\n';
    }

    const position = { line: lastLine, ch: lastLineText.length };
    processAll = true;
    cm.replaceRange(newLinesToAdd + contentToAdd, position);
    processAll = false;

    const node = ui.scrollToTitle(formattedTitle);

    return Promise.forAnimation("Add Note", 0, () => {
        return new Promise((resolve) => {
            // Return to use of placement strategy
            zettelkastenProcessor.placementStrategy.zetPlacementOverride = false;
            resolve(node);
        });
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
        baseFunction: Prompt.zettelkasten,
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
Logger.debug(functionNameList);
