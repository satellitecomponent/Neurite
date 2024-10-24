let generateEmbeddings = {};

async function initializeEmbeddings(model) {
    if (generateEmbeddings[model]) {
        return; // Model already initialized
    }

    try {
        const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0/dist/transformers.min.js');

        // Ensure models are fetched from the remote source
        env.allowLocalModels = false;
        env.useBrowserCache = true;

        let modelName;
        switch (model) {
            case 'local-embeddings-gte-small':
                modelName = 'Supabase/gte-small';
                break;
            case 'local-embeddings-all-MiniLM-L6-v2':
                modelName = 'Xenova/all-MiniLM-L6-v2';
                break;
            default:
                throw new Error(`Unknown model: ${model}`);
        }

        console.log(`Loading model: ${modelName}`);

        // Specify the dtype for the pipeline (e.g., fp32 or fp16)
        generateEmbeddings[model] = await pipeline('feature-extraction', modelName, {
            dtype: 'fp32'  // You can also try 'fp16' if supported by your device
        });

        console.log(`Model loaded successfully: ${modelName}`);

        self.postMessage({ type: 'ready', model: model });
    } catch (error) {
        console.error('Error initializing embeddings:', error);
        self.postMessage({ type: 'error', error: error.message });
    }
}

self.onmessage = async function (e) {
    try {
        const { type, model, text } = e.data;

        if (type === 'initialize') {
            // Initialize the requested model
            await initializeEmbeddings(model);
        } else if (type === 'generate') {
            // Ensure the model is initialized
            if (!generateEmbeddings[model]) {
                self.postMessage({ type: 'error', error: `Embeddings not initialized for ${model}` });
                return;
            }

            // Ensure input text is valid
            if (typeof text !== 'string') {
                throw new Error('Input must be a string');
            }

            // Generate embeddings
            const output = await generateEmbeddings[model](text, {
                pooling: 'mean',
                normalize: true,
            });

            // Post the results back to the main thread
            self.postMessage({ type: 'result', data: Array.from(output.data) });
        } else {
            throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        console.error('Worker: Error processing message:', error);
        self.postMessage({ type: 'error', error: error.message });
    }
};
