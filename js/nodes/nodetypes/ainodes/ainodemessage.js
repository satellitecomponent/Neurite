
async function sendLLMNodeMessage(node, message = null) {
    if (node.aiResponding) {
        console.log('AI is currently responding. Wait for the current response to complete before sending a new message.');
        return;
    }

    const nodeIndex = node.index;

    const maxTokensSlider = node.content.querySelector('#node-max-tokens-' + node.index);
    //Initalize count for message trimming
    let contextSize = 0;

    // Checks if all connected nodes should be sent or just nodes up to the first found ai node in each branch. connected nodes (default)
    const useAllConnectedNodes = document.getElementById('use-all-connected-ai-nodes').checked;

    // Choose the function based on checkbox state
    let allConnectedNodes = useAllConnectedNodes ? getAllConnectedNodes(node) : getAllConnectedNodes(node, true);


    //Use Prompt area if message is not passed.
    node.latestUserMessage = message ? message : node.promptTextArea.value;

    // Clear the prompt textarea
    node.promptTextArea.value = '';
    node.promptTextArea.dispatchEvent(new Event('input'));

    //Initialize messages array.
    let nodeTitle = node.getTitle();
    let aiIdentity = nodeTitle ? `${nodeTitle}` : "an Ai Assistant";


    let messages = [
        {
            role: "system",
            content: `YOU are ${aiIdentity}. Attend to relevant context. Your response renders via markdown.`
        },
    ];

    const selectedModel = determineAiNodeModel(node);
    let inferenceOverride = selectedModel;

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

    // Determine if there are any connected AI nodes
    let connectedAiNodes = calculateAiNodeDirectionalityLogic(node);
    let hasConnectedAiNode = connectedAiNodes.length > 0;

    if (hasConnectedAiNode) {
        node.shouldAppendQuestion = true;
    } else {
        node.shouldAppendQuestion = false;
    }

    if (node.shouldAppendQuestion) {
        messages.push({
            role: "system",
            content: `The LAST LINE of your response is DELIVERED to any current CONNECTIONS. TAKE INITIATIVE!`
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

    if (isWikipediaEnabled(nodeIndex)) {

        // Call generateKeywords function to get keywords
        const count = 3; // Set the number of desired keywords
        const keywordsArray = await generateKeywords(node.latestUserMessage, count);

        // Join the keywords array into a single string when needed for operations that require a string
        const keywordsString = keywordsArray.join(' ');

        // Use the first keyword from the array for specific lookups
        const firstKeyword = keywordsArray[0];

        wikipediaSummaries = await getWikipediaSummaries([firstKeyword]);
        console.log("wikipediasummaries", wikipediaSummaries);

        const wikipediaMessage = {
            role: "system",
            content: `Wikipedia Summaries (Keywords: ${keywordsString}): \n ${Array.isArray(wikipediaSummaries)
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
    }


    let searchQuery = null;

    if (isGoogleSearchEnabled(nodeIndex) || isEmbedEnabled(node.index)) {
        // Use the node-specific recent context when calling constructSearchQuery
        searchQuery = await constructSearchQuery(node.latestUserMessage, truncatedRecentContext, node);
    }


    let searchResultsData = null;
    let searchResults = [];

    if (isGoogleSearchEnabled(nodeIndex)) {
        searchResultsData = await performSearch(searchQuery);

        if (searchResultsData) {
            searchResults = processSearchResults(searchResultsData);
            searchResults = await getRelevantSearchResults(node.latestUserMessage, searchResults);

            displaySearchResults(searchResults);
        }

        const searchResultsContent = searchResults.map((result, index) => {
            return `Search Result ${index + 1}: ${result.title} - ${result.description.substring(0, 100)}...\n[Link: ${result.link}]\n`;
        }).join('\n');

        const googleSearchMessage = {
            role: "system",
            content: "Google SEARCH RESULTS displayed to user:" + searchResultsContent
        };

        messages.push(googleSearchMessage);
    }

    let relevantKeys = [];

    // Check for connected link nodes
    const hasLinkNodes = allConnectedNodes.some(node => node.isLink);

    if (hasLinkNodes) {
        const linkNodes = allConnectedNodes.filter(node => node.isLink);
        const linkUrls = linkNodes.map(node => node.linkUrl);

        // Check if each link URL exists in the vector store
        const allKeysFromServer = await getAllKeysFromServer();
        relevantKeys = linkUrls.filter(url => allKeysFromServer.includes(url));

        // Handle not extracted links
        const notExtractedLinks = linkUrls.filter(url => !allKeysFromServer.includes(url));
        if (notExtractedLinks.length > 0) {
            await handleNotExtractedLinks(notExtractedLinks);
        }

        // Refresh the relevant keys after handling not extracted links
        const updatedKeysFromServer = await getAllKeysFromServer();
        relevantKeys = linkUrls.filter(url => updatedKeysFromServer.includes(url));
    } else if (isEmbedEnabled(node.index)) {
        // Obtain relevant keys based on the user message and recent context
        relevantKeys = await getRelevantKeys(node.latestUserMessage, truncatedRecentContext, searchQuery);
    }

    // Only proceed if we have relevant keys
    if (relevantKeys.length > 0) {
        // Get relevant chunks based on the relevant keys
        const relevantChunks = await getRelevantChunks(node.latestUserMessage, topN, relevantKeys);
        const topNChunksContent = groupAndSortChunks(relevantChunks, MAX_CHUNK_SIZE);

        // Construct the embed message
        const embedMessage = {
            role: "system",
            content: `Top ${topN} MATCHED chunks of TEXT from extracted WEBPAGES:\n` + topNChunksContent + `\n Provide CONTEXT from the given snippets. CITE your sources!`
        };

        messages.push(embedMessage);
    }

    let allConnectedNodesData = getAllConnectedNodesData(node, true);
    let totalTokenCount = getTokenCount(messages);
    let remainingTokens = Math.max(0, maxTokensSlider.value - totalTokenCount);
    const maxContextSize = document.getElementById(`node-max-context-${nodeIndex}`).value;

    let textNodeInfo = [];
    let llmNodeInfo = [];
    let imageNodeInfo = [];

    const TOKEN_COST_PER_IMAGE = 150; // Flat token cost assumption for each image

    allConnectedNodes.forEach(connectedNode => {
        if (connectedNode.isImageNode) {
            const imageData = getImageNodeData(connectedNode);
            if (imageData && remainingTokens >= TOKEN_COST_PER_IMAGE) {
                // Construct an individual message for each image
                messages.push({
                    role: 'user',
                    content: [imageData] // Contains only the image data
                });
                remainingTokens -= TOKEN_COST_PER_IMAGE; // Deduct the token cost for this image
            } else {
                console.warn('Not enough tokens to include the image:', connectedNode);
            }
        }
    });


    let messageTrimmed = false;

    allConnectedNodesData.sort((a, b) => a.isLLM - b.isLLM);
    allConnectedNodesData.forEach(info => {
        if (info.data && info.data.replace) {
            if (info.isLLM) {
                // Check if the AI node is present in the connectedAiNodes array
                if (connectedAiNodes.some(aiNode => aiNode.uuid === info.node.uuid)) {
                    [remainingTokens, totalTokenCount, messageTrimmed] = updateInfoList(
                        info, llmNodeInfo, remainingTokens, totalTokenCount, maxContextSize
                    );
                }
            } else {
                [remainingTokens, totalTokenCount, messageTrimmed] = updateInfoList(
                    info, textNodeInfo, remainingTokens, totalTokenCount, maxContextSize
                );
            }
        }
    });

    // For Text Nodes
    if (textNodeInfo.length > 0) {
        let intro = "Text nodes CONNECTED to MEMORY:";
        messages.push({
            role: "system",
            content: intro + "\n\n" + textNodeInfo.join("\n\n")
        });
    }

    // For LLM Nodes
    if (llmNodeInfo.length > 0) {
        let intro = "AI you are CONVERSING with:";
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
    handleUserPromptAppend(node.aiResponseTextArea, node.latestUserMessage, PROMPT_IDENTIFIER);

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

    const clickQueues = {};  // Contains a click queue for each AI node
    // Initiates helper functions for aiNode Message loop.
    const aiNodeMessageLoop = new AiNodeMessageLoop(node, clickQueues);

    const haltCheckbox = node.haltCheckbox;

    // AI call
    callchatLLMnode(messages, node, true, inferenceOverride)
        .finally(async () => {
            node.aiResponding = false;
            aiLoadingIcon.style.display = 'none';

            // Determine if there are any connected AI nodes
            connectedAiNodes = calculateAiNodeDirectionalityLogic(node);
            hasConnectedAiNode = connectedAiNodes.length > 0;

            if (node.shouldContinue && node.shouldAppendQuestion && hasConnectedAiNode && !node.aiResponseHalted) {
                textToSend = await getLastLineFromTextArea(node.aiResponseTextArea);
                await aiNodeMessageLoop.questionConnectedAiNodes(textToSend);
            }
        })
        .catch((error) => {
            if (haltCheckbox) {
                haltCheckbox.checked = true;
            }
            console.error(`An error occurred while getting response: ${error}`);
            aiErrorIcon.style.display = 'block';
        });
}

function updateInfoList(info, tempInfoList, remainingTokens, totalTokenCount, maxContextSize) {
    let cleanedData = info.data.replace("Text Content:", "");

    if (cleanedData.trim()) {
        let tempString = tempInfoList.join("\n\n") + "\n\n" + cleanedData;
        let tempTokenCount = getTokenCount([{ content: tempString }]);

        if (tempTokenCount <= remainingTokens && totalTokenCount + tempTokenCount <= maxContextSize) {
            tempInfoList.push(cleanedData);
            remainingTokens -= tempTokenCount;
            totalTokenCount += tempTokenCount;
            return [remainingTokens, totalTokenCount, false];
        } else {
            return [remainingTokens, totalTokenCount, true];
        }
    }
    return [remainingTokens, totalTokenCount, false];
}

class AiNodeMessageLoop {
    constructor(node, clickQueues) {
        this.node = node;
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
        const connectedAiNodes = calculateAiNodeDirectionalityLogic(this.node);

        for (const connectedNode of connectedAiNodes) {
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

function calculateAiNodeDirectionalityLogic(node, visited = new Set()) {
    const connectedAiNodes = [];
    visited.add(node.uuid);

    const edgeDirectionalities = node.getEdgeDirectionalities();

    for (const { edge, directionality } of edgeDirectionalities) {
        const isOutgoing = directionality === "outgoing";
        const isBidirectional = directionality === "none";

        if (isOutgoing || isBidirectional) {
            for (const pt of edge.pts) {
                if (pt.uuid !== node.uuid && !visited.has(pt.uuid)) {
                    if (pt.isLLMNode) {
                        connectedAiNodes.push(pt);
                    } else {
                        connectedAiNodes.push(...calculateAiNodeDirectionalityLogic(pt, visited));
                    }
                }
            }
        }
    }

    return connectedAiNodes;
}