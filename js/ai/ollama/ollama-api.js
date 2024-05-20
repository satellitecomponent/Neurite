
async function receiveOllamaModelList() {
    try {
        const response = await fetch(`${baseOllamaUrl}tags`);
        if (response.ok) {
            const data = await response.json();
            data.models.forEach(model => {
                if (model.name.includes(':latest')) {
                    model.name = model.name.replace(':latest', '');
                }
            });
            return data.models; // Access the models array
        } else {
            console.error('Failed to fetch model tags');
            return [];
        }
    } catch (error) {
        console.error('Error fetching model tags:', error);
        return [];
    }
}

async function getOllamaLibrary() {
    if (useProxy) {
        const response = await fetch('http://localhost:7070/ollama/library');
        const models = await response.json();
        //console.log(models); Use this to update the defaults...
        return models;
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
                    onProgress(progress);
                }
                if (data.status === 'success') {
                    onProgress(100);
                    ollamaCurrentInstallNamesMap.delete(name); // Remove from active downloads on success
                    return true;
                }
            }
        }
    } catch (error) {
        console.error('Error pulling model with progress:', error);
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
