class NeuralTelemetry {
    constructor() {
        // The constructor can be used to initialize any necessary state,
        // but in this case, it might not be needed if we're only fetching current data.
    }

    // Method to get a range of node titles
    getRangeOfNodeTitles(startCount, endCount) {
        const allTitles = Array.from(nodeTitles);

        // Handle cases where the requested counts are more than available titles
        const totalTitles = allTitles.length;
        if (startCount + endCount > totalTitles) {
            // Reduce counts proportionally to fit within the total available titles
            startCount = Math.round((startCount / (startCount + endCount)) * totalTitles);
            endCount = totalTitles - startCount;
        }

        // Fetch titles from the start
        const firstNodeTitles = allTitles.slice(0, startCount);

        // Fetch titles from the end
        const lastNodeTitles = allTitles.slice(-endCount);

        // Combine and return unique titles
        return Array.from(new Set([...firstNodeTitles, ...lastNodeTitles]));
    }

    // Method to retrieve the last n function call snippets
    getLastFunctionCalls(n) {
        const functionCallItems = Array.from(document.querySelectorAll('.function-call-item'));
        const lastNItems = functionCallItems.slice(-n);
        return lastNItems.map(item => {
            const callData = JSON.parse(item.dataset.callData);
            return {
                code: callData.code,
                zoom: callData.zoom,
                pan: callData.pan,
                functionName: callData.functionName
            };
        });
    }

    // Method to get the list of currently saved views
    getListOfSavedViews() {
        return listSavedViews();
    }
}

function testGetLastFunctionCalls(n) {
    const lastCalls = App.telemetry.getLastFunctionCalls(n);
    Logger.info(`Last ${n} function calls:`, lastCalls);
}

Prompt.forTelemetry = function(telemetry, vision = false){
    const coords = Graph.getCoords();
    const currentEquation = Elem.byId('equation').innerHTML;
    const prompt = ["/* ", "Current Zoom", ": ", coords.zoom, ", ",
                            "Current Pan", ": ", coords.pan, ", ",
                            "Current Equation", ": ", currentEquation];

    if (!vision) {
        const startCount = 6;
        const endCount = 10;
        const nodeTitles = telemetry.getRangeOfNodeTitles(startCount, endCount);

        if (nodeTitles.length > 0) {
            prompt.push(", ", "Note Titles", ": ", nodeTitles.join(', '))
        }
    }

    // Append the list of saved views with their coordinates
    //const savedViewsList = telemetry.getListOfSavedViews();
    //if (savedViewsList.length > 0) {
    //    const formattedViews = savedViewsList.map(view => {
    //        return `{Title: "${view.title}", Coordinates: Zoom ${view.coordinates.zoom}, Pan ${view.coordinates.pan}}`;
    //    });
    //    prompt.push(", ", "Saved Views", ": ", formattedViews.join(" | "));
    //}

    // Append the history of function calls
    const historyCount = 3;
    const lastFunctionCalls = telemetry.getLastFunctionCalls(historyCount);
    if (lastFunctionCalls.length > 0) {
        const formattedCalls = lastFunctionCalls.map(call => {
            return `{Title/Result: "${call.functionName}", initZoom: ${call.zoom}, initPan: ${call.pan}, code: ${call.code}}`;
        });
        prompt.push(`

Last ${historyCount} Function Calls: ${formattedCalls.join(" END ")}`);
    }

    prompt.push(" */");

    return prompt.join('');
}

//eventually add functionality for each example to randomize saved mandelbrot locations on each use.

const functionOptions = {
    neuralApiAndVision: {neuralApi: true, vision: true},
    neuralApiNoVision: {neuralApi: true, vision: false}
}

const functionObjects = {
    performSequence: {
        title: "async function performSequence(animations) {",
        mainDemo: `/* In the animations array, each animation is an array where the first element is the function to be called,
the second element is an array of arguments for that function,
and the optional third element is the delay after the function call. */

// Psuedo code of the existing function.
async function performSequence(animations) {
    // Transform the input animations for processing
    const transformedAnimations = animations.map(animation => {
        // Extract the animation action, parameters, and delay
        const [action, [params], delay = 0] = animation;
        // Ensure parameters are in array format
        const paramsArray = Array.isArray(params) ? params : [params];
        // Return the transformed animation object
        return {
            action: action,        // Function to execute for the animation
            params: paramsArray,   // Parameters for the animation function
            delayAfter: delay      // Optional delay after animation completion
        };
    });

    // Execute the queue of animations
    await neuriteAnimationQueue(transformedAnimations);
}`,
        examples: [
            `// Expected Input Format for animations:
// animations = [
//     [animationFunction1, parameters1, optionalDelay1],
//     [animationFunction2, parameters2, optionalDelay2],
//     ...
// ]`,
            `// An Example of how to use performSequence(animations)
async function neuriteExploreSequence() {
    try {
        const animations = [
            // Edge of Scepter Valley (Disc 3)
            [setMandelbrotCoords, [0.0005, -0.11976554575070869, -0.8386187672227761, 0.1], 0],
            // Zoom in slowly and pan to the right
            [movement, [[], {zoomFactor: 0.2}, { deltaX: 400, deltaY: 100 }, {}, 8000], 2000], // 8000ms for animation + 2000ms additional delay
            // Elephant Valley
            [setMandelbrotCoords, [0.0000035, 0.2544079756556442, 0.0004361569634536873, 0.1], 1000], // 4000ms for animation + 1000ms additional delay
            // Zoom in, pan up and left
            [movement, [[], { zoomFactor: 0.1, zoomX: window.innerWidth / 2, zoomY: window.innerHeight / 2 }, { deltaX: -120, deltaY: 100 }, {}, 7000], 2000],
            // Seahorse Valley
            [setMandelbrotCoords, [0.0005, -0.7683397616890582, -0.10766665853317046, 0.1], 1000],
            // Zoom out slowly
            [movement, [['zoomOut'], {}, {}, {}, 5000], 1000],
            // Reset the view
            [resetView, [true, 2000], 2000]
        ];
        console.log("Starting sequence...");
        await performSequence(animations);  // Utilize performSequence to await each call in const animations.
        console.log("Sequence completed!");
    } catch (error) {
        console.error("An error occurred during the Neurite exploration sequence:", error);
    }
}

neuriteExploreSequence()`
        ],
        options: "neuralApiAndVision"
    },
    setMandelbrotCoords: {
        title: "function setMandelbrotCoords(zoomMagnitude, panReal, panImaginary, speed = 0.1) {",
        mainDemo: `// Navigates to exact coordinates.`,
        examples: [
            "setMandelbrotCoords(0.0005, -0.11976554575070869, -0.8386187672227761, 0.1);",
            "setMandelbrotCoords(0.0000035, 0.2544079756556442, 0.0004361569634536873, 0.1);"
        ],
        options: "neuralApiAndVision"
    },
    movement: {
        title: "function movement(movementTypes = [], zoomParams = {}, panParams = {}, rotateParams = {}, duration = 1000) {",
        mainDemo: `// Combined movements set by parameter.`,
        examples: [
            "movement(['zoomIn'], {}, {}, 3000);",
            "movement(['zoomOut', 'panRight'], {}, {}, 2000);",
            "movement([], {zoomFactor: 0.8}, {}, {rotationAngle: 90}, 3000);"
        ],
        options: "neuralApiAndVision"
    },
    addNote: {
        title: "function addNote(nodeTitle, nodeText) {",
        mainDemo: `// Adds a note to the Zettelkasten with a specified title and content.`,
        examples: [
            "addNote('Holomorphic Dynamics?', 'Text explanation here...'); // Define a relevant title and text content",
            "addNote('Imaginary Numbers', 'Explanation here...');"
        ],
        options: "neuralApiAndVision"
    },
    searchNotes: {
        title: "async function searchNotes(searchTerm, maxNodesOverride = null) {",
        mainDemo: `// Returns an array of node objects, sorted by relevance to the search term. Optionally set the number of nodes to return.`,
        examples: [
            "searchNotes(`Relevant Query`)",
            ""
        ],
        options: "neuralApiNoVision"
    },
    zoomToNodeTitle: {
        title: "function zoomToNodeTitle(nodeOrTitle, zoomLevel = 1.0) {",
        mainDemo: `// Accepts exact titles of nodes, or nodes retrieved from searchNotes`,
        examples: [
            "zoomToNodeTitle('Holomorphic Dynamics?', 1.0);"
        ],
        options: "neuralApiAndVision"
    },
    searchAndZoom: {
        title: "async function searchAndZoom(searchTerm, maxNodesOverride = null, zoomLevel = 1.0, delayBetweenNodes = 2000) {",
        mainDemo: `// Accepts a search term. Automatically zooms to each resulting Node`,
        examples: [
            "searchAndZoom('Relevant Query');"
        ],
        options: "neuralApiAndVision"
    },
    callMovementAi: {
        title: "function callMovementAi(movementIntention, totalIterations = 1) {",
        mainDemo: `// Calls an Ai with vision capabilities to navigate the user screen. Optionally set an iteration count for the ai to repeatedly explore.`,
        examples: [
            "callMovementAi('Explore', 1);",
            "callMovementAi('Navigate existing notes.', 4);",
            "callMovementAi('Explore new areas', 3);"
        ],
        options: "neuralApiNoVision"
    },
    promptZettelkasten: {
        title: "function promptZettelkastenAi(message) {",
        mainDemo: `// Triggers a prompt to the Zettelkasten AI for generating notes based on the given message.`,
        examples: [
            "promptZettelkastenAi('Define 10 notes that branch off ...'); // Fill ... with a relevant existing note title.",
            "promptZettelkastenAi('Take notes on ...');",
            "promptZettelkastenAi('Synthesize a critical dialogue from the following topics ..');"
        ],
        options: "neuralApiNoVision"
    },
    promptZettelkasten: {
        title: "function requestUserResponse(message) {",
        mainDemo: `/* Takes a message to the user as an argument.
Returns the user response as a string*/`,
        examples: [
            `const userResponse = requestUserResponse('How are you ? ');
// Then do something with the userResponsee string such as addNote(userResponse), or promptZettelkastenAi(userResponse)`
        ],
        options: "neuralApiNoVision"
    },
    resetView: {
        title: "function resetView(animate = true, duration = 2000) {",
        mainDemo: `// Returns view to page refresh.`,
        examples: [
            "resetView(true, 2000);"
        ],
        options: "neuralApiAndVision"
    },
    performSequence2: {
        title: "Advanced use of performSequence(animations)",
        mainDemo: `// You can create multiple sequences, and use any function in a sequence.`,
        examples: [
            `Do your best to best utilize the actual functionality described.`
        ],
        options: "neuralApiNoVision"
    },
    // ... add more function objects as needed
};

function forEachFuncOfGroup(group, cb, ct){
    for (const name in functionObjects) {
        const func = functionObjects[name];
        if (functionOptions[func.options][group]) cb.call(ct, func);
    }
}
function pushFuncToThis(func){
    this.push(func.title, ":\n",
              func.mainDemo, "\n\n",
              "Examples", ":\n");
    func.examples.forEach(example => this.push("- ", example, '\n'));
    this.push('\n');
}

Prompt.functionBase = function(){
    return `/* Neurite API Documentation
You write code that is executed within the fractal mind mapping interface, Neurite.

REMEMBER, creativity, format, substance, etc... As you are a transformer architecture, each token generation is a chance to grow computational context. UTILIZE available JAVASCRIPT FUNCTIONALITY*/`;
}

Prompt.neuralApi = function(){
    const prompt = [Prompt.functionBase()];
    forEachFuncOfGroup('neuralApi', pushFuncToThis, prompt);
    prompt.push(`\n/* The creation of text notes and prompts to the zettelkasten can be called BOTH inside and/or outside of Neurite's async function performSequence(animations)
For example, you can either use promptZettelkasten within a performSequence such that there are no animations during the response, or call promptZettelkasten outside of a performSequence such that the Ai response and movements coordinate.
The setting of coords, movement, zoomToTitle, etc. are ALWAYS CALLED within performSequence */`);

    const str = prompt.join('');
    Prompt.neuralApi = ()=>str ;
    return str;
}

Prompt.vision = function(){
    const prompt = [Prompt.functionBase()];
    forEachFuncOfGroup('vision', pushFuncToThis, prompt);
    prompt.push(`\n/* Vision Specific Guidelines */\n
You TAKE ACTION based off the provided SCREENSHOTS of Neurite's interface.`);

    const str = prompt.join('');
    Prompt.vision = ()=>str ;
    return str;
}
