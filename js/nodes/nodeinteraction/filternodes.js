
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

function extractTitlesFromContent(content) {
    let titles = new Set();
    let regex = new RegExp(`^${RegExp.escape(nodeTag)}\\s*(.*)$`, 'gm');
    let match;
    while ((match = regex.exec(content)) !== null) {
        titles.add(match[1].trim());
    }
    return titles;
}

function removeTitlesFromContext(contentStr, titlesToForget) {
    let newContent = "";
    const lines = contentStr.split("\n"); // Split content into lines
    lines.forEach(line => {
        const trimLine = line.trim();
        const match = trimLine.match(nodeTitleRegexGlobal);
        if (match && match[1]) {
            const title = match[1].trim(); // Extract the title from the match
            if (!titlesToForget.has(title)) {
                newContent += line + "\n";  // Preserve this line if the title is not in the forget list
            }
        } else {
            newContent += line + "\n";  // Include lines that do not match the node tag
        }
    });
    return newContent.trim(); // Trim the trailing newline from the last line addition
}

function filterAndProcessNodesByExistingTitles(nodes, existingTitles, titlesToForget, nodeTag) {
    return nodes
        .map((node) => {
            if (!node) {
                return null;
            }

            const titleElement = node.titleInput;
            const title = titleElement && titleElement.value !== "" ? titleElement.value.trim() : "No title found";

            // If title already present in context, don't include the node
            if (existingTitles.has(title) || titlesToForget.has(title)) {
                return null;
            }

            fullNodeObject = getNodeByTitle(title.toLowerCase());

            const contents = getTextareaContentForNode(fullNodeObject);


            return `${tagValues.nodeTag} ${title}\n ${contents}`;
        })
        .filter(content => content !== null); // Remove nulls
}


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