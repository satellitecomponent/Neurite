
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
            content: `You are ${aiIdentity}. Conversation renders via markdown.`
        },
    ];

    const selectedModel = determineAiNodeModel(node);
    let inferenceOverride = selectedModel;

    // Fetch the content from the custom instructions textarea using the nodeIndex
    const customInstructionsTextarea = node.customInstructionsTextarea || document.getElementById(`custom-instructions-textarea-${nodeIndex}`); // Include deprecated fallback for previous Ai Node html.
    const customInstructions = customInstructionsTextarea ? customInstructionsTextarea.value.trim() : "";

    // Append custom instructions if they exist.
    if (customInstructions.length > 0) {
        messages.push({
            role: "system",
            content: `${customInstructions}`
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
        // List the available recipients with spaces replaced by underscores, add '@' symbol, and use '@no_name' if the node title is empty
        const recipientList = connectedAiNodes.map(node => {
            const title = node.getTitle().trim();
            return title ? `@${title.replace(/\s+/g, '_')}` : '@no_name';
        }).join(', ');

        messages.push({
            role: "system",
            content: `You represent the singular personality of ${aiIdentity}. Your response exclusively portrays ${aiIdentity}. Attempt to reflect the thoughts, decisions, and voice of this identity alone. Communicate with others using @mention. The available recipients are: ${recipientList}. *underscores required. All text after an @mention is sent to that specific recipient. Use @self for internal thoughts, and @all to broadcast to all connected recipients. /exit disconnects you from the conversation. @user prompts the user. Remember, each response is expected to exclusively represent the voice of ${aiIdentity}.`
        });
    }

    if (document.getElementById(`code-checkbox-${nodeIndex}`).checked) {
        messages.push(aiNodeCodeMessage());
    }

    if (document.getElementById("instructions-checkbox").checked) {
        messages.push(instructionsMessage());
    }

    const truncatedRecentContext = getLastPromptsAndResponses(2, 150, node.aiResponseTextArea);

    let wikipediaSummaries;

    if (isWikipediaEnabled(nodeIndex)) {

        // Call generateKeywords function to get keywords
        const count = 3; // Set the number of desired keywords
        const keywordsArray = await generateKeywords(node.latestUserMessage, count, node);

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
    let filteredKeys = null;

    if (isGoogleSearchEnabled(nodeIndex) || (filteredKeys = await isEmbedEnabled(node))) {
        try {
            searchQuery = await constructSearchQuery(node.latestUserMessage, truncatedRecentContext, node);
        } catch (error) {
            console.error('Error constructing search query:', error);
            searchQuery = null;
        }
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
        const linkInfo = linkNodes.map(node => ({
            url: node.linkUrl,
            key: node.linkUrl.startsWith('blob:') ? node.titleInput.value : node.linkUrl
        }));

        const allKeysFromServer = await getAllKeys();

        relevantKeys = linkInfo
            .filter(info => allKeysFromServer.includes(info.key))
            .map(info => info.key);

        const notExtractedLinks = linkInfo.filter(info => !allKeysFromServer.includes(info.key));

        if (notExtractedLinks.length > 0) {
            await handleNotExtractedLinks(notExtractedLinks, linkNodes);
        }

        // Refresh the relevant keys after handling not extracted links
        const updatedKeysFromServer = await getAllKeys();
        relevantKeys = linkInfo
            .filter(info => updatedKeysFromServer.includes(info.key))
            .map(info => info.key);
    } else if (searchQuery !== null && filteredKeys) {
        // Obtain relevant keys based on the user message
        relevantKeys = await getRelevantKeys(node.latestUserMessage, truncatedRecentContext, searchQuery, filteredKeys);
    }

    // Only proceed if we have relevant keys
    if (relevantKeys.length > 0) {
        // Get relevant chunks based on the relevant keys
        node.currentTopNChunks = await getRelevantChunks(node.latestUserMessage, topN, relevantKeys);
        let topNChunks = groupAndSortChunks(node.currentTopNChunks, MAX_CHUNK_SIZE);
        // Construct the embed message
        const embedMessage = {
            role: "system",
            content: `Top ${topN} MATCHED chunks of TEXT from extracted WEBPAGES:\n` + topNChunks + `\nProvide EXACT INFORMATION from the given snippets! Use [Snippet n](source) to display references to exact snippets. Make exclusive use of the provided snippets.`
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
                /* Check if the AI node is present in the connectedAiNodes array
                if (connectedAiNodes.some(aiNode => aiNode.uuid === info.node.uuid)) {
                    [remainingTokens, totalTokenCount, messageTrimmed] = updateInfoList(
                        info, llmNodeInfo, remainingTokens, totalTokenCount, maxContextSize
                    );
                }*/
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

    /* For LLM Nodes
    if (llmNodeInfo.length > 0) {
        let intro = "AI you are CONVERSING with:";
        messages.push({
            role: "system",
            content: intro + "\n\n" + llmNodeInfo.join("\n\n")
        });
    }*/

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
    lastPromptsAndResponses = getLastPromptsAndResponses(20, contextSize, node.aiResponseTextArea);

    // Append the user prompt to the AI response area with a distinguishing mark and end tag
    handleUserPromptAppend(node.aiResponseTextArea, node.latestUserMessage, PROMPT_IDENTIFIER);

    let wolframData;
    if (document.getElementById(`enable-wolfram-alpha-checkbox-${nodeIndex}`).checked) {
        const wolframContext = getLastPromptsAndResponses(2, 300, node.aiResponseTextArea);
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
        lastPromptsAndResponses = getLastPromptsAndResponses(10, contextSize, node.aiResponseTextArea);
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
        .then(async () => {
            node.aiResponding = false;
            aiLoadingIcon.style.display = 'none';

            connectedAiNodes = calculateAiNodeDirectionalityLogic(node);
            hasConnectedAiNode = connectedAiNodes.length > 0;

            if (node.shouldContinue && node.shouldAppendQuestion && hasConnectedAiNode && !node.aiResponseHalted) {
                await aiNodeMessageLoop.questionConnectedAiNodes();
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
        this.clickQueues = clickQueues || {}; // Initialize clickQueues if not passed
    }

    async processClickQueue(nodeId) {
        const queue = this.clickQueues[nodeId] || [];
        while (true) {
            if (queue.length > 0) {
                const { connectedNode, sendButton } = queue[0];

                // Check if the connected node still has connections
                const connectedAiNodes = calculateAiNodeDirectionalityLogic(connectedNode);
                if (connectedAiNodes.length === 0 || connectedNode.aiResponseHalted) {
                    console.warn(`Node ${connectedNode.index} has no more connections or its AI response is halted. Exiting queue.`);
                    break;
                }

                // If AI is not responding, attempt the click
                if (!connectedNode.aiResponding) {
                    queue.shift();  // Remove the processed message from the queue
                    sendButton.click();
                }
            }

            await new Promise(resolve => setTimeout(resolve, 4000));  // Wait before processing the next message
        }

        // Clean up the queue after processing
        delete this.clickQueues[nodeId];
    }

    async questionConnectedAiNodes() {
        console.log("Questioning connected AI nodes...");
        const lastResponse = this.getLastAiResponse();
        const connectedAiNodes = calculateAiNodeDirectionalityLogic(this.node);

        const parsedMessages = this.parseMessages(lastResponse);
        for (const { recipient, message } of parsedMessages) {
            console.log(`Parsed message for ${recipient}: ${message}`);

            // Handle /exit command
            if (message === '/exit') {
                this.node.haltResponse();

                const connectedAiNodeSet = new Set(connectedAiNodes.map(node => node.uuid));

                for (let i = this.node.edges.length - 1; i >= 0; i--) {
                    const edge = this.node.edges[i];

                    if (edge.pts.some(pt => connectedAiNodeSet.has(pt.uuid))) {
                        edge.remove();
                    }
                }

                console.log("AI has exited the conversation.");
                break;
            }

            // Skip processing if the message is directed to @self
            if (recipient.toLowerCase() === 'self') {
                console.log("Skipping self-directed message.");
                continue;
            }

            // Prompt user if the message is directed to @user
            if (recipient.toLowerCase() === 'user') {
                const userResponse = await new Promise(resolve => {
                    const response = prompt(`${message}`);
                    resolve(response);
                });

                if (userResponse) {
                    // Handle the user's response by sending it back to the AI node that prompted
                    const responseMessage = `@user says,\n${userResponse.trim()}`;
                    this.processTargetNode(this.node, responseMessage);
                }
                continue;
            }

            let targetNodes = [];

            // Handle @all to broadcast to all connected nodes
            if (recipient.toLowerCase() === 'all') {
                targetNodes = connectedAiNodes;
            } else if (recipient.toLowerCase() === 'no_name') {
                // Handle @no_name to send to all connected nodes with an empty title
                targetNodes = connectedAiNodes.filter(node => {
                    const title = this.normalizeRecipient(node.getTitle());
                    return title === '';
                });
            } else {
                const normalizedRecipient = this.normalizeRecipient(recipient);
                const targetNode = connectedAiNodes.find(node =>
                    this.normalizeRecipient(node.getTitle()) === normalizedRecipient
                );

                if (targetNode) {
                    targetNodes.push(targetNode);
                } else {
                    console.warn(`No connected node found for recipient ${recipient}`);
                    continue;
                }
            }

            // Process each target node
            for (const connectedNode of targetNodes) {
                this.processTargetNode(connectedNode, message);
            }
        }
    }

    processTargetNode(connectedNode, message) {
        let uniqueNodeId = connectedNode.index;

        if (connectedNode.aiResponseHalted || this.node.aiResponseHalted) {
            console.warn(`AI response for node ${uniqueNodeId} or its connected node is halted. Skipping this node.`);
            return;
        }

        let promptElement = connectedNode.content.querySelector(`#nodeprompt-${uniqueNodeId}`);
        let sendButton = connectedNode.content.querySelector(`#prompt-form-${uniqueNodeId}`);

        if (!promptElement || !sendButton) {
            console.error(`Elements for ${uniqueNodeId} are not found`);
            return;
        }

        if (promptElement instanceof HTMLTextAreaElement) {
            promptElement.value += `\n${message}`;
        } else if (promptElement instanceof HTMLDivElement) {
            promptElement.innerHTML += `<br>${message}`;
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

    normalizeRecipient(recipient) {
        // Remove '@' only if it's the first character
        recipient = recipient.startsWith('@') ? recipient.substring(1) : recipient;
        // Normalize by converting to lowercase and treating underscores and spaces as equivalent
        return recipient.toLowerCase().replace(/[\s_]/g, '');
    }

    parseMessages(text) {
        console.log("Parsing messages...");
        const messages = [];
        const mentionPattern = /@([a-zA-Z0-9_]+)/g;
        let senderName = this.node.getTitle() || "no_name";

        let accumulatedMessage = '';
        let currentRecipients = [];
        let isSelfMessage = false;

        text.split('\n').forEach(line => {
            console.log(`Processing line: ${line}`);
            line = line.trim();

            // Check for the /exit command
            if (line.toLowerCase().includes('/exit')) {
                messages.push({ recipient: 'all', message: `${senderName} says,\n${line}` });
                messages.push({ recipient: 'self', message: '/exit' });
                return; // Stop further processing
            }

            let lastIndex = 0;
            let match;
            let lineRecipients = [];
            let lineMessage = '';

            while ((match = mentionPattern.exec(line)) !== null) {
                const beforeMention = line.substring(lastIndex, match.index).trim();

                // If a self message is encountered, finalize the message and stop accumulating further text
                if (match[1].toLowerCase() === 'self') {
                    if (accumulatedMessage.trim() || beforeMention) {
                        currentRecipients.forEach(recipient => {
                            messages.push({
                                recipient: recipient,
                                message: `${senderName} says,\n${(accumulatedMessage + beforeMention).trim()}`
                            });
                        });
                    }
                    accumulatedMessage = ''; // Reset accumulated message after finalizing
                    isSelfMessage = true;
                    break; // Stop processing this line after @self
                }

                // Finalize any accumulated message before this new mention
                if (accumulatedMessage.trim() && currentRecipients.length > 0) {
                    currentRecipients.forEach(recipient => {
                        messages.push({
                            recipient: recipient,
                            message: `${senderName} says,\n${accumulatedMessage.trim()}`
                        });
                    });
                    accumulatedMessage = ''; // Reset accumulated message after sending
                }

                // Include any text before the mention
                if (beforeMention) {
                    lineMessage += beforeMention + ' ';
                }

                // Add the mention itself to the message
                lineMessage += match[0] + ' ';

                // Add the mention to the list of recipients for this line
                const recipient = match[1].toLowerCase();
                if (!lineRecipients.includes(recipient)) {
                    lineRecipients.push(recipient);
                }

                lastIndex = match.index + match[0].length;
            }

            // Capture any remaining text after the last mention in the line
            if (!isSelfMessage) {
                const remainingText = line.substring(lastIndex).trim();
                if (remainingText) {
                    lineMessage += remainingText + ' ';
                }
            }

            // Accumulate the message for all recipients from this line
            if (lineRecipients.length > 0) {
                accumulatedMessage += lineMessage;
                currentRecipients = lineRecipients; // Update current recipients to include all recipients found in this line
            } else if (!isSelfMessage) {
                accumulatedMessage += line + ' ';
            }

            // Reset self message flag for next line
            isSelfMessage = false;
        });

        // Finalize the last message if it exists
        if (accumulatedMessage.trim()) {
            currentRecipients.forEach(recipient => {
                messages.push({
                    recipient: recipient,
                    message: `${senderName} says,\n${accumulatedMessage.trim()}`
                });
            });
        }

        console.log(`Parsed messages: ${JSON.stringify(messages)}`);
        return messages;
    }

    getLastAiResponse() {
        const responseWrappers = this.node.aiResponseDiv.querySelectorAll('.response-wrapper');
        if (responseWrappers.length > 0) {
            const lastWrapper = responseWrappers[responseWrappers.length - 1];
            const aiResponseDiv = lastWrapper.querySelector('.ai-response');
            if (aiResponseDiv) {
                // Use textContent instead of innerText to preserve formatting
                const responseText = aiResponseDiv.textContent.trim();
                //console.log(`Last AI response: ${responseText}`);
                return responseText;
            }
        }
        console.warn("No AI response found.");
        return '';
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