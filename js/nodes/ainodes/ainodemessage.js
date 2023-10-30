
async function sendLLMNodeMessage(node, message = null) {
    if (node.aiResponding) {
        console.log('AI is currently responding. Please wait for the current response to complete before sending a new message.');
        return;
    }

    const nodeIndex = node.index;

    const maxTokensSlider = document.getElementById(`node-max-tokens-${nodeIndex}`);
    //Initalize count for message trimming
    let contextSize = 0;

    //Use Prompt area if message is not passed.
    node.latestUserMessage = message ? message : node.promptTextArea.value;
    // Clear the prompt textarea
    node.promptTextArea.value = '';
    node.promptTextArea.dispatchEvent(new Event('input'));

    //Initialize messages array.
    let messages = [
        {
            role: "system",
            content: "YOU (Ai) are responding in an Ai node. CONNECTED NODES are SHARED as system messages. Triple backtick and label any codeblocks"
        },
    ];

    // Fetch the content from the custom instructions textarea using the nodeIndex
    const customInstructionsTextarea = document.getElementById(`custom-instructions-textarea-${nodeIndex}`);
    const customInstructions = customInstructionsTextarea ? customInstructionsTextarea.value.trim() : "";

    // Append custom instructions if they exist.
    if (customInstructions.length > 0) {
        messages.push({
            role: "system",
            content: `RETRIEVE INSIGHTS FROM and ADHERE TO the following user-defined CUSTOM INSTRUCTIONS: ${customInstructions}`
        });
    }

    // Checks if all connected nodes should be sent or just nodes up to the first found ai node in each branch. connecteed nodes (default)
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
            content: `The LAST LINE of your response will be EXTRACTED and SENT to any CONNECTED Ai.
Ask INSIGHTFUL, THOUGHT-PROVOKING, and RELEVANT questions that will provide DEPTH to the CONVERSATION.
REMEMBER to FOLLOW CUSTOM INSTRUCTIONS and REFERENCE CONNECTED TEXT NODES.`
        });
    }


    if (document.getElementById(`code-checkbox-${nodeIndex}`).checked) {
        messages.push(aiNodeCodeMessage());
    }

    if (document.getElementById("instructions-checkbox").checked) {
        messages.push(instructionsMessage());
    }

    const truncatedRecentContext = getLastPromptsAndResponses(2, 150, node.id);

    let wikipediaSummaries;
    let keywordsArray = [];
    let keywords = '';

    if (isWikipediaEnabled(nodeIndex)) {

        // Call generateKeywords function to get keywords
        const count = 3; // Change the count value as needed
        keywordsArray = await generateKeywords(node.latestUserMessage, count, truncatedRecentContext);

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

    if (isWikipediaEnabled(nodeIndex)) {
        messages.push(wikipediaMessage);
    }

    // Use the node-specific recent context when calling constructSearchQuery
    const searchQuery = await constructSearchQuery(node.latestUserMessage, truncatedRecentContext, node);
    if (searchQuery === null) {
        return; // Return early if a link node was created directly
    }

    let searchResultsData = null;
    let searchResults = [];

    if (isGoogleSearchEnabled(nodeIndex)) {
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
        content: "Google Search RESULTS displayed to user:" + searchResultsContent
    };

    if (document.getElementById(`google-search-checkbox-${nodeIndex}`).checked) {
        messages.push(googleSearchMessage);
    }

    if (isEmbedEnabled(nodeIndex)) {
        const aiSuggestedSearch = await searchQuery;
        const relevantChunks = await getRelevantChunks(aiSuggestedSearch, searchResults, topN, false);
        const topNChunksContent = groupAndSortChunks(relevantChunks, MAX_CHUNK_SIZE);

        const embedMessage = {
            role: "system",
            content: `Top ${topN} MATCHED chunks of TEXT from extracted WEBPAGES:\n` + topNChunksContent + `\n Use the given chunks as context. CITE your sources!`
        };

        messages.push(embedMessage);
    }

    let allConnectedNodesData = getAllConnectedNodesData(node, true);

    let totalTokenCount = getTokenCount(messages);
    let remainingTokens = Math.max(0, maxTokensSlider.value - totalTokenCount);
    const maxContextSize = document.getElementById(`node-max-context-${nodeIndex}`).value;

    let textNodeInfo = [];
    let llmNodeInfo = [];
    let messageTrimmed = false;

    allConnectedNodesData.sort((a, b) => a.isLLM - b.isLLM);  // Prioritize LLM nodes

    allConnectedNodesData.forEach(info => {
        if (info.data && info.data.replace) { // Make sure info.data exists and has a replace method
            let tempInfoList = info.isLLM ? llmNodeInfo : textNodeInfo;
            let cleanedData = info.data.replace("Text Content:", "");

            // Only proceed if cleanedData contains text
            if (cleanedData.trim()) {
                let tempString = tempInfoList.join("\n\n") + "\n\n" + cleanedData;
                let tempTokenCount = getTokenCount([{ content: tempString }]);

                if (tempTokenCount <= remainingTokens && totalTokenCount + tempTokenCount <= maxContextSize) {
                    tempInfoList.push(cleanedData);
                    remainingTokens -= tempTokenCount;
                    totalTokenCount += tempTokenCount;
                } else {
                    messageTrimmed = true;
                }
            }
        }
    });

    // For Text Nodes
    if (textNodeInfo.length > 0) {
        let intro = "Text nodes CONNECTED to your interface:";
        messages.push({
            role: "system",
            content: intro + "\n\n" + textNodeInfo.join("\n\n")
        });
    }

    // For LLM Nodes
    if (llmNodeInfo.length > 0) {
        let intro = "ALL AI nodes you are CONVERSING with:";
        messages.push({
            role: "system",
            content: intro + "\n\n" + llmNodeInfo.join("\n\n")
        });
    }

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

    // Init value of getLastPromptsAndResponses
    let lastPromptsAndResponses;
    lastPromptsAndResponses = getLastPromptsAndResponses(20, contextSize, node.id);

    // Append the user prompt to the AI response area with a distinguishing mark and end tag
    node.aiResponseTextArea.value += `\n\n${PROMPT_IDENTIFIER} ${node.latestUserMessage}\n`;
    // Trigger the input event programmatically
    node.aiResponseTextArea.dispatchEvent(new Event('input'));

    let wolframData;
    if (document.getElementById(`enable-wolfram-alpha-checkbox-${nodeIndex}`).checked) {
        const wolframContext = getLastPromptsAndResponses(2, 300, node.id);
        wolframData = await fetchWolfram(node.latestUserMessage, true, node, wolframContext);
    }

    if (wolframData) {
        const { wolframAlphaTextResult } = wolframData;
        createWolframNode(wolframData);

        const wolframAlphaMessage = {
            role: "system",
            content: `The Wolfram result has ALREADY been returned based off the current user message. INSTEAD of generating a new query, USE the following Wolfram result as CONTEXT: ${wolframAlphaTextResult}`
        };

        console.log("wolframAlphaTextResult:", wolframAlphaTextResult);
        messages.push(wolframAlphaMessage);

        // Redefine lastPromptsAndResponses after Wolfram's response.
        lastPromptsAndResponses = getLastPromptsAndResponses(10, contextSize, node.id);
    }

    if (lastPromptsAndResponses.trim().length > 0) {
        messages.push({
            role: "system",
            content: `CONVERSATION HISTORY:${lastPromptsAndResponses}`
        });
    }


    //Finally, send the user message last.
    messages.push({
        role: "user",
        content: node.latestUserMessage
    });


    node.aiResponding = true;
    node.userHasScrolled = false;

    let LocalLLMSelect = document.getElementById(node.LocalLLMSelectID); // Use node property to get the correct select element

    // Get the loading and error icons
    let aiLoadingIcon = document.getElementById(`aiLoadingIcon-${nodeIndex}`);
    let aiErrorIcon = document.getElementById(`aiErrorIcon-${nodeIndex}`);

    // Hide the error icon and show the loading icon
    aiErrorIcon.style.display = 'none'; // Hide error icon
    aiLoadingIcon.style.display = 'block'; // Show loading icon


    // Re-evaluate the state of connected AI nodes
    function updateConnectedAiNodeState() {
        let allConnectedNodes = useAllConnectedNodes ? getAllConnectedNodes(node) : getAllConnectedNodes(node, true);
        return allConnectedNodes.some(n => n.isLLMNode);
    }

    const clickQueues = {};  // Contains a click queue for each AI node
    // Initiates helper functions for aiNode Message loop.
    const aiNodeMessageLoop = new AiNodeMessageLoop(node, allConnectedNodes, clickQueues);

    const selectedModel = LocalLLMSelect.value;
    console.log('Selected Model:', selectedModel);

    // Local LLM call
    if (document.getElementById("localLLM").checked && selectedModel !== 'OpenAi') {
        window.generateLocalLLMResponse(node, messages)
            .then(async (fullMessage) => {
                node.aiResponding = false;
                aiLoadingIcon.style.display = 'none';

                hasConnectedAiNode = updateConnectedAiNodeState(); // Update state right before the call

                if (node.shouldContinue && node.shouldAppendQuestion && hasConnectedAiNode && !node.aiResponseHalted) {
                    await aiNodeMessageLoop.questionConnectedAiNodes(fullMessage);
                }
            })
            .catch((error) => {
                console.error(`An error occurred while getting response: ${error}`);
                aiErrorIcon.style.display = 'block';
            });
    } else {
        // AI call
        callchatLLMnode(messages, node, true, selectedModel)
            .finally(async () => {
                node.aiResponding = false;
                aiLoadingIcon.style.display = 'none';

                hasConnectedAiNode = updateConnectedAiNodeState(); // Update state right before the call

                if (node.shouldContinue && node.shouldAppendQuestion && hasConnectedAiNode && !node.aiResponseHalted) {
                    const lastLine = await getLastLineFromTextArea(node.aiResponseTextArea);
                    await aiNodeMessageLoop.questionConnectedAiNodes(lastLine);
                }
            })
            .catch((error) => {
                console.error(`An error occurred while getting response: ${error}`);
                aiErrorIcon.style.display = 'block';
            });
    }
}

class AiNodeMessageLoop {
    constructor(node, allConnectedNodes, clickQueues) {
        this.node = node;
        this.allConnectedNodes = allConnectedNodes;
        this.clickQueues = clickQueues || {}; // If clickQueues is not passed, initialize as an empty object
    }

    async processClickQueue(nodeId) {
        const queue = this.clickQueues[nodeId] || [];
        while (true) {
            if (queue.length > 0) {
                const connectedNode = queue[0].connectedNode;

                // If the node is not connected or the response is halted, 
                // break out of the loop to stop processing this node's queue.
                if (connectedNode.aiResponseHalted) {
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

    async questionConnectedAiNodes(lastLine) {
        for (const connectedNode of this.allConnectedNodes) {
            if (connectedNode.isLLMNode) {
                let uniqueNodeId = connectedNode.index;

                if (connectedNode.aiResponseHalted || this.node.aiResponseHalted) {
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

                if (!this.clickQueues[uniqueNodeId]) {
                    this.clickQueues[uniqueNodeId] = [];
                    this.processClickQueue(uniqueNodeId);  // Start processing this node's click queue
                }

                this.clickQueues[uniqueNodeId].push({ sendButton, connectedNode });
            }
        }
    }
}
