//searchapi.js

async function generateKeywords(message, count, specificContext = null, node = null) {
    const lastPromptsAndResponses = specificContext || getLastPromptsAndResponses(2, 150);
    const isEmpty = !lastPromptsAndResponses || !/\S/.test(lastPromptsAndResponses);

    if (isEmpty) {
        return message
            .split(' ')
            .filter(word => word.trim().length > 0)
            .sort((a, b) => b.length - a.length)
            .slice(0, count)
            .map(word => word.trim());
    }

    const messages = [
        {
            role: "system",
            content: `Recent conversation:${lastPromptsAndResponses}`,
        },
        {
            role: "system",
            content: `Provide three single-word keywords relevant to the latest user message. Enclose each keyword in quotations and separate them with commas.`,
        },
        {
            role: "user",
            content: `${message}`,
        },
    ];

    let response;
    if (node) {
        response = await callchatLLMnode(messages, node, false, 0);
    } else {
        response = await callchatAPI(messages, false, 0);
    }

    console.log(`Generate Keywords Ai Response:`, response);

    const regex = /"(.*?)"/g;
    const keywords = [];
    let match;
    while (match = regex.exec(response)) {
        keywords.push(match[1].trim());
    }

    console.log(`Keywords:`, keywords);
    return keywords;
}

// Function to check if Google Search is enabled
function isGoogleSearchEnabled(nodeIndex = null) {
    const globalCheckbox = document.getElementById("google-search-checkbox");

    // Check for AI node-specific checkboxes only if nodeIndex is provided
    if (nodeIndex !== null) {
        const aiCheckbox = document.getElementById(`google-search-checkbox-${nodeIndex}`);
        if (aiCheckbox) {
            return aiCheckbox.checked;
        }
    }

    // If we are here, it means no node-specific checkbox was found or nodeIndex was not provided
    if (globalCheckbox) {
        return globalCheckbox.checked;
    }

    return false;
}


// console.log("Sending context to AI:", messages);
async function performSearch(searchQuery) {
    console.log(`Search Query in processLinkInput: ${searchQuery}`);

    // Get the API Key and Search Engine ID from input fields
    const apiKey = document.getElementById('googleApiKey').value;
    const searchEngineId = document.getElementById('googleSearchEngineId').value;

    if (!apiKey || !searchEngineId) {
        alert('API Key or Search Engine ID is missing. Please enter them.');
        return null;
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURI(searchQuery)}`;
    //console.log(`Request URL: ${url}`);  // Log the request URL

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        //console.log('Received data:', data);  // Log the received data

        return data;
    } catch (error) {
        console.error('Error fetching search results:', error);
        alert(`Failed to fetch search results: ${error.message}. Please check your API key, search engine ID, and ensure your Google Cloud project is properly configured.`);
        return null;
    }
}

async function constructSearchQuery(userMessage, recentContext = null, node = null) {
    if (isUrl(userMessage)) {
        document.getElementById("prompt").value = '';
        let linkNode = createLinkNode(userMessage, userMessage, userMessage);
        setupNodeForPlacement(linkNode);
        return null;
    }

    recentContext = recentContext || getLastPromptsAndResponses(2, 150);
    const queryContext = [
        {
            role: "system",
            content: `Recent conversation context: \n${recentContext}`
        },
        {
            role: "system",
            content: "Without unnecessary preface or summary... From the provided context history, predict a relevant search query within quotation marks."
        },
        {
            role: "user",
            content: userMessage
        }
    ];

    try {
        let apiResponse;
        if (node) {
            apiResponse = await callchatLLMnode(queryContext, node, false, 0);
        } else {
            apiResponse = await callchatAPI(queryContext, false, 0);
        }

        const extractedQuery = apiResponse.match(/"([^"]*)"/);
        const searchQuery = extractedQuery ? extractedQuery[1] : apiResponse;
        console.log("Search Query:", searchQuery);

        if (!searchQuery || searchQuery.trim().length === 0) {
            console.warn("Received empty search query, using user message as fallback.");
            return userMessage;
        }
        return searchQuery;
    } catch (error) {
        console.error("Error generating search query:", error);
        return userMessage;
    }
}




async function getRelevantSearchResults(userMessage, searchResults, topN = 5) {
    const userMessageEmbedding = await fetchEmbeddings(userMessage);

    // Get the embeddings for the search results and store them in an array
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

    // Calculate the cosine similarity between the user message embedding and each search result embedding
    searchResultEmbeddings.forEach(resultEmbedding => {
        resultEmbedding.similarity = cosineSimilarity(userMessageEmbedding, resultEmbedding.embedding);
    });

    // Sort the search results by their similarity scores
    searchResultEmbeddings.sort((a, b) => b.similarity - a.similarity);

    // Return the top N search results
    return searchResultEmbeddings.slice(0, topN).map(resultEmbedding => resultEmbedding.result);
}


function processSearchResults(results) {
    if (!results || !results.items || !Array.isArray(results.items)) {
        return []; // Return an empty array if no valid results are found
    }

    const formattedResults = results.items.map(item => {
        return {
            title: item.title,
            link: item.link,
            description: item.snippet
        };
    });

    if (!Array.isArray(formattedResults)) {
        return "No results found";
    }

    return formattedResults;
}


function displaySearchResults(searchResults) {
    searchResults.forEach((result, index) => {
        let title = `${result.title}`;
        let description = result.description.substring(0, 500) + "...";
        let link = result.link;

        let node = createLinkNode(title, description, link);
        // Attach the node to the user's mouse
        setupNodeForPlacement(node);
    });
}

function returnLinkNodes() {
    let linkUrl = prompt("Enter a Link or Search Query", "");

    if (linkUrl) {
        processLinkInput(linkUrl);
    }
}

    //for interface.js link node drop handler
async function processLinkInput(linkUrl) {
    if (isUrl(linkUrl)) {
        let node = createLinkNode(linkUrl, linkUrl, linkUrl);
        setupNodeForPlacement(node);
    } else {
        await handleNaturalLanguageSearch(linkUrl);
    }
}

async function handleNaturalLanguageSearch(query) {
    let searchResultsData = null;

    // Construct the search query
    if (query === null) {
        return; // Return early if the query is null
    }

    searchResultsData = await performSearch(query);

    if (searchResultsData) {
        let searchResults = processSearchResults(searchResultsData);
        searchResults = await getRelevantSearchResults(query, searchResults);
        displaySearchResults(searchResults);
    }
}