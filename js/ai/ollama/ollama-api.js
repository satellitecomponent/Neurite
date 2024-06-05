
async function receiveOllamaModelList(includeEmbeddingsModels = false) {
    try {
        const response = await fetch(`${baseOllamaUrl}tags`);
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
            // Use the default models when an error occurs or the request times out
            return defaultOllamaModels;
        }
    } else {
        return defaultOllamaModels;
    }
}


async function getAvailableModels() {
    if (!ollamaLibrary) {
        ollamaLibrary = await getOllamaLibrary();
    }

    const cleanedModels = [];

    ollamaLibrary.forEach(model => {
        const lines = model.name.split('\n').map(line => line.trim());
        const name = lines[0];
        const description = lines.find(line => line.length > 0 && line !== name);
        const sizes = lines.filter(line => /^\d+[Bb]$/.test(line)).map(size => size.toLowerCase());

        if (sizes.length === 0) {
            cleanedModels.push({
                name: name,
                title: description || ''
            });
        } else if (sizes.length === 1) {
            cleanedModels.push({
                name: name,
                title: description || ''
            });
        } else {
            const minSize = Math.min(...sizes.map(size => parseInt(size)));
            sizes.forEach(size => {
                if (parseInt(size) === minSize) {
                    cleanedModels.push({
                        name: name,
                        title: description || ''
                    });
                } else {
                    cleanedModels.push({
                        name: `${name}:${size}`,
                        title: description || ''
                    });
                }
            });
        }
    });

    return cleanedModels;
}

async function pullOllamaModelWithProgress(name, onProgress) {
    try {
        const response = await fetch(`${baseOllamaUrl}pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, stream: true })
        });

        if (!response.body) {
            console.error('Failed to pull model: No response body');
            ollamaCurrentInstallNamesMap.delete(name); // Remove from active downloads on failure
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
                    ollamaCurrentInstallNamesMap.delete(name); // Remove from active downloads on success
                    return true;
                }
            }
        }
    } catch (error) {
        console.error('Error pulling model:', error);
        ollamaCurrentInstallNamesMap.delete(name); // Remove from active downloads on error
        return false;
    }
}

async function deleteOllamaModel(name) {
    try {
        const response = await fetch(`${baseOllamaUrl}delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (response.ok) {
            console.log('Model deleted successfully');
            return true;
        } else {
            console.error('Failed to delete model');
            return false;
        }
    } catch (error) {
        console.error('Error deleting model:', error);
        return false;
    }
}

async function generateOllamaEmbedding(model, prompt) {
    try {
        const response = await fetch(`${baseOllamaUrl}embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt })
        });
        if (response.ok) {
            const data = await response.json();
            return data.embedding;
        } else {
            console.error('Failed to generate embeddings');
            return null;
        }
    } catch (error) {
        console.error('Error generating embeddings:', error);
        return null;
    }
}
