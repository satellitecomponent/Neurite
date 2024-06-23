
let generateEmbeddings = {};

async function initializeEmbeddings(model) {
    if (generateEmbeddings[model]) {
        return; // Model already initialized
    }

    const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0');

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

    generateEmbeddings[model] = await pipeline('feature-extraction', modelName);
    
    self.postMessage({ type: 'ready', model: model });
}

self.onmessage = async function (e) {
    if (e.data.type === 'initialize') {
        await initializeEmbeddings(e.data.model);
        return;
    }

    const model = e.data.model;
    if (!generateEmbeddings[model]) {
        self.postMessage({ type: 'error', error: `Embeddings not initialized for ${model}` });
        return;
    }

    try {
        if (typeof e.data.text !== 'string') {
            throw new Error('Input must be a string');
        }
        const output = await generateEmbeddings[model](e.data.text, {
            pooling: 'mean',
            normalize: true,
        });
        self.postMessage({ type: 'result', data: Array.from(output.data) });
    } catch (error) {
        console.error('Worker: Error generating embeddings:', error);
        self.postMessage({ type: 'error', error: error.message });
    }
};