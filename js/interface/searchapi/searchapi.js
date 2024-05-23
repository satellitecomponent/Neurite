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
    // Get the API Key and Search Engine ID from local storage
    const apiKey = localStorage.getItem('googleApiKey');
    const searchEngineId = localStorage.getItem('googleSearchEngineId');

    console.log(`Search query: ${searchQuery}`);  // Log the search query

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURI(searchQuery)}`;
    //console.log(`Request URL: ${url}`);  // Log the request URL

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Received data:', data);  // Log the received data

        return data;
    } catch (error) {
        console.error('Error fetching search results:', error);
        alert('Failed to fetch search results. Please ensure you have entered your Google Programmable Search API key and search engine ID in the Ai tab.');
        return null;
    }
}

async function constructSearchQuery(userMessage, recentContext = null, node = null) {
    // If the user's message is a URL, use it as the search query and create a link node
    if (isUrl(userMessage)) {
        document.getElementById("prompt").value = ''; // Clear the textarea
        let linkNode = createLinkNode(userMessage, userMessage, userMessage); // Set the title to user's message (URL)
        // Attach the node to the user's mouse
        linkNode.followingMouse = 1;
        linkNode.mouseAnchor = toDZ(new vec2(0, -linkNode.content.offsetHeight / 2 + 6));

        return null; // Return null to indicate that no further processing is necessary
    }
    let nodeIndex = node ? node.index : null;
    //console.log(nodeIndex);
    // Adjust to account for both Google Search and Embed
    if (!isGoogleSearchEnabled(nodeIndex) && !isEmbedEnabled(nodeIndex)) {
        return "not-enabled"; // Return a default value when search is disabled
    }



    recentContext = recentContext || getLastPromptsAndResponses(2, 150);

    const queryContext = [{
        role: "system",
        content: `The following recent conversation may provide further context for generating your search query; \n ${recentContext},`
    },
    {
        role: "system",
        content: "Without preface or explanation, generate the search query most relevant to the current user message. Your response is used as a Google Programable Search and an embedded vector search that finds relevant webpages/pdf chunks. User can't see your output. Provide a single, keyword search query that's most likely to yield relevant results."
    },
    {
        role: "user",
        content: userMessage,
    },
    ];

    const searchQuery = await callchatAPI(queryContext, false, 0);
    console.log("Search Query", searchQuery);
    return searchQuery;
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
        node.followingMouse = 1;
        node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
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
        node.followingMouse = 1;
        node.draw();
        node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
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