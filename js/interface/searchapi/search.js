function setSearchHighlight(match, nomatch, node) {
    const classList = node.content.classList;
    classList[match]("search_matched");
    classList[nomatch]("search_nomatch");
}

const clearSearchHighlight = setSearchHighlight.bind(null, 'remove', 'remove');
const matchSearchHighlight = setSearchHighlight.bind(null, 'add', 'remove');
const nomatchSearchHighlight = setSearchHighlight.bind(null, 'remove', 'add');

function nodesForSearchTerm(searchTerm, maxResults) {
    const keywords = searchTerm.toLowerCase().split(' ').filter(k => k);
    const matched = [];

    Graph.forEachNode((node) => {
        clearSearchHighlight(node);

        if (keywords.length === 0) {
            matched.push({ node, numMatches: 0 });
            return;
        }

        const searchable = [...node.searchStrings()].join().toLowerCase();
        let numMatches = 0;
        for (const keyword of keywords) {
            if (searchable.includes(keyword)) {
                numMatches += 1;
            }
        }

        if (numMatches > 0) {
            matched.push({ node, numMatches });
        }
    });

    matched.sort((a, b) => b.numMatches - a.numMatches);

    matched.forEach((match, index) => {
        const isTopResult = !maxResults || index < maxResults;
        (isTopResult ? matchSearchHighlight : nomatchSearchHighlight)(match.node);
    });

    return (maxResults ? matched.slice(0, maxResults) : matched).map(m => m.node);
}

function performZettelkastenSearch(searchTerm) {
    const res = document.querySelector("#search-results .results-display-div");
    res.innerHTML = '';

    const nodes = nodesForSearchTerm(searchTerm);

    for (const node of nodes) {
        const div = Html.make.div('search-result-item');
        const title = Html.make.div('search-result-title');
        title.appendChild(document.createTextNode(node.getTitle()));
        div.appendChild(title);

        On.click(div, () => {
            console.log(`[Search] Clicked result: ${node.getTitle()}`);
            Autopilot.zoomToFrame(node).start();
        });

        On.dblclick(div, () => {
            Autopilot.zoomToFrame(node).skip().start();
        });

        res.appendChild(div);
    }
}

function setupZettelkastenSearchBar() {
    const inp = Elem.byId('Searchbar');
    On.input(inp, () => {
        performZettelkastenSearch(inp.value);
    });
}


On.click(Elem.byId('vectorDbSearchButton'), (e)=>{
    Modal.open('vectorDbSearchModal');
    performVectorDbDisplaySearch();
    // Create a debounced version of performVectorDbDisplaySearch
    const debouncedPerformVectorDbDisplaySearch = debounce(performVectorDbDisplaySearch, 300);

    On.input(Elem.byId('vectorDbSearchInput'), debouncedPerformVectorDbDisplaySearch);

    const topNSlider = Elem.byId('topNSlider');
    const topNValue = Elem.byId('topNValue');

    // Display the initial slider value
    topNValue.textContent = topNSlider.value;

    // Update display value on slider input
    On.input(topNSlider, (e)=>{
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
    const loaderElement = Html.make.div('loader loader-centered');
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

            const resultElement = Html.make.div('vdb-search-result');
            resultElement.innerHTML = `
                <div class="vdb-result-header">
                    <div class="vdb-result-source">${source}</div>
                    <div class="vdb-result-score">Relevance: <br />${chunk.relevanceScore.toFixed(3)}</div>
                </div>
                <div class="vdb-result-text custom-scrollbar">${chunk.text}</div>
            `;
            searchResultsContainer.appendChild(resultElement);
        });
    } catch (err) {
        Logger.err("In fetching search results:", err);
        searchResultsContainer.removeChild(loaderElement);
    }
}


        // Node Search

const MAX_CACHE_SIZE = 300;

const nodeCache = new LRUCache(MAX_CACHE_SIZE);



Embeddings.search = async function(searchTerm, maxNodesOverride){
    const searchTermLowered = searchTerm.toLowerCase();
    const maxNodes = maxNodesOverride ?? Elem.byId('node-count-slider').value;
    const keywords = searchTermLowered.split(/,\s*/);

    const nodes = Object.values(Graph.nodes);
    if (nodes.length < 1) return [];

    const matched = [];

    async function fetchNodeEmbedding(node){
        const compoundKey = node.uuid + '-' + Embeddings.selectModel.value;
        const cachedEmbedding = nodeCache.get(compoundKey);
        if (cachedEmbedding) return cachedEmbedding;

        const titleText = node.getTitle() || '';
        const contentText = node.getText() || '';
        Logger.debug("Extracted title text:", titleText);
        Logger.debug("Extracted content text:", contentText);

        const embedding = await Embeddings.fetch(titleText + ' ' + contentText);
        nodeCache.set(compoundKey, embedding);
        return embedding;
    }

    const promSearchTermEmbedding = Embeddings.fetch(searchTerm);
    const promsNodeEmbeddings = nodes.map(fetchNodeEmbedding);
    const [keywordEmbedding, ...nodeEmbeddings] = await Promise.all([promSearchTermEmbedding, ...promsNodeEmbeddings]);

    Logger.debug("Keyword Embedding:", keywordEmbedding);
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node.isTextNode) continue;

        // Updated to use new property names
        const titleLowered = node.view.titleInput.value.toLowerCase();
        const titleMatchScore = titleLowered.includes(searchTermLowered) ? 1 : 0;

        // Updated to use new property names
        const contentMatchScore = keywords.filter(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            return node.getText().match(regex);
        }).length;

        const weightedTitleScore = titleMatchScore * 10;
        const weightedContentScore = contentMatchScore;

        const nodeEmbedding = nodeEmbeddings[i];

        const dotProduct = keywordEmbedding.reduce((sum, value, index) => sum + (value * nodeEmbedding[index]), 0);
        Math.magnitude = (arr)=>Math.sqrt(arr.reduce( (sum, value)=>(sum + (value * value)) , 0));
        const keywordMagnitude = Math.magnitude(keywordEmbedding);
        const nodeMagnitude = Math.magnitude(nodeEmbedding);

        Logger.debug("Dot Product:", dotProduct);
        Logger.debug("Keyword Magnitude:", keywordMagnitude);
        Logger.debug("Node Magnitude:", nodeMagnitude);

        const cosineSimilarity = dotProduct / (keywordMagnitude * nodeMagnitude);
        Logger.debug("Cosine Similarity:", cosineSimilarity);

        const similarityThreshold = -1;
        const keywordMatchPercentage = 0.5;

        if (weightedTitleScore + weightedContentScore > 0 || cosineSimilarity > similarityThreshold) {
            matched.push({
                node,
                title: node.title,
                content: node.content.innerText.trim(),
                weightedTitleScore,
                weightedContentScore,
                similarity: cosineSimilarity,
                scoreSum: weightedTitleScore + weightedContentScore + cosineSimilarity
            });
            Logger.debug("embeddings", node.content.innerText.trim());
        }
    }

    matched.sort( (a, b)=>(b.scoreSum - a.scoreSum) );
    return matched.slice(0, maxNodes).map(m => m.node);
}
