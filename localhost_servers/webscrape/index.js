const express = require('express');
const fetch = require('node-fetch');
const sqlite3 = require('sqlite3').verbose();
const pdf = require('pdf-parse');
const cheerio = require('cheerio');

const app = express();

// Initialize SQLite database
const db = new sqlite3.Database('database.db', (err) => {
    if (err) {
        console.error(err.message);
    }
});


// Create necessary tables
db.serialize(() => {
    // Create the embeddings table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS embeddings (
    key TEXT PRIMARY KEY,
    embeddings TEXT,
    text TEXT
)`);
    db.run('CREATE TABLE IF NOT EXISTS webpage_text (url TEXT PRIMARY KEY, text TEXT)');
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
        } else if (contentType.includes("text/plain")) {
            // Directly return the plain text content.
            extractedText = await response.text();
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



app.post('/store-embedding-and-text', (req, res) => {
    const { key, embeddings, text } = req.body;

    db.run('INSERT OR REPLACE INTO embeddings (key, embeddings, text) VALUES (?, ?, ?)', [key, JSON.stringify(embeddings), text], (err) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Error storing embedding and text');
        }
    });
});

app.post('/store-additional-embedding', (req, res) => {
    const { key, source, embedding } = req.body;

    // Retrieve the existing embedding from the database
    db.get('SELECT * FROM embeddings WHERE key = ?', [key], (err, row) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Error fetching embedding');
        } else if (row) {
            const existingEmbeddings = JSON.parse(row.embeddings);

            // Check if the source already exists in the embeddings array
            const existingEmbeddingIndex = existingEmbeddings.findIndex(e => e.source === source);

            if (existingEmbeddingIndex !== -1) {
                // Update the existing embedding for the source
                existingEmbeddings[existingEmbeddingIndex].embedding = embedding;
            } else {
                // Add the new source and embedding to the embeddings array
                existingEmbeddings.push({ source, embedding });
            }

            // Update the embeddings in the database
            db.run('UPDATE embeddings SET embeddings = ? WHERE key = ?', [JSON.stringify(existingEmbeddings), key], (err) => {
                if (err) {
                    console.error(err.message);
                    res.status(500).send('Error updating embedding');
                } else {
                    res.send('Embedding updated successfully');
                }
            });
        } else {
            res.status(404).json({ error: 'Embedding not found' });
        }
    });
});

app.post('/fetch-embeddings-by-keys', async (req, res) => {
    const { keys, source } = req.body;
    if (!Array.isArray(keys)) {
        return res.status(400).json({ error: 'Keys must be an array.' });
    }

    // Modify the placeholders to use the LIKE operator
    const placeholders = keys.map(() => '?').join(', ');
    const query = `SELECT * FROM embeddings WHERE ` + keys.map(() => 'key LIKE ?').join(' OR ');

    // Callback function to handle the query result
    const callback = (err, rows) => {
        if (err) {
            console.error('Database error:', err.message);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }

        // Filter the embeddings to only include the desired source
        const result = rows.map(row => {
            const embeddings = JSON.parse(row.embeddings);
            const desiredEmbedding = embeddings.find(e => e.source === source);

            if (desiredEmbedding) {
                return {
                    key: row.key,
                    embedding: desiredEmbedding.embedding,
                    text: row.text
                };
            } else {
                return {
                    key: row.key,
                    text: row.text
                };
            }
        });

        res.json(result);
    };

    // Perform the query, passing the wildcard-prefixed keys and the newly defined callback as arguments
    db.all(query, keys.map(key => `${key.split('_chunk_')[0]}%`), callback);
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
    // The key should be provided as a query parameter
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

module.exports = app;