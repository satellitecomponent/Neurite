async function fetchEmbeddings(text, source = null) {
    const model = source || document.getElementById("embeddingsModelSelect").value;
    const API_KEY = document.getElementById("api-key-input").value;

    switch (model) {
        case "local-embeddings":
            if (window.generateEmbeddings) {
                // Local embeddings logic
                try {
                    const output = await window.generateEmbeddings(text, {
                        pooling: 'mean',
                        normalize: true,
                    });
                    return Array.from(output.data); // Convert Float32Array to regular array
                } catch (error) {
                    console.error("Error generating local embeddings:", error);
                    return [];
                }
            } else {
                console.error("Local embedding function not available.");
                alert("Local embedding function is not available.");
                return [];
            }
        case "mxbai-embed-large":
        case "nomic-embed-text":
        case "all-minilm":
            // Check if the model is already in the model list
            const modelList = await await receiveOllamaModelList(true); //true to not filter out embeddings models.
            const isModelAvailable = modelList.some(m => m.name === model);

            if (!isModelAvailable) {
                // If the model is not in the list, pull it
                const isPulled = await pullOllamaModelWithProgress(model);
                if (!isPulled) {
                    console.error("Failed to pull Ollama model:", model);
                    return [];
                }
            }

            // Ollama API embeddings logic
            try {
                const embedding = await generateOllamaEmbedding(model, text);
                return embedding || [];
            } catch (error) {
                console.error("Error generating Ollama embeddings:", error);
                return [];
            }
        default:
            // OpenAI API embeddings logic
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

    // Start the dot animation
    const dotInterval = setInterval(() => {
        dotCount = (dotCount + 1) % 4; // Cycle dotCount between 0 and 3
        chunkAndStoreButton.textContent = "Chunking Input" + ".".repeat(dotCount);
    }, 500); // Update every 500 milliseconds

    try {
        if (fileInput.files.length === 0) {
            alert("Please select a file to upload");
            return;
        }

        const file = fileInput.files[0];
        const fileText = await processFileContent(file);

        if (!fileText) {
            alert("Failed to extract text from the file");
            return;
        }

        const chunkedText = chunkText(fileText, MAX_CHUNK_SIZE, overlapSize);
        const chunkedEmbeddings = await fetchChunkedEmbeddings(chunkedText);

        let key = file.name; // Use the file name as the key
        const success = await storeEmbeddingsAndChunksInDatabase(key, chunkedText, chunkedEmbeddings);

        chunkAndStoreButton.textContent = success ? "Upload File" : "Chunking Failed";

    } catch (error) {
        console.error(`Failed to chunk and store input:`, error);
        chunkAndStoreButton.textContent = "Chunking Failed";
    } finally {
        clearInterval(dotInterval); // Stop the dot animation
        fileInput.value = ""; // Reset file input
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

async function extractAndStoreLinkContent(link) {
    try {
        const extractedText = await fetchLinkContentText(link); // Fetch text based on content type
        if (!extractedText) {
            throw new Error("Failed to extract text or text was empty");
        }
        await receiveAndStoreText(extractedText, link, link);
        return true;
    } catch (error) {
        console.error('Error during extraction and storage:', error);
        alert("An error occurred during extraction. Please ensure that the extract server is running on your localhost.");
        return false;
    }
}

async function handleNotExtractedLinks(notExtractedLinks) {
    for (const link of notExtractedLinks) {
        const userConfirmed = confirm(`${link} is not in the vector store. Extract the content?`);
        if (userConfirmed) {
            const success = await extractAndStoreLinkContent(link);
            if (success) {
                console.log(`Successfully extracted and stored content for ${link}`);
            } else {
                console.warn(`Failed to extract content for ${link}`);
            }
        }
    }
}

async function storeTextData(storageKey, text) {
    const chunkedText = chunkText(text, MAX_CHUNK_SIZE, overlapSize);
    const chunkedEmbeddings = await fetchChunkedEmbeddings(chunkedText);
    await storeEmbeddingsAndChunksInDatabase(storageKey, chunkedText, chunkedEmbeddings);
}

async function receiveAndStoreText(text, storageKey, url) {
    if (!text) {
        console.error("No text to store for:", storageKey);
        return;
    }

    try {
        if (isGitHubUrl(url)) {
            // Use the robust extraction method to get GitHub details
            const details = extractGitHubRepoDetails(url);
            if (!details) {
                console.error("Invalid GitHub URL:", url);
                return;  // Exit if the URL is not a valid GitHub repository URL
            }
            const { owner, repo } = details;
            const path = url.split(`github.com/${owner}/${repo}/`)[1] || '';  // Extract the path within the repository

            // GitHub content requires specialized handling
            await storeGitHubContent(text, owner, repo, path);
        } else {
            // Call the existing storeTextData function for non-GitHub URLs
            await storeTextData(storageKey, text);  // Ensure this is awaited to handle asynchronous operations
        }
    } catch (error) {
        console.error(`Error storing text for ${storageKey}:`, error);
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




// Vector DB

async function storeEmbeddingsAndChunksInDatabase(key, chunks, embeddings) {
    console.log(`Storing embeddings and text chunks for key: ${key}`);

    // Get the selected model from the dropdown
    const selectedModel = document.getElementById("embeddingsModelSelect").value;

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
                    embeddings: [
                        {
                            embedding: embeddings[i],
                            source: selectedModel
                        }
                    ],
                    text: chunks[i]
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
    // Get the selected model from the dropdown
    const selectedModel = document.getElementById("embeddingsModelSelect").value;

    let relevantEmbeddings = [];

    // If relevant keys are provided, fetch embeddings for those keys
    if (relevantKeys.length > 0) {
        relevantEmbeddings = await fetchEmbeddingsForKeys(relevantKeys, selectedModel);
    }

    // If no relevant keys were provided or fetching failed, use all available keys
    if (relevantKeys.length === 0 || !relevantEmbeddings || relevantEmbeddings.length === 0) {
        // Fetch all available keys from the server
        const allKeys = await getAllKeysFromServer();
        if (!allKeys || allKeys.length === 0) {
            console.warn("Failed to fetch keys from server.");
            return [];
        }
        relevantEmbeddings = await fetchEmbeddingsForKeys(allKeys, selectedModel);
    }
    //console.log(relevantEmbeddings);

    // Prepare the final output
    const topNChunks = [];

    for (const embedding of relevantEmbeddings) {
        if (embedding.embedding) {
            // Calculate the similarity between the search query and the embedding
            const similarity = await calculateSimilarity([{ embedding: embedding.embedding }], await fetchEmbeddings(searchQuery, selectedModel), selectedModel);

            topNChunks.push({
                key: embedding.key,
                text: embedding.text,
                source: selectedModel,
                relevanceScore: similarity[0].similarity
            });
        } else {
            // If the desired source is not available, fetch the embedding and store it in the database
            const convertedEmbedding = await fetchEmbeddings(embedding.text, selectedModel);

            // Store the embedding with the additional source in the database
            await storeAdditionalEmbedding(embedding.key, selectedModel, convertedEmbedding);

            // Calculate the similarity between the search query and the converted embedding
            const similarity = await calculateSimilarity([{ embedding: convertedEmbedding }], await fetchEmbeddings(searchQuery, selectedModel), selectedModel);

            topNChunks.push({
                key: embedding.key,
                text: embedding.text,
                source: selectedModel,
                relevanceScore: similarity[0].similarity
            });
        }
    }

    // Sort the top N chunks by relevance score and return the top N
    topNChunks.sort((a, b) => b.relevanceScore - a.relevanceScore);
    console.log("Top N Chunks:", topNChunks.slice(0, topN));
    return topNChunks.slice(0, topN);
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

async function fetchChunkedEmbeddings(textChunks) {
    // Array to store the embeddings
    const chunkEmbeddings = [];

    // Loop through each chunk of text
    for (const chunk of textChunks) {
        const embedding = await fetchEmbeddings(chunk);
        chunkEmbeddings.push(embedding);
    }

    return chunkEmbeddings;
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
        });
        return acc;
    }, {});

    // Construct the topNChunksContent
    return Object.entries(groupedChunks).map(([source, chunks]) => {
        chunks.sort((a, b) => a.number - b.number);
        return `[${source}](${source})\n\n${chunks.map(chunk => `(Snippet ${chunk.number}) (Relevance: ${chunk.relevanceScore.toFixed(2)}): ${chunk.text}...`).join('\n')}\n`;
    }).join('\n');
}