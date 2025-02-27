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

// Converts a blob URL to a Base64 data URL using an Image and Canvas.
function convertBlobUrlToBase64(blobUrl) {
    return new Promise((resolve, reject) => {
        const imageElement = new Image();
        // Uncomment the following if cross-origin issues are a concern.
        // imageElement.crossOrigin = "Anonymous";

        imageElement.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = imageElement.naturalWidth;
            canvas.height = imageElement.naturalHeight;
            const context = canvas.getContext('2d');

            try {
                context.drawImage(imageElement, 0, 0);
                // Get Base64 encoded image as a data URL
                const dataURL = canvas.toDataURL('image/png');
                resolve(dataURL);
            } catch (error) {
                reject(error);
            }
        };

        imageElement.onerror = (error) => {
            reject(error);
        };

        imageElement.src = blobUrl;
    });
}

async function getImageNodeData(node) {
    let imageUrl = node.imageData;
    if (imageUrl.startsWith('blob:')) imageUrl = await convertBlobUrlToBase64(imageUrl);
    if (!imageUrl.startsWith('data:image/')) imageUrl = `data:image/png;base64,${imageUrl}`;
    return imageUrl;
}

View.Code.prototype.callVisionModel = async function(messages, onStreamComplete){
    const requestId = generateRequestId();
    const controller = new AbortController();

    activeRequests.set(requestId, { type: 'function', controller });

    callAiApi({
        messages,
        stream: true, // Assuming streaming is not required for vision model
        customTemperature: null, // Or specify a custom temperature if needed
        onBeforeCall: ()=>{
            this.isAiProcessing = true;
            this.updateUiForProcessing();
        },
        onStreamingResponse: (content)=>{
            const cm = this.cm.cm;
            cm.getDoc().replaceRange(content, CodeMirror.Pos(cm.lastLine()));
        },
        onAfterCall: ()=>{
            this.isAiProcessing = false;
            this.updateUiForIdleState();
            if (onStreamComplete) onStreamComplete(); // Call the callback after streaming is complete
        },
        onError: (err)=>{
            this.iconError.style.display = 'block';
            Logger.err(err);
        },
        inferenceOverride: {
            provider: 'OpenAi',
            model: 'gpt-4o'
        },
        controller,
        requestId
    });
}
