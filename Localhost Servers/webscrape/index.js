const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const sqlite3 = require('sqlite3').verbose();
const { JSDOM } = require('jsdom');
const pdf = require('pdf-parse');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize SQLite database
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the in-memory SQlite database.');
});

// Create necessary tables
db.serialize(() => {
    db.run('CREATE TABLE embeddings (key TEXT PRIMARY KEY, embedding TEXT)');
    db.run('CREATE TABLE webpage_text (url TEXT PRIMARY KEY, text TEXT)');
});


// Extract visible text from HTML
async function extractVisibleText(url) {
    try {
        const response = await fetch(url);
        const html = await response.text();

        const $ = cheerio.load(html);
        $('script, style, noscript, iframe, header, footer, nav').remove();
        const visibleText = $('body').text().replace(/\s\s+/g, ' ').trim();

        return visibleText || ''; // Return an empty string if the visibleText is falsy
    } catch (error) {
        console.error(`Error extracting text from ${url}: ${error}`);
        return '';
    }
}

// Extract text from PDF
async function extractTextFromPDF(url) {
    try {
        const response = await fetch(url);
        const data = await response.arrayBuffer();
        const pdfText = await pdf(data);
        return pdfText.text || ''; // Return an empty string if the pdfText.text is falsy
    } catch (error) {
        console.error(`Error extracting text from PDF ${url}: ${error}`);
        return '';
    }
}

// Define proxy route to fetch raw HTML from external URLs
app.get('/raw-proxy', async (req, res) => {
    try {
        const url = req.query.url;
        const response = await fetch(url);
        const html = await response.text();

        res.send(html);
    } catch (error) {
        console.error('Error fetching external URL:', error);
        res.status(500).send('Error fetching external URL');
    }
});

// Define proxy route to fetch content from external URLs
app.get('/proxy', async (req, res) => {
    try {
        const url = req.query.url;
        const response = await fetch(url);
        const contentType = response.headers.get("content-type");

        let extractedText = '';

        if (contentType.includes("text/html")) {
            extractedText = await extractVisibleText(url);
        } else if (contentType.includes("application/pdf")) {
            extractedText = await extractTextFromPDF(url);
        } else {
            res.status(400).send('Invalid content type');
            return;
        }

        res.send(extractedText);
    } catch (error) {
        console.error('Error fetching external URL:', error);
        res.status(500).send('Error fetching external URL');
    }
});

app.post('/store-embedding-and-text', (req, res) => {
    const { key, embedding, text } = req.body;
    db.run('INSERT OR REPLACE INTO embeddings (key, embedding) VALUES (?, ?)', [key, JSON.stringify(embedding)], (err) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Error storing embedding');
        } else {
            console.log('Embedding stored successfully');
            db.run('INSERT OR REPLACE INTO webpage_text (url, text) VALUES (?, ?)', [key, text], (err) => {
                if (err) {
                    console.error(err.message);
                    res.status(500).send('Error storing web page text');
                } else {
                    console.log('Web page text stored successfully');
                    res.send('Embedding and text stored successfully');
                }
            });
        }
    });
});

app.get('/fetch-embedding', async (req, res) => {
    const key = req.query.key;

    // Replace embeddingDatabase.get(key) with the appropriate SQLite query
    db.get('SELECT embedding FROM embeddings WHERE key = ?', [key], (err, row) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Error fetching embedding');
        } else if (row) {
            res.json(JSON.parse(row.embedding));
        } else {
            res.status(404).json({ error: 'Embedding not found' });
        }
    });
});

app.get('/fetch-web-page-text', (req, res) => {
    const url = req.query.url;
    db.get('SELECT text FROM webpage_text WHERE url = ?', [url], (err, row) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Error fetching web page text');
        } else if (row) {
            res.send(row.text);
        } else {
            res.status(404).send('Web page text not found');
        }
    });
});

app.get('/fetch-all-embeddings', (req, res) => {
    db.all('SELECT key, embedding, text FROM embeddings INNER JOIN webpage_text ON embeddings.key = webpage_text.url', (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Error fetching all embeddings');
        } else {
            const embeddings = [];
            for (const row of rows) {
                try {
                    console.log('row.embedding:', row.embedding);
                    console.log('row.text:', row.text);
                    const parsedEmbedding = JSON.parse(row.embedding);
                    // No need to parse row.text as JSON
                    const parsedChunks = row.text;
                    embeddings.push({
                        key: row.key,
                        embedding: parsedEmbedding,
                        chunks: parsedChunks
                    });
                } catch (error) {
                    console.error('Error parsing JSON for row:', row, 'Error:', error.message);
                }
            }
            res.json(embeddings);
        }
    });
});

// Function to log the contents of the database
function logDatabaseContents() {
    // Log the contents of the 'embeddings' table
    db.all('SELECT * FROM embeddings', [], (err, rows) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log('Contents of the embeddings table:');
            console.log(rows);
        }
    });

    // Log the contents of the 'webpage_text' table
    db.all('SELECT * FROM webpage_text', [], (err, rows) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log('Contents of the webpage_text table:');
            console.log(rows);
        }
    });
}

// Log the contents of the database when the server starts
logDatabaseContents();

// Define endpoint to fetch all database records
app.get('/fetch-all', (req, res) => {
    const response = {
        embeddings: [],
        webpage_text: []
    };

    db.all('SELECT * FROM embeddings', [], (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Error fetching embeddings');
        } else {
            response.embeddings = rows;
            db.all('SELECT * FROM webpage_text', [], (err, rows) => {
                if (err) {
                    console.error(err.message);
                    res.status(500).send('Error fetching webpage_text');
                } else {
                    response.webpage_text = rows;
                    res.json(response);
                }
            });
        }
    });
});
// Define endpoint to fetch all keys
app.get('/get-keys', (req, res) => {
    db.all('SELECT key FROM embeddings', [], (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Error fetching keys');
        } else {
            // Initialize an empty set to store distinct keys
            const distinctKeys = new Set();

            rows.forEach(row => {
                // Split the key on '_chunk_' and take the first part as the overall key
                const overallKey = row.key.split('_chunk_')[0];
                distinctKeys.add(overallKey);
            });

            // Convert the set of distinct keys back to an array
            const keys = Array.from(distinctKeys);
            res.json(keys);
        }
    });
});

// Delete all chunks for a key
app.delete('/delete-chunks', (req, res) => {
    const key = req.query.key;

    // Delete all rows where the key starts with the provided key followed by "_chunk_"
    db.run('DELETE FROM embeddings WHERE key LIKE ?', [`${key}_chunk_%`], function (err) {
        if (err) {
            console.error(err.message);
            res.status(500).send('Error deleting chunks');
        } else {
            res.send(`Deleted ${this.changes} chunks`);
        }
    });
});


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});