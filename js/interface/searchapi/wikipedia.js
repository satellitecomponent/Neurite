const Wikipedia = {};

Wikipedia.isEnabled = function(nodeIndex = null){
    if (nodeIndex !== null) {
        const aiCheckbox = Elem.byId('wiki-checkbox-' + nodeIndex);
        if (aiCheckbox) return aiCheckbox.checked;
    }

    return Elem.byId('wiki-checkbox')?.checked;
}

function sampleSummaries(summaries, top_n_links) {
    const sampledSummaries = [];
    for (let i = 0; i < top_n_links; i++) {
        if (summaries.length < 1) continue;

        const randomIndex = Math.floor(Math.random() * summaries.length);
        sampledSummaries.push(summaries.splice(randomIndex, 1)[0]);
    }
    return sampledSummaries;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function isNoveltyEnabled() {
    return Elem.byId('novelty-checkbox').checked
}

async function calculateRelevanceScores(summaries, searchTermEmbedding) {
    // Use the existing searchTermEmbedding for cosine similarity calculations
    const titleEmbeddings = await Promise.all(summaries.map(summary => Embeddings.fetch(summary.title)));

    for (let i = 0; i < summaries.length; i++) {
        const similarity = cosineSimilarity(searchTermEmbedding, titleEmbeddings[i]);
        summaries[i].relevanceScore = similarity;
    }

    return summaries;
}

Wikipedia.ctGetSummary = class {
    constructor(keyword, top_n_links){
        const encodedKeyword = encodeURIComponent(keyword);
        this.url = `${Proxy.baseUrl}/wikisearch/wikipedia_summaries?keyword=${encodedKeyword}&top_n_links=${top_n_links}`;
        this.keyword = keyword;
    }
    onResponse(res){ return res.json().then(this.onData) }
    onData = (data)=>Embeddings.fetch(this.keyword)
                     .then(calculateRelevanceScores.bind(null, data))
    onFailure(){
        alert("Failed to fetch Wikipedia summaries. Please ensure your Wikipedia server is running. Localhosts can be found at the Github link in the ? tab.");
        return "Failed to fetch Wikipedia summaries:";
    }
}
Wikipedia.getSummary = async function(top_n_links, keyword){
    const ct = new Wikipedia.ctGetSummary(keyword, top_n_links);
    return (await Request.send(ct)) || [];
}
Wikipedia.getSummaries = async function(keywords, top_n_links = 3){
    const allSummariesPromises = keywords.map(Wikipedia.getSummary.bind(null, top_n_links));
    const allSummaries = await Promise.all(allSummariesPromises);
    const summaries = [].concat(...allSummaries); // Flatten the array of summaries
    // Sort the summaries by relevance score in descending order
    summaries.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const combinedSummaries = [summaries[0]]; // Include the top matched summary
    // Check if the novelty checkbox is checked
    if (isNoveltyEnabled()) {
        // randomly pick two of the remaining summaries
        const remainingSummaries = summaries.slice(1);
        shuffleArray(remainingSummaries);
        combinedSummaries.push(...sampleSummaries(remainingSummaries, 2));
    } else {
        combinedSummaries.push(...summaries.slice(1, top_n_links));
    }
    combinedSummaries.forEach(Wikipedia.displayResult);

    return (!Array.isArray(combinedSummaries)) ? "Wiki Disabled"
         : combinedSummaries
            .filter( (s)=>(s?.title !== undefined && s?.summary !== undefined) )
            .map( (s)=>(s.title + " (Relevance Score: " + s.relevanceScore.toFixed(2) + "): " + s.summary) )
            .join("\n\n");
}

Wikipedia.displayResult = function(result){
    const title = result.title;
    const description = String.dotTruncToLength(result.summary.trim(), 200);
    const link = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replace(' ', '_'));
    setupNodeForPlacement(new LinkNode(link, title, description));
}

String.dotTruncToLength = function(str, maxLength){
    return (str.length <= maxLength) ? str
         : str.slice(0, maxLength - 3) + "..."
}
