//searchapi.js

async function generateKeywords(message, count, specificContext = null) {
    const lastPromptsAndResponses = specificContext || getLastPromptsAndResponses(2, 150);
    const isEmpty = !lastPromptsAndResponses || !/\S/.test(lastPromptsAndResponses);

    if (isEmpty) {
        // If the context is empty, return the 'count' longest words from the user message
        const keywords = message
            .split(' ')
            .filter(word => word.trim().length > 0)
            .sort((a, b) => b.length - a.length)
            .slice(0, count)
            .map(word => word.trim());
        return keywords;
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

    const response = await callchatAPI(messages, false, 0);
    console.log(`Generate Keywords Ai Response:`, response);

    // Extract keywords by finding the part between quotations
    const regex = /"(.*?)"/g;
    let match;
    const keywords = [];
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

// Function to check if Embed (Data) is enabled
function isEmbedEnabled(nodeIndex = null) {
    const globalCheckbox = document.getElementById("embed-checkbox");

    // Check for AI node-specific checkboxes only if nodeIndex is provided
    if (nodeIndex !== null) {
        const aiCheckbox = document.getElementById(`embed-checkbox-${nodeIndex}`);
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
    // Check if the user's message is a URL
    if (isUrl(userMessage)) {
        document.getElementById("prompt").value = ''; // Clear the input field
        let linkNode = createLinkNode(userMessage, userMessage, userMessage); // Create a link node with the URL
        setupNodeForPlacement(linkNode); // Attach the node for user interaction
        return null; // End function execution as no search query is needed
    }

    // Fetch the index of the current node if available
    let nodeIndex = node ? node.index : null;

    // Check if search features are enabled for the current node
    if (!isGoogleSearchEnabled(nodeIndex) && !isEmbedEnabled(nodeIndex)) {
        return "not-enabled"; // Return immediately if search is disabled
    }

    // Prepare the recent context for the query
    recentContext = recentContext || getLastPromptsAndResponses(2, 150);
    const queryContext = [
        {
            role: "system",
            content: `Recent conversation context: \n${recentContext}`
        },
        {
            role: "system",
            content: "Generate the search query most relevant to the current user message. This will be used for both Google Programmable Search and embedded vector search."
        },
        {
            role: "user",
            content: userMessage
        }
    ];

    // Attempt to generate a search query using the chat API
    try {
        const searchQuery = await callchatAPI(queryContext, false, 0);
        console.log("Generated Search Query:", searchQuery);

        // Check if the search query is empty, null, or undefined
        if (!searchQuery || searchQuery.trim().length === 0) {
            console.warn("Received empty search query, using user message as fallback.");
            return userMessage; // Use user's original message as fallback
        }
        return searchQuery; // Return the valid search query
    } catch (error) {
        console.error("Error generating search query:", error);
        return userMessage; // Fallback to the user's message if an error occurs
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