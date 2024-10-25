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
            console.error('Failed to fetch model tags');
            return [];
        }
    } catch (error) {
        console.error('Error fetching model tags:', error);
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
                fetch('http://localhost:7070/ollama/library'),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timed out')), 2500)
                ),
            ]);

            if (!response.ok) {
                throw new Error('Failed to fetch Ollama library from proxy');
            }

            const models = await response.json();
            return models;
        } catch (error) {
            console.error('Error fetching Ollama library from proxy:', error);
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
            console.error('Failed to pull model: No response body');
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
        console.error('Error pulling model:', err);
        Ollama.curInstalledNames.delete(name); // Remove from active downloads on error
        return false;
    }
}

Ollama.deleteModel = async function(name){
    return await Request.send(new Ollama.deleteModel.ct(name))
}
Ollama.deleteModel.ct = class {
    constructor(name){
        this.url = Ollama.baseUrl + 'delete';
        this.options = {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        };
        this.name = name;
    }
    onSuccess(){ return `Model ${this.name} deleted successfully` }
    onFailure(){ return `Failed to delete model ${this.name}:` }
}

async function generateOllamaEmbedding(model, prompt) {
    const response = await Request.send(new generateOllamaEmbedding.ct(model, prompt));
    if (!response) return;

    const data = await response.json();
    return data.embedding;
}
generateOllamaEmbedding.ct = class {
    constructor(model, prompt){
        this.url = Ollama.baseUrl + 'delete';
        this.options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt })
        };
    }
    onFailure(){ return "Failed to generate embeddings:" }
}
