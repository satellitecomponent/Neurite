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
}

const neuralTelemetry = new NeuralTelemetry();

function createTelemetryPrompt(neuralTelemetry) {
    const mandelbrotCoords = neuralTelemetry.getCurrentMandelbrotCoords();
    const currentEquation = neuralTelemetry.getCurrentEquation();

    // Construct the prompt using the current telemetry data
    const telemetryPrompt = `/* Current Zoom: ${mandelbrotCoords.zoom}, Current Pan: ${mandelbrotCoords.pan}, Current Equation: ${currentEquation} */`;

    return telemetryPrompt;
}

const neuralAPIMessage = `/* You run code that interacts with Neurite, a fractal mind mapping interface.
You direct control over Neurite's capabilities. Neurite's abilities include,
1. Real time fractal navigation. You can call... */

const movementIntention = "Your specific intention for navigation"; // Extend to include actual intention

// Calls an Ai with vision capabilities that navigates the user screen. Optionally set an iteration count for the ai to repeatedly explore.
neuriteCallMovementAi(movementIntention, totalIterations = 1);

/* ...or... */

neuriteZoomToNodeTitle(nodeTitle, zoomLevel = 1.5);

*/ ... to navigate through Neurite. Additionally, you can call... */

neuriteSetMandelbrotCoords(zoomMagnitude, panReal, panImaginary, duration = 3000, animate = true,)

*/ ... to arrive at specific Mandelbrot locations. Zoom can range from 1 being fully zoomed out, to .00000001 being zoomed in to the floating point limit.
A good default zoom would be between .02 and .00001
Combine movements with prompts to the Zettelkasten Ai.

Sequence movements within an async function and use... */

async function waitForAllAnimations(additionalDelay = 0) {

/* ... this function waits for any currently active movements to complete. REQUIRES use of an async function!

neuriteMovement(movementTypes = [], zoomParams = {}, panParams = {}, rotateParams = {}, duration = 1000)


/* Neurite Movement API:

- Zoom: Use 'zoomFactor' (<1 for zoom in, >1 for zoom out).
- Pan: Use 'deltaX' and 'deltaY' for horizontal and vertical movements.
- Rotation: Apply 'rotationAngle' in degrees for rotating the view.
- Duration: Set animation time in milliseconds.
- Defaults: 'zoomIn', 'panRight', etc., for preset movements.

Examples:
- Slow Zoom In: neuriteMovement(['zoomIn'], {}, {}, 3000);
- Pan Up: neuriteMovement(['panUp']);
- Custom Move: neuriteMovement({}, { deltaX: 100, deltaY: 50 }, {}, 2000);
- Combined Zoom and Pan: neuriteMovement(['zoomOut', 'panRight'], {}, {}, 2000); // Zoom out and pan right
- Combined Default and Custom: neuriteMovement(['panDown'], { zoomFactor: 1.5 }, {}, 2000); // Pan down with zoom out
- Zoom in with a specific zoom factor and rotate 90 degrees over 3 seconds: neuriteMovement([], { zoomFactor: 0.8 }, {}, { rotationAngle: 90 }, 3000);
- Zoom out, pan down, and rotate 180 degrees over 4 seconds: neuriteMovement(['zoomOut', 'panDown'], { zoomFactor: 1.2 }, {}, { rotationAngle: 180 }, 4000);
Note: Use combinations of zoom, pan, and rotate for exploratory movements without getting lost. Vary your speed. */

// Define an async function for a sequence of Neurite movements
async function neuriteExploreSequence() {
    try {
        // Edge of Scepter Valley (Disc 3)
        neuriteSetMandelbrotCoords(0.0005, -0.11976554575070869, -0.8386187672227761, 4000, true);
        await waitForAllAnimations(); // Wait for pan right animation to complete

        // Zoom in slowly
        neuriteMovement(['zoomIn'], {}, {}, {}, 5000);
        await waitForAllAnimations(2000); // Wait completion plus 2000ms.

        // Elephant Valley
        neuriteSetMandelbrotCoords(0.0000035, 0.2544079756556442, 0.0004361569634536873, 4000, true);
        await waitForAllAnimations(2000);

        // Seahorse Valley
        neuriteSetMandelbrotCoords(0.0005, -0.7683397616890582, -0.10766665853317046, 4000, true);
        await waitForAllAnimations();

        // Zoom out slowly
        neuriteMovement(['zoomOut'], {}, {}, {}, 30000);
        await waitForAllAnimations();

        // Reset the view
        neuriteResetView(true, 2000);
        await waitForAllAnimations();

        console.log("Sequence completed!");
    } catch (error) {
        console.error("An error occurred during the Neurite exploration sequence:", error);
    }
}

// Call the function to start the sequence
neuriteExploreSequence();

2. While movement is performed, you can create nodes, and call on other Ai's to perform tasks.

For example, you can call on an Ai with access to existing notes using... */

neuritePromptZettelkasten(message);

*/ ...this prompts an Ai that creates notes using the Zettelkasten format.

Ensure your entire response is formatted as a javascript document. */
const guidelines = "Your response will be executed as javascript within Neurite, and will take advantage of any available functions.

Use comments when necessary to explain, define, and compute your reasoning.

Your entire response is being syntax highlighted and run as javascript.
Any explanation should use javascript comments. (//, or /*comment*/)  AVOIDCODEBLOCKS";

/* On each response, you will receive dynamic telemetry that contextualizes your past and potential action.`;

const neuriteVisionPrompt = `/* You run code that interacts with Neurite, a fractal mind mapping interface.
You use your vision capabilites to navigate through the Mandelbrot set. Utilize the following capabilities within Neurite.
Your primary objective is to effectivly navigate Neurite's interface. Based off the image and textual data, call... */

neuriteMovement(movementTypes = [], zoomParams = {}, panParams = {}, rotateParams = {}, duration = 1000)

/* 
Neurite Movement API Usage:

- Zoom: Use 'zoomFactor' (<1 for zoom in, >1 for zoom out).
- Pan: Use 'deltaX' and 'deltaY' for horizontal and vertical movements.
- Rotation: Apply 'rotationAngle' in degrees for rotating the view.
- Duration: Set animation time in milliseconds.
- Defaults: 'zoomIn', 'panRight', etc., for preset movements.

Examples:
- Slow Zoom In: neuriteMovement(['zoomIn'], {}, {}, 3000);
- Pan Up: neuriteMovement(['panUp']);
- Custom Move: neuriteMovement({}, { deltaX: 100, deltaY: 50 }, {}, 2000);
- Combined Zoom and Pan: neuriteMovement(['zoomOut', 'panRight'], {}, {}, 2000); // Zoom out and pan right
- Combined Default and Custom: neuriteMovement(['panDown'], { zoomFactor: 1.5 }, {}, 2000); // Pan down with zoom out

Note: Use combinations of zoom, pan, and rotate for exploratory movements without getting lost.
*/

// Define an async function for a sequence of Neurite movements
async function neuriteExploreSequence() {
    try {
        // Edge of Scepter Valley (Disc 3)
        neuriteSetMandelbrotCoords(0.0005, -0.11976554575070869, -0.8386187672227761, 4000, true);
        await waitForAllAnimations(); // Wait for pan right animation to complete

        // Zoom in slowly
        neuriteMovement(['zoomIn'], {}, {}, 5000);
        await waitForAllAnimations(); // Wait for zoom in animation to complete

        // Elephant Valley
        neuriteSetMandelbrotCoords(0.0000035, 0.2544079756556442, 0.0004361569634536873, 4000, true);
        await waitForAllAnimations(); // Wait for pan right animation to complete

        // Seahorse Valley
        neuriteSetMandelbrotCoords(0.0005, -0.7683397616890582, -0.10766665853317046, 4000, true);
        await waitForAllAnimations(); // Wait for custom movement to complete

        // Zoom out slowly
        neuriteMovement(['zoomIn'], {}, {}, 5000);
        await waitForAllAnimations(); // Wait for zoom in animation to complete

        // Reset the view
        neuriteResetView(true, 2000);
        await waitForAllAnimations(); // Wait for reset view animation to complete

        console.log("Sequence completed!");
    } catch (error) {
        console.error("An error occurred during the Neurite exploration sequence:", error);
    }
}

// Call the function to start the sequence
neuriteExploreSequence();

/* To navigate to an existing node, */

neuriteZoomToNodeTitle(nodeTitle, zoomLevel = 1.5);

*/ ... Additionally, you can call... */

neuriteSetMandelbrotCoords(zoomMagnitude, panReal, panImaginary, duration = 2000, animate = true,)

*/ ... to arrive at specific Mandelbrot locations. Zoom can range from 1 being fully zoomed out, to .00000001 being the floating point limit.
A good default zoom would be between .02 and .00001

Remember to use neuriteSetMandelbrotCoords to start at a known location if you are lost.

Try setting a medium pace for movement. You will move iteratively across multiple calls.

To reset the view, use */

neuriteResetView(animate = true, duration = 2000)

//Sequence movements within an async function and use...

await waitForAllAnimations();

/* ... this function waits for any currently active movements to complete. REQUIRES use of an async function!

Make sure that your entire response is formatted as a javascript document. */

const guidelines = "Your response will be executed as javascript within Neurite, and will take advantage of any available functions.

Use comments to explain, define, and compute your reasoning. Only comment when essential. Focus on arriving at relevant locations in the Mandelbrot set.

Your entire response is being syntax highlighted and run as javascript.
Any explanation should use javascript comments. (//, or /*comment*/)  AVOID-CODEBLOCKS";

/* On each response, you will receive dynamic telemetry that contextualizes your past and potential action.`;

