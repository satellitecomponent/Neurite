

// Function to check if Wikipedia is enabled
function isWikipediaEnabled(nodeIndex = null) {
    const globalCheckbox = document.getElementById("wiki-checkbox");

    // Check for AI node-specific checkboxes only if nodeIndex is provided
    if (nodeIndex !== null) {
        const aiCheckbox = document.getElementById(`wiki-checkbox-${nodeIndex}`);
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

function sampleSummaries(summaries, top_n_links) {
    const sampledSummaries = [];
    for (let i = 0; i < top_n_links; i++) {
        if (summaries.length > 0) {
            const randomIndex = Math.floor(Math.random() * summaries.length);
            const randomSummary = summaries.splice(randomIndex, 1)[0];
            sampledSummaries.push(randomSummary);
        }
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
    const checkbox = document.getElementById("novelty-checkbox");
    return checkbox.checked;
}


async function getWikipediaSummaries(keywords, top_n_links = 3) {
    const allSummariesPromises = keywords.map(async (keyword) => {
        try {
            const response = await fetch(
                `http://localhost:5000/wikipedia_summaries?keyword=${encodeURIComponent(keyword)}&top_n_links=${top_n_links}`
            );
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const keywordSummaries = await calculateRelevanceScores(data, await fetchEmbeddings(keyword));
            return keywordSummaries;
        } catch (error) {
            console.error('Error fetching Wikipedia summaries:', error);
            alert('Failed to fetch Wikipedia summaries. Please ensure your Wikipedia server is running on localhost:5000. Localhosts can be found at the Github link in the ? tab.');
            return [];
        }
    });
    const allSummaries = await Promise.all(allSummariesPromises);
    const summaries = [].concat(...allSummaries); // Flatten the array of summaries
    // Sort the summaries by relevance score in descending order
    summaries.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const combinedSummaries = [];
    // Include the top matched summary
    combinedSummaries.push(summaries[0]);
    // Check if the novelty checkbox is checked
    if (isNoveltyEnabled()) {
        // If checked, randomly pick two summaries from the remaining summaries
        const remainingSummaries = summaries.slice(1);
        shuffleArray(remainingSummaries);
        combinedSummaries.push(...sampleSummaries(remainingSummaries, 2));
    } else {
        // If not checked, push the top n summaries
        combinedSummaries.push(...summaries.slice(1, top_n_links));
    }
    // Display the final selected Wikipedia results
    displayWikipediaResults(combinedSummaries);
    return combinedSummaries;
}

function displayWikipediaResults(wikipediaSummaries) {
    wikipediaSummaries.forEach((result, index) => {
        let title = `${result.title}`;

        // Trimming whitespace and truncating the description
        let description = truncateDescription(result.summary.trim(), 200); // Limiting to 300 characters for example

        // Create the Wikipedia URL from the title
        let link = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(' ', '_'))}`;

        let node = createLinkNode(title, description, link);
        htmlnodes_parent.appendChild(node.content);
        node.followingMouse = 1;
        node.draw();
        node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
    });
}

// Utility function to truncate descriptions
function truncateDescription(description, maxLength) {
    if (description.length <= maxLength) return description;

    // Return the substring of the given description up to maxLength and append '...'
    return description.substring(0, maxLength) + "...";
}