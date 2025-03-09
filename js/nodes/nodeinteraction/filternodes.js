//Node filtering helper functions

async function forget(userMessage, combinedContext) {
    // Trim the combinedContext to remove leading and trailing whitespaces and new lines, then check if it's empty.
    if (!combinedContext.trim()) {
        Logger.debug("Combined context is empty or just newlines. Skipping API call.");
        return new Set(); // Return an empty Set since no titles are to be forgotten.
    }

    const aiCall = AiCall.single() // forget query context
        .addSystemPrompt("Here's the current context and top matched nodes to help you decide which node titles should be forgotten:\n\n" + combinedContext)
        .addUserPrompt(userMessage)
        .addSystemPrompt("Without preface or explanation, based on the provided user message and context, suggest which node titles should be forgotten. Return the exact titles to forget separated by newlines.");

    const response = await aiCall.exec(); // mock calling the AI API
    Logger.info(response);
    // Extract the node titles to forget from the AI's response
    const titlesToForget = new Set(response.split('\n'));
    Logger.info(titlesToForget);
    return titlesToForget;
}

function extractTitlesFromContent(content) {
    const titles = new Set();
    const regex = new RegExp(`^${RegExp.escape(Tag.node)}\\s*(.*)$`, 'gm');
    let match;
    while ((match = regex.exec(content)) !== null) {
        titles.add(match[1].trim());
    }
    return titles;
}

function removeTitlesFromContext(contentStr, titlesToForget) {
    const keptLines = [];
    contentStr.split('\n').forEach( (line)=>{
        const match = line.trim().match(ZettelkastenParser.regexpNodeTitle);
        if (match && match[1] && titlesToForget.has(match[1].trim())) return;

        keptLines.push(line);
    });
    return keptLines.join('\n');
}

function filterAndProcessNodesByExistingTitles(nodes, existingTitles, titlesToForget = new Set(), nodeTag) {
    const arr = [];
    nodes.forEach( (node)=>{
        if (!node) return;

        const titleInput = node.view.titleInput;
        const title = (titleInput?.value ? titleInput.value.trim() : "No title found");
        if (existingTitles.has(title) || titlesToForget.has(title)) return;

        const fullNodeObject = Node.byTitle(title.toLowerCase());
        const contents = Node.getTextareaContent(fullNodeObject);
        arr.push(`${tagValues.nodeTag} ${title}\n ${contents}`);
    });
    return arr;
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
       }).join('\n')
          : '';

      const edgeInfo = node.edges
           .map((edge) => {
               if (edge.nodeA && edge.nodeB) {
                   return `Edge Length: ${edge.length}\nEdge Strength: ${edge.strength}\nConnected Nodes UUIDs: ${edge.nodeA.uuid}, ${edge.nodeB.uuid}`;
               } else {
                   return ''; // Return an empty string or a placeholder message if connectedNode is undefined
               }
          }).join('\n');
const createdAt = node.createdAt;

UUID: ${node.uuid}\n       Creation Time: ${createdAt} */
