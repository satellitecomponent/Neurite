
class NeuralTelemetry {
    constructor() {
        // The constructor can be used to initialize any necessary state,
        // but in this case, it might not be needed if we're only fetching current data.
    }

    // Method to directly fetch current Mandelbrot coordinates
    getCurrentMandelbrotCoords() {
        // Assuming neuriteGetMandelbrotCoords is a globally available function
        const coords = neuriteGetMandelbrotCoords();
        return {
            zoom: coords.zoom,
            pan: coords.pan
        };
    }

    // Method to fetch the current exponent
    getCurrentExponent() {
        // Retrieve the exponent value from the HTML element displaying it
        return document.getElementById("exponent_value").textContent;
    }

    // Method to get the current equation used for generating the Mandelbrot set
    getCurrentEquation() {
        const exponent = this.getCurrentExponent();
        return `z^${exponent} + c`;
    }

    // Method to get a range of node titles
    getRangeOfNodeTitles(startCount, endCount) {
        const allTitles = Array.from(nodeTitleToLineMap.keys());

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
            const callData = JSON.parse(item.getAttribute('data-call-data'));
            return {
                code: callData.code,
                zoom: callData.zoom,
                pan: callData.pan,
                functionName: callData.functionName
            };
        });
    }
}

const neuralTelemetry = new NeuralTelemetry();

function testGetLastFunctionCalls(n) {
    const lastCalls = neuralTelemetry.getLastFunctionCalls(n);
    console.log(`Last ${n} function calls:`, lastCalls);
}

function createTelemetryPrompt(neuralTelemetry, vision = false) {
    const mandelbrotCoords = neuralTelemetry.getCurrentMandelbrotCoords();
    const currentEquation = neuralTelemetry.getCurrentEquation();

    const historyCount = 3;
    const lastFunctionCalls = neuralTelemetry.getLastFunctionCalls(historyCount);

    let telemetryPrompt = `/* Current Zoom: ${mandelbrotCoords.zoom}, Current Pan: ${mandelbrotCoords.pan}, Current Equation: ${currentEquation}`;

    if (!vision) {
        const startCount = 6;
        const endCount = 10;
        const nodeTitles = neuralTelemetry.getRangeOfNodeTitles(startCount, endCount);

        if (nodeTitles.length > 0) {
            telemetryPrompt += `, Note Titles: ${nodeTitles.join(', ')}`;
        }
    }

    // Append the history of function calls
    if (lastFunctionCalls.length > 0) {
        const formattedCalls = lastFunctionCalls.map(call => {
            return `{Title/Result: "${call.functionName}", initZoom: ${call.zoom}, initPan: ${call.pan}, code: ${call.code}}`;
        });
        telemetryPrompt += `

Last ${historyCount} Function Calls: ${formattedCalls.join(' END ')}`;
    }

    telemetryPrompt += ' */';

    return telemetryPrompt;
}

const functionObjects = {
    performSequence: {
        title: "async function performSequence(animations) {",
        mainDemo: `/* In the animations array, each animation is an array where the first element is the function to be called,
the second element is an array of arguments for that function,
and the optional third element is the delay after the function call. */`,
        examples: [
            `const animations = [
    [genericAnimationFunction, [genericArg1, genericArg2, ..., genericArgN], delayAfterCompletion],
    [anotherAnimationFunction, [otherArg1, otherArg2, ..., otherArgN], anotherDelay],
    // More animation entries can be added here
];`,
            `// Define an async function to sequence Neurite movements
async function neuriteExploreSequence() {
    try {
        const animations = [
            // Edge of Scepter Valley (Disc 3)
            [setMandelbrotCoords, [0.0005, -0.11976554575070869, -0.8386187672227761, 0.1, true], 0],

            // Zoom in slowly and pan to the right
            [movement, [[], {zoomFactor: 0.2}, { deltaX: 400, deltaY: 100 }, {}, 8000], 2000], // 8000ms for animation + 2000ms additional delay

            // Elephant Valley
            [setMandelbrotCoords, [0.0000035, 0.2544079756556442, 0.0004361569634536873, 0.1, true], 1000], // 4000ms for animation + 1000ms additional delay

            // Zoom in, pan up and left
            [movement, [[], { zoomFactor: 0.1, zoomX: window.innerWidth / 2, zoomY: window.innerHeight / 2 }, { deltaX: -120, deltaY: 100 }, {}, 7000], 2000],

            // Seahorse Valley
            [setMandelbrotCoords, [0.0005, -0.7683397616890582, -0.10766665853317046, 0.1, true], 1000],

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

// Call the function to start the sequence
neuriteExploreSequence();`
        ],
        options: { neuralApi: true, vision: true }
    },
    setMandelbrotCoords: {
        title: "function neuriteSetMandelbrotCoords(zoomMagnitude, panReal, panImaginary, speed = 0.1, animate = true) {",
        mainDemo: `// Navigates to exact coordinates.`,
        examples: [
            "setMandelbrotCoords(0.0005, -0.11976554575070869, -0.8386187672227761, 0.1, true);",
            "setMandelbrotCoords(0.0000035, 0.2544079756556442, 0.0004361569634536873, 0.1, true);"
        ],
        options: { neuralApi: true, vision: true }
    },
    movement: {
        title: "function neuriteMovement(movementTypes = [], zoomParams = {}, panParams = {}, rotateParams = {}, duration = 1000) {",
        mainDemo: `// Combined movements set by parameter.`,
        examples: [
            "movement(['zoomIn'], {}, {}, 3000);",
            "movement(['zoomOut', 'panRight'], {}, {}, 2000);",
            "movement([], {zoomFactor: 0.8}, {}, {rotationAngle: 90}, 3000);"
        ],
        options: { neuralApi: true, vision: true }
    },
    addNote: {
        title: "function neuriteAddNote(nodeTitle, nodeText) {",
        mainDemo: `// Adds a note to the Zettelkasten with a specified title and content.`,
        examples: [
            "addNote('Holomorphic Dynamics?', 'What is it?');",
            "addNote('Imaginary Numbers...', 'Can you explain this to me?');"
        ],
        options: { neuralApi: true, vision: false }
    },
    zoomToNodeTitle: {
        title: "function neuriteZoomToNodeTitle(nodeTitle, zoomLevel = 1.0) {",
        mainDemo: `// Accepts exact titles of nodes`,
        examples: [
            "zoomToNodeTitle('Holomorphic Dynamics?', 1.0);"
        ],
        options: { neuralApi: true, vision: false }
    },
    callMovementAi: {
        title: "function neuriteCallMovementAi(movementIntention, totalIterations = 1) {",
        mainDemo: `// Calls an Ai with vision capabilities to navigate the user screen. Optionally set an iteration count for the ai to repeatedly explore.`,
        examples: [
            "callMovementAi('Explore', 1);",
            "callMovementAi('Navigate existing notes.', 4);",
            "callMovementAi('Explore new areas', 3);"
        ],
        options: { neuralApi: true, vision: true }
    },
    promptZettelkasten: {
        title: "function neuritePromptZettelkasten(message) {",
        mainDemo: `// Triggers a prompt to the Zettelkasten AI for generating notes based on the given message.`,
        examples: [
            "promptZettelkasten('Define 10 notes that branch off ...'); // Fill ... with a relevant existing note title.",
            "promptZettelkasten('Take notes on ...'); // Fill ... with a relevant topic",
            "promptZettelkasten('Synthesize a critical dialogue from the following topics ..'); // Fill ... with relevant topics"
        ],
        options: { neuralApi: true, vision: false }
    },
    promptZettelkasten: {
        title: "function neuriteGetUserResponse(message) {",
        mainDemo: `/* Takes a message to the user as an argument.
Returns the user response as a string*/`,
        examples: [
            "getUserResponse('How are you?'); // Try to go beyond small talk"
        ],
        options: { neuralApi: true, vision: false }
    },
    resetView: {
        title: "function neuriteResetView(animate = true, duration = 2000) {",
        mainDemo: `// Returns view to page refresh.`,
        examples: [
            "resetView(true, 2000);"
        ],
        options: { neuralApi: true, vision: true }
    },
    resetView: {
        title: "Advanced use of neuritePerformSequence(animations)",
        mainDemo: `// You can create multiple sequences, and use any N neuritefunction in a sequence.`,
        examples: [
            `// Define the initial sequence of setting coordinates, movements, and adding notes
async function initialSequence() {
    const initialAnimations = [
        // Set Mandelbrot coordinates and add a note
        [setMandelbrotCoords, [0.00013713634721725833, -0.024035092371998055, 0.7268549248591437, 0.1, true], 1000],
        [addNote, ['Holomorphic Dynamics?', 'What is it?'], 500],
        [zoomToNodeTitle, ['Holomorphic Dynamics?', { zoomfactor: 1 }], 1000],
        [movement, [[], { zoomFactor: 1.2 }, { deltaX: -500, deltaY: -400 }, {}, 4000], 2000],

        [addNote, ['Imaginary Numbers...', 'Can you explain this to me?'], 500],
        // ... additional sets of coordinates and notes
    ];

    console.log("Starting initial sequence...");
    await performSequence(initialAnimations);
    console.log("Initial sequence completed!");
}

// Function to interact with the Zettelkasten
function callZettelkasten() {
    promptZettelkasten("Define 10 notes that branch off the existing topics.");
}

// Define the second sequence of movements after interacting with the Zettelkasten
async function furtherMovementSequence() {
    const furtherAnimations = [
        // Movement with zoom and pan, including rotation
        [movement, [[], { zoomFactor: 0.5 }, { deltaX: 400, deltaY: -500 }, { rotationAngle: 45 }, 3000], 2000],

        // Set Mandelbrot coordinates
        [setMandelbrotCoords, [0.00008112374184603912, -0.024043983267418786, 0.7261919682847592, 0.1, true], 1000],

        // Another movement with a different rotation
        [movement, [[], { zoomFactor: 0.5 }, { deltaX: -200, deltaY: -500 }, { rotationAngle: -30 }, 4000], 2000],

        // Set Mandelbrot coordinates
        [setMandelbrotCoords, [0.000004038913281545681, -0.023793659903068972, 0.7278428617599411, 0.1, true], 1000],

        // A third movement with yet another rotation
        [movement, [[], { zoomFactor: 0.5 }, { deltaX: -600, deltaY: -500 }, { rotationAngle: 90 }, 3000], 1000],
    ];

    console.log("Starting further movement sequence...");
    await performSequence(furtherAnimations);
    console.log("Further movement sequence completed!");
}

// Combine the sequences with the Zettelkasten call in between
async function completeNeuriteInteraction() {
    await initialSequence();
    callZettelkasten();
    await furtherMovementSequence();
}

// Execute the complete interaction
completeNeuriteInteraction();`
        ],
        options: { neuralApi: true, vision: false }
    },
    // ... add more function objects as needed
};


function constructPromptWithFunctions(functions, forVision = false) {
    let prompt = "";

    Object.entries(functions).forEach(([key, value]) => {
        if (forVision && !value.options.vision) return;
        if (!forVision && !value.options.neuralApi) return;

        prompt += `${value.title}:\n${value.mainDemo}\n\nExamples:\n`;
        value.examples.forEach(example => prompt += `- ${example}\n`);
        prompt += `\n`;
    });

    return prompt;
}

function functionBasePrompt() {
    return `/* Neurite API Interaction Script
You write code that is executed with access to our fractal mind mapping interface, Neurite.

REMEMBER, creativity, format, substance, etc... As you are a transformer architecture, each task is a chance at computation. UTILIZE available JAVASCRIPT FUNCTIONALITY*/`;
}

function neuralApiPrompt() {
    let prompt = functionBasePrompt();
    prompt += constructPromptWithFunctions(functionObjects, false);
    prompt += `\n/* The creation of text notes and prompts to the zettelkasten can be called BOTH inside and/or outside of Neurite's async function performSequence(animations)
The setting of coords, movement, zoomToTitle, etc. are ALWAYS CALLED within performSequence */`;
    return prompt;
}

function visionPrompt() {
    let prompt = functionBasePrompt();
    prompt += constructPromptWithFunctions(functionObjects, true);
    prompt += `\n/* Vision Specific Guidelines */\n
You TAKE ACTION based off the provided SCREENSHOTS of Neurite's interface. REFERENCE your current TELEMETRY and UTILIZE available FUNCTION CALLS within Neurite.`;
    return prompt;
}

// Usage
const neuriteNeuralApiPrompt = neuralApiPrompt();
const neuriteNeuralVisionPrompt = visionPrompt();

// Example console log
//console.log(neuriteNeuralApiPrompt);
//console.log(neuriteNeuralVisionPrompt);