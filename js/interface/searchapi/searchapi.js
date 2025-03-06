async function generateKeywords(message, count, specificContext = null, node = null) {
    const lastPromptsAndResponses = specificContext || getLastPromptsAndResponses(2, 150);
    const isEmpty = !lastPromptsAndResponses || !/\S/.test(lastPromptsAndResponses);

    if (isEmpty) {
        return message
            .split(' ')
            .filter(word => word.trim().length > 0)
            .sort((a, b) => b.length - a.length)
            .slice(0, count)
            .map(String.trim);
    }

    const aiCall = AiCall.single(node)
        .addSystemPrompt("Recent conversation:" + lastPromptsAndResponses)
        .addSystemPrompt("Provide three single-word keywords relevant to the latest user message. Enclose each keyword in quotations and separate them with commas.")
        .addUserPrompt(message);
    aiCall.customTemperature = 0;

    const response = aiCall.exec();

    Logger.info("Generate Keywords Ai Response:", response);

    const regex = /"(.*?)"/g;
    const keywords = [];
    let match;
    while (match = regex.exec(response)) {
        keywords.push(match[1].trim());
    }

    Logger.info("Keywords:", keywords);
    return keywords;
}

function isGoogleSearchEnabled(nodeIndex = null) {
    if (nodeIndex !== null) {
        // Check for AI node-specific checkboxes
        const aiCheckbox = Elem.byId('google-search-checkbox-' + nodeIndex);
        if (aiCheckbox) return aiCheckbox.checked;
    }

    const globalCheckbox = Elem.byId('google-search-checkbox');
    return (globalCheckbox ? globalCheckbox.checked : false);
}

function performSearch(searchQuery) {
    Logger.info("Search Query in processLinkInput:", searchQuery);

    const apiKey = Elem.byId('googleApiKey').value;
    const searchEngineId = Elem.byId('googleSearchEngineId').value;

    if (!apiKey || !searchEngineId) {
        return window.alert('API Key or Search Engine ID is missing. Please enter them.')
            .then(() => Promise.resolve())
            .catch((error) => {
                Logger.err("Failed to display alert:", error);
                return Promise.resolve();
            });
    }

    const ct = new performSearch.ct(apiKey, searchEngineId, searchQuery);
    return Request.send(ct);
}
performSearch.ct = class {
    constructor(apiKey, searchEngineId, searchQuery){
        this.url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURI(searchQuery)}`;
        Logger.debug("Request URL:", this.url);
    }
    onResponse(res){ return res.json().then(this.onData) }
    onData(data){
        Logger.debug("Received data:", data);
        return data;
    }
    onFailure(){
        return window.alert("Failed to fetch search results. Please check your API key, search engine ID, and ensure your Google Cloud project is properly configured.")
            .then(() => "Failed to fetch search results:")
            .catch((error) => {
                Logger.err("Failed to display alert:", error);
                return "Failed to fetch search results:";
            });
    }
}

async function constructSearchQuery(userMessage, recentContext = null, node = null) {
    if (String.isUrl(userMessage)) {
        Elem.byId('prompt').value = '';
        const linkNode = new LinkNode(userMessage, userMessage);
        setupNodeForPlacement(linkNode);
        return null;
    }

    recentContext = recentContext || getLastPromptsAndResponses(2, 150);
    const aiCall = AiCall.single(node)
        .addSystemPrompt("Recent conversation context: \n" + recentContext)
        .addSystemPrompt("Without unnecessary preface or summary... From the provided context history, predict a relevant search query within quotation marks.")
        .addUserPrompt(userMessage);
    aiCall.customTemperature = 0;

    try {
        const apiResponse = aiCall.exec();

        const extractedQuery = apiResponse.match(/"([^"]*)"/);
        const searchQuery = extractedQuery ? extractedQuery[1] : apiResponse;
        Logger.info("Search Query:", searchQuery);

        if (!searchQuery || searchQuery.trim().length === 0) {
            Logger.warn("Received empty search query, using user message as fallback.");
            return userMessage;
        }
        return searchQuery;
    } catch (err) {
        Logger.err("In generating search query:", err);
        return userMessage;
    }
}

async function getRelevantSearchResults(userMessage, searchResults, topN = 5) {
    const fetchEmbeddings = Embeddings.fetch;
    const userMessageEmbedding = await fetchEmbeddings(userMessage);

    const searchResultEmbeddings = await Promise.all(
        searchResults.map(async result => {
            const titleAndDescription = result.title + " " + result.description;
            const embedding = await fetchEmbeddings(titleAndDescription);
            return {
                result,
                embedding
            };
        })
    );

    searchResultEmbeddings.forEach(resultEmbedding => {
        resultEmbedding.similarity = cosineSimilarity(userMessageEmbedding, resultEmbedding.embedding);
    });

    searchResultEmbeddings.sort((a, b) => b.similarity - a.similarity);

    // Return the top N search results
    return searchResultEmbeddings.slice(0, topN).map(resultEmbedding => resultEmbedding.result);
}

function processSearchResults(results) {
    if (!results || !results.items || !Array.isArray(results.items)) return [];

    const formattedResults = results.items.map(item => {
        return {
            title: item.title,
            link: item.link,
            description: item.snippet
        };
    });

    return (Array.isArray(formattedResults) ? formattedResults : "No results found");
}

function displaySearchResult(result){
    const description = String.dotTruncToLength(result.description, 500);
    const node = new LinkNode(result.link, result.title, description);
    setupNodeForPlacement(node); // Attach to the user's mouse
}
async function displayResultsRelevantToMessage(searchResults, message){
    const relevantResults = await getRelevantSearchResults(message, searchResults);
    relevantResults.forEach(displaySearchResult);
}

function returnLinkNodes() {
    window.prompt("Enter a Link or Search Query", '').then((linkUrl) => {
        if (linkUrl) processLinkInput(linkUrl);
    }).catch((error) => {
        Logger.err("Failed to get prompt input:", error);
    });
}

    //for interface.js link node drop handler
function processLinkInput(linkUrl) {
    if (String.isUrl(linkUrl)) {
        const node = new LinkNode(linkUrl, linkUrl);
        setupNodeForPlacement(node);
    } else {
        return handleNaturalLanguageSearch(linkUrl)
    }
}

async function handleNaturalLanguageSearch(query, message) {
    if (query === null) return;

    const searchResultsData = await performSearch(query);
    if (!searchResultsData) return;

    const searchResults = processSearchResults(searchResultsData);
    await displayResultsRelevantToMessage(searchResults, message ?? query);
    if (!message) return;

    return searchResults.map( (result, index)=>{
        const descr = result.description.substring(0, 100);
        return `Search Result ${index + 1}: ${result.title} - ${descr}...\n[Link: ${result.link}]\n`;
    }).join('\n');
}
