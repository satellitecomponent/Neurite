async function receiveOllamaModelList(includeEmbeddingsModels = false) {
    try {
        const response = await fetch(Ollama.baseUrl + 'tags');
        if (response.ok) {
            const data = await response.json();
            let models = data.models;

            // Remove the ':latest' suffix from model names
            models = models.map(model => {
                if (model.name.includes(':latest')) {
                    return {
                        ...model,
                        name: model.name.replace(':latest', '')
                    };
                }
                return model;
            });

            // Filter out embeddings models if includeEmbeddingsModels is false
            if (!includeEmbeddingsModels) {
                models = models.filter(model => !isEmbeddingsModel(model.name));
            }

            return models;
        } else {
            Logger.err("Failed to fetch model tags");
            return [];
        }
    } catch (error) {
        Logger.err("In fetching model tags:", error);
        return [];
    }
}

function isEmbeddingsModel(modelName) {
    const embeddingsModels = ["mxbai-embed-large", "nomic-embed-text", "all-minilm"];
    return embeddingsModels.includes(modelName);
}

async function getOllamaLibrary() {
    if (useProxy) {
        try {
            const response = await Promise.race([
                fetch(Host.urlForPath('/aiproxy/ollama/library')),
                new Promise((_, reject) =>
                    setTimeout( ()=>reject(new Error("Request timed out")) , 2500)
                ),
            ]);

            if (!response.ok) {
                throw new Error("Failed to fetch Ollama library from proxy")
            }

            const models = await response.json();
            return models;
        } catch (err) {
            Logger.err("In fetching Ollama library from proxy:", err)
        }
    }
    return Ollama.defaultModels;
}

async function pullOllamaModelWithProgress(name, onProgress) {
    try {
        const response = await fetch(Ollama.baseUrl + 'pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, stream: true })
        });

        const curInstalledNames = Ollama.curInstalledNames;
        if (!response.body) {
            Logger.err("Failed to pull model: No response body");
            curInstalledNames.delete(name); // Remove from active downloads on failure
            return false;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let receivedLength = 0;
        let totalLength = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            receivedLength += chunk.length;

            const lines = chunk.split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
                const data = JSON.parse(line);
                if (data.total) totalLength = data.total;
                if (data.completed && totalLength) {
                    const progress = (data.completed / totalLength) * 100;
                    if (typeof onProgress === 'function') {
                        onProgress(progress);
                    }
                }
                if (data.status === 'success') {
                    if (typeof onProgress === 'function') {
                        onProgress(100);
                    }
                    curInstalledNames.delete(name); // Remove from active downloads on success
                    return true;
                }
            }
        }
    } catch (err) {
        Logger.err("In pulling model:", err);
        Ollama.curInstalledNames.delete(name); // Remove from active downloads on error
        return false;
    }
}

Ollama.deleteModel = async function(name){
    await Request.send(new Ollama.modelEraser(name))
}
Ollama.modelEraser = class {
    url = Ollama.baseUrl + 'delete';
    constructor(name){
        this.options = Request.makeJsonOptions('DELETE', { name });
        this.name = name;
    }
    onSuccess(){ return `Model ${this.name} deleted successfully` }
    onFailure(){ return `Failed to delete model ${this.name}:` }
}

Ollama.fetchEmbeddings = function(model, prompt){ // promise
    return Request.send(new Ollama.embeddingsFetcher(model, prompt))
}
Ollama.embeddingsFetcher = class {
    url = Ollama.baseUrl + 'embeddings';
    constructor(model, prompt){
        this.options = Request.makeJsonOptions('POST', { model, prompt })
    }
    onResponse(res){ return res.json().then(this.onData) }
    onData(data){ return data.embedding }
    onFailure(){ return "Failed to generate embeddings:" }
}
