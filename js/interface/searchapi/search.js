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

let inp = document.getElementById("Searchbar");
inp.addEventListener("input", function () {
    let res = document.getElementById("search-results");
    if (inp.value) {
        res.style.display = "block";
        let ns = searchNodesBy(inp.value);
        let resdiv = res.children[0];
        resdiv.innerHTML = "";
        for (let n of ns) {
            let c = document.createElement("a");

            // Use the getTitle method to get the title of the node
            c.appendChild(document.createTextNode(n.getTitle()));

            c.addEventListener("click", (function (event) {
                this.zoom_to();
                autopilotSpeed = settings.autopilotSpeed;
            }).bind(n));
            c.addEventListener("dblclick", (function (event) {
                this.zoom_to();
                skipAutopilot();
                autopilotSpeed = settings.autopilotSpeed;
            }).bind(n));
            resdiv.appendChild(c);
        }
    } else {
        res.style.display = "none";
        clearSearch();
    }
});