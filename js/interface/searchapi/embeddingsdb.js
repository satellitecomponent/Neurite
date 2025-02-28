const Embeddings = {
    fetchFromModel: {
        "local-embeddings-gte-small": "fetchLocal",
        "local-embeddings-all-MiniLM-L6-v2": "fetchLocal",
        "mxbai-embed-large": "fetchOllama",
        "nomic-embed-text": "fetchOllama",
        "all-minilm": "fetchOllama",
        "text-embedding-ada-002": "fetchOpenAI",
        "text-embedding-3-large": "fetchOpenAI",
        "text-embedding-3-small": "fetchOpenAI"
    },
    selectModel: null,
    worker: null
}

let browserEmbeddingsInitialized = {};

Embeddings.initializeWorker = function(){
    Embeddings.selectModel = Elem.byId('embeddingsModelSelect');

    const worker = Embeddings.worker = new Worker('/embeddings.js', { type: 'module' });

    function onMessage(e){
        const data = e.data;
        if (data.type === 'ready') {
            browserEmbeddingsInitialized[data.model] = true;
        } else if (data.type === 'error') {
            Logger.err("From embeddings worker:", data.error);
        }
    }

    On.message(worker, onMessage);
    worker.onerror = Logger.err.bind(Logger, "From embeddings worker:");

    // Initialize both models
    worker.postMessage({ type: 'initialize', model: 'local-embeddings-gte-small' });
    worker.postMessage({ type: 'initialize', model: 'local-embeddings-all-MiniLM-L6-v2' });
}

Embeddings.initializeWorker();

Embeddings.fetch = function(text, source){
    const model = source || Embeddings.selectModel.value;
    const fetch = Embeddings.fetchFromModel[model];
    if (!fetch) return Promise.reject(new Error("Unsupported model: " + model));

    try {
        return Embeddings[fetch](model, text)
    } catch (err) {
        Logger.err(`In generating embeddings for model ${model}:`, err);
        return Promise.resolve([]);
    }
}

Embeddings.fetchLocal = function(model, text){
    return new Promise( (resolve, reject)=>{
        if (!browserEmbeddingsInitialized[model]) {
            return reject(new Error(`Embeddings worker is not initialized for ${model}.`))
        }

        const worker = Embeddings.worker;
        function onMessage(e){
            Off.message(worker, onMessage);
            const data = e.data;
            if (data.type === 'result') {
                resolve(data.data)
            } else { // data.type === 'error'
                reject(new Error(data.error))
            }
        }
        On.message(worker, onMessage);
        worker.postMessage({ type: 'generate', text: text, model: model });
    })
}

Embeddings.fetchOllama = async function(model, text){
    const modelList = await receiveOllamaModelList(true);
    const isModelAvailable = modelList.some(m => m.name === model);

    if (!isModelAvailable) {
        const isPulled = await pullOllamaModelWithProgress(model);
        if (!isPulled) {
            throw new Error("Failed to pull Ollama model: " + model);
        }
    }

    const embedding = await Ollama.fetchEmbeddings(model, text);
    if (!embedding) {
        throw new Error("Failed to generate Ollama embedding for model: " + model);
    }
    return embedding;
}

Embeddings.fetchOpenAI = async function(model, text){
    const API_URL = 'https://api.openai.com/v1/embeddings';
    const headers = new Headers({
        "Content-Type": "application/json",
        "Authorization": "Bearer " + Elem.byId('api-key-input').value
    });

    const response = await fetch(API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, input: text })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error("OpenAI API error: " + JSON.stringify(data));
    }

    return data.data[0].embedding;
}

function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
    }
    return dotProduct;
}


let keyFilters = new Map();

function toggleKeyFilter(key) {
    keyFilters.set(key, !keyFilters.get(key));
    localStorage.setItem('keyFilters', JSON.stringify(Array.from(keyFilters)));
}

function initializeKeyFilters() {
    const storedFilters = localStorage.getItem('keyFilters');
    if (storedFilters) {
        keyFilters = new Map(JSON.parse(storedFilters));
    }
}

initializeKeyFilters();

// Return all keys, including filtered ones
Keys.getAll = async function(){
    return (await Request.send(new Keys.fetcher())) || []
}
Keys.fetcher = class {
    url = 'http://localhost:4000/get-keys';
    onResponse(res){ return res.json() }
    onFailure(){ return "Failed to fetch keys:" }
}

Keys.getVisible = function(keys){
    return keys.filter( (key)=>(!keyFilters.get(key)) )
}

Keys.getRelevant = async function(userInput, recentContext = null, searchQuery, filteredKeys){
    const visibleKeys = filteredKeys;
    if (visibleKeys.length <= 3) return visibleKeys;

    // Use recent context or fetch the last prompts and responses if not provided
    recentContext = recentContext || getLastPromptsAndResponses(2, 1500);

    const directoryMap = new Map();
    visibleKeys.forEach(key => {
        const directory = key.substring(0, key.lastIndexOf('/'));
        directoryMap.set(directory, directoryMap.get(directory) || []);
        directoryMap.get(directory).push({
            index: visibleKeys.indexOf(key) + 1, // index +1 for display
            filename: key.substring(key.lastIndexOf('/') + 1)
        });
    });

    const keysDisplay = [];
    const indexToFileMap = {};
    directoryMap.forEach((files, directory) => {
        keysDisplay.push("Directory: ", directory, '\n');
        files.forEach(file => {
            keysDisplay.push(" ", file.index, ". ", file.filename, '\n');
            indexToFileMap[file.index] = visibleKeys[file.index - 1]; // Correct index for full key
        });
    });

    const aiPrompt = [
        { role: "system", content: `Determine the filepaths to select. Given the User Message and Search Query "${searchQuery}", identify between ONE and THREE numbered documents from the list most relevant to this context.` },
        { role: "system", content: "Here is the list of files:\n" + keysDisplay.join('') }
    ];

    if (recentContext && recentContext.trim() !== '') {
        aiPrompt.push({ role: "system", content: "The following recent conversation may provide context:\n" + recentContext });
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
    if (relevantKeys.length === 0) return visibleKeys;

    Logger.info("Selected Document Keys", relevantKeys);
    return relevantKeys;
}

Keys.getRelevantNodeLinks = async function(allConnectedNodesData, userMessage, searchQuery, filteredKeys, recentContext) {
    let relevantKeys = [];
  
    // Filter out only link-type nodes
    const linkNodesData = allConnectedNodesData.filter(info => info.data?.type === 'link');
  
    if (linkNodesData.length > 0) {
      // Collect url and key from each link node
      const linkInfo = linkNodesData.map(info => ({
        url: info.data.data.url,
        key: info.data.data.key
      }));
  
      // Get all keys from the server and determine which ones are relevant
      const allKeysFromServer = await this.getAll();
      relevantKeys = linkInfo
        .filter(info => allKeysFromServer.includes(info.key))
        .map(info => info.key);
  
      // Handle any links that have not yet been extracted
      const notExtractedLinks = linkInfo.filter(info => !allKeysFromServer.includes(info.key));
      if (notExtractedLinks.length > 0) {
        // Make sure handleNotExtractedLinks is defined or imported
        await handleNotExtractedLinks(
          notExtractedLinks,
          linkNodesData.map(info => info.node) // Pass the link node objects themselves
        );
      }
  
      // Refresh the keys after processing not-extracted links
      const updatedKeysFromServer = await this.getAll();
      relevantKeys = linkInfo
        .filter(info => updatedKeysFromServer.includes(info.key))
        .map(info => info.key);
  
    } else if (searchQuery !== null && filteredKeys) {
      // Fallback: obtain relevant keys based on the user message
      relevantKeys = await this.getRelevant(userMessage, recentContext, searchQuery, filteredKeys);
    }
  
    return relevantKeys;
}
  

Keys.fetchAndDisplayAll = function(){
    const onError = Logger.err.bind(Logger, "(Server disconnect) Failed to fetch keys:");
    return Keys.getAll().catch(onError).then(Keys.display);
}
Keys.display = function(keys){
    const keyList = Elem.byId('key-list');
    keyList.innerHTML = '';
    const uniqueGitHubRepos = new Set();
    for (const key of keys) {
        const listItem = Html.new.p();
        listItem.title = key; // sets the hover text

        const keyText = Html.new.span();
        keyText.textContent = key;

        const eyeballIcon = Svg.new.svg();
        eyeballIcon.classList.add("eyeball-icon");
        eyeballIcon.innerHTML = `<use xlink:href="${keyFilters.get(key) ? '#crossed-eyeball-symbol' : '#eyeball-symbol'}"></use>`;

        listItem.append(keyText, eyeballIcon);

        if (isGitHubUrl(key)) {
            const [protocol, empty, domain, owner, repo] = key.split('/');
            const rootRepo = `${protocol}//${domain}/${owner}/${repo}`;
            if (!uniqueGitHubRepos.has(rootRepo)) {
                uniqueGitHubRepos.add(rootRepo);
                keyList.appendChild(listItem);
            }
        } else {
            keyList.appendChild(listItem);
        }

        function onItemClicked(e){
            if (e.target !== eyeballIcon && e.target !== eyeballIcon.querySelector('use')) {
                e.stopPropagation();
                listItem.classList.toggle("selected");
            }
        }
        function onIconClicked(e){
            e.stopPropagation();
            toggleKeyFilter(key);
            updateEyeballIcon(eyeballIcon, key);
        }

        On.click(listItem, onItemClicked);
        On.click(eyeballIcon, onIconClicked);
    }
}

function updateEyeballIcon(eyeballIcon, key) {
    const useElement = eyeballIcon.querySelector('use');
    useElement.setAttribute('xlink:href', keyFilters.get(key) ? '#crossed-eyeball-symbol' : '#eyeball-symbol');
}

Keys.deleteSelected = async function(){
    const items = Elem.byId('key-list').getElementsByClassName("selected");
    const selectedKeys = Array.from(items).map(el => el.title || el.textContent.trim());

    if (selectedKeys.length < 1) {
        alert("No keys selected for deletion.");
        return;
    }

    const keysToDelete = [];
    for (const key of selectedKeys) {
        if (isGitHubUrl(key)) {
            // find all associated keys
            const allKeys = await Keys.getAll();
            const associatedKeys = allKeys.filter(k => k.startsWith(key));
            keysToDelete.push(...associatedKeys);
        } else {
            keysToDelete.push(key);
        }
    }

    const confirmMessage = "Are you sure you want to delete the following keys?\n\n"
                         + keysToDelete.join('\n') + "\n\nThis action cannot be undone.";
    const userConfirmed = await window.confirm(confirmMessage);
    if (userConfirmed) {
        await Promise.all(keysToDelete.map(Keys.deleteKey));
        await Keys.fetchAndDisplayAll();
    }
}
Keys.deleteKey = async function(key){
    await Request.send(new Keys.eraser(key))
}
Keys.eraser = class {
    static baseUrl = 'http://localhost:4000/delete-chunks?key=';
    options = {
        method: 'DELETE'
    };
    constructor(key){
        this.url = Keys.eraser.baseUrl + encodeURIComponent(key);
        this.key = key;
    }
    onFailure(){ return `Failed to delete chunks for key ${this.key}:` }
}

function handleFileUploadVDBSelection() {
    const fileInput = Elem.byId('fileInput');
    fileInput.click();
    On.change(fileInput, uploadFileToVectorDB);
}

async function processFileContent(file) {
    const fileURL = URL.createObjectURL(file);
    const fileType = file.type;

    try {
        switch (fileType) {
            case 'application/pdf':
                return await extractTextFromPDF(fileURL);
            case 'application/json':
                return await fetchJsonFile(fileURL);
            case 'text/plain':
            case 'text/html':
            case 'application/xml':
            case 'text/xml':
            case 'text/csv':
                return await fetchTextFile(fileURL);
            default:
                Logger.warn("Unsupported file type:", fileType);
        }
    } catch (err) {
        Logger.err("In processing file content:", err)
    } finally {
        URL.revokeObjectURL(fileURL); // release memory
    }
}

async function fetchFile(fileURL) {
    const response = await fetch(fileURL);
    if (!response.ok) throw new Error(response.statusText);
    return response;
}
async function fetchTextFile(fileURL) {
    try {
        const response = await fetchFile(fileURL);
        return await response.text();
    } catch (err) {
        Logger.err("In fetching text file:", err);
        throw err;
    }
}
async function fetchJsonFile(fileURL) {
    try {
        const response = await fetchFile(fileURL);
        return JSON.stringify(await response.json());
    } catch (err) {
        Logger.err("In fetching JSON file:", err);
        throw err;
    }
}

async function uploadFileToVectorDB() {
    const fileInput = Elem.byId('fileInput');
    if (fileInput.files.length < 1) {
        alert("Please select a file to upload");
        return;
    }

    const btnChunkAndStore = Elem.byId('chunkAndStoreButton');

    let dotCount = 0;
    const dotInterval = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        btnChunkAndStore.textContent = btnChunkAndStore.textContent.replace(/\.+$/, '') + '.'.repeat(dotCount);
    }, 500);

    try {
        const file = fileInput.files[0];
        btnChunkAndStore.textContent = "Reading File";
        const fileText = await processFileContent(file);
        if (!fileText) {
            alert("Failed to extract text from the file");
            return;
        }

        btnChunkAndStore.textContent = "Processing Input";
        await receiveAndStoreByType(fileText, file.name, file.name);

        btnChunkAndStore.textContent = "Upload Complete";
    } catch (err) {
        Logger.err("Failed to process and store input:", err);
        btnChunkAndStore.textContent = "Process Failed";
    } finally {
        clearInterval(dotInterval);
        fileInput.value = '';
    }
}

// using PDF.js
async function extractTextFromPDF(pdfLink) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.9.179/build/pdf.worker.min.js';
    const loadingTask = pdfjsLib.getDocument(pdfLink);

    try {
        const pdf = await loadingTask.promise;
        const extracted = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            extracted.push(textContent.items.map(item => item.str).join(' '));
        }
        return extracted.join('');
    } catch (err) {
        Logger.err("In extracting text from PDF:", err);
        throw new Error("Failed to extract text from PDF");
    }
}

Link.fetchContentText = function(link){ // promise
    if (link.toLowerCase().endsWith('.pdf') || link.startsWith('blob:')) {
        return extractTextFromPDF(link);
    }

    if (!isGitHubUrl(link)) return Request.send(new Link.textFetcher(link));

    const details = extractGitHubRepoDetails(link);
    if (!details) {
        Logger.err("Invalid GitHub URL:", link);
        return Promise.resolve();
    }

    return fetchGitHubRepoContent(details.owner, details.repo);
}
Link.textFetcher = class TextFetcher {
    static baseUrl = 'http://localhost:4000/proxy?url=';
    constructor(link){
        this.url = TextFetcher.baseUrl + encodeURIComponent(link);
        this.link = link;
    }
    onResponse(res){
        const contentType = res.headers.get("content-type");
        if (contentType.includes("text")) return res.text();

        Logger.warn("Content type for", this.link, "is not text:", contentType);
    }
    onFailure(){ return `Failed to fetch web page content for ${this.link}:` }
}

async function storeTextData(storageId, text) {
    const chunkedText = await handleChunkText(text, MAX_CHUNK_SIZE, overlapSize, storageId);
    if (chunkedText === null) return;

    const chunkedEmbeddings = await Embeddings.fetchChunked(chunkedText, storageId);
    await storeEmbeddingsAndChunksInDatabase(storageId, chunkedText, chunkedEmbeddings);
}

async function handleNotExtractedLinks(notExtractedLinks, linkNodes) {
    for (const linkInfo of notExtractedLinks) {
        const node = linkNodes.find(node => node.linkUrl === linkInfo.url);
        const title = linkInfo.key;  // This is already the correct title or URL

        const userConfirmed = await window.confirm(`"${title}" is not in the vector store. Extract the content?`);
        if (!userConfirmed) continue;

        const success = await extractAndStoreLinkContent(linkInfo.url, title);
        if (success) {
            Logger.info(`Successfully extracted and stored content for "${title}"`);
        } else {
            Logger.warn(`Failed to extract content for "${title}"`);
        }
    }
}

async function extractAndStoreLinkContent(link, title) {
    try {
        const extractedText = await Link.fetchContentText(link);
        if (!extractedText) {
            throw new Error("Failed to extract text or text was empty");
        }
        await receiveAndStoreByType(extractedText, title, link);
        return true;
    } catch (err) {
        Logger.err("During extraction and storage:", err);
        alert("An error occurred during extraction. Please ensure that the extract server is running on your localhost.");
        return false;
    }
}

async function receiveAndStoreByType(text, storageId, url) {
    if (!text) {
        Logger.err("No text to store for:", storageId);
        return;
    }

    try {
        if (isGitHubUrl(url)) {
            // GitHub handling remains the same
            const details = extractGitHubRepoDetails(url);
            if (!details) {
                Logger.err("Invalid GitHub URL:", url);
                return;
            }

            const { owner, repo } = details;
            const path = url.split(`github.com/${owner}/${repo}/`)[1] || '';
            await storeGitHubContent(text, owner, repo, path);
        } else {
            // Use the storageId (which is now the title or URL) for non-GitHub URLs
            await storeTextData(storageId, text);
        }
    } catch (err) {
        Logger.err(`In storing text for ${storageId}:`, err);
        VectorDb.removeLoadingIndicator(storageId);
    }
}

// Vector DB

async function storeEmbeddingsAndChunksInDatabase(key, chunks, embeddings) {
    Logger.info("Preparing to store embeddings and text chunks for key:", key);
    const selectedModel = Embeddings.selectModel.value;
    const updateProgressBar = VectorDb.funcUpdateProgressBarForKey(key);
    updateProgressBar(0);

    try {
        // First, validate all chunks and embeddings
        if (chunks.length !== embeddings.length) {
            throw new Error("Mismatch between chunks and embeddings count");
        }

        const requests = chunks.map((chunk, i) => {
            return {
                key: key + "_chunk_" + i,
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

            const progress = 100 * (i + 1) / chunks.length;
            updateProgressBar(progress);
        }

        Logger.info("Completed storing embeddings and chunks for", key);
        return true;
    } catch (err) {
        Logger.err(`Failed to store chunks and embeddings for key ${key}:`, err);
        throw err;
    } finally {
        updateProgressBar(100);
        Promise.delay(500).then( ()=>{
            VectorDb.removeLoadingIndicator(key);
            Keys.fetchAndDisplayAll();
        });
    }
}

async function storeAdditionalEmbedding(key, source, embedding) {
    await Request.send(new storeAdditionalEmbedding.ct(key, source, embedding));
}
storeAdditionalEmbedding.ct = class {
    url = 'http://localhost:4000/store-additional-embedding';
    constructor(key, source, embedding){
        this.options = Request.makeJsonOptions('POST', { key, source, embedding })
    }
    onSuccess(){ return "Additional embedding stored successfully" }
    onFailure(){ return "Failed to store additional embedding:" }
}

async function handleChunkText(text, maxLength, overlapSize, storageId, shouldConfirm = true) {
    if (!shouldConfirm) return chunkText(text, maxLength, overlapSize);

    try {
        Modal.open('vectorDbImportConfirmModal');
        const confirmedChunks = await setupVectorDbImportConfirmModal(text, maxLength, overlapSize, storageId);
        return confirmedChunks;
    } catch (err) {
        if (err.message === "User cancelled the operation") {
            Logger.info("User cancelled the chunking operation");
            return null;
        } else {
            Logger.err("Confirmation failed:", err);
            throw err;
        }
    }
}

Embeddings.fetchChunked = async function(textChunks, key){
    await VectorDb.openModal();
    const updateProgressBar = VectorDb.funcUpdateProgressBarForKey(key);
    updateProgressBar(0);

    const chunkEmbeddings = [];
    for (let i = 0; i < textChunks.length; i++) {
        const embedding = await Embeddings.fetch(textChunks[i]);
        chunkEmbeddings.push(embedding);
        const progress = 100 * (i + 1) / textChunks.length;
        updateProgressBar(progress);
    }
    return chunkEmbeddings;
}

function chunkText(text, maxLength, overlapSize) {
    // Modified regex to preserve punctuation and spaces
    const sentences = text.match(/[^.!?]+\s*[.!?]+|[^.!?]+$/g);
    if (!Array.isArray(sentences)) {
        Logger.err("Failed to split text into sentences:", text);
        return [];
    }

    let chunks = [];
    let currentChunk = [];
    let currentLength = 0;

    sentences.forEach(sentence => {
        const words = sentence.split(/\s+/);

        words.forEach(word => {
            const wordLength = word.length + (currentLength > 0 ? 1 : 0); // Add 1 for space if not first word

            // If adding the word exceeds maxLength, push the current chunk and reset
            if (currentLength + wordLength > maxLength) {
                if (currentChunk.length > 0) {
                    chunks.push(currentChunk.join(' '));
                }
                currentChunk = [];
                currentLength = 0;
            }

            currentChunk.push(word);
            currentLength += wordLength;

            if (wordLength > maxLength) {
                throw new Error("Word length exceeds maxLength: " + word);
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
    return (await Request.send(new fetchEmbeddingsForKeys.ct(keys, source))) || []
}
fetchEmbeddingsForKeys.ct = class {
    url = 'http://localhost:4000/fetch-embeddings-by-keys';
    constructor(keys, source){
        this.options = Request.makeJsonOptions('POST', { keys, source })
    }
    onResponse(res){ return res.json().then(this.onData) }
    onData(selectedEmbeddings){
        return selectedEmbeddings.map( (embedding)=>({
            key: embedding.key,
            embedding: embedding.embedding,
            text: embedding.text
        }))
    }
    onFailure(){ return "Failed to fetch selected embeddings:" }
}

async function getRelevantChunks(searchQuery, topN, relevantKeys = []) {
    if (relevantKeys.length < 1) {
        Logger.warn("No relevant keys provided for fetching embeddings.");
        return [];
    }

    const selectedModel = Embeddings.selectModel.value;
    const fetchEmbeddings = Embeddings.fetch;
    const relevantEmbeddings = await fetchEmbeddingsForKeys(relevantKeys, selectedModel);
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

    topNChunks.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const firstN = topNChunks.slice(0, topN);
    Logger.info("Top N Chunks:", firstN);
    return firstN;
}

// Helper function to calculate cosine similarity for a list of embeddings
function calculateSimilarity(embeddings, queryEmbedding, source) {
    return embeddings.map(embedding => {
        const embeddingToUse = embedding[source] || embedding.embedding;
        return {
            ...embedding,
            similarity: cosineSimilarity(embeddingToUse, queryEmbedding)
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
