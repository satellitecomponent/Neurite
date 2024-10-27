function modulateAiNodeModel(aiNodeInference, hasImageNodes) {
    const { provider, model } = aiNodeInference;

    // Check if the local or global model is set to ollama.
    const isOllamaSelected = provider === 'ollama' ||
        (provider === 'GLOBAL' && Elem.byId('model-select').value === 'ollama');

    // If image nodes are present, and ollama is not selected, use the vision model.
    if (hasImageNodes && !isOllamaSelected) {
        return { provider: 'OpenAi', model: 'gpt-4o' };
    } else if (hasImageNodes && isOllamaSelected) {
        // If ollama is selected and there are image nodes, either as local or global model, use LLaVA 7B
        return { provider: 'ollama', model: 'LLaVA' };
    } else if (provider === 'GLOBAL') {
        return Ai.determineModel();
    } else {
        // Use the local model selection
        return { provider, model };
    }
}


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
    // If there's no image URL but there is base64 image data
    if (node.imageData) {
        return {
            type: 'image_url',
            image_url: {
                url: node.imageData // Provide the base64 data as the url property of the image_url object
            }
        };
    }
    // If there's no image data or URL, return null or an appropriate placeholder
    return null;
}

async function callVisionModel(messages, onStreamComplete) {
    const inferenceOverride = {
        provider: 'OpenAi',
        model: 'gpt-4o'
    };

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
        onError: (err) => {
            functionErrorIcon.style.display = 'block';
            Logger.err("Error:", err);
        },
        inferenceOverride: inferenceOverride,
    });
}
