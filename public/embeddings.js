import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.3.0';

let browserEmbeddingsInitialized = false;

async function initializeBrowserEmbeddings() {
   try {
       window.generateEmbeddings = await pipeline(
           'feature-extraction',
           'Supabase/gte-small',
       );
       browserEmbeddingsInitialized = true;
    } catch (error) {
        console.error('Error initializing the model:', error);
    }
}
initializeBrowserEmbeddings();