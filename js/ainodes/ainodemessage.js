async function sendLLMNodeMessage(node, message = null) {
    if (node.aiResponding) {
        console.log('AI is currently responding. Please wait for the current response to complete before sending a new message.');
        return;
    }

    const maxTokensSlider = document.getElementById('max-tokens-slider');
    let contextSize = 0;

    node.latestUserMessage = message ? message : node.promptTextArea.value;
    // Clear the prompt textarea
    node.promptTextArea.value = '';
    node.promptTextArea.dispatchEvent(new Event('input'));

    let messages = [
        {
            role: "system",
            content: "You (Ai) are responding in an Ai node. All connected nodes are shared in the 'remember this' system message. Triple backtick and label any codeblocks"
        },
    ];


    // Check if all conneceted nodes should be sent or just nodes up to the first ai node in each branch. connecteed nodes (default)
    const useAllConnectedNodes = document.getElementById('use-all-connected-ai-nodes').checked;

    // Choose the function based on checkbox state
    let allConnectedNodes = useAllConnectedNodes ? getAllConnectedNodes(node) : getAllConnectedNodes(node, true);

    // Determine if there are any connected AI nodes
    let hasConnectedAiNode = allConnectedNodes.some(n => n.isLLMNode);

    if (hasConnectedAiNode) {
        node.shouldAppendQuestion = true;
    } else {
        node.shouldAppendQuestion = false;
    }

    if (node.shouldAppendQuestion) {
        messages.push({
            role: "system",
            content: `Format: The last line of your response will be extracted and sent to any connected Ai.
Ask insightful, thought-provoking, and relevant questions that will deepen the conversation.
Remember to follow any received instructions from all connected nodes.`
        });
    }

    const clickQueues = {};  // Contains a click queue for each AI node

    async function processClickQueue(nodeId) {
        const queue = clickQueues[nodeId] || [];
        while (true) {
            if (queue.length > 0) {
                const connectedNode = queue[0].connectedNode;

                // If the node is not connected or the response is halted, 
                // break out of the loop to stop processing this node's queue.
                if (!updateConnectedAiNodeState() || connectedNode.aiResponseHalted) {
                    break;
                }

                // Check if AI is not responding to attempt the click again
                if (!connectedNode.aiResponding) {
                    const { sendButton } = queue.shift();
                    sendButton.click();
                }
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    async function questionConnectedAiNodes(lastLine) {
        for (const connectedNode of allConnectedNodes) {
            if (connectedNode.isLLMNode) {
                let uniqueNodeId = connectedNode.index;

                // Check if the AI response is halted for the node or the connectedNode
                if (connectedNode.aiResponseHalted || node.aiResponseHalted) {
                    console.warn(`AI response for node ${uniqueNodeId} or its connected node is halted. Skipping this node.`);
                    continue;
                }

                let promptElement = document.getElementById(`nodeprompt-${uniqueNodeId}`);
                let sendButton = document.getElementById(`prompt-form-${uniqueNodeId}`);

                if (!promptElement || !sendButton) {
                    console.error(`Elements for ${uniqueNodeId} are not found`);
                    continue;
                }

                if (promptElement instanceof HTMLTextAreaElement) {
                    promptElement.value += `\n${lastLine}`;
                } else if (promptElement instanceof HTMLDivElement) {
                    promptElement.innerHTML += `<br>${lastLine}`;
                } else {
                    console.error(`Element with ID prompt-${uniqueNodeId} is neither a textarea nor a div`);
                }

                promptElement.dispatchEvent(new Event('input', { 'bubbles': true, 'cancelable': true }));

                // Initialize the click queue for this node if it doesn't exist
                if (!clickQueues[uniqueNodeId]) {
                    clickQueues[uniqueNodeId] = [];
                    processClickQueue(uniqueNodeId);  // Start processing this node's click queue
                }

                // Add to the node's specific click queue
                clickQueues[uniqueNodeId].push({ sendButton, connectedNode });
            }
        }
    }

    if (document.getElementById("code-checkbox").checked) {
        messages.push(aiNodeCodeMessage());
    }

    if (document.getElementById("instructions-checkbox").checked) {
        messages.push(instructionsMessage());
    }


    const nodeSpecificRecentContext = getLastPromptsAndResponses(2, 150, node.id);

    let wikipediaSummaries;
    let keywordsArray = [];
    let keywords = '';

    if (isWikipediaEnabled()) {

        // Call generateKeywords function to get keywords
        const count = 3; // Change the count value as needed
        keywordsArray = await generateKeywords(node.latestUserMessage, count, nodeSpecificRecentContext);

        // Join the keywords array into a single string
        keywords = keywordsArray.join(' ');



        const keywordString = keywords.replace("Keywords: ", "");
        const splitKeywords = keywordString.split(',').map(k => k.trim());
        const firstKeyword = splitKeywords[0];
        // Convert the keywords string into an array by splitting on spaces

        wikipediaSummaries = await getWikipediaSummaries([firstKeyword]);
        console.log("wikipediasummaries", wikipediaSummaries);
    } else {
        wikipediaSummaries = "Wiki Disabled";
    }

    
    //console.log("Keywords array:", keywords);

    const wikipediaMessage = {
        role: "system",
        content: `Wikipedia Summaries (Keywords: ${keywords}): \n ${Array.isArray(wikipediaSummaries)
            ? wikipediaSummaries
                .filter(s => s !== undefined && s.title !== undefined && s.summary !== undefined)
                .map(s => s.title + " (Relevance Score: " + s.relevanceScore.toFixed(2) + "): " + s.summary)
                .join("\n\n")
            : "Wiki Disabled"
            } END OF SUMMARIES`
    };

    if (document.getElementById("wiki-checkbox").checked) {
        messages.push(wikipediaMessage);
    }

    // Use the node-specific recent context when calling constructSearchQuery
    const searchQuery = await constructSearchQuery(node.latestUserMessage, nodeSpecificRecentContext);
    if (searchQuery === null) {
        return; // Return early if a link node was created directly
    }

    let searchResultsData = null;
    let searchResults = [];

    if (isGoogleSearchEnabled()) {
        searchResultsData = await performSearch(searchQuery);
    }

    if (searchResultsData) {
        searchResults = processSearchResults(searchResultsData);
        searchResults = await getRelevantSearchResults(node.latestUserMessage, searchResults);
    }

    displaySearchResults(searchResults);



    const searchResultsContent = searchResults.map((result, index) => {
        return `Search Result ${index + 1}: ${result.title} - ${result.description.substring(0, 100)}...\n[Link: ${result.link}]\n`;
    }).join('\n');

    const googleSearchMessage = {
        role: "system",
        content: "Google Search Results displayed to user:" + searchResultsContent
    };

    if (document.getElementById("google-search-checkbox").checked) {
        messages.push(googleSearchMessage);
    }

    const embedCheckbox = document.getElementById("embed-checkbox");

    if (embedCheckbox && embedCheckbox.checked) {
        const aiSuggestedSearch = await constructSearchQuery(node.latestUserMessage);
        const relevantChunks = await getRelevantChunks(aiSuggestedSearch, searchResults, topN, false);

        // Group the chunks by their source (stripping the chunk number from the key)
        const groupedChunks = relevantChunks.reduce((acc, chunk) => {
            // Separate the source and the chunk number
            const [source, chunkNumber] = chunk.source.split('_chunk_');
            if (!acc[source]) acc[source] = [];
            acc[source].push({
                text: chunk.text.substring(0, MAX_CHUNK_SIZE),
                number: parseInt(chunkNumber), // Parse chunkNumber to an integer
                relevanceScore: chunk.relevanceScore,
            });
            return acc;
        }, {});

        // Construct the topNChunksContent
        const topNChunksContent = Object.entries(groupedChunks).map(([source, chunks]) => {
            // Sort the chunks by their chunk number for each source
            chunks.sort((a, b) => a.number - b.number);
            const chunksContent = chunks.map(chunk => `Chunk ${chunk.number} (Relevance: ${chunk.relevanceScore.toFixed(2)}): ${chunk.text}...`).join('\n');
            return `[Source: ${source}]\n${chunksContent}\n`;
        }).join('\n');

        const embedMessage = {
            role: "system",
            content: `Top ${topN} matched chunks of text from extracted webpages:\n` + topNChunksContent + `\n Use the given chunks as context. Cite your sources!`
        };

        messages.push(embedMessage);
    }

    let allConnectedNodesData = getAllConnectedNodesData(node, true);

    // Sort the array to prioritize trimming LLM nodes first
    allConnectedNodesData.sort((a, b) => a.isLLM - b.isLLM);

    let totalTokenCount = getTokenCount(messages);
    let remainingTokens = Math.max(0, maxTokensSlider.value - totalTokenCount);
    const maxContextSize = document.getElementById('max-context-size-slider').value;

    let messageTrimmed = false;

    // Build the infoString step-by-step, checking tokens as we go
    let infoList = allConnectedNodesData.map(info => info.data.replace("Text Content:", ""));
    let infoString = "";
    let infoIntro = "The following are all nodes that have been manually connected to your chat interface.\n";

    for (let i = 0; i < infoList.length; i++) {
        let tempString = infoString + "\n\n" + infoList[i];
        let tempIntroString = infoIntro + tempString;
        let tempTokenCount = getTokenCount([{ content: tempIntroString }]);

        if (tempTokenCount <= remainingTokens && totalTokenCount + tempTokenCount <= maxContextSize) {
            infoString = tempString;
            remainingTokens -= tempTokenCount;
            totalTokenCount += tempTokenCount;
        } else {
            messageTrimmed = true;
            break;  // Stop adding more info since we've reached the limit
        }
    }

    let finalInfoString = infoIntro + infoString;
    messages.push({
        role: "system",
        content: finalInfoString
    });

    if (messageTrimmed) {
        messages.push({
            role: "system",
            content: "Previous messages trimmed."
        });
    }

    totalTokenCount = getTokenCount(messages);
    remainingTokens = Math.max(0, maxTokensSlider.value - totalTokenCount);

    // calculate contextSize again
    contextSize = Math.min(remainingTokens, maxContextSize);

    // Update the value of getLastPromptsAndResponses
    let lastPromptsAndResponses;
    if (!document.getElementById("enable-wolfram-alpha").checked) {
        lastPromptsAndResponses = getLastPromptsAndResponses(10, contextSize, node.id);
    }

    // Append the user prompt to the AI response area with a distinguishing mark and end tag
    node.aiResponseTextArea.value += `\n\n${PROMPT_IDENTIFIER} ${node.latestUserMessage}\n`;
    // Trigger the input event programmatically
    node.aiResponseTextArea.dispatchEvent(new Event('input'));

    let wolframData;
    if (document.getElementById("enable-wolfram-alpha").checked) {
        const wolframContext = getLastPromptsAndResponses(2, 300, node.id);
        wolframData = await fetchWolfram(node.latestUserMessage, true, node, wolframContext);
    }

    if (wolframData) {
        const { table, wolframAlphaTextResult, reformulatedQuery } = wolframData;

        let content = [table];
        let scale = 1;

        let wolframNode = windowify(`${reformulatedQuery} - Wolfram Alpha Result`, content, toZ(mousePos), (zoom.mag2() ** settings.zoomContentExp), scale);
        htmlnodes_parent.appendChild(wolframNode.content);
        registernode(wolframNode);
        wolframNode.followingMouse = 1;
        wolframNode.draw();
        wolframNode.mouseAnchor = toDZ(new vec2(0, -wolframNode.content.offsetHeight / 2 + 6));

        const wolframAlphaMessage = {
            role: "system",
            content: `The Wolfram result has already been returned based off the current user message. Instead of generating a new query, use the following Wolfram result as context: ${wolframAlphaTextResult}`
        };

        console.log("wolframAlphaTextResult:", wolframAlphaTextResult);
        messages.push(wolframAlphaMessage);

        // Redefine lastPromptsAndResponses here
        lastPromptsAndResponses = getLastPromptsAndResponses(10, contextSize, node.id);
    }

    messages.push({
        role: "system",
        content: `Conversation history:${lastPromptsAndResponses}`
    });

    messages.push({
        role: "user",
        content: node.latestUserMessage
    });


    node.aiResponding = true;
    node.userHasScrolled = false;

    let LocalLLMSelect = document.getElementById(node.LocalLLMSelectID); // Use node property to get the correct select element

    // Get the loading and error icons
    let aiLoadingIcon = document.getElementById(`aiLoadingIcon-${node.index}`);
    let aiErrorIcon = document.getElementById(`aiErrorIcon-${node.index}`);

    // Hide the error icon and show the loading icon
    aiErrorIcon.style.display = 'none'; // Hide error icon
    aiLoadingIcon.style.display = 'block'; // Show loading icon


    // Re-evaluate the state of connected AI nodes
    function updateConnectedAiNodeState() {
        let allConnectedNodes = useAllConnectedNodes ? getAllConnectedNodes(node) : getAllConnectedNodes(node, true);
        return allConnectedNodes.some(n => n.isLLMNode);
    }

    // Local LLM call
    if (document.getElementById("localLLM").checked && LocalLLMSelect.value !== 'OpenAi') {
        window.generateLocalLLMResponse(node, messages)
            .then(async (fullMessage) => {
                node.aiResponding = false;
                aiLoadingIcon.style.display = 'none';

                hasConnectedAiNode = updateConnectedAiNodeState(); // Update state right before the call

                if (node.shouldContinue && node.shouldAppendQuestion && hasConnectedAiNode && !node.aiResponseHalted) {
                    await questionConnectedAiNodes(fullMessage);
                }
            })
            .catch((error) => {
                console.error(`An error occurred while getting response: ${error}`);
                aiErrorIcon.style.display = 'block';
            });
    } else {
        // AI call
        callchatLLMnode(messages, node, true)
            .finally(async () => {
                node.aiResponding = false;
                aiLoadingIcon.style.display = 'none';

                hasConnectedAiNode = updateConnectedAiNodeState(); // Update state right before the call

                if (node.shouldContinue && node.shouldAppendQuestion && hasConnectedAiNode && !node.aiResponseHalted) {
                    const lastLine = await getLastLineFromTextArea(node.aiResponseTextArea);
                    await questionConnectedAiNodes(lastLine);
                }
            })
            .catch((error) => {
                console.error(`An error occurred while getting response: ${error}`);
                aiErrorIcon.style.display = 'block';
            });
    }
}