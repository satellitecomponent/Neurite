
async function fetchEmbeddings(text, model = "text-embedding-ada-002") {
    const useLocalEmbeddings = document.getElementById("local-embeddings-checkbox").checked;

    // If the "Use Local Embeddings" checkbox is checked, use the local model
    if (useLocalEmbeddings && window.generateEmbeddings) {
        try {
            const output = await window.generateEmbeddings(text, {
                pooling: 'mean',
                normalize: true,
            });
            // Convert Float32Array to regular array
            return Array.from(output.data);
        } catch (error) {
            console.error("Error generating local embeddings:", error);
            return [];
        }
    } else {
        // Use the API for embeddings

        const API_KEY = document.getElementById("api-key-input").value;
        if (!API_KEY) {
            alert("Please enter your API key");
            return;
        }

        const API_URL = "https://api.openai.com/v1/embeddings";

        const headers = new Headers();
        headers.append("Content-Type", "application/json");
        headers.append("Authorization", `Bearer ${API_KEY}`);

        const body = JSON.stringify({
            model: model,
            input: text,
        });

        const requestOptions = {
            method: "POST",
            headers: headers,
            body: body,
        };

        try {
            const response = await fetch(API_URL, requestOptions);
            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error fetching embeddings:", errorData);
                return [];
            }

            const data = await response.json();
            return data.data[0].embedding;
        } catch (error) {
            console.error("Error fetching embeddings:", error);
            return [];
        }
    }
}

function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0 || vecB.length === 0) {
        return 0;
    }

    let dotProduct = 0;
    let vecASquaredSum = 0;
    let vecBSquaredSum = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        vecASquaredSum += vecA[i] * vecA[i];
        vecBSquaredSum += vecB[i] * vecB[i];
    }

    const vecAMagnitude = Math.sqrt(vecASquaredSum);
    const vecBMagnitude = Math.sqrt(vecBSquaredSum);

    if (vecAMagnitude === 0 || vecBMagnitude === 0) {
        return 0;
    }

    return dotProduct / (vecAMagnitude * vecBMagnitude);
}

const MAX_CACHE_SIZE = 300;

const nodeCache = new LRUCache(MAX_CACHE_SIZE);


async function embeddedSearch(searchTerm) {
    const maxNodes = document.getElementById('node-count-slider').value;
    let keywords = searchTerm.toLowerCase().split(/,\s*/);

    const nodes = getNodeText();

    if (nodes.length === 0) {
        return [];
    }

    let matched = [];

    const fetchNodeEmbedding = async (node) => {
        //console.log('Node:', node);  // DEBUG
        //console.log('Node content:', node.content);  // DEBUG

        const titleElement = node.content.querySelector(".title-input");
        const contentElement = node.content.querySelector("textarea");
        const titleText = titleElement ? titleElement.value : '';
        const contentText = contentElement ? contentElement.value : '';

        //console.log('Extracted title text:', titleText);  // DEBUG
        // console.log('Extracted content text:', contentText);  // DEBUG

        const fullText = titleText + ' ' + contentText;

        const useLocalEmbeddings = document.getElementById("local-embeddings-checkbox").checked;
        const compoundKey = `${node.uuid}-${useLocalEmbeddings ? 'local' : 'openai'}`;

        const cachedEmbedding = nodeCache.get(compoundKey);
        if (cachedEmbedding) {
            return cachedEmbedding;
        } else {
            const embedding = await fetchEmbeddings(fullText);
            nodeCache.set(compoundKey, embedding);
            return embedding;
        }
    };

    const searchTermEmbeddingPromise = fetchEmbeddings(searchTerm);
    const nodeEmbeddingsPromises = nodes.map(fetchNodeEmbedding);
    const [keywordEmbedding, ...nodeEmbeddings] = await Promise.all([searchTermEmbeddingPromise, ...nodeEmbeddingsPromises]);

    //   console.log('Keyword Embedding:', keywordEmbedding);  // DEBUG

    for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];

        // Skip if the node does not have the flag `isTextNode = true`
        if (!n.isTextNode) {
            continue;
        }

        const titleMatchScore = n.searchStrings[0].toLowerCase().includes(searchTerm.toLowerCase()) ? 1 : 0;
        const contentMatchScore = keywords.filter(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            return n.searchStrings[1].match(regex);
        }).length;
        const weightedTitleScore = titleMatchScore * 10;
        const weightedContentScore = contentMatchScore;

        const nodeEmbedding = nodeEmbeddings[i];

        const dotProduct = keywordEmbedding.reduce((sum, value, index) => sum + (value * nodeEmbedding[index]), 0);
        const keywordMagnitude = Math.sqrt(keywordEmbedding.reduce((sum, value) => sum + (value * value), 0));
        const nodeMagnitude = Math.sqrt(nodeEmbedding.reduce((sum, value) => sum + (value * value), 0));

        //   console.log('Dot Product:', dotProduct);  // DEBUG
        //   console.log('Keyword Magnitude:', keywordMagnitude);  // DEBUG
        //   console.log('Node Magnitude:', nodeMagnitude);  // DEBUG

        const cosineSimilarity = dotProduct / (keywordMagnitude * nodeMagnitude);
        //console.log('Cosine Similarity:', cosineSimilarity);

        const similarityThreshold = -1;
        const keywordMatchPercentage = 0.5;

        if (weightedTitleScore + weightedContentScore > 0 || cosineSimilarity > similarityThreshold) {
            matched.push({
                node: n,
                title: n.title,
                content: n.content.innerText.trim(),
                weightedTitleScore: weightedTitleScore,
                weightedContentScore: weightedContentScore,
                similarity: cosineSimilarity,
            });
            //console.log(`embeddings`, n.content.innerText.trim())
        }
    }

    matched.sort((a, b) => (b.weightedTitleScore + b.weightedContentScore + b.similarity) - (a.weightedTitleScore + a.weightedContentScore + a.similarity));
    return matched.slice(0, maxNodes).map(m => m.node);
}



const nodeTitlesAndContent = [];

for (let key in nodes) {
    let nodeTitle = nodes[key].title;
    let nodeContent = nodes[key].plainText;
    nodeTitlesAndContent.push({
        title: nodeTitle,
        content: nodeContent
    });
}

function clearSearchHighlights(nodesArray) {
    for (const node of nodesArray) {
        node.content.classList.remove("search_matched");
        node.content.classList.remove("search_nomatch");
    }
}


async function calculateRelevanceScores(summaries, searchTermEmbedding) {
    // Use the existing searchTermEmbedding for cosine similarity calculations
    const titleEmbeddings = await Promise.all(summaries.map(summary => fetchEmbeddings(summary.title)));

    for (let i = 0; i < summaries.length; i++) {
        const similarity = cosineSimilarity(searchTermEmbedding, titleEmbeddings[i]);
        summaries[i].relevanceScore = similarity;
    }

    return summaries;
}



const CORS_PROXY = "http://localhost:4000/proxy";

async function fetchAndDisplayAllKeys() {
    try {
        const response = await fetch('http://localhost:4000/get-keys');
        if (!response.ok) {
            console.error(`Failed to fetch keys:`, response.statusText);
            return;
        }


        const keys = await response.json();
        const keyList = document.getElementById("key-list");
        // Clear existing keys
        keyList.innerHTML = "";

        for (let key of keys) {
            // Create a new paragraph for the key
            var listItem = document.createElement("p");

            // Set the text of the paragraph to the key
            listItem.textContent = key;

            // Add the paragraph to the list
            keyList.appendChild(listItem);

            // Add a click event listener to the paragraph
            // Make use of closures to capture each listItem instance separately
            (function (listItem) {
                listItem.addEventListener("click", (event) => {
                    event.stopPropagation();
                    listItem.classList.toggle("selected");
                });
            })(listItem);
        }
    } catch (error) {
        console.error(`(Server disconnect) Failed to fetch keys:`, error);
    }
}

window.onload = function () {
    fetchAndDisplayAllKeys();
}

document.getElementById('chunkAndStoreButton').addEventListener('click', chunkAndStoreInputExtract);

async function deleteSelectedKeys() {
    // Get all selected keys
    const selectedKeys = Array.from(document.getElementsByClassName("selected")).map(el => el.textContent);

    // Send a request to the server to delete the chunks for each key
    for (let key of selectedKeys) {
        const response = await fetch(`http://localhost:4000/delete-chunks?key=${encodeURIComponent(key)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            console.error(`Failed to delete chunks for key ${key}:`, response.statusText);
        }
    }

    // Refresh the key list
    fetchAndDisplayAllKeys();
}

async function chunkAndStoreInputExtract() {
    const chunkAndStoreButton = document.getElementById('chunkAndStoreButton');
    let dotCount = 0;

    // Start the dot animation
    const dotInterval = setInterval(() => {
        dotCount = (dotCount + 1) % 4; // Cycle dotCount between 0 and 3
        chunkAndStoreButton.textContent = "Chunking Input" + ".".repeat(dotCount);
    }, 500); // Update every 500 milliseconds

    try {
        // Get the input text from the textarea
        const inputText = document.getElementById('inputTextExtract').value;

        if (!inputText) {
            alert("Please enter some text into the textarea");
            return;
        }

        // Chunk the input text
        const chunkedText = chunkText(inputText, MAX_CHUNK_SIZE, overlapSize);

        // Fetch the embeddings for the chunks
        const chunkedEmbeddings = await fetchChunkedEmbeddings(chunkedText);

        // Get the key from the input field, or use the first sentence of the input text if no key was provided
        let key = document.getElementById('inputKeyExtract').value;
        if (!key) {
            // Extract the first sentence from the input text
            // This regex matches everything up to the first period, question mark, or exclamation mark
            const firstSentenceMatch = inputText.match(/[^.!?]+[.!?]/);
            key = firstSentenceMatch ? firstSentenceMatch[0] : inputText;
        }

        // Store the chunks and their embeddings in the database
        const success = await storeEmbeddingsAndChunksInDatabase(key, chunkedText, chunkedEmbeddings);

        chunkAndStoreButton.textContent = success ? "Store Key & Text" : "Chunking Failed";

    } catch (error) {
        console.error(`Failed to chunk and store input:`, error); //1872
        chunkAndStoreButton.textContent = "Chunking Failed";
    } finally {
        // Stop the dot animation
        clearInterval(dotInterval);
    }
}

async function storeEmbeddingsAndChunksInDatabase(key, chunks, embeddings) {
    console.log(`Storing embeddings and text chunks for key: ${key}`);

    // Check if local embeddings are used
    const useLocalEmbeddings = document.getElementById("local-embeddings-checkbox").checked;
    const source = useLocalEmbeddings ? 'local' : 'openai';

    try {
        for (let i = 0; i < chunks.length; i++) {
            const chunkKey = `${key}_chunk_${i}`;
            const response = await fetch('http://localhost:4000/store-embedding-and-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    key: chunkKey,
                    embedding: embeddings[i],
                    text: chunks[i],
                    source: source  // attach the source tag
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to store chunk ${i} for key ${key}: ${response.statusText}`);
            }
        }

        // If no errors, refresh the key list
        await fetchAndDisplayAllKeys();

        // If no errors, return true to indicate success
        return true;
    } catch (error) {
        console.error(`Failed to store chunks and embeddings for key ${key}:`, error);
        throw error;
    }
}

async function fetchAndStoreWebPageContent(url) {
    try {
        const response = await fetch(`${CORS_PROXY}?url=${encodeURIComponent(url)}`);

        if (!response.ok) {
            console.error(`Failed to fetch web page content for ${url}:`, response.statusText);
            return null;
        }

        const contentType = response.headers.get("content-type");
        const extractedTextResponse = await fetch(`${CORS_PROXY}/extract-text?url=${encodeURIComponent(url)}`);
        const text = await extractedTextResponse.text();

        if (typeof text !== "string") {
            console.warn(`Text type for ${url}: ${contentType}`);
            console.warn(`Text for ${url}:`, text);
            return null;
        }

        const chunkedText = chunkText(extractedText, MAX_CHUNK_SIZE, overlapSize);
        const chunkedEmbeddings = await fetchChunkedEmbeddings(chunkedText);

        // Store the chunked embeddings and text in the database
        await storeEmbeddingsAndChunksInDatabase(url, chunkedText, chunkedEmbeddings);
    } catch (error) {
        console.error(`Failed to fetch web page content for ${url}:`, error);
        alert("An error occurred fetching the top-n relevant chunks of extracted webpage text. Please ensure that the extract server is running on your localhost. Localhosts can be found at the Github link in the ? tab.");
        return null;
    }
}

async function fetchAllStoredEmbeddings() {
    try {
        const response = await fetch(`http://localhost:4000/fetch-all-embeddings`);

        if (!response.ok) {
            console.error(`Failed to fetch stored embeddings:`, response.statusText);
            return null;
        }

        // Parse the response text as JSON
        const embeddings = await response.json();
        //console.log('Fetched all stored embeddings:', embeddings);
        return embeddings;

    } catch (error) {
        console.error(`Failed to fetch stored embeddings:`, error);
        alert("An error occurred fetching the top-n relevant chunks of extracted webpage text. Please ensure that the extract server is running on your localhost. Localhosts can be found at the Github link in the ? tab.");
        return null;
    }
}

function chunkText(text, maxLength, overlapSize) {
    const sentences = text.match(/[^.!?]+\s*[.!?]+|[^.!?]+$/g); // Modified regex to preserve punctuation and spaces
    if (!Array.isArray(sentences)) {
        console.error('Failed to split text into sentences:', text);
        return [];
    }
    const chunks = [];
    let chunkWords = [];
    let chunkLength = 0;

    for (const sentence of sentences) {
        const words = sentence.split(/\s+/);

        for (const word of words) {
            // Add 1 for the space if not the first word in the chunk
            const wordLengthWithSpace = chunkLength === 0 ? word.length : word.length + 1;

            // Check if single word exceeds maxLength
            if (word.length > maxLength) {
                throw new Error(`Word length exceeds maxLength: ${word}`);
            }

            // Check if adding new word exceeds maxLength
            if (chunkLength + wordLengthWithSpace > maxLength) {
                chunks.push(chunkWords.join(' '));
                chunkWords = chunkWords.slice(-overlapSize);
                chunkLength = chunkWords.join(' ').length;
            }

            // Add the word to the current chunk
            if (chunkLength > 0) {
                chunkWords.push(' ' + word);
                chunkLength += wordLengthWithSpace;
            } else {
                chunkWords.push(word);
                chunkLength += word.length;
            }
        }
    }

    // Add the remaining chunk if it's not empty
    if (chunkWords.length > 0) {
        chunks.push(chunkWords.join(' '));
    }

    return chunks;
}

async function getRelevantChunks(searchQuery, searchResults) {
    const searchQueryEmbedding = await fetchEmbeddings(searchQuery);

    const allEmbeddings = await fetchAllStoredEmbeddings();
    if (!allEmbeddings) {
        console.error("No embeddings were fetched. Please check the server logs for more information.");
        return [];
    }

    const useLocalEmbeddings = document.getElementById("local-embeddings-checkbox").checked;

    const chunkEmbeddings = allEmbeddings.flatMap(embedding => {
        if (!useLocalEmbeddings && embedding.source === 'local') {
            return []; // Ignore local embeddings when checkbox is not checked
        } else if (useLocalEmbeddings && embedding.source !== 'local') {
            return []; // Ignore non-local embeddings when checkbox is checked
        }
        if (typeof embedding.chunks === 'string') {
            const result = {
                link: embedding.key,
                description: embedding.chunks
            };
            return [{
                result,
                embedding: embedding.embedding,
                source: embedding.source // Extract source here
            }];
        } else if (Array.isArray(embedding.chunks)) {
            return embedding.chunks.map(chunk => {
                const result = {
                    link: embedding.key,
                    description: chunk.text
                };
                return {
                    result,
                    embedding: chunk.embedding,
                    source: chunk.source // Extract source here
                };
            });
        } else {
            return [];
        }
    });

    // Calculate the cosine similarity between the search query embedding and each chunk embedding
    chunkEmbeddings.forEach(chunkEmbedding => {
        const embedding = chunkEmbedding.embedding;
        const source = chunkEmbedding.source; // Use extracted source

        if (embedding && embedding.length > 0) {
            let similarity = cosineSimilarity(
                searchQueryEmbedding,
                embedding
            );


            chunkEmbedding.similarity = similarity;
        } else {
            chunkEmbedding.similarity = 0;
        }
    });
    //console.log("Chunk embeddings with similarity:", chunkEmbeddings); //4551

    // Sort the chunks by their similarity scores
    chunkEmbeddings.sort((a, b) => b.similarity - a.similarity);
    console.log("Sorted chunk embeddings:", chunkEmbeddings);

    // Return the top N chunks or the total number of chunks if less than N
    const limit = Math.min(topN, chunkEmbeddings.length);
    const topNChunks = chunkEmbeddings
        .slice(0, limit)
        .map(chunkEmbedding => ({
            text: chunkEmbedding.result.description,
            source: chunkEmbedding.result.link,
            relevanceScore: chunkEmbedding.similarity
        }));
    console.log("Top N Chunks:", topNChunks);

    return topNChunks;
}

let overlapSize = document.getElementById('overlapSizeSlider').value;

document.getElementById('overlapSizeSlider').addEventListener('input', function (e) {
    overlapSize = Number(e.target.value);
    document.getElementById('overlapSizeDisplay').textContent = overlapSize;
});




async function fetchChunkedEmbeddings(textChunks, model = "text-embedding-ada-002") {
    const useLocalEmbeddings = document.getElementById("local-embeddings-checkbox").checked;

    // Array to store the embeddings
    const chunkEmbeddings = [];

    // Loop through each chunk of text
    for (const chunk of textChunks) {

        // Check if local embeddings should be used
        if (useLocalEmbeddings && window.generateEmbeddings) {
            try {
                // This assumes that the local embedding model is initialized
                // and assigned to window.generateEmbeddings
                const output = await window.generateEmbeddings(chunk, {
                    pooling: 'mean',
                    normalize: true,
                });
                // Convert Float32Array to regular array
                chunkEmbeddings.push(Array.from(output.data));
            } catch (error) {
                console.error("Error generating local embeddings:", error);
                chunkEmbeddings.push([]);
            }
        } else {
            // Use the API for embeddings
            const API_KEY = document.getElementById("api-key-input").value;
            if (!API_KEY) {
                alert("Please enter your API key");
                return;
            }

            const API_URL = "https://api.openai.com/v1/embeddings";

            const headers = new Headers();
            headers.append("Content-Type", "application/json");
            headers.append("Authorization", `Bearer ${API_KEY}`);

            const body = JSON.stringify({
                model: model,
                input: chunk,
            });

            const requestOptions = {
                method: "POST",
                headers: headers,
                body: body,
            };

            try {
                const response = await fetch(API_URL, requestOptions);
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error("Error fetching embeddings:", errorData);
                    chunkEmbeddings.push([]);
                    continue;
                }

                const data = await response.json();
                const embedding = data.data[0].embedding;

                chunkEmbeddings.push(embedding);
            } catch (error) {
                console.error("Error fetching embeddings:", error);
                chunkEmbeddings.push([]);
            }
        }
    }
    return chunkEmbeddings;
}
