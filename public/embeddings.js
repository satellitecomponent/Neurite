import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.3.0';

let modelInitialized = false;

async function initialize() {
   try {
       window.generateEmbeddings = await pipeline(
           'feature-extraction',
           'Supabase/gte-small',
       );
        modelInitialized = true;
        document.getElementById("local-embeddings-checkbox").disabled = false;
    } catch (error) {
        console.error('Error initializing the model:', error);
    }
}

document.getElementById("local-embeddings-checkbox").disabled = true;
initialize();