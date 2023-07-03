//import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.3.0';

import { pipeline } from '@xenova/transformers';

let modelInitialized = false;

async function initialize() {
   try {
       window.generateEmbeddings = await pipeline(
            'feature-extraction',
           'Xenova/all-MiniLM-L6-v2'
        );
        modelInitialized = true;
        document.getElementById("local-embeddings-checkbox").disabled = false;
    } catch (error) {
        console.error('Error initializing the model:', error);
    }
}

document.getElementById("local-embeddings-checkbox").disabled = true;
initialize();