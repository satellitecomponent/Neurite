
//Node filtering helper functions

async function forget(userMessage, combinedContext) {
    // Trim the combinedContext to remove leading and trailing whitespaces and new lines, then check if it's empty.
    if (!combinedContext.trim()) {
        //console.log("Combined context is empty or just newlines. Skipping API call.");
        return new Set(); // Return an empty Set since no titles are to be forgotten.
    }

    const forgetQueryContext = [
        {
            role: "system",
            content: `Here's the current context and top matched nodes to help you decide which node titles should be forgotten:\n\n${combinedContext}`
        },
        {
            role: "user",
            content: userMessage
        },
        {
            role: "system",
            content: "Without preface or explanation, based on the provided user message and context, suggest which node titles should be forgotten. Return the exact titles to forget separated by newlines."
        },
    ];

    // Now we'll mock calling the AI API just like you did with the 'callchatAPI' function.
    const response = await callchatAPI(forgetQueryContext);
    console.log(response)
    // Extract the node titles to forget from the AI's response
    const titlesToForget = new Set(response.split("\n"));
    console.log(titlesToForget)
    return titlesToForget;
}

function extractTitlesFromContent(content, nodeTag) {
    let titles = new Set();
    const titleRegex = new RegExp(nodeTag + " (.*?)\\r?\\n", "g"); // Match until the newline character
    let match;
    while ((match = titleRegex.exec(content)) !== null) {
        titles.add(match[1].trim());
    }
    return titles;
}

function removeTitlesFromContext(contentStr, titlesToForget, nodeTag) {
    const regex = new RegExp(`(${nodeTag} )(.*?)\\r?\\n`, 'gs'); // Separate the tag and the title
    let match;
    let newContent = "";
    while ((match = regex.exec(contentStr)) !== null) {
        const title = match[2].trim(); // Get the title only, excluding the tag
        if (!titlesToForget.has(title)) {
            newContent += match[0];
        }
    }
    return newContent;
}

function filterAndProcessNodesByExistingTitles(nodes, existingTitles, titlesToForget, nodeTag) {
    return nodes
        .map((node) => {
            if (!node) {
                return null;
            }

            const titleElement = node.content.querySelector("input.title-input");
            const title = titleElement && titleElement.value !== "" ? titleElement.value.trim() : "No title found";

            // If title already present in context, don't include the node
            if (existingTitles.has(title) || titlesToForget.has(title)) {
                return null;
            }

            fullNodeObject = getNodeByTitle(title.toLowerCase());

            const contents = getTextareaContentForNode(fullNodeObject);
            //console.log(contents);
            /* 
                 const connectedNodesInfo = node.edges
                ? node.edges.map((edge) => {
                     if (edge.nodeA && edge.nodeB) {
                          const connectedNode = edge.nodeA.uuid === node.uuid ? edge.nodeB : edge.nodeA;
                          return `Connected Node Title: ${connectedNode.uuid}\nConnected Node UUID: ${connectedNode.uuid ?? "N/A"
                              }\nConnected Node Position: (${connectedNode.pos.x}, ${connectedNode.pos.y})`;
                      } else {
                          return ''; // Return an empty string or a placeholder message if connectedNode is undefined
                       }
                   }).join("\n")
                      : '';
            
                  const edgeInfo = node.edges
                       .map((edge) => {
                           if (edge.nodeA && edge.nodeB) {
                               return `Edge Length: ${edge.length}\nEdge Strength: ${edge.strength}\nConnected Nodes UUIDs: ${edge.nodeA.uuid}, ${edge.nodeB.uuid}`;
                           } else {
                               return ''; // Return an empty string or a placeholder message if connectedNode is undefined
                           }
                      }).join("\n"); 
            const createdAt = node.createdAt;

            UUID: ${node.uuid}\n       Creation Time: ${createdAt} */

            return `${tagValues.nodeTag} ${title}\n ${contents}`;
        })
        .filter(content => content !== null); // Remove nulls
}
