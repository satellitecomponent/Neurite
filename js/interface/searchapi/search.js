function clearSearchHighlights(nodesArray) {
    for (const node of nodesArray) {
        node.content.classList.remove("search_matched");
        node.content.classList.remove("search_nomatch");
    }
}

function searchNodesBy(searchTerm, maxResults = null) {
    let keywords = searchTerm.toLowerCase().split(' ');
    let matched = [];
    for (let n of nodes) {
        let numMatches = 0;
        for (let keyword of keywords) {
            if ([...n.searchStrings()].join().toLowerCase().includes(keyword)) {
                numMatches++;
            }
        }
        if (numMatches > 0) {
            matched.push({
                node: n,
                numMatches: numMatches
            });
        } else {
            n.content.classList.remove("search_matched");
            n.content.classList.add("search_nomatch");
        }
    }
    // Sort by the number of matches in descending order
    matched.sort((a, b) => b.numMatches - a.numMatches);

    // Apply classes only to the top 'maxResults' (or all if maxResults is null)
    matched.forEach((match, index) => {
        if (!maxResults || index < maxResults) {
            match.node.content.classList.add("search_matched");
            match.node.content.classList.remove("search_nomatch");
        } else {
            match.node.content.classList.remove("search_matched");
            match.node.content.classList.add("search_nomatch");
        }
    });

    // Return all matched nodes if needed or just the top results
    return (maxResults ? matched.slice(0, maxResults) : matched).map(m => m.node);
}

function clearSearch() {
    for (let n of nodes) {
        n.content.classList.remove("search_matched");
        n.content.classList.remove("search_nomatch");
    }
}

function performZettelkastenSearch(searchTerm) {
    let res = document.querySelector("#search-results .results-display-div");
    let ns;

    if (searchTerm) {
        ns = searchNodesBy(searchTerm);
    } else {
        ns = Object.values(nodeMap);
    }

    res.innerHTML = "";

    for (let n of ns) {
        let c = document.createElement("div");
        c.classList.add("search-result-item");
        let title = document.createElement("div");
        title.classList.add("search-result-title");
        title.appendChild(document.createTextNode(n.getTitle()));
        c.appendChild(title);
        c.addEventListener("click", (function (event) {
            this.zoom_to();
            autopilotSpeed = settings.autopilotSpeed;
        }).bind(n));
        c.addEventListener("dblclick", (function (event) {
            this.zoom_to();
            skipAutopilot();
            autopilotSpeed = settings.autopilotSpeed;
        }).bind(n));
        res.appendChild(c);
    }
}

function setupZettelkastenSearchBar() {
    let inp = document.getElementById("Searchbar");
    inp.addEventListener("input", function () {
        performZettelkastenSearch(inp.value);
    });
}




document.getElementById("vectorDbSearchButton").addEventListener("click", () => {
    openModal("vectorDbSearchModal");
    performVectorDbDisplaySearch();
    // Create a debounced version of performVectorDbDisplaySearch
    const debouncedPerformVectorDbDisplaySearch = debounce(performVectorDbDisplaySearch, 300);


    document.getElementById("vectorDbSearchInput").addEventListener("input", debouncedPerformVectorDbDisplaySearch);

    const topNSlider = document.getElementById('topNSlider');
    const topNValue = document.getElementById('topNValue');

    // Display the initial slider value
    topNValue.textContent = topNSlider.value;

    // Update display value on slider input
    topNSlider.addEventListener('input', () => {
        topNValue.textContent = topNSlider.value;
        debouncedPerformVectorDbDisplaySearch(); // Use the debounced function here
    });
});



// Function to perform the search and display the results
async function performVectorDbDisplaySearch() {
    const searchQuery = document.getElementById("vectorDbSearchInput").value;

    const searchResultsContainer = document.getElementById("vectorDbSearchDisplay");
    searchResultsContainer.innerHTML = ""; // Clear previous search results

    // Create and display the loading icon
    const loaderElement = document.createElement("div");
    loaderElement.classList.add("loader");
    loaderElement.classList.add("loader-centered");
    searchResultsContainer.appendChild(loaderElement);

    try {
        const relevantChunks = await getRelevantChunks(searchQuery, topN);

        // Remove the loading icon
        searchResultsContainer.removeChild(loaderElement);

        relevantChunks.forEach(chunk => {
            const [source, chunkNumber] = chunk.key.split('_chunk_');

            const resultElement = document.createElement("div");
            resultElement.classList.add("vdb-search-result");
            resultElement.innerHTML = `
                <div class="vdb-result-header">
                    <div class="vdb-result-source">${source}</div>
                    <div class="vdb-result-score">Relevance: <br />${chunk.relevanceScore.toFixed(3)}</div>
                </div>
                <div class="vdb-result-text">${chunk.text}</div>
            `;
            searchResultsContainer.appendChild(resultElement);
        });
    } catch (error) {
        console.error("Error fetching search results:", error);
        // Remove the loading icon in case of an error
        searchResultsContainer.removeChild(loaderElement);
        // Display an error message or handle the error as needed
    }
}


        // Node Search

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

        const selectedModel = document.getElementById("embeddingsModelSelect").value;
        const compoundKey = `${node.uuid}-${selectedModel}`;

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