require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cheerio = require('cheerio');
const app = express();
const PORT = process.env.PORT || 7070;

// Initialize API keys
let openaiApiKey = process.env.OPENAI_API_KEY;
let groqApiKey = process.env.GROQ_API_KEY;
let customApiKey = process.env.CUSTOM_API_KEY;

// Middleware to parse JSON request bodies
app.use(express.json());

// Enable CORS for all routes
app.use(cors());

// Endpoint to check if the proxy server is working
app.get('/check', (req, res) => {
    res.sendStatus(200);
});

// Endpoint to receive API keys from the client-side JavaScript
app.post('/api-keys', (req, res) => {
    const { openaiApiKey: clientOpenaiApiKey, groqApiKey: clientGroqApiKey } = req.body;

    if (!openaiApiKey && clientOpenaiApiKey) {
        openaiApiKey = clientOpenaiApiKey;
        console.log('OpenAI API Key received from client-side JavaScript');
    }

    if (!groqApiKey && clientGroqApiKey) {
        groqApiKey = clientGroqApiKey;
        console.log('GROQ API Key received from client-side JavaScript');
    }

    res.sendStatus(200);
});

// Helper function to handle API requests and cancellation
async function handleApiRequest(req, res, apiEndpoint, apiKey, additionalOptions = {}) {
    const { model, messages, max_tokens, temperature, stream, requestId } = req.body;

    const requestBody = {
        model,
        messages,
        max_tokens,
        temperature,
        stream,
        ...additionalOptions
    };

    // Only include requestId in the request body if it is provided
    if (requestId) {
        requestBody.requestId = requestId;
    }

    const cancelToken = axios.CancelToken.source();

    try {
        const response = await axios.post(apiEndpoint, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
            },
            responseType: stream ? 'stream' : 'json',
            cancelToken: cancelToken.token
        });

        if (stream) {
            response.data.pipe(res);
            res.on('close', () => {
                cancelToken.cancel('Request canceled by the client');
            });
        } else {
            res.json(response.data);
        }
    } catch (error) {
        if (axios.isCancel(error)) {
            console.log('Request canceled:', requestId);
            res.status(499).json({ error: 'Request canceled by the client' });
        } else {
            console.error('Error calling API:', error);
            res.status(500).json({ error: 'Failed to call API' });
        }
    }
}

// Proxy routes
app.post('/groq', async (req, res) => {
    await handleApiRequest(req, res, 'https://api.groq.com/openai/v1/chat/completions', groqApiKey);
});

app.post('/openai', async (req, res) => {
    await handleApiRequest(req, res, 'https://api.openai.com/v1/chat/completions', openaiApiKey);
});

app.post('/ollama/chat', async (req, res) => {
    await handleApiRequest(req, res, 'http://127.0.0.1:11434/api/chat', null, { context: "" });
});

app.post('/custom', async (req, res) => {
    const { apiEndpoint, apiKey: reqApiKey } = req.body;
    const effectiveApiKey = reqApiKey || customApiKey;
    await handleApiRequest(req, res, apiEndpoint, effectiveApiKey);
});

app.get('/ollama/tags', async (req, res) => {
    try {
        const response = await axios.get('http://127.0.0.1:11434/api/tags');
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
        const response = await axios.post('http://127.0.0.1:11434/api/embeddings', {
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
        const response = await axios.post('http://127.0.0.1:11434/api/pull', {
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
        const response = await axios.delete('http://127.0.0.1:11434/api/delete', {
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
        const response = await axios.post('http://127.0.0.1:11434/api/create', {
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
        const response = await axios.post('http://127.0.0.1:11434/api/show', {
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
        const response = await axios.head(`http://127.0.0.1:11434/api/blobs/${digest}`);
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
        const response = await axios.post(`http://127.0.0.1:11434/api/blobs/${digest}`, req.body, {
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
        const response = await axios.post('http://127.0.0.1:11434/api/push', {
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

// Start the server
app.listen(PORT, () => {
    console.log(`Proxy server is running on port ${PORT}`);
});