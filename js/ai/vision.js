
// Function to calculate token cost for an image based on resolution and detail
function calculateImageTokenCost(width, height, detailLevel) {
    if (detailLevel === 'low') {
        return 85; // Low detail images cost a fixed 85 tokens
    }

    // For high detail images
    let initialResizeWidth = Math.min(width, 2048);
    let initialResizeHeight = Math.min(height, 2048);
    let scale = 768 / Math.min(initialResizeWidth, initialResizeHeight);
    let scaledWidth = Math.floor(initialResizeWidth * scale);
    let scaledHeight = Math.floor(initialResizeHeight * scale);

    // Calculate the number of 512px tiles needed
    let tilesWidth = Math.ceil(scaledWidth / 512);
    let tilesHeight = Math.ceil(scaledHeight / 512);
    let totalTiles = tilesWidth * tilesHeight;

    // Each high detail tile costs 170 tokens, plus an additional 85 tokens
    return (totalTiles * 170) + 85;
}

// Asynchronously convert an image to a base64 string
// The convertImageToBase64 function should take a blob URL, create an Image object,
// load the blob URL, and then perform the canvas draw and toDataURL conversion.
function convertImageToBase64(imageElement, callback) {
    // Create an off-screen canvas element
    let canvas = document.createElement('canvas');
    canvas.width = imageElement.naturalWidth;
    canvas.height = imageElement.naturalHeight;

    let ctx = canvas.getContext('2d');
    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

    // Convert the canvas content to a base64 string (assuming png format)
    let base64String = canvas.toDataURL('image/png');
    callback(base64String);

    // Clean up the canvas element
    canvas = null;
}

function getImageNodeData(node) {
    // If the node has an image URL, prefer that
    if (node.imageUrl) {
        return {
            type: 'image_url',
            image_url: node.imageUrl // Use the direct URL to the image
        };
    }
    // If there's no image URL but there is base64 image data
    else if (node.imageData) {
        return {
            type: 'image_url',
            image_url: node.imageData // The imageData should be a base64 string
        };
    }
    // If there's no image data or URL, return null or an appropriate placeholder
    return null;
}

async function callVisionModel(messages, onStreamComplete) {
    callAiApi({
        messages: messages,
        stream: true, // Assuming streaming is not required for vision model
        customTemperature: null, // Or specify a custom temperature if needed
        onBeforeCall: () => {
            isAiProcessing = true;
            updateUiForProcessing();
        },
        onStreamingResponse: (content) => {
            neuriteFunctionCM.getDoc().replaceRange(content, CodeMirror.Pos(neuriteFunctionCM.lastLine()));
        },
        onAfterCall: () => {
            isAiProcessing = false;
            updateUiForIdleState();
            if (onStreamComplete) onStreamComplete(); // Call the callback after streaming is complete
        },
        onError: (error) => {
            functionErrorIcon.style.display = 'block';
            console.error("Error:", error);
        },
        modelOverride: 'gpt-4-vision-preview' // Override model to use gpt-4-vision-preview
    });
}