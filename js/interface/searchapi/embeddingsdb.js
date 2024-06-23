let embeddingsWorker;
let browserEmbeddingsInitialized = {};

function initializeEmbeddingsWorker() {
    embeddingsWorker = new Worker('embeddings.js');

    embeddingsWorker.onmessage = function (e) {
        if (e.data.type === 'ready') {
            browserEmbeddingsInitialized[e.data.model] = true;
        } else if (e.data.type === 'error') {
            console.error('Main: Error from embeddings worker:', e.data.error);
        }
    };

    embeddingsWorker.onerror = function (error) {
        console.error('Main: Error from embeddings worker:', error);
    };

    // Initialize both models
    embeddingsWorker.postMessage({ type: 'initialize', model: 'local-embeddings-gte-small' });
    embeddingsWorker.postMessage({ type: 'initialize', model: 'local-embeddings-all-MiniLM-L6-v2' });
}

// Initialize the worker when the page loads
initializeEmbeddingsWorker();

async function fetchEmbeddings(text, source = null) {
    const model = source || document.getElementById("embeddingsModelSelect").value;

    try {
        switch (model) {
            case "local-embeddings-gte-small":
            case "local-embeddings-all-MiniLM-L6-v2":
                return await fetchLocalEmbeddings(text, model);

            case "mxbai-embed-large":
            case "nomic-embed-text":
            case "all-minilm":
                return await fetchOllamaEmbeddings(model, text);

            case "text-embedding-ada-002":
            case "text-embedding-3-large":
            case "text-embedding-3-small":
                return await fetchOpenAIEmbeddings(model, text);

            default:
                throw new Error(`Unsupported model: ${model}`);
        }
    } catch (error) {
        console.error(`Error generating embeddings for model ${model}:`, error);
        return [];
    }
}

async function fetchLocalEmbeddings(text, model) {
    if (!browserEmbeddingsInitialized[model]) {
        throw new Error(`Embeddings worker is not initialized for ${model}.`);
    }
    return new Promise((resolve, reject) => {
        const messageHandler = function (e) {
            embeddingsWorker.removeEventListener('message', messageHandler);
            if (e.data.type === 'error') {
                reject(new Error(e.data.error));
            } else if (e.data.type === 'result') {
                resolve(e.data.data);
            }
        };
        embeddingsWorker.addEventListener('message', messageHandler);
        embeddingsWorker.postMessage({ text: text, model: model });
    });
}

async function fetchOllamaEmbeddings(model, text) {
    const modelList = await receiveOllamaModelList(true);
    const isModelAvailable = modelList.some(m => m.name === model);

    if (!isModelAvailable) {
        const isPulled = await pullOllamaModelWithProgress(model);
        if (!isPulled) {
            throw new Error(`Failed to pull Ollama model: ${model}`);
        }
    }

    const embedding = await generateOllamaEmbedding(model, text);
    if (!embedding) {
        throw new Error(`Failed to generate Ollama embedding for model: ${model}`);
    }
    return embedding;
}

async function fetchOpenAIEmbeddings(model, text) {
    const API_KEY = document.getElementById("api-key-input").value;
    const API_URL = "https://api.openai.com/v1/embeddings";
    const headers = new Headers({
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
    });

    const response = await fetch(API_URL, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ model, input: text })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
}

function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
        return 0;
    }

    let dotProduct = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
    }

    return dotProduct;
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

    // Use recent context or fetch the last prompts and responses if not provided
    recentContext = recentContext || getLastPromptsAndResponses(2, 150);

    const directoryMap = new Map();
    allKeys.forEach(key => {
        const directory = key.substring(0, key.lastIndexOf('/'));
        directoryMap.set(directory, directoryMap.get(directory) || []);
        directoryMap.get(directory).push({
            index: allKeys.indexOf(key) + 1, // index +1 for display
            filename: key.substring(key.lastIndexOf('/') + 1)
        });
    });

    let keysDisplayContent = "";
    let indexToFileMap = {};
    directoryMap.forEach((files, directory) => {
        keysDisplayContent += `Directory: ${directory}\n`;
        files.forEach(file => {
            keysDisplayContent += ` ${file.index}. ${file.filename}\n`;
            indexToFileMap[file.index] = allKeys[file.index - 1]; // Correct index for full key
        });
    });

    const aiPrompt = [
        { role: "system", content: `Determine the filepaths to select. Given the User Message and Search Query "${searchQuery}", identify between ONE and THREE numbered documents from the list most relevant to this context.` },
        { role: "system", content: `Here is the list of files:\n${keysDisplayContent}` }
    ];

    if (recentContext && recentContext.trim() !== "") {
        aiPrompt.push({ role: "system", content: `The following recent conversation may provide context:\n${recentContext}` });
    }

    aiPrompt.push({ role: "user", content: userInput });

    const aiResponse = await callchatAPI(aiPrompt, false, 0);

    const numberPattern = /\b\d+\b/g;
    let match;
    const relevantKeyNumbers = [];
    while ((match = numberPattern.exec(aiResponse)) !== null) {
        relevantKeyNumbers.push(parseInt(match[0]));
    }

    const relevantKeys = relevantKeyNumbers.map(number => indexToFileMap[number]).filter(key => key !== undefined);

    // Return all keys if the response does not select any keys
    if (relevantKeys.length === 0) {
        return allKeys;
    }

    console.log("Selected Document Keys", relevantKeys);
    return relevantKeys;
}




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

function handleFileUploadVDBSelection() {
    const fileInput = document.getElementById('fileInput');
    fileInput.click();

    fileInput.onchange = uploadFileToVectorDB;
}

async function processFileContent(file) {
    const fileURL = URL.createObjectURL(file);
    const fileType = file.type;

    try {
        switch (fileType) {
            case 'application/pdf':
                return await extractTextFromPDF(fileURL);
            case 'text/plain':
                return await fetchFile(fileURL);
            case 'application/json':
                return await fetchJsonFile(fileURL);
            case 'text/html':
                return await fetchFile(fileURL);
            case 'application/xml':
            case 'text/xml':
                return await fetchFile(fileURL);
            case 'text/csv':
                return await fetchFile(fileURL);
            default:
                console.warn(`Unsupported file type: ${fileType}`);
                return null;
        }
    } catch (error) {
        console.error(`Error processing file content: ${error}`);
        return null;
    } finally {
        // Revoke the object URL to release memory
        URL.revokeObjectURL(fileURL);
    }
}

// Generic fetch function for supported file types
async function fetchFile(fileURL) {
    try {
        const response = await fetch(fileURL);
        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        return await response.text();
    } catch (error) {
        console.error(`Error fetching file: ${error}`);
        throw error;
    }
}

async function fetchJsonFile(fileURL) {
    try {
        const response = await fetch(fileURL);
        if (!response.ok) {
            throw new Error(`Failed to fetch JSON file: ${response.statusText}`);
        }
        return JSON.stringify(await response.json());
    } catch (error) {
        console.error(`Error fetching JSON file: ${error}`);
        throw error;
    }
}

async function uploadFileToVectorDB() {
    const fileInput = document.getElementById('fileInput');
    const chunkAndStoreButton = document.getElementById('chunkAndStoreButton');
    let dotCount = 0;

    const dotInterval = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        chunkAndStoreButton.textContent = chunkAndStoreButton.textContent.replace(/\.+$/, '') + ".".repeat(dotCount);
    }, 500);

    try {
        if (fileInput.files.length === 0) {
            alert("Please select a file to upload");
            return;
        }

        const file = fileInput.files[0];
        chunkAndStoreButton.textContent = "Reading File";
        const fileText = await processFileContent(file);
        if (!fileText) {
            alert("Failed to extract text from the file");
            return;
        }

        chunkAndStoreButton.textContent = "Processing Input";
        await receiveAndStoreByType(fileText, file.name, file.name);

        chunkAndStoreButton.textContent = "Upload Complete";
    } catch (error) {
        console.error(`Failed to process and store input:`, error);
        chunkAndStoreButton.textContent = "Process Failed";
    } finally {
        clearInterval(dotInterval);
        fileInput.value = "";
    }
}

// Extract text from PDF files using PDF.js
async function extractTextFromPDF(pdfLink) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.9.179/build/pdf.worker.min.js';
    const loadingTask = pdfjsLib.getDocument(pdfLink);

    try {
        const pdf = await loadingTask.promise;
        let extractedText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            extractedText += textContent.items.map(item => item.str).join(' ');
        }
        return extractedText;
    } catch (error) {
        console.error('Error extracting text from PDF:', error);
        throw new Error('Failed to extract text from PDF');
    }
}

async function fetchLinkContentText(link) {
    if (link.toLowerCase().endsWith('.pdf') || link.startsWith('blob:')) {
        return await extractTextFromPDF(link);
    } else if (isGitHubUrl(link)) {
        const details = extractGitHubRepoDetails(link);
        if (!details) {
            console.error('Invalid GitHub URL:', link);
            return null;
        }
        return await fetchGitHubRepoContent(details.owner, details.repo);
    } else {
        try {
            const response = await fetch(`http://localhost:4000/proxy?url=${encodeURIComponent(link)}`);
            if (!response.ok) {
                console.error(`Failed to fetch web page content for ${link}:`, response.statusText);
                return null;
            }
            const contentType = response.headers.get("content-type");
            if (!contentType.includes("text")) {
                console.warn(`Content type for ${link} is not text: ${contentType}`);
                return null;
            }
            return await response.text();
        } catch (error) {
            console.error(`Failed to fetch web page content for ${link}:`, error);
            return null;
        }
    }
}

async function storeTextData(storageKey, text) {
    const chunkedText = await handleChunkText(text, MAX_CHUNK_SIZE, overlapSize, storageKey);

    if (chunkedText === null) {
        return; // Exit the function early
    }
    const chunkedEmbeddings = await fetchChunkedEmbeddings(chunkedText, storageKey);
    await storeEmbeddingsAndChunksInDatabase(storageKey, chunkedText, chunkedEmbeddings);
}

async function handleNotExtractedLinks(notExtractedLinks, linkNodes) {
    for (const linkInfo of notExtractedLinks) {
        const node = linkNodes.find(node => node.linkUrl === linkInfo.url);
        const title = linkInfo.key;  // This is already the correct title or URL

        const userConfirmed = confirm(`"${title}" is not in the vector store. Extract the content?`);
        if (userConfirmed) {
            const success = await extractAndStoreLinkContent(linkInfo.url, title);
            if (success) {
                console.log(`Successfully extracted and stored content for "${title}"`);
            } else {
                console.warn(`Failed to extract content for "${title}"`);
            }
        }
    }
}

async function extractAndStoreLinkContent(link, title) {
    try {
        const extractedText = await fetchLinkContentText(link);
        if (!extractedText) {
            throw new Error("Failed to extract text or text was empty");
        }
        await receiveAndStoreByType(extractedText, title, link);
        return true;
    } catch (error) {
        console.error('Error during extraction and storage:', error);
        alert("An error occurred during extraction. Please ensure that the extract server is running on your localhost.");
        return false;
    }
}


async function receiveAndStoreByType(text, storageKey, url) {
    if (!text) {
        console.error("No text to store for:", storageKey);
        return;
    }
    try {
        if (isGitHubUrl(url)) {
            // GitHub handling remains the same
            const details = extractGitHubRepoDetails(url);
            if (!details) {
                console.error("Invalid GitHub URL:", url);
                return;
            }
            const { owner, repo } = details;
            const path = url.split(`github.com/${owner}/${repo}/`)[1] || '';
            await storeGitHubContent(text, owner, repo, path);
        } else {
            // Use the storageKey (which is now the title or URL) for non-GitHub URLs
            await storeTextData(storageKey, text);
        }
    } catch (error) {
        console.error(`Error storing text for ${storageKey}:`, error);
        removeVectorDbLoadingIndicator(storageKey);
    }
}

// Vector DB

async function storeEmbeddingsAndChunksInDatabase(key, chunks, embeddings) {
    console.log(`Preparing to store embeddings and text chunks for key: ${key}`);
    const selectedModel = document.getElementById("embeddingsModelSelect").value;
    updateVectorDbProgressBar(key, 0);

    try {
        // First, validate all chunks and embeddings
        if (chunks.length !== embeddings.length) {
            throw new Error("Mismatch between chunks and embeddings count");
        }

        // Prepare all requests
        const requests = chunks.map((chunk, i) => {
            const chunkKey = `${key}_chunk_${i}`;
            return {
                key: chunkKey,
                embeddings: [
                    {
                        embedding: embeddings[i],
                        source: selectedModel
                    }
                ],
                text: chunk
            };
        });

        // Now send all requests
        for (let i = 0; i < requests.length; i++) {
            const response = await fetch('http://localhost:4000/store-embedding-and-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requests[i])
            });

            if (!response.ok) {
                throw new Error(`Failed to store chunk ${i} for key ${key}: ${response.statusText}`);
            }

            const progress = ((i + 1) / chunks.length) * 100;
            updateVectorDbProgressBar(key, progress);
        }

        console.log(`Completed storing embeddings and chunks for ${key}`);
        return true;
    } catch (error) {
        console.error(`Failed to store chunks and embeddings for key ${key}:`, error);
        throw error;
    } finally {
        updateVectorDbProgressBar(key, 100);
        setTimeout(() => {
            removeVectorDbLoadingIndicator(key);
            fetchAndDisplayAllKeys();
        }, 500);
    }
}

async function storeAdditionalEmbedding(key, source, embedding) {
    try {
        const response = await fetch('http://localhost:4000/store-additional-embedding', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ key, source, embedding })
        });

        if (!response.ok) {
            throw new Error(`Failed to store additional embedding: ${response.statusText}`);
        }

        console.log('Additional embedding stored successfully');
    } catch (error) {
        console.error('Error storing additional embedding:', error);
    }
}

async function handleChunkText(text, maxLength, overlapSize, storageKey, shouldConfirm = true) {
    if (shouldConfirm) {
        try {
            openModal('vectorDbImportConfirmModal');
            const confirmedChunks = await setupVectorDbImportConfirmModal(text, maxLength, overlapSize, storageKey);
            return confirmedChunks;
        } catch (error) {
            if (error.message === "User cancelled the operation") {
                console.log('User cancelled the chunking operation');
                return null;
            } else {
                console.error('Confirmation failed:', error);
                throw error;
            }
        }
    } else {
        return chunkText(text, maxLength, overlapSize);
    }
}

async function fetchChunkedEmbeddings(textChunks, key) {
    openModal('vectorDbModal');
    await openVectorDbModal()
    updateVectorDbProgressBar(key, 0); // This will create the loading indicator if it doesn't exist
    const chunkEmbeddings = [];
    for (let i = 0; i < textChunks.length; i++) {
        const embedding = await fetchEmbeddings(textChunks[i]);
        chunkEmbeddings.push(embedding);
        const progress = ((i + 1) / textChunks.length) * 100;
        updateVectorDbProgressBar(key, progress);
    }
    return chunkEmbeddings;
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

// Query function for outside use.

async function fetchEmbeddingsForKeys(keys, source) {
    try {
        const response = await fetch('http://localhost:4000/fetch-embeddings-by-keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ keys, source })
        });
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.status}`);
        }

        const selectedEmbeddings = await response.json();

        // Ensure that the embeddings are returned in the expected format
        const formattedEmbeddings = selectedEmbeddings.map(embedding => ({
            key: embedding.key,
            embedding: embedding.embedding,
            text: embedding.text
        }));

        return formattedEmbeddings;
    } catch (error) {
        console.error(`Error fetching selected embeddings: ${error.message}`);
        console.error("Full error object:", error);
        return [];
    }
}

async function getRelevantChunks(searchQuery, topN, relevantKeys = []) {
    const selectedModel = document.getElementById("embeddingsModelSelect").value;
    let relevantEmbeddings = [];

    // Fetch embeddings for relevant keys or all keys
    if (relevantKeys.length > 0) {
        relevantEmbeddings = await fetchEmbeddingsForKeys(relevantKeys, selectedModel);
    }
    if (relevantEmbeddings.length === 0) {
        const allKeys = await getAllKeysFromServer();
        if (!allKeys || allKeys.length === 0) {
            console.warn("Failed to fetch keys from server.");
            return [];
        }
        relevantEmbeddings = await fetchEmbeddingsForKeys(allKeys, selectedModel);
    }

    // Fetch the search query embedding once
    const queryEmbedding = await fetchEmbeddings(searchQuery, selectedModel);

    // Process embeddings and calculate similarities
    const topNChunks = await Promise.all(relevantEmbeddings.map(async (embedding) => {
        let embeddingVector = embedding.embedding;
        if (!embeddingVector) {
            embeddingVector = await fetchEmbeddings(embedding.text, selectedModel);
            await storeAdditionalEmbedding(embedding.key, selectedModel, embeddingVector);
        }

        const similarity = await calculateSimilarity([{ embedding: embeddingVector }], queryEmbedding, selectedModel);
        return {
            key: embedding.key,
            text: embedding.text,
            source: selectedModel,
            relevanceScore: similarity[0].similarity
        };
    }));

    // Sort and return top N chunks
    topNChunks.sort((a, b) => b.relevanceScore - a.relevanceScore);
    console.log("Top N Chunks:", topNChunks.slice(0, topN));
    return topNChunks.slice(0, topN);
}

// Helper function to calculate cosine similarity for a list of embeddings
function calculateSimilarity(embeddings, queryEmbedding, source) {
    return embeddings.map(embedding => {
        const embeddingToUse = embedding[source] || embedding.embedding;
        const similarity = cosineSimilarity(embeddingToUse, queryEmbedding);
        return {
            ...embedding,
            similarity
        };
    });
}

function groupAndSortChunks(relevantChunks, MAX_CHUNK_SIZE) {
    // Group the chunks by their source (stripping the chunk number from the key)
    const groupedChunks = relevantChunks.reduce((acc, chunk) => {
        const [source, chunkNumber] = chunk.key.split('_chunk_');
        if (!acc[source]) acc[source] = [];
        acc[source].push({
            text: chunk.text.substring(0, MAX_CHUNK_SIZE),
            number: parseInt(chunkNumber),
            relevanceScore: chunk.relevanceScore,
            source: source
        });
        return acc;
    }, {});

    // Construct the topNChunksContent
    return Object.entries(groupedChunks)
        .map(([source, chunks]) => {
            chunks.sort((a, b) => a.number - b.number);
            return chunks
                .map(chunk => `[Snippet ${chunk.number}](${chunk.source}) (Relevance: ${chunk.relevanceScore.toFixed(2)}): ${chunk.text}...`)
                .join('\n');
        })
        .join('\n\n');
}