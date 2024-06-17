require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cheerio = require('cheerio');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 7070;

// Initialize API keys
let openaiApiKey = process.env.OPENAI_API_KEY;
let anthropicApiKey = process.env.ANTHROPIC_API_KEY;
let groqApiKey = process.env.GROQ_API_KEY;
let customApiKey = process.env.CUSTOM_API_KEY;

// Middleware to parse JSON request bodies
app.use(express.json({ limit: '50mb' })); // Increase the limit to handle large payloads
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Enable CORS for all routes
app.use(cors({
    origin: 'http://localhost:8080', // Adjust this to match your client origin
    methods: 'GET,POST',
    allowedHeaders: 'Content-Type,Authorization'
}));

// Endpoint to check if the proxy server is working
app.get('/check', (req, res) => {
    res.sendStatus(200);
});

// Endpoint to receive API keys from the client-side JavaScript
app.post('/api-keys', (req, res) => {
    const { openaiApiKey: clientOpenaiApiKey, groqApiKey: clientGroqApiKey, anthropicApiKey: clientAnthropicApiKey } = req.body;
    if (!openaiApiKey && clientOpenaiApiKey) {
        openaiApiKey = clientOpenaiApiKey;
        console.log('OpenAI API Key received from client-side JavaScript');
    }
    if (!groqApiKey && clientGroqApiKey) {
        groqApiKey = clientGroqApiKey;
        console.log('GROQ API Key received from client-side JavaScript');
    }
    if (!anthropicApiKey && clientAnthropicApiKey) {
        anthropicApiKey = clientAnthropicApiKey;
        console.log('Anthropic API Key received from client-side JavaScript');
    }
    res.sendStatus(200);
});

// Function to modify the request body and headers based on the API type
function modifyRequestByApiType(apiType, requestBody, headers, apiKey) {
    switch (apiType) {
        case 'anthropic':
            headers['x-api-key'] = apiKey;
            headers['anthropic-version'] = '2023-06-01';
            // Extract system messages and concatenate the remaining messages
            if (requestBody.messages && requestBody.messages.length > 0) {
                const systemMessages = requestBody.messages.filter(msg => msg.role === 'system');
                if (systemMessages.length > 0) {
                    requestBody.system = systemMessages.map(msg => msg.content).join('\n');
                }
                requestBody.messages = requestBody.messages
                    .filter(msg => msg.role !== 'system')
                    .map(msg => ({ role: msg.role, content: msg.content }));
            }
            break;
        default:
            headers['Authorization'] = `Bearer ${apiKey}`;
            break;
    }
}

// Function to modify the response based on the API type
function modifyResponseByApiType(apiType, response, res, stream) {
    switch (apiType) {
        case 'anthropic':
            if (stream) {
                let responseText = '';
                response.data.on('data', (chunk) => {
                    responseText += chunk.toString();
                    const lines = responseText.split('\n');
                    responseText = lines.pop();
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data !== '[DONE]') {
                                try {
                                    const payload = JSON.parse(data);
                                    if (payload.type === 'content_block_delta') {
                                        const content = payload.delta.text;
                                        const transformedResponse = {
                                            choices: [{ delta: { content } }],
                                        };
                                        res.write(`data: ${JSON.stringify(transformedResponse)}\n\n`);
                                    }
                                } catch (error) {
                                    console.error('Error parsing JSON:', error);
                                }
                            }
                        }
                    }
                });
                response.data.on('end', () => {
                    res.write(`data: [DONE]\n\n`);
                    res.end();
                });
            } else {
                const content = response.data.content.map(block => block.text).join('');
                const transformedResponse = {
                    choices: [{ message: { content: content.trim() } }],
                };
                res.json(transformedResponse);
            }
            break;
        default:
            if (stream) {
                response.data.pipe(res);
            } else {
                res.json(response.data);
            }
            break;
    }
}

// Helper function to handle API requests and cancellation
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
    // Only include requestId in the request body if it is provided
    if (requestId) {
        requestBody.requestId = requestId;
    }
    const cancelToken = axios.CancelToken.source();
    try {
        const headers = {
            'Content-Type': 'application/json',
        };
        modifyRequestByApiType(apiType, requestBody, headers, apiKey);
        const response = await axios.post(apiEndpoint, requestBody, {
            headers: headers,
            responseType: stream ? 'stream' : 'json',
            cancelToken: cancelToken.token
        });
        modifyResponseByApiType(apiType, response, res, stream);
    } catch (error) {
        if (axios.isCancel(error)) {
            console.log('Request canceled:', requestId);
            res.status(499).json({ error: 'Request canceled by the client' });
        } else {
            console.error('Error calling API:', error);
            console.error('Error details:', error.response ? error.response.data : error.message);
            res.status(500).json({ error: 'Failed to call API' });
        }
    }
}

// Proxy routes
app.post('/openai', async (req, res) => {
    await handleApiRequest(req, res, 'https://api.openai.com/v1/chat/completions', openaiApiKey, 'openai');
});

app.post('/anthropic', async (req, res) => {
    await handleApiRequest(req, res, 'https://api.anthropic.com/v1/messages', anthropicApiKey, 'anthropic');
});

app.post('/groq', async (req, res) => {
    await handleApiRequest(req, res, 'https://api.groq.com/openai/v1/chat/completions', groqApiKey, 'groq');
});

app.post('/ollama/chat', async (req, res) => {
    await handleApiRequest(req, res, 'http://127.0.0.1:11434/api/chat', null, 'ollama', { context: "" });
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