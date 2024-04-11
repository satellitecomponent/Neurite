
async function fetchEmbeddings(text) {
    const useLocalEmbeddings = document.getElementById("local-embeddings-checkbox").checked;
    const model = document.getElementById("embeddingsModelSelect").value;

    console.log(`local?`, useLocalEmbeddings, `model`, model);

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


async function embeddedSearch(searchTerm, maxNodesOverride = null) {
    // Use maxNodesOverride if provided, otherwise use the slider value
    const maxNodes = maxNodesOverride !== null ? maxNodesOverride : document.getElementById('node-count-slider').value;
    let keywords = searchTerm.toLowerCase().split(/,\s*/);

    const nodes = getNodeText();

    if (nodes.length === 0) {
        return [];
    }

    let matched = [];

    const fetchNodeEmbedding = async (node) => {
        const titleText = node.titleInput;
        const contentText = node.contentText;

       // console.log('Extracted title text:', titleText);  // DEBUG
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

    // Updated to use new property names
    const titleMatchScore = n.titleInput.toLowerCase().includes(searchTerm.toLowerCase()) ? 1 : 0;

    // Updated to use new property names
    const contentMatchScore = keywords.filter(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        return n.contentText.match(regex);
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

function isGitHubUrl(url) {
    return url.startsWith('https://github.com/') || url.startsWith('http://github.com/');
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
        keyList.innerHTML = "";

        const uniqueGitHubRepos = new Set(); // To hold unique GitHub root repos

        for (let key of keys) {
            if (isGitHubUrl(key)) {
                const [protocol, empty, domain, owner, repo] = key.split('/');
                const rootRepo = `${protocol}//${domain}/${owner}/${repo}`;
                uniqueGitHubRepos.add(rootRepo); // Add to Set. Duplicates will be ignored.
                continue;
            }

            // Handle non-GitHub keys (existing logic)
            const listItem = document.createElement("p");
            listItem.textContent = key;
            keyList.appendChild(listItem);
            (function (listItem) {
                listItem.addEventListener("click", (event) => {
                    event.stopPropagation();
                    listItem.classList.toggle("selected");
                });
            })(listItem);
        }

        // Add unique GitHub root repos to the display
        for (let rootRepo of uniqueGitHubRepos) {
            const listItem = document.createElement("p");
            listItem.textContent = rootRepo;
            keyList.appendChild(listItem);
            listItem.addEventListener("click", (event) => {
                event.stopPropagation();
                listItem.classList.toggle("selected");
            });
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
    const selectedKeys = Array.from(document.getElementsByClassName("selected")).map(el => el.textContent);

    for (let key of selectedKeys) {
        if (isGitHubUrl(key)) {
            // If the selected key is a GitHub repo root, find all associated keys
            const allKeys = await getAllKeysFromServer();
            const associatedKeys = allKeys.filter(k => k.startsWith(key));

            // Delete all associated keys
            await Promise.all(associatedKeys.map(deleteKey));
        } else {
            // If it's not a GitHub repo, just delete the single key
            await deleteKey(key);
        }
    }

    fetchAndDisplayAllKeys();
}

async function getAllKeysFromServer() {
    const response = await fetch('http://localhost:4000/get-keys');
    if (!response.ok) {
        console.error(`Failed to fetch keys:`, response.statusText);
        return [];
    }
    return await response.json();
}

async function deleteKey(key) {
    const response = await fetch(`http://localhost:4000/delete-chunks?key=${encodeURIComponent(key)}`, {
        method: 'DELETE'
    });
    if (!response.ok) {
        console.error(`Failed to delete chunks for key ${key}:`, response.statusText);
    }
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

async function storeTextData(storageKey, text) {
    const chunkedText = chunkText(text, MAX_CHUNK_SIZE, overlapSize);
    const chunkedEmbeddings = await fetchChunkedEmbeddings(chunkedText);
    await storeEmbeddingsAndChunksInDatabase(storageKey, chunkedText, chunkedEmbeddings);
}

async function fetchAndStoreWebPageContent(url) {
    if (isGitHubUrl(url)) {
        console.log("Handling Github");
        const [_, __, ___, owner, repo] = url.split('/');
        // Defined in gitparsed.js
        await fetchGitHubRepoContent(owner, repo);
        return;
    }

    try {
        const response = await fetch(`${CORS_PROXY}?url=${encodeURIComponent(url)}`);

        if (!response.ok) {
            console.error(`Failed to fetch web page content for ${url}:`, response.statusText);
            return null;
        }

        const contentType = response.headers.get("content-type");
        const text = await response.text();

        if (typeof text !== "string") {
            console.warn(`Text type for ${url}: ${contentType}`);
            console.warn(`Text for ${url}:`, text);
            return null;
        }

        await storeTextData(url, text);  // Store the text data

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

async function getAllKeys() {
    try {
        const response = await fetch(`http://localhost:4000/get-keys`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const keys = await response.json();
        return keys;
    } catch (error) {
        console.error('Error fetching keys:', error);
        return [];
    }
}


async function getRelevantKeys(userInput, recentContext = null, searchQuery) {
    const allKeys = await getAllKeys();

    // Early return if there are 3 or fewer keys
    if (allKeys.length <= 3) {
        return allKeys;
    }

    // Continue with the rest of the function if there are more than 3 keys
    recentContext = recentContext || getLastPromptsAndResponses(2, 150);

    const directoryMap = new Map();
    allKeys.forEach(key => { // Make sure to use this 'key' variable inside the loop
        const index = allKeys.indexOf(key) + 1; // Get the index +1 for display
        const directory = key.substring(0, key.lastIndexOf('/'));
        if (!directoryMap.has(directory)) {
            directoryMap.set(directory, []);
        }
        directoryMap.get(directory).push({ index: index, filename: key.substring(key.lastIndexOf('/') + 1) });
    });

    let keysDisplayContent = "";
    let indexToFileMap = {};
    directoryMap.forEach((files, directory) => {
        keysDisplayContent += `Directory: ${directory}\n`;
        files.forEach(file => {
            keysDisplayContent += ` ${file.index}. ${file.filename}\n`;
            indexToFileMap[file.index] = allKeys[file.index - 1]; // Use the correct index to get the full key
        });
    });

    // Construct the context for the AI API call
    const aiPrompt = [
        {
            role: "system",
            content: `Determine the filepaths to select. Given the User Message and Search Query "${searchQuery}", (without preface) identify a limit of THREE numbered keys from the list relevant to this context. GENERATE NUMBERS THAT MAP TO RELEVENT FILEPATH KEYS`
        },
        {
            role: "system",
            content: `Here is the list of files:\n${keysDisplayContent}`
        }
    ];

    // Only add the recent conversation to the prompt if it exists and is not empty
    if (recentContext && recentContext.trim() !== "") {
        aiPrompt.push({
            role: "system",
            content: `The following recent conversation may provide context:\n${recentContext}`
        });
    }

    // Always include the user input
    aiPrompt.push({
        role: "user",
        content: userInput
    });

    // Call the AI API with the constructed context
    const aiResponse = await callchatAPI(aiPrompt, false, 0);
    //console.log("Response For File Selection", aiResponse);

    // Use a regular expression to extract numbers from the response
    const numberPattern = /\b\d+\b/g;
    let match;
    const relevantKeyNumbers = [];
    while ((match = numberPattern.exec(aiResponse)) !== null) {
        relevantKeyNumbers.push(parseInt(match[0]));
    }

    // Map the numbers to the full keys using indexToFileMap
    const relevantKeys = relevantKeyNumbers.map(number => indexToFileMap[number]).filter(key => key !== undefined);

    console.log("Selected Document Keys", relevantKeys);
    return relevantKeys;
}


// Step 3: Fetch embeddings only for the relevant keys using the new server endpoint
async function fetchEmbeddingsForKeys(keys) {
    try {
        const response = await fetch('http://localhost:4000/fetch-embeddings-by-keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ keys }) // Send the keys as a JSON payload
        });
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.status}`);
        }

        const selectedEmbeddings = await response.json();

        // Ensure that the embeddings are returned in the expected format
        const formattedEmbeddings = selectedEmbeddings.map(embedding => {
            return {
                key: embedding.key,
                embedding: embedding.embedding,
                source: embedding.source,
                text: embedding.text
            };
        });

        //console.log("Formatted embeddings ready for return:", formattedEmbeddings); // Log the final formatted embeddings

        return formattedEmbeddings;
    } catch (error) {
        console.error(`Error fetching selected embeddings: ${error.message}`);
        console.error("Full error object:", error); // Log the full error object
        return []; // Return an empty array to indicate failure
    }
}

// Integration of the new flow into getRelevantChunks
async function getRelevantChunks(searchQuery, searchResults, topN, relevantKeys = []) {
    const searchQueryEmbedding = await fetchEmbeddings(searchQuery);

    let relevantEmbeddings = [];

    // If relevant keys are provided, try to fetch embeddings for those keys
    if (relevantKeys.length > 0) {
        // Make sure to await the result of the async operation
        relevantEmbeddings = await fetchEmbeddingsForKeys(relevantKeys);
        //console.log("Relevant Embeddings Fetch Result", relevantEmbeddings);
    }

    // Fallback to fetching all stored embeddings if no relevant keys were provided or fetching failed
    if (relevantKeys.length === 0 || !relevantEmbeddings || relevantEmbeddings.length === 0) {
        console.warn("Fetching specific embeddings failed. Falling back to fetching all stored embeddings.");
        const allStoredEmbeddings = await fetchAllStoredEmbeddings();
        //console.log(allStoredEmbeddings);

        // Map the base URLs to their full keys with chunk identifiers
        const keyMap = allStoredEmbeddings.reduce((map, embedding) => {
            const baseKey = embedding.key.split('_chunk_')[0];
            if (!map[baseKey]) {
                map[baseKey] = [];
            }
            map[baseKey].push(embedding.key);
            return map;
        }, {});

        // Use the map to filter out embeddings that match the base keys from relevantKeys
        if (allStoredEmbeddings && allStoredEmbeddings.length > 0) {
            relevantEmbeddings = allStoredEmbeddings.filter(embedding =>
                relevantKeys.some(relevantKey => {
                    const baseRelevantKey = relevantKey.split('_chunk_')[0];
                    return keyMap[baseRelevantKey] && keyMap[baseRelevantKey].includes(embedding.key);
                })
            ).map(embedding => {
                // Ensure that the structure of the data matches the expected format
                // Renaming 'chunks' property to 'text' to match the non-fallback data structure
                return {
                    ...embedding,
                    text: embedding.chunks
                };
            });
            //console.log(relevantEmbeddings);
        }
    }

    // After the fallback, if there are still no relevant embeddings, use all stored embeddings
    if (!relevantEmbeddings || relevantEmbeddings.length === 0) {
        console.warn("Failed to fetch index of embeddings. Using all available embeddings.");
        // Return all available embeddings in the proper format
        const allStoredEmbeddings = await fetchAllStoredEmbeddings();
        relevantEmbeddings = allStoredEmbeddings.map(embedding => {
            return {
                key: embedding.key,
                text: embedding.chunks,
                source: embedding.source,
                embedding: embedding.embedding
            };
        });
    }

    // Filter embeddings by source and calculate cosine similarity for each
    const localEmbeddings = calculateSimilarity(filterBySource(relevantEmbeddings, 'local'), searchQueryEmbedding);
    const openaiEmbeddings = calculateSimilarity(filterBySource(relevantEmbeddings, 'openai'), searchQueryEmbedding);
    //console.log("local embeddings", localEmbeddings);
    //console.log("openai embeddings", openaiEmbeddings);
    // Sort and select top 2N embeddings from each category for more accurate readings when converting
    const extendedTopN = topN * 2;
    const topLocalEmbeddings = localEmbeddings.sort((a, b) => b.similarity - a.similarity).slice(0, extendedTopN);
    const topOpenAIEmbeddings = openaiEmbeddings.sort((a, b) => b.similarity - a.similarity).slice(0, extendedTopN);

    // Determine which embeddings to convert based on the checkbox state
    const useLocalEmbeddings = document.getElementById("local-embeddings-checkbox").checked;
    let embeddingsToConvert = useLocalEmbeddings ? topOpenAIEmbeddings : topLocalEmbeddings;

    // Convert embeddings of the non-preferred type to the preferred type
    const convertedEmbeddings = await Promise.all(
        embeddingsToConvert.map(async (embedding) => {
            // fetchEmbeddings function must be designed to take the text content and return its embeddings
            const convertedEmbeddingText = await fetchEmbeddings(embedding.text);
            return {
                ...embedding,
                // The assumption here is that fetchEmbeddings returns the embedding itself,
                // not an object with an embedding property.
                embedding: convertedEmbeddingText,
                source: useLocalEmbeddings ? 'local' : 'openai'
            };
        })
    );

    // Calculate similarity for converted embeddings
    const reevaluatedConvertedEmbeddings = calculateSimilarity(convertedEmbeddings, searchQueryEmbedding);

    // Merge with preferred embeddings and re-sort to get the combined top N
    const combinedEmbeddings = (useLocalEmbeddings ? topLocalEmbeddings : topOpenAIEmbeddings)
        .concat(reevaluatedConvertedEmbeddings)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topN);

    // Prepare the final output
    const topNChunks = combinedEmbeddings.map(chunkEmbedding => ({
        // Directly use chunkEmbedding.text and chunkEmbedding.key
        text: chunkEmbedding.text,
        source: chunkEmbedding.key,
        relevanceScore: chunkEmbedding.similarity
    }));

    console.log("Top N Chunks:", topNChunks);
    return topNChunks;
}

// Helper function to filter embeddings by source
function filterBySource(embeddings, source) {
    // Log the source we're filtering for and the sources present in the embeddings
    //console.log(`Filtering for source: ${source}`);
    //console.log(`Current embedding sources:`, embeddings.map(e => e.source));

    const filteredEmbeddings = embeddings.filter(embedding => {
        // Added a check for undefined or null source
        const isSourceMatching = embedding.source && embedding.source === source;
        if (!isSourceMatching) {
            //console.log(`Mismatched source for key: ${embedding.key}, expected: ${source}, actual: ${embedding.source}`);
        }
        return isSourceMatching;
    });

    //console.log(`Filtered embeddings for ${source}:`, filteredEmbeddings);
    return filteredEmbeddings;
}

// Helper function to calculate cosine similarity for a list of embeddings
function calculateSimilarity(embeddings, searchQueryEmbedding) {
    return embeddings.map(embedding => {
        embedding.similarity = cosineSimilarity(searchQueryEmbedding, embedding.embedding);
        return embedding;
    });
}

// Helper function to process a single embedding's chunks
function processChunkEmbedding(embedding) {
    if (typeof embedding.chunks === 'string') {
        return [{
            result: {
                link: embedding.key,
                description: embedding.chunks
            },
            embedding: embedding.embedding,
            source: embedding.source
        }];
    } else if (Array.isArray(embedding.chunks)) {
        return embedding.chunks.map(chunk => ({
            result: {
                link: embedding.key,
                description: chunk.text
            },
            embedding: chunk.embedding,
            source: embedding.source
        }));
    }
    return [];
}


function chunkText(text, maxLength, overlapSize) {
    // Modified regex to preserve punctuation and spaces
    const sentences = text.match(/[^.!?]+\s*[.!?]+|[^.!?]+$/g);
    if (!Array.isArray(sentences)) {
        console.error('Failed to split text into sentences:', text);
        return [];
    }

    let chunks = [];
    let currentChunk = [];
    let currentLength = 0;

    sentences.forEach(sentence => {
        // Split sentence into words
        const words = sentence.split(/\s+/);

        words.forEach(word => {
            const wordLength = word.length + (currentLength > 0 ? 1 : 0); // Add 1 for space if not first word

            // If adding the word exceeds maxLength, push the current chunk and reset
            if (currentLength + wordLength > maxLength) {
                if (currentChunk.length > 0) {
                    chunks.push(currentChunk.join(' '));
                }
                currentChunk = []; // Start a new chunk
                currentLength = 0;
            }

            // Add word to chunk
            currentChunk.push(word);
            currentLength += wordLength;

            // Handle the edge case where a single word might exceed the maxLength
            if (wordLength > maxLength) {
                // If the current word itself exceeds maxLength, it's a special case
                throw new Error(`Word length exceeds maxLength: ${word}`);
            }
        });
    });

    // Add any remaining words in the buffer to the chunks
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
    }

    // If overlap is specified, apply it between chunks
    if (overlapSize > 0 && chunks.length > 1) {
        chunks = chunks.map((chunk, index) => {
            if (index === 0) return chunk; // First chunk doesn't need overlap
            // Get the last 'overlapSize' words from the previous chunk
            const overlap = chunks[index - 1].split(' ').slice(-overlapSize).join(' ');
            return overlap + ' ' + chunk;
        });
    }

    return chunks;
}

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

function groupAndSortChunks(relevantChunks, MAX_CHUNK_SIZE) {
    // Group the chunks by their source (stripping the chunk number from the key)
    const groupedChunks = relevantChunks.reduce((acc, chunk) => {
        const [source, chunkNumber] = chunk.source.split('_chunk_');
        if (!acc[source]) acc[source] = [];
        acc[source].push({
            text: chunk.text.substring(0, MAX_CHUNK_SIZE),
            number: parseInt(chunkNumber),
            relevanceScore: chunk.relevanceScore,
        });
        return acc;
    }, {});

    // Construct the topNChunksContent
    return Object.entries(groupedChunks).map(([source, chunks]) => {
        chunks.sort((a, b) => a.number - b.number);
        return `[Source: ${source}]\n${chunks.map(chunk => `Chunk ${chunk.number} (Relevance: ${chunk.relevanceScore.toFixed(2)}): ${chunk.text}...`).join('\n')}\n`;
    }).join('\n');
}