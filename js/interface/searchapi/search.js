function setSearchHighlight(match, nomatch, node) {
    const classList = node.content.classList;
    classList[match]("search_matched");
    classList[nomatch]("search_nomatch");
}
const clearSearchHighlight = setSearchHighlight.bind(null, 'remove', 'remove');
const matchSearchHighlight = setSearchHighlight.bind(null, 'add', 'remove');
const nomatchSearchHighlight = setSearchHighlight.bind(null, 'remove', 'add');

function nodesForSearchTerm(searchTerm, maxResults) {
    if (!searchTerm) return Object.values(nodeMap);

    const matched = [];
    const keywords = searchTerm.toLowerCase().split(' ');
    for (const node of Graph.nodes) {
        let numMatches = 0;
        for (const keyword of keywords) {
            if ([...node.searchStrings()].join().toLowerCase().includes(keyword)) {
                numMatches += 1;
            }
        }
        if (numMatches > 0) {
            matched.push({
                node,
                numMatches: numMatches
            });
        } else {
            nomatchSearchHighlight(node);
        }
    }
    // Sort by the number of matches in descending order
    matched.sort((a, b) => b.numMatches - a.numMatches);

    // Apply classes only to the top 'maxResults' (or all if maxResults is null)
    matched.forEach((match, index) => {
        const matched = (!maxResults || index < maxResults);
        (matched ? matchSearchHighlight : nomatchSearchHighlight)(match.node);
    });

    // Return all matched nodes if needed or just the top results
    return (maxResults ? matched.slice(0, maxResults) : matched).map(m => m.node);
}

function performZettelkastenSearch(searchTerm) {
    const res = document.querySelector("#search-results .results-display-div");
    res.innerHTML = '';
    for (const node of nodesForSearchTerm(searchTerm)) {
        const div = document.createElement('div');
        div.classList.add("search-result-item");

        const title = document.createElement('div');
        title.classList.add("search-result-title");
        title.appendChild(document.createTextNode(node.getTitle()));
        div.appendChild(title);

        function onClick(e){
            this.zoom_to();
            autopilotSpeed = settings.autopilotSpeed;
        }
        function onDblclick(e){
            this.zoom_to();
            skipAutopilot();
            autopilotSpeed = settings.autopilotSpeed;
        }
        div.addEventListener('click', onClick.bind(node));
        div.addEventListener('dblclick', onDblclick.bind(node));

        res.appendChild(div);
    }
}

function setupZettelkastenSearchBar() {
    const inp = Elem.byId('Searchbar');
    inp.addEventListener('input',
        (e)=>performZettelkastenSearch(inp.value)
    );
}



Elem.byId('vectorDbSearchButton').addEventListener('click', () => {
    Modal.open('vectorDbSearchModal');
    performVectorDbDisplaySearch();
    // Create a debounced version of performVectorDbDisplaySearch
    const debouncedPerformVectorDbDisplaySearch = debounce(performVectorDbDisplaySearch, 300);


    Elem.byId('vectorDbSearchInput').addEventListener('input', debouncedPerformVectorDbDisplaySearch);

    const topNSlider = Elem.byId('topNSlider');
    const topNValue = Elem.byId('topNValue');

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
    const searchQuery = Elem.byId('vectorDbSearchInput').value;
    const relevantKeys = Keys.getVisible(await Keys.getAll()); // Get filtered keys if any filters are applied

    const searchResultsContainer = Elem.byId('vectorDbSearchDisplay');
    searchResultsContainer.innerHTML = ''; // Clear previous search results

    // Create and display the loading icon
    const loaderElement = document.createElement('div');
    loaderElement.classList.add("loader");
    loaderElement.classList.add("loader-centered");
    searchResultsContainer.appendChild(loaderElement);

    try {
        const relevantChunks = await getRelevantChunks(searchQuery, topN, relevantKeys);

        // Remove the loading icon safely
        if (loaderElement.parentNode === searchResultsContainer) {
            searchResultsContainer.removeChild(loaderElement);
        }

        // Display results...
        relevantChunks.forEach(chunk => {
            const [source, chunkNumber] = chunk.key.split('_chunk_');

            const resultElement = document.createElement('div');
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
    } catch (err) {
        console.error("Error fetching search results:", err);
        // Remove the loading icon in case of an error
        searchResultsContainer.removeChild(loaderElement);
        // Display an error message or handle the error as needed
    }
}


        // Node Search

const MAX_CACHE_SIZE = 300;

const nodeCache = new LRUCache(MAX_CACHE_SIZE);


async function embeddedSearch(searchTerm, maxNodesOverride) {
    const maxNodes = maxNodesOverride ?? Elem.byId('node-count-slider').value;
    const keywords = searchTerm.toLowerCase().split(/,\s*/);

    const nodes = getNodeText();
    if (nodes.length < 1) return [];

    const matched = [];

    const fetchEmbeddings = Embeddings.fetch;
    async function fetchNodeEmbedding(node){
        const compoundKey = node.uuid + '-' + Embeddings.selectModel.value;
        const cachedEmbedding = nodeCache.get(compoundKey);
        if (cachedEmbedding) return cachedEmbedding;

        const titleText = node.titleInput;
        const contentText = node.contentText;
        // console.log("Extracted title text:", titleText);  // DEBUG
        // console.log("Extracted content text:", contentText);  // DEBUG

        const embedding = await fetchEmbeddings(titleText + ' ' + contentText);
        nodeCache.set(compoundKey, embedding);
        return embedding;
    }

    const searchTermEmbeddingPromise = fetchEmbeddings(searchTerm);
    const nodeEmbeddingsPromises = nodes.map(fetchNodeEmbedding);
    const [keywordEmbedding, ...nodeEmbeddings] = await Promise.all([searchTermEmbeddingPromise, ...nodeEmbeddingsPromises]);

    //   console.log("Keyword Embedding:", keywordEmbedding);  // DEBUG
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node.isTextNode) continue;

        // Updated to use new property names
        const titleMatchScore = node.titleInput.toLowerCase().includes(searchTerm.toLowerCase()) ? 1 : 0;

        // Updated to use new property names
        const contentMatchScore = keywords.filter(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            return node.contentText.match(regex);
        }).length;

        const weightedTitleScore = titleMatchScore * 10;
        const weightedContentScore = contentMatchScore;

        const nodeEmbedding = nodeEmbeddings[i];

        const dotProduct = keywordEmbedding.reduce((sum, value, index) => sum + (value * nodeEmbedding[index]), 0);
        Math.magnitude = (arr)=>Math.sqrt(arr.reduce( (sum, value)=>(sum + (value * value)) , 0));
        const keywordMagnitude = Math.magnitude(keywordEmbedding);
        const nodeMagnitude = Math.magnitude(nodeEmbedding);

        //   console.log("Dot Product:", dotProduct);  // DEBUG
        //   console.log("Keyword Magnitude:", keywordMagnitude);  // DEBUG
        //   console.log("Node Magnitude:", nodeMagnitude);  // DEBUG

        const cosineSimilarity = dotProduct / (keywordMagnitude * nodeMagnitude);
        //console.log("Cosine Similarity:", cosineSimilarity);

        const similarityThreshold = -1;
        const keywordMatchPercentage = 0.5;

        if (weightedTitleScore + weightedContentScore > 0 || cosineSimilarity > similarityThreshold) {
            matched.push({
                node,
                title: node.title,
                content: node.content.innerText.trim(),
                weightedTitleScore: weightedTitleScore,
                weightedContentScore: weightedContentScore,
                similarity: cosineSimilarity,
            });
            //console.log("embeddings", node.content.innerText.trim())
        }
    }

    matched.sort((a, b) => (b.weightedTitleScore + b.weightedContentScore + b.similarity) - (a.weightedTitleScore + a.weightedContentScore + a.similarity));
    return matched.slice(0, maxNodes).map(m => m.node);
}
