AiNode.sendMessage = async function (node, message = null) {
    if (node.aiResponding) {
        Logger.info("AI is currently responding. Wait for the current response to complete before sending a new message.");
        return;
    }

    const nodeIndex = node.index;

    const maxTokens = node.content.querySelector('#node-max-tokens-' + node.index).value;
    //Initalize count for message trimming
    let contextSize = 0;

    // Checks if all connected nodes should be sent or just nodes up to the first found ai node in each branch. connected nodes (default)
    const useAllConnectedNodes = Elem.byId('use-all-connected-ai-nodes').checked;
    const allConnectedNodes = node.getAllConnectedNodes(useAllConnectedNodes ? undefined : true);

    node.latestUserMessage = message || node.promptTextArea.value;

    // Clear the prompt textarea
    node.promptTextArea.value = '';
    node.promptTextArea.dispatchEvent(new Event('input'));

    const aiIdentity = node.getTitle() || "an Ai Assistant";

    const messages = [
        {
            role: "system",
            content: `You are ${aiIdentity}. Conversation renders via markdown.`
        },
    ];

    const selectedModel = Ai.determineModel(node);
    let inferenceOverride = selectedModel;

    const textarea = node.customInstructionsTextarea || Elem.byId('custom-instructions-textarea-' + nodeIndex); // Include deprecated fallback for previous Ai Node html.
    const customInstructions = (textarea ? textarea.value.trim() : '');
    if (customInstructions.length > 0) {
        messages.push({
            role: "system",
            content: customInstructions
        });
    }

    let connectedAiNodes = AiNode.calculateDirectionalityLogic(node);

    node.shouldAppendQuestion = (connectedAiNodes.length > 0);
    if (node.shouldAppendQuestion) {
        // List the available recipients with spaces replaced by underscores, add '@' symbol, and use '@no_name' if the node title is empty
        const recipientList = connectedAiNodes.map(node => {
            const title = node.getTitle().trim();
            return title ? `@${title.replace(/\s+/g, '_')}` : '@no_name';
        }).join(', ');

        const promptContent = [
            "You represent the singular personality of ", aiIdentity, ". ",
            "Your response exclusively portrays ", aiIdentity, ". ",
            "Attempt to reflect the thoughts, decisions, and voice of this identity alone. ",
            "Communicate with others using @mention. The available recipients are: ", recipientList, ". ",
            "*underscores required. ",
            "All text after an @mention is sent to that specific recipient. ",
            "Multiple mentions on the same line send to each mention. "
        ];
        const getInputValue = Modal.getAiInputValue;

        if (getInputValue('enable-self')) {
            promptContent.push("Use @self for internal thoughts. ");
        }

        if (getInputValue('enable-all')) {
            promptContent.push("Use @all to broadcast to all connected recipients. ");
        }

        if (getInputValue('enable-exit')) {
            promptContent.push("/exit disconnects you from the conversation. ");
        }

        if (getInputValue('enable-user')) {
            promptContent.push("@user prompts the user. ");
        }

        promptContent.push(
            "Remember, each response is expected to exclusively represent the voice of ", aiIdentity, ". ",
            "@ symbols start a mention if not preceded by text."
        );

        messages.push({
            role: "system",
            content: promptContent.join('')
        });
    }

    if (Elem.byId('code-checkbox-' + nodeIndex).checked) messages.push(aiNodeCodeMessage());
    if (Elem.byId('instructions-checkbox').checked) messages.push(instructionsMessage());

    const truncatedRecentContext = getLastPromptsAndResponses(2, 150, node.aiResponseTextArea);

    if (Wikipedia.isEnabled(nodeIndex)) {
        const keywordsArray = await generateKeywords(node.latestUserMessage, 3, node);
        const keywordsString = keywordsArray.join(' ');

        // Use the first keyword from the array for specific lookups
        const firstKeyword = keywordsArray[0];

        const wikipediaSummaries = await Wikipedia.getSummaries([firstKeyword]);
        Logger.info("wikipediasummaries", wikipediaSummaries);

        const summary = (!Array.isArray(wikipediaSummaries) ? "Wiki Disabled" : wikipediaSummaries
            .filter(s => s?.title !== undefined && s?.summary !== undefined)
            .map(s => s.title + " (Relevance Score: " + s.relevanceScore.toFixed(2) + "): " + s.summary)
            .join("\n\n"));

        messages.push({
            role: "system",
            content: `Wikipedia Summaries (Keywords: ${keywordsString}): \n ${summary} END OF SUMMARIES`
        });
    }

    let searchQuery = null;
    let filteredKeys = null;

    if (isGoogleSearchEnabled(nodeIndex) || (filteredKeys = await isEmbedEnabled(node))) {
        try {
            searchQuery = await constructSearchQuery(node.latestUserMessage, truncatedRecentContext, node);
        } catch (err) {
            Logger.err("In constructing search query:", err);
            searchQuery = null;
        }
    }

    if (isGoogleSearchEnabled(nodeIndex)) {
        let searchResults = [];
        const searchResultsData = await performSearch(searchQuery);
        if (searchResultsData) {
            searchResults = processSearchResults(searchResultsData);
            await displayResultsRelevantToMessage(searchResults, node.latestUserMessage);
        }

        const searchResultsContent = searchResults.map((result, index) => {
            return `Search Result ${index + 1}: ${result.title} - ${result.description.substring(0, 100)}...\n[Link: ${result.link}]\n`;
        });

        messages.push({
            role: "system",
            content: "Google SEARCH RESULTS displayed to user:" + searchResultsContent.join('\n')
        });
    }

    let relevantKeys = [];

    // Check for connected link nodes
    const hasLinkNodes = allConnectedNodes.some(node => node.isLink);
    if (hasLinkNodes) {
        const linkNodes = allConnectedNodes.filter(node => node.isLink);
        const linkInfo = linkNodes.map(node => ({
            url: node.linkUrl,
            key: node.linkUrl.startsWith('blob:') ? node.view.titleInput.value : node.linkUrl
        }));

        const allKeysFromServer = await Keys.getAll();

        relevantKeys = linkInfo
            .filter(info => allKeysFromServer.includes(info.key))
            .map(info => info.key);

        const notExtractedLinks = linkInfo.filter(info => !allKeysFromServer.includes(info.key));

        if (notExtractedLinks.length > 0) {
            await handleNotExtractedLinks(notExtractedLinks, linkNodes);
        }

        // Refresh the relevant keys after handling not extracted links
        const updatedKeysFromServer = await Keys.getAll();
        relevantKeys = linkInfo
            .filter(info => updatedKeysFromServer.includes(info.key))
            .map(info => info.key);
    } else if (searchQuery !== null && filteredKeys) {
        // Obtain relevant keys based on the user message
        relevantKeys = await Keys.getRelevant(node.latestUserMessage, truncatedRecentContext, searchQuery, filteredKeys);
    }

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

    let allConnectedNodesData = node.getAllConnectedNodesData(true);
    let totalTokenCount = TokenCounter.forMessages(messages);
    let remainingTokens = Math.max(0, maxTokens - totalTokenCount);
    const maxContextSize = Elem.byId('node-max-context-' + nodeIndex).value;

    let textNodeInfo = [];
    let llmNodeInfo = [];
    let imageNodeInfo = [];

    const TOKEN_COST_PER_IMAGE = 150; // Flat token cost assumption for each image

    allConnectedNodes.forEach(async (connectedNode) => {
        if (connectedNode.isImageNode) {
            const imageData = await getImageNodeData(connectedNode);
            if (imageData && remainingTokens >= TOKEN_COST_PER_IMAGE) {
                // Construct the message with base64 image formatted as a data URL
                messages.push({
                    role: 'user',
                    content: {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${imageData.image_data}` // Properly format the base64 image data as a data URL
                        },
                        //detail: 'high' // Set high detail for better quality
                    }
                });
                remainingTokens -= TOKEN_COST_PER_IMAGE; // Deduct the token cost for this image
            } else {
                Logger.warn("Not enough tokens to include the image:", connectedNode)
            }
        }
    });

    let messageTrimmed = false;

    allConnectedNodesData.sort((a, b) => a.isLLM - b.isLLM);
    allConnectedNodesData.forEach(info => {
        if (!info.data?.replace) return;

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

    totalTokenCount = TokenCounter.forMessages(messages);
    remainingTokens = Math.max(0, maxTokens - totalTokenCount);

    // calculate contextSize again
    contextSize = Math.min(remainingTokens, maxContextSize);

    // Init value of getLastPromptsAndResponses
    let lastPromptsAndResponses;
    lastPromptsAndResponses = getLastPromptsAndResponses(20, contextSize, node.aiResponseTextArea);

    // Append the user prompt to the AI response area with a distinguishing mark and end tag
    handleUserPromptAppend(node.aiResponseTextArea, node.latestUserMessage, PROMPT_IDENTIFIER);

    let wolframData;
    if (Elem.byId('enable-wolfram-alpha-checkbox-' + nodeIndex).checked) {
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

        Logger.info("wolframAlphaTextResult:", wolframAlphaTextResult);
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

    // Initiates helper functions for aiNode Message loop.
    const aiNodeMessageLoop = new AiNode.MessageLoop(node, clickQueues);

    const haltCheckbox = node.haltCheckbox;

    // AI call
    callchatLLMnode(messages, node, true, inferenceOverride)
        .then(() => {
            node.aiResponding = false;
            aiLoadingIcon.style.display = 'none';

            const hasConnectedAiNode = AiNode.calculateDirectionalityLogic(node).length > 0;
            if (node.shouldContinue && node.shouldAppendQuestion && hasConnectedAiNode && !node.aiResponseHalted) {
                return aiNodeMessageLoop.questionConnectedAiNodes();
            }
        })
        .catch((err) => {
            if (haltCheckbox) haltCheckbox.checked = true;
            Logger.err("While getting response:", err);
            aiErrorIcon.style.display = 'block';
        });
}

function updateInfoList(info, tempInfoList, remainingTokens, totalTokenCount, maxContextSize) {
    let flag = false;
    const cleanedData = info.data.replace("Text Content:", '');
    if (cleanedData.trim()) {
        const tempString = tempInfoList.join("\n\n") + "\n\n" + cleanedData;
        let tempTokenCount = TokenCounter.forString(tempString);

        if (tempTokenCount <= remainingTokens && totalTokenCount + tempTokenCount <= maxContextSize) {
            tempInfoList.push(cleanedData);
            remainingTokens -= tempTokenCount;
            totalTokenCount += tempTokenCount;
        } else {
            flag = true;
        }
    }
    return [remainingTokens, totalTokenCount, flag];
}

AiNode.MessageLoop = class {
    constructor(node, clickQueues = {}) {
        this.node = node;
        this.clickQueues = clickQueues;
    }

    async processClickQueue(connectedNode) {
        const queue = this.clickQueues.get(connectedNode) || [];
        while (true) {
            if (queue.length > 0) {
                const { sendButton } = queue[0];

                const connectedAiNodes = AiNode.calculateDirectionalityLogic(connectedNode);
                if (connectedAiNodes.length === 0 || connectedNode.aiResponseHalted) {
                    Logger.warn("Node", connectedNode.index, "has no more connections or its AI response is halted. Exiting queue.");
                    break;
                }

                if (!connectedNode.aiResponding) {
                    queue.shift(); // Remove the processed message
                    sendButton.click();
                }
            }

            await Promise.delay(2500);
        }

        this.clickQueues.delete(connectedNode);
    }

    async questionConnectedAiNodes() {
        Logger.debug("Questioning connected AI nodes...");
        const lastResponse = this.getLastAiResponse();
        const connectedAiNodes = AiNode.calculateDirectionalityLogic(this.node);

        let parsedMessages = this.parseMessages(lastResponse);
        if (parsedMessages.length === 0) {
            Logger.warn("Standard parsing failed. Using fallback method.");
            parsedMessages = this.fallbackParse(lastResponse);
        }

        for (const { recipient, message } of parsedMessages) {
            if (!message.trim()) {
                Logger.debug("Skipping empty message for recipient:", recipient);
                continue;
            }

            Logger.debug(`Processing message for ${recipient}: ${message}`);

            // Handle /exit command
            if (message.includes('/exit')) {
                this.node.haltResponse();
                this.removeEdgesToConnectedNodes(connectedAiNodes);
                Logger.debug("AI has exited the conversation.");
                break;
            }

            // Handle messages to specific recipients or 'all'
            let targetNodes = [];
            if (recipient === 'all') {
                targetNodes = connectedAiNodes;
            } else if (recipient === 'user') {
                const userResponse = await this.getUserResponse(message);
                if (userResponse) {
                    const responseMessage = `@user says,\n${userResponse.trim()}`;
                    this.processTargetNode(this.node, responseMessage);
                }
                continue;
            } else if (recipient === 'self') {
                Logger.debug("Skipping self-directed message.");
                continue;
            } else {
                // Handle specific recipient
                const targetNode = connectedAiNodes.find(node =>
                    this.normalizeRecipient(node.getTitle()) === this.normalizeRecipient(recipient)
                );
                if (targetNode) {
                    targetNodes.push(targetNode);
                } else {
                    Logger.warn("No connected node found for recipient", recipient);
                    continue;
                }
            }

            for (const connectedNode of targetNodes) {
                this.processTargetNode(connectedNode, message);
            }
        }
    }

    removeEdgesToConnectedNodes(connectedAiNodes) {
        const connectedAiNodeSet = new Set(connectedAiNodes.map(String.uuidOf));
        for (let i = this.node.edges.length - 1; i >= 0; i--) {
            const edge = this.node.edges[i];
            if (edge.pts.some(pt => connectedAiNodeSet.has(pt.uuid))) {
                edge.remove();
            }
        }
    }

    getUserResponse(message) {
        return new Promise(resolve => {
            const response = prompt(message);
            resolve(response);
        });
    }

    processTargetNode(connectedNode, message, skipClickQueue = false) {
        if (connectedNode.aiResponseHalted || this.node.aiResponseHalted) {
            Logger.warn("AI response for node", uniqueNodeId, "or its connected node is halted. Skipping this node.");
            return;
        }

        const promptElement = connectedNode.content.querySelector('#nodeprompt-' + uniqueNodeId);
        const sendButton = connectedNode.content.querySelector('#prompt-form-' + uniqueNodeId);

        if (!promptElement || !sendButton) {
            Logger.err("Elements for", uniqueNodeId, "are not found");
            return;
        }

        promptElement.value += `\n${message}`;
        promptElement.dispatchEvent(new Event('input', { 'bubbles': true, 'cancelable': true }));

        if (!skipClickQueue) {
            this.enqueueClick(connectedNode, sendButton);
        }
    }

    updatePromptElement(promptElement, message) {
        if (promptElement instanceof HTMLTextAreaElement) {
            promptElement.value += '\n' + message;
        } else if (promptElement instanceof HTMLDivElement) {
            promptElement.innerHTML += "<br>" + message;
        } else {
            Logger.err(`Element with ID prompt-${uniqueNodeId} is neither a textarea nor a div`)
        }

        promptElement.dispatchEvent(new Event('input', { 'bubbles': true, 'cancelable': true }));
    }

    enqueueClick(uniqueNodeId, sendButton, connectedNode) {
        const clickQueues = this.clickQueues;
        if (!clickQueues[uniqueNodeId]) {
            clickQueues[uniqueNodeId] = [];
            this.processClickQueue(uniqueNodeId);
        }
        clickQueues[uniqueNodeId].push({ sendButton, connectedNode });
    }

    fallbackParse(text) {
        Logger.debug("Using fallback parsing method");
        const senderName = this.node.getTitle() || "no_name";
        if (!text.trim()) {
            return []; // No message if the text is empty
        }
        return [{
            recipient: 'all',
            message: `${senderName} says,\n${text.trim()}`
        }];
    }

    isValidRecipient(mention) {
        const validRecipients = ['self', 'all', 'user'];
        return validRecipients.includes(mention) || this.isConnectedNode(mention);
    }

    isConnectedNode(nodeName) {
        const normalizedNodeName = this.normalizeRecipient(nodeName);
        const func = (node) => (this.normalizeRecipient(node.getTitle()) === normalizedNodeName);
        return AiNode.calculateDirectionalityLogic(this.node).some(func);
    }

    extractMentionType(mention) {
        if (mention === 'self') return 'self';
        if (mention === 'all') return 'all';
        if (mention === 'user') return 'user';
        return mention;
    }

    normalizeRecipient(recipient) {
        return recipient.toLowerCase().replace(/[\s@_-]/g, '');
    }

    parseMessages(text) {
        Logger.debug("Parsing messages...");
        Logger.debug("Input text:", text);
        const messages = [];
        const mentionPattern = /@([a-zA-Z0-9._-]+)(?:[\s,:]|$)/g;
        const senderName = this.node.getTitle() || "no_name";

        let currentRecipient = 'all';
        let currentMessage = '';

        // Split the text into paragraphs
        const paragraphs = text.split(/\n\s*\n/);

        for (const paragraph of paragraphs) {
            const parts = paragraph.split(mentionPattern);

            for (let i = 0; i < parts.length; i++) {
                if (i % 2 === 0) {
                    // This is message content
                    currentMessage += parts[i];
                } else {
                    // This is a mention
                    const mention = parts[i].toLowerCase();

                    if (this.isValidRecipient(mention)) {
                        if (currentMessage.trim()) {
                            this.finalizeMessage(messages, currentRecipient, currentMessage.trim(), senderName);
                        }
                        currentRecipient = this.extractMentionType(mention);
                        currentMessage = '';
                    } else {
                        currentMessage += "@" + parts[i];
                    }
                }
            }

            // Finalize the message for this paragraph
            if (currentMessage.trim()) {
                this.finalizeMessage(messages, currentRecipient, currentMessage.trim(), senderName);
                currentMessage = '';
            }
        }

        Logger.debug("Parsed", messages.length, "messages");
        Logger.debug("Parsed messages:", JSON.stringify(messages));

        if (messages.length === 0) {
            Logger.warn("No messages parsed. Using fallback method.");
            return this.fallbackParse(text);
        }

        return messages;
    }

    finalizeMessage(messages, recipient, message, senderName) {
        Logger.debug("Finalizing message for recipient:", recipient);
        if (!message.trim()) {
            Logger.debug("Skipping empty message");
            return;
        }

        messages.push({
            recipient: recipient,
            message: `${senderName} says,\n${message.trim()}`
        });
    }

    getLastAiResponse() {
        const responseWrappers = this.node.aiResponseDiv.querySelectorAll('.response-wrapper');
        if (responseWrappers.length > 0) {
            const lastWrapper = responseWrappers[responseWrappers.length - 1];
            const aiResponseDiv = lastWrapper.querySelector('.ai-response');
            if (aiResponseDiv) return aiResponseDiv.textContent.trim();
        }

        Logger.warn("No AI response found.");
        return '';
    }
}

AiNode.calculateDirectionalityLogic = function (node, visited = new Set()) {
    const connectedAiNodes = [];
    visited.add(node.uuid);

    for (const { edge, directionality } of node.getEdgeDirectionalities()) {
        if (directionality !== 'outgoing' && directionality !== 'none') continue;

        for (const pt of edge.pts) {
            if (pt.uuid === node.uuid || visited.has(pt.uuid)) continue;

            if (pt.isLLMNode) {
                connectedAiNodes.push(pt);
            } else {
                connectedAiNodes.push(...AiNode.calculateDirectionalityLogic(pt, visited));
            }
        }
    }

    return connectedAiNodes;
}