require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 7070; // Proxy server port

// Initialize API keys
let openaiApiKey = process.env.OPENAI_API_KEY;
let groqApiKey = process.env.GROQ_API_KEY;

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

// Proxy routes
app.post('/groq', async (req, res) => {
  const { model, messages, max_tokens, temperature, stream } = req.body;
  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', req.body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`
      },
      responseType: stream ? 'stream' : 'json'
    });

    if (stream) {
      response.data.pipe(res);
    } else {
      res.json(response.data);
    }
  } catch (error) {
    console.error('Error calling GROQ API:', error);
    res.status(500).json({ error: 'Failed to call GROQ API' });
  }
});

app.post('/openai', async (req, res) => {
  const { model, messages, max_tokens, temperature, stream } = req.body;
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', req.body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      responseType: stream ? 'stream' : 'json'
    });

    if (stream) {
      response.data.pipe(res);
    } else {
      res.json(response.data);
    }
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    res.status(500).json({ error: 'Failed to call OpenAI API' });
  }
});

app.post('/ollama', async (req, res) => {
    const { model, messages, max_tokens, temperature, stream } = req.body;

    // Prepare the request body for Ollama API, including an empty context.
    const requestBody = {
        model,
        messages,
        max_tokens,
        temperature,
        stream,
        context: "" // Setting context to blank
    };

    try {
        const response = await axios.post('http://127.0.0.1:11434/api/chat', requestBody, {
            headers: {
                'Content-Type': 'application/json',
            },
            responseType: stream ? 'stream' : 'json'
        });

        if (stream) {
            response.data.pipe(res);
        } else {
            res.json(response.data);
        }
    } catch (error) {
        console.error('Error calling Ollama API:', error);
        res.status(500).json({ error: 'Failed to call Ollama API' });
    }
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

// Start the server
app.listen(PORT, () => {
  console.log(`Proxy server is running on port ${PORT}`);
});