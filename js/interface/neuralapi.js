// If funcUpdate depends on requestAnimationFrame, duration should be positive.
Promise.forAnimation = function(name, duration, funcUpdate, funcIsComplete){
    return (new Animation(duration))
        .setFuncs(funcUpdate, funcIsComplete)
        .executeProm(name)
}

class Animation {
    static activeCount = 0;
    funcEase = easeInOutCubic;
    funcIsComplete = Animation.onDurationCompleted;
    funcUpdate = Animation.interpolateZoomAndPan;
    name = "unnamed";

    startPan = Graph.pan;
    startTime = Date.now();
    // startValue = 0;
    startZoom = Graph.zoom;

    endPan = null;
    // endValue = 1;
    endZoom = null;

    constructor(duration){ this.duration = duration }
    setFuncs(funcUpdate, funcIsComplete){
        this.funcUpdate = funcUpdate || Animation.interpolateZoomAndPan;
        this.funcIsComplete = funcIsComplete || Animation.onDurationCompleted;
        return this;
    }

    static interpolateZoomAndPan(t){
        Graph.pan_set(Interpolation.forVec2(this.startPan, this.endPan, t));
        if (this.endZoom !== null) {
            Graph.zoom_set(Interpolation.forVec2Log(this.startZoom.clog(), this.endZoom.clog(), t).cexp());
            if (this.rotationAngle !== null) {
                const curRotation = Interpolation.forNums(this.startRotation, this.endRotation, t);
                const r = new vec2(Math.cos(curRotation), Math.sin(curRotation));
                const pivot = Graph.xyToZ(this.pivotX, this.pivotY);
                const zc = pivot.minus(Graph.pan);
                Graph.zoom_cmultWith(r)
                    .pan_incBy(zc.cmult(new vec2(1, 0).minus(r)));
            }
        }
        Svg.updateViewbox(Graph.pan, Graph.zoom);
    }
    static onDurationCompleted(progress){ return progress >= 1 }

    #onStep = ()=>{
        let res;
        const progress = Math.min((Date.now() - this.startTime) / this.duration, 1);
        try {
            res = this.funcUpdate.call(this, this.funcEase(progress));
        } catch (err) {
            if (!this.#reject) throw(err);

            return this.#onError(err);
        }
        if (!this.funcIsComplete(progress)) {
            requestAnimationFrame(this.#onStep);
            return;
        }
        if (!this.#resolve) return;

        this.#onComplete(res);
    }
    #onComplete = (res)=>{
        Animation.activeCount -= 1;
        Logger.info(this.name, "completed, left:", Animation.activeCount);
        this.#resolve(res);
    }
    #onError = (err)=>{
        Animation.activeCount -= 1;
        Logger.err("In", this.name, "animation:", err);
        this.#reject(err);
    }

    #reject = Function.nop;
    #resolve = Function.nop;
    execute(){ requestAnimationFrame(this.#onStep) }
    executeProm(name = "unnamed"){
        this.name = name;
        return new Promise(this.#exec);
    }
    #exec = (resolve, reject)=>{
        this.#resolve = resolve;
        this.#reject = reject;
        Animation.activeCount += 1;
        if (this.duration > 0) return this.execute();

        this.funcUpdate().then(this.#onComplete).catch(this.#onError);
    }

    setEndPanAndZoom(endPan, endZoom = null){
        this.endPan = endPan;
        this.endZoom = endZoom;
        return this;
    }
    setRotationParams(params){
        this.rotationAngle = params.rotationAngle ?? null;
        if (this.rotationAngle === null) return this;

        this.startRotation = 0;
        this.endRotation = this.rotationAngle * Math.PI / 180; // Convert degrees to radians
        this.pivotX = params.pivotX ?? window.innerWidth / 2;
        this.pivotY = params.pivotY ?? window.innerHeight / 2;
        return this;
    }
}

const Interpolation = {
    forNums(numStart, numEnd, t){
        return numStart + (numEnd - numStart) * t
    },
    forVec2(vecStart, vecEnd, t){
        const x = this.forNums(vecStart.x, vecEnd.x, t);
        const y = this.forNums(vecStart.y, vecEnd.y, t);
        return new vec2(x, y);
    },
    forVec2Log(a, b, t){
        return this.forVec2(a.clog(), b.clog(), t).cexp()
    }
}
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}



Animation.zoom = function(zoomFactor, targetX = window.innerWidth / 2, targetY = window.innerHeight / 2, duration = 1000){
    const inverseFactor = 1 / zoomFactor;
    const dest = Graph.xyToZ(targetX, targetY);
    const endPan = dest.scale(1 - inverseFactor).plus(Graph.pan.scale(inverseFactor));
    const endZoom = Graph.zoom.scale(inverseFactor);
    (new Animation(duration)).setEndPanAndZoom(endPan, endZoom).execute();
}
Animation.pan = function(deltaX, deltaY, duration = 1000){
    const dp = toDZ(new vec2(deltaX, deltaY).scale(settings.panSpeed));
    const endPan = Graph.pan.plus(dp);
    (new Animation(duration)).setEndPanAndZoom(endPan).execute();
}
Animation.rotate = function(rotationAngle, pivotX, pivotY, duration = 1000){
    const p = Graph.xyToZ(pivotX, pivotY);
    const zc = p.minus(Graph.pan);
    const r = new vec2(Math.cos(rotationAngle), Math.sin(rotationAngle));
    const endPan = Graph.pan.plus(zc.cmult(new vec2(1, 0).minus(r)));
    const endZoom = Graph.zoom.cmult(r);
    (new Animation(duration)).setEndPanAndZoom(endPan, endZoom).execute();
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

Animation.movement = function(movements = [], cz = {}, cp = {}, cr = {}, d = 1000){
    movements = [].concat(movements);
    const { z, p, r, duration } = movements.reduce(
        (acc, m)=>{
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
    Object.assign(r, cr);

    let endPan = (Object.keys(p).length < 1) ? Graph.pan
        : Graph.pan.plus(toDZ(new vec2(p.deltaX || 0, p.deltaY || 0).scale(settings.panSpeed)));
    let endZoom = Graph.zoom;
    const zoomFactor = z.zoomFactor;
    if (zoomFactor !== undefined && zoomFactor !== 1) {
        const zoomX = z.zoomX ?? window.innerWidth / 2;
        const zoomY = z.zoomY ?? window.innerHeight / 2;
        endPan = Graph.xyToZ(zoomX, zoomY)
            .scale(1 - zoomFactor)
            .plus(endPan.scale(zoomFactor));
        endZoom = Graph.zoom.scale(zoomFactor);
    }

    return (new Animation(duration))
        .setEndPanAndZoom(endPan, endZoom)
        .setRotationParams(r)
        .executeProm("Movement");
  }

/*
panTo = new vec2(0, 0); //this.pos;
let gz = zoom.mag2() * ((this.scale * s) ** (-1 / settings.zoomContentExp));
zoomTo = zoom.unscale(gz ** 0.5);
autopilotReferenceFrame = this;
panToI = new vec2(0, 0); */

Animation.goToCoords = function(zoomMagnitude, panReal, panImaginary, speed = 0.1){
    let animate = true;

    const newZoomMagnitude = parseFloat(zoomMagnitude);
    const newPanReal = parseFloat(panReal);
    const newPanImaginary = parseFloat(panImaginary);

    if (!animate) { // Resolve immediately
        // Directly set the new zoom and pan values
        if (newZoomMagnitude !== 0) {
            Graph.zoom_scaleBy(newZoomMagnitude / Graph.zoom.mag())
        }
        Graph.pan_set(new vec2(newPanReal, newPanImaginary));
        return Promise.resolve();
    }

    const targetZoom = Graph.zoom.scale(newZoomMagnitude / Graph.zoom.mag());
    const targetPan = new vec2(newPanReal, newPanImaginary);
    return (new Animation.GoToCoords(targetPan, targetZoom, speed)).promise();
}
Animation.GoToCoords = class {
    constructor(targetPan, targetZoom, speed){
        this.targetPan = targetPan;
        this.targetZoom = targetZoom;
        this.speed = speed;
    }
    promise(){
        Autopilot.setNode().start(this.speed > 1 ? undefined : this.speed);
        return Promise.forAnimation("Set Coords", 1, this.update, this.isComplete) // positive duration
            .finally(Autopilot.reset);
    }
    update = (t)=>{
        // Regular animation steps
        const targetZoom = this.targetZoom;
        const currentZoom = Graph.zoom.mag();
        const stepZoom = currentZoom + (targetZoom.mag() - currentZoom) * t;

        // Ensure zoom does not undershoot or overshoot
        if (Math.abs(stepZoom - targetZoom.mag()) < Autopilot.threshold) {
            Autopilot.targetZoom = targetZoom
        } else {
            Autopilot.targetZoom = Graph.zoom.scale(stepZoom / currentZoom)
        }

        const pan = Graph.pan;
        const stepPanX = pan.x + (this.targetPan.x - pan.x) * t;
        const stepPanY = pan.y + (this.targetPan.y - pan.y) * t;
        Autopilot.targetPan = new vec2(stepPanX, stepPanY);
    }
    isComplete = ()=>{
        if (!Autopilot.isMoving()) {
            Logger.info("Animation interrupted by user interaction.");
            return true;
        }

        const res = Autopilot.vectorsCloseEnough(Graph.zoom, this.targetZoom)
                 && Autopilot.vectorsCloseEnough(Graph.pan, this.targetPan);
        if (res) { // If close-enough, equate them
            Graph.pan_set(this.targetPan).zoom_set(this.targetZoom)
        }
        return res;
    }
}

Animation.zoomToNodeTitle = function(nodeOrTitle, zoomLevel = 1.0, delay){
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

    return (new Animation.ZoomToNode(node, delay)).promise();
}
Animation.ZoomToNode = class {
    constructor(node, delay = 3000){ // 3 secs
        this.delay = delay;
        this.node = node;
    }
    launch(){
        if (this.node.hasBoundingRectangle()) {
            Autopilot.zoomToFitFrame(this.node).targetZoom_scaleBy(1.5).start()
        } else {
            Autopilot.zoomToFrame(this.node, 0.5).start()
        }
    }
    finish(){
        clearInterval(this.#idInterval);
        Autopilot.reset();
        this.#resolve(this.node);
    }
    promise(){ return Promise.forAnimation("Zoom to Node", 0, this.run) }
    run = ()=>(new Promise(this.#runExec))

    #idInterval = 0;
    #resolve = Function.nop;
    #onCheck = ()=>{
        if (Autopilot.isMoving()) return;

        Logger.info("Animation interrupted by user interaction.");
        this.finish();
    }
    #onTimeout = ()=>{
        if (Autopilot.isMoving()) Logger.debug("Animation completed normally.");
        this.finish();
    }
    #runExec = (resolve)=>{
        this.#resolve = resolve;
        this.launch();
        this.#idInterval = setInterval(this.#onCheck, 100); // every 100 msecs
        Promise.delay(this.delay).then(this.#onTimeout);
    }
}

Graph.prototype.searchNotes = async function(searchTerm, maxNodesOverride){
    Graph.forEachNode(clearSearchHighlight);
    const matchedPartialNodes = await Embeddings.search(searchTerm, maxNodesOverride);

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

Animation.searchAndZoom = function(searchTerm, maxNodesOverride = null, zoomLevel = 1.0, delayBetweenNodes = 2000){
    return Promise.forAnimation("Search and Zoom", 0, async ()=>{
        const matchedNodes = await Graph.searchNotes(searchTerm, maxNodesOverride);
        for (const node of matchedNodes) {
            await Animation.zoomToNodeTitle(node, zoomLevel);
            await Promise.delay(delayBetweenNodes);
        }
    })
}
Animation.resetView = function(animate = true, duration = 2000){
    const defaultZoomMagnitude = 1.3;
    const defaultZoom = Graph.zoom.scale(defaultZoomMagnitude / Graph.zoom.mag());

    const defaultPanReal = -0.3;
    const defaultPanImaginary = 0;
    const defaultPan = new vec2(defaultPanReal, defaultPanImaginary);

    if (!animate) { // Resolve immediately
        Graph.zoom_set(defaultZoom).pan_set(defaultPan);
        return Promise.resolve();
    }

    return Promise.forAnimation("Reset View", duration, (t)=>{
        Graph.zoom_set(Interpolation.forVec2(Graph.zoom, defaultZoom, t))
            .pan_set(Interpolation.forVec2(Graph.pan, defaultPan, t))
    });
}

Graph.prototype.getCoords = function(forFunctionCall = false){
    // Extract and format zoom and pan values
    const zoomValue = this.zoom.x.toExponential();
    const panReal = this.pan.x.toExponential();
    const panImaginary = this.pan.y.toExponential();

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
Animation.queueAnimations = function(animations){
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
Animation.WaitForAllActive = class {
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

Recorder.captureScreenshot = function(){
    if (window.startedViaPlaywright) {
        // Playwright controlled session, use fetch to request screenshot
        fetch('${Proxy.baseUrl}/automation/screenshot')
            .then(response => response.text())
            .then(base64Image => {
                // Create an image element from the base64 data
                const img = new Image();
                img.src = `data:image/png;base64,${base64Image}`;
                NodeView.addForImage(img, 'Screenshot');
            })
            .catch(Logger.err.bind(Logger))
    } else {
        // Regular session, use existing screenshot mechanism
        Recorder.captureScreenToImage()
    }
}
On.click(Elem.byId('screenshotButton'), Recorder.captureScreenshot);

Recorder.returnScreenshot = function(){
    if (window.startedViaPlaywright) {
        // Playwright controlled session, use fetch to request screenshot
        return fetch('${Proxy.baseUrl}/automation/screenshot')
            .then( (response)=>response.text() )
            .then( (base64Image)=>("data:image/png;base64," + base64Image) )
            .catch( (err)=>{
                Logger.err(err);
                return Promise.reject(err);
            })
    } else {
        // If not in a Playwright session, use captureScreenToBase64
        return Recorder.captureScreenToBase64()
            .catch( (err)=>{
                Logger.err("In capturing display:", err);
                return Promise.reject(err);
            })
    }
}

Animation.movementAi = async function(movementIntention, totalIterations = 1, currentIteration = 0){
    if (currentIteration >= totalIterations) return;

    const screenshotBase64 = await Recorder.returnScreenshot();
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

            await (new Animation.WaitForAllActive).promise();
            Logger.info("awaited");
            // Recursive call for the next iteration
            await Animation.movementAi(movementIntention, totalIterations, currentIteration + 1);
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

Animation.promptZettelkasten = function(message){
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

function getUserInput(message){
    return window.prompt(message)
        .catch(Logger.err.bind(Logger, "Failed to get user response:"))
}

Animation.addNote = function(nodeTitle, nodeText){
    const instanceInfo = getActiveZetCMInstanceInfo();
    if (!instanceInfo) {
        Logger.warn("No active Zettelkasten instance found.");
        return;
    }

    const { cm, ui, paneId, zettelkastenProcessor } = instanceInfo;

    const formattedTitle = getUniqueNodeTitle(nodeTitle.replace(/\n/g, ' '));
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
    return Promise.forAnimation("Add Note", 0, ()=>{
        // Return to use of placement strategy
        zettelkastenProcessor.placementStrategy.zetPlacementOverride = false;
        return Promise.resolve(node);
    });
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
        baseFunction: Animation.addNote,
        alternateNames: ['addNote', 'createNote', 'zettelkastenAddNote', `promptNote`]
    },
    {
        baseFunctionName: 'neuritePromptZettelkasten',
        baseFunction: Animation.promptZettelkasten,
        alternateNames: ['promptZettelkasten', 'zettelkastenPrompt', 'promptZettelkastenAi', 'callZettelkastenAi', `zettelkastenAi`]
    },
    {
        baseFunctionName: 'neuriteGetUserResponse',
        baseFunction: getUserInput,
        alternateNames: ['getUserResponse', 'promptUser', 'requestUserResponse']
    },
    {
        baseFunctionName: 'neuriteZoomToNodeTitle',
        baseFunction: Animation.zoomToNodeTitle,
        alternateNames: ['zoomToNodeTitle', 'focusNode', 'zoomToNote', 'zoomToNoteByTitle', `zoomToNode`]
    },
    {
        baseFunctionName: 'neuriteCallMovementAi',
        baseFunction: Animation.movementAi,
        alternateNames: ['callMovementAi', 'promptMovementAi', 'initiateMovementAi']
    },
    {
        baseFunctionName: 'neuriteQueueAnimations',
        baseFunction: Animation.queueAnimations,
        alternateNames: ['queueAnimations', 'performSequence', 'neuritePerformSequence']
    },
    {
        baseFunctionName: 'neuriteResetView',
        baseFunction: Animation.resetView,
        alternateNames: ['resetView', 'returnToStart', 'reinitializeView']
    },
    {
        baseFunctionName: 'neuriteSetMandelbrotCoords',
        baseFunction: Animation.goToCoords,
        alternateNames: ['setMandelbrotCoords', 'updateMandelbrotPosition', 'mandelbrotCoords']
    },
    {
        baseFunctionName: 'neuriteMovement',
        baseFunction: Animation.movement,
        alternateNames: ['movement', 'startMovement', 'performMovement']
    },
    {
        baseFunctionName: 'neuriteDelay',
        baseFunction: Promise.delay,
        alternateNames: ['delay', 'setDelay']
    },
    {
        baseFunctionName: 'neuriteSearchNotes',
        baseFunction: Graph.prototype.searchNotes,
        alternateNames: ['searchNotes', 'returnSearchedNodes', `searchNodes`]
    },
    {
        baseFunctionName: 'neuriteSearchAndZoom',
        baseFunction: Animation.searchAndZoom,
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
