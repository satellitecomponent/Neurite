function post(type, res){ self.postMessage({ type, res }) }
post.error = post.bind(self, 'error');

class Model {
    urlTransformers = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0/dist/transformers.min.js';
    #promExtractor = null;
    constructor(apiName, pipelineName){
        this.apiName = apiName;
        this.pipelineName = pipelineName;
    }

    initialize(input){
        return import(this.urlTransformers)
                .then(this.#getExtractor.bind(this))
                .then(this.#postReady.bind(this), this.#onInitError)
    }
    #getExtractor(transformers){
        const { pipeline, env } = transformers;

        // Ensure models are fetched from the remote source
        env.allowLocalModels = false;
        env.useBrowserCache = true;

        const modelName = this.pipelineName;
        console.log("Loading model: " + modelName);
        return pipeline('feature-extraction', modelName, {
            dtype: 'fp32'  // You can also try 'fp16' if supported by your device
        });
    }
    #postReady(extractor){
        console.log("Model loaded successfully: " + this.pipelineName);
        post('ready', this.apiName);
        return extractor;
    }
    #onInitError = (err)=>{
        console.error("Error initializing embeddings:", err);
        return Promise.reject(err);
    }

    generate(text){
        if (typeof text !== 'string') {
            post.error("Input must be a string");
            return Promise.resolve();
        }

        const onExtractor = this.#passTextToExtractor.bind(this, text);
        return (this.#promExtractor ||= this.initialize())
                .then(onExtractor, this.#postError);
    }
    #passTextToExtractor(text, extractor){
        const options = {
            pooling: 'mean',
            normalize: true,
        };
        return extractor(text, options).then(this.#postResult);
    }
    #postResult(output){ post('result', Array.from(output.data)) }
    #postError = (err)=>{ post.error(err.message) }
}

const models = {
    'local-embeddings-gte-small': new Model('local-embeddings-gte-small', 'Supabase/gte-small'),
    'local-embeddings-all-MiniLM-L6-v2': new Model('local-embeddings-all-MiniLM-L6-v2', 'Xenova/all-MiniLM-L6-v2')
}

self.onmessage = function(e){
    const { verb, modelName, input } = e.data;

    const model = models[modelName];
    if (!model) return post.error("Unknown model: " + modelName);
    if (!model[verb]) return post.error("Unknown message type: " + type);

    model[verb](input).catch( (err)=>{
        console.error('Worker: Error processing message:', err);
        post.error(err.message);
    });
}
