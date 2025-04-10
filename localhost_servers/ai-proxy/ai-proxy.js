require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

// Initialize API keys
let openaiApiKey = process.env.OPENAI_API_KEY;
let anthropicApiKey = process.env.ANTHROPIC_API_KEY;
let groqApiKey = process.env.GROQ_API_KEY;
let customApiKey = process.env.CUSTOM_API_KEY;

// Ollama Base URL
let ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/api/';

// Endpoint to receive API keys from the client-side JavaScript
app.post('/api-keys', (req, res) => {
    const { openaiApiKey: clientOpenaiApiKey, groqApiKey: clientGroqApiKey, anthropicApiKey: clientAnthropicApiKey, ollamaBaseUrl: clientOllamaBaseUrl } = req.body;

    if (clientOpenaiApiKey) openaiApiKey = clientOpenaiApiKey;
    if (clientGroqApiKey) groqApiKey = clientGroqApiKey;
    if (clientAnthropicApiKey) anthropicApiKey = clientAnthropicApiKey;
    if (clientOllamaBaseUrl) ollamaBaseUrl = clientOllamaBaseUrl;

    res.sendStatus(200);
});

function modifyRequestByApiType(apiType, headers, apiKey) {
    headers['Content-Type'] = 'application/json';
    headers['Authorization'] = `Bearer ${apiKey}`;

    if (apiType === 'anthropic') {
        headers['OpenAI-Version'] = '2020-10-01';
    }
}


const activeRequests = new Map();

function modifyResponseByApiType(apiType, response, res, stream, requestId) {
    return new Promise((resolve, reject) => {
        const cleanup = () => {
            if (requestId) {
                activeRequests.delete(requestId);
            }
        };

        if (stream) {
            response.data.pipe(res);
            response.data.on('end', () => {
                cleanup();
                resolve();
            });
            response.data.on('error', (error) => {
                cleanup();
                reject(error);
            });
        } else {
            res.json(response.data);
            cleanup();
            resolve();
        }
    });
}

async function handleApiRequest(req, res, apiEndpoint, apiKey, apiType, additionalOptions = {}) {
    const { model, messages, max_tokens, temperature, stream, requestId } = req.body;
    const requestBody = {
        model,
        messages,
        max_tokens,
        temperature,
        stream,
        ...additionalOptions
    };
    const cancelToken = axios.CancelToken.source();

    if (requestId) {
        activeRequests.set(requestId, { cancelToken, res });
    }

    try {
        const headers = {};
        modifyRequestByApiType(apiType, headers, apiKey);

        const response = await axios.post(apiEndpoint, requestBody, {
            headers: headers,
            responseType: stream ? 'stream' : 'json',
            cancelToken: cancelToken.token
        });

        await modifyResponseByApiType(apiType, response, res, stream, requestId);
    } catch (error) {
        if (axios.isCancel(error)) {
            console.log('Request already canceled:', requestId);
        } else {
            console.error('Error calling API:', error);
            console.error('Error details:', error.response ? error.response.data : error.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to call API' });
            }
        }
    } finally {
        if (requestId) {
            activeRequests.delete(requestId);
        }
    }
}

app.post('/cancel', (req, res) => {
    const { requestId } = req.body;
    if (activeRequests.has(requestId)) {
        const { cancelToken, res: requestRes } = activeRequests.get(requestId);
        cancelToken.cancel('Request cancelled by client');
        if (!requestRes.headersSent) {
            requestRes.status(499).json({ error: 'Request canceled by the client' });
        }
        activeRequests.delete(requestId);
        res.status(200).json({ message: 'Request cancelled successfully' });
    } else {
        console.log('Request not found for cancellation:', requestId);
        res.status(404).json({ error: 'Request not found' });
    }
});

// Proxy routes
app.post('/openai', async (req, res) => {
    await handleApiRequest(req, res, 'https://api.openai.com/v1/chat/completions', openaiApiKey, 'openai');
});

app.post('/anthropic', async (req, res) => {
    await handleApiRequest(req, res, 'https://api.anthropic.com/v1/chat/completions', anthropicApiKey, 'anthropic');
});

app.post('/groq', async (req, res) => {
    await handleApiRequest(req, res, 'https://api.groq.com/openai/v1/chat/completions', groqApiKey, 'groq');
});

app.post('/ollama/chat', async (req, res) => {
    await handleApiRequest(req, res, `${ollamaBaseUrl}chat`, null, 'ollama', { context: "" });
});

app.post('/custom', async (req, res) => {
    const { apiEndpoint, apiKey: reqApiKey } = req.body;
    const effectiveApiKey = reqApiKey || customApiKey;
    await handleApiRequest(req, res, apiEndpoint, effectiveApiKey);
});

app.get('/ollama/tags', async (req, res) => {
    try {
        const response = await axios.get(`${ollamaBaseUrl}tags`);
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching Ollama tags:', error);
        res.status(500).json({ error: 'Failed to fetch Ollama tags' });
    }
});
app.get('/ollama/library', async (req, res) => {
    try {
        const response = await axios.get('https://ollama.com/library');
        const $ = cheerio.load(response.data);
        const models = [];
        $('li a[href^="/library/"]').each((index, element) => {
            const modelName = $(element).text().trim();
            models.push({ name: modelName });
        });
        res.json(models);
    } catch (error) {
        console.error('Error fetching Ollama library:', error);
        if (error.response && error.response.status === 500) {
            // Handle specific 500 Internal Server Error
            res.status(500).json({ error: 'Ollama library page is currently unavailable.' });
        } else {
            // Handle other errors
            res.status(500).json({ error: 'Failed to fetch Ollama library' });
        }
    }
});

app.post('/ollama/embeddings', async (req, res) => {
    const { model, prompt, options, keep_alive } = req.body;
    try {
        const response = await axios.post(`${ollamaBaseUrl}embeddings`, {
            model,
            prompt,
            options,
            keep_alive
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error generating embeddings:', error);
        res.status(500).json({ error: 'Failed to generate embeddings' });
    }
});

app.post('/ollama/pull', async (req, res) => {
    const { name, insecure, stream } = req.body;
    try {
        const response = await axios.post(`${ollamaBaseUrl}pull`, {
            name,
            insecure,
            stream
        }, {
            responseType: 'stream'
        });

        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Transfer-Encoding': 'chunked'
        });

        response.data.on('data', (chunk) => {
            res.write(chunk);
        });

        response.data.on('end', () => {
            res.end();
        });
    } catch (error) {
        console.error('Error pulling model:', error);
        res.status(500).json({ error: 'Failed to pull model' });
    }
});

app.delete('/ollama/delete', async (req, res) => {
    const { name } = req.body;
    try {
        const response = await axios.delete(`${ollamaBaseUrl}delete`, {
            data: { name }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error deleting model:', error);
        res.status(500).json({ error: 'Failed to delete model' });
    }
});

app.post('/ollama/create', async (req, res) => {
    const { name, modelfile, stream, path } = req.body;
    try {
        const response = await axios.post(`${ollamaBaseUrl}create`, {
            name,
            modelfile,
            stream,
            path
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error creating model:', error);
        res.status(500).json({ error: 'Failed to create model' });
    }
});

app.post('/ollama/show', async (req, res) => {
    const { name } = req.body;
    try {
        const response = await axios.post(`${ollamaBaseUrl}show`, {
            name
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error showing model information:', error);
        res.status(500).json({ error: 'Failed to show model information' });
    }
});

// Check if a Blob Exists
app.head('/ollama/blobs/:digest', async (req, res) => {
    const { digest } = req.params;
    try {
        const response = await axios.head(`${ollamaBaseUrl}blobs/${digest}`);
        res.status(response.status).end();
    } catch (error) {
        console.error('Error checking blob:', error);
        res.status(404).json({ error: 'Blob not found' });
    }
});

// Create a Blob
app.post('/ollama/blobs/:digest', async (req, res) => {
    const { digest } = req.params;
    try {
        const response = await axios.post(`${ollamaBaseUrl}blobs/${digest}`, req.body, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        res.status(201).json(response.data);
    } catch (error) {
        console.error('Error creating blob:', error);
        res.status(400).json({ error: 'Failed to create blob' });
    }
});

app.post('/ollama/push', async (req, res) => {
    const { name, insecure, stream } = req.body;
    try {
        const response = await axios.post(`${ollamaBaseUrl}push`, {
            name,
            insecure,
            stream
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error pushing model:', error);
        res.status(500).json({ error: 'Failed to push model' });
    }
});

module.exports = app;