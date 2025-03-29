AiNode.sendMessage = async function (node, message = null, autoModeMessage = null) {
    if (!autoModeMessage && node.aiResponding) {
        Logger.info("AI is currently responding. Wait for the current response to complete before sending a new message.");
        return;
    }
    node.aiResponding = true;
    node.aiResponseHalted = false;
    node.shouldContinue = true;

    const nodeIndex = node.index;

    const maxTokens = node.content.querySelector('#node-max-tokens-' + node.index).value;
    //Initalize count for message trimming
    let contextSize = 0;

    // Get all connected nodes (without filtering for LLM)
    const allConnectedNodes = AiNode.calculateDirectionalityLogic(node, new Set(), true);

    // Get only LLM nodes
    const connectedAiNodes = allConnectedNodes.filter(n => n.isLLM);

    node.latestUserMessage = message || node.promptTextArea.value;
    const latestUserMessage = node.latestUserMessage

    node.isAutoModeEnabled = node.autoCheckbox.checked;
    if (node.isAutoModeEnabled && node.originalUserMessage === null) {
        node.originalUserMessage = latestUserMessage;
    }

    // Clear the prompt textarea
    node.promptTextArea.value = '';
    node.promptTextArea.dispatchEvent(new Event('input'));

    const aiIdentity = node.getTitle() || "an Ai Assistant";

    const aiCall = AiCall.stream(node)
        .addSystemPrompt(Prompt.markdownIdentity(aiIdentity));
    aiCall.inferenceOverride = Ai.determineModel(node);

    const textarea = node.customInstructionsTextarea || Elem.byId('custom-instructions-textarea-' + nodeIndex); // Include deprecated fallback for previous Ai Node html.
    const customInstructions = (textarea ? textarea.value.trim() : '');
    if (customInstructions.length > 0) {
        aiCall.addSystemPrompt(customInstructions)
    }

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
            "You are an Ai assistant with the ability to execute commands (/) and send messages (@) during the current conversation. ",
            "Communicate with others using @mention. The available recipients are: ", recipientList, ". ",
            "*underscores required. ",
            "All text after an @recipient_name_here is sent to that specific recipient. ",
            "Multiple mentions on the same line are sent to all relevant parties. "
        ];
        const getInputValue = Modal.getAiInputValue;

        if (getInputValue('enable-all')) {
            promptContent.push("@all sends the text after @all to every connected recipient. ");
        }

        if (getInputValue('enable-user')) {
            promptContent.push("@user prompts the user. ");
        }

        if (getInputValue('enable-memory')) {
            promptContent.push("@memory sends any text after @memory to your memory. ");
        }

        if (getInputValue('enable-rewrite')) {
            promptContent.push("/rewrite <nodeTitle> on a single line overwrites the text of the node named `<nodeTitle>`. Put all new lines of text for that node immediately after this command. Stop when you reach a new `@mention` or another `/validCommand`. Do not include anything else on the same line as the `/rewrite` command apart from the node title. ");
        }

        if (getInputValue('enable-disconnect')) {
            promptContent.push("/disconnect followed by the exact title of the node to disconnect from deletes the connection to that node.");
        }

        if (getInputValue('enable-exit')) {
            promptContent.push("/exit disconnects you from all connected conversants. ");
        }

        promptContent.push(
            "REMEMBER: You have the ability to use @memory to store memories in the same way you can use @mention to send messages.",
            "@mention to send messages. ",
            "/ to execute commands. ",
            "Each response is expected to exclusively represent the voice of ", aiIdentity
        );

        aiCall.addSystemPrompt(promptContent.join(''));
    }

    if (Elem.byId('code-checkbox-' + nodeIndex).checked) {
        aiCall.addSystemPrompt(Prompt.aiNodeCode())
    }
    if (Elem.byId('instructions-checkbox').checked) {
        aiCall.addSystemPrompt(Prompt.instructions())
    }

    const truncatedRecentContext = getLastPromptsAndResponses(2, 1500, node.aiResponseTextArea);

    if (Wikipedia.isEnabled(nodeIndex)) {
        const arrKeywords = await generateKeywords(latestUserMessage, 3, node);
        const strKeywords = arrKeywords.join(' ');
        const summaries = await Wikipedia.getSummaries([arrKeywords[0]]);
        aiCall.addSystemPrompt(Prompt.wikipedia(strKeywords, summaries));
    }

    let searchQuery = null;
    let filteredKeys = null;
    const allConnectedNodesData = await node.getAllConnectedNodesData(true);
    
    if (
        isGoogleSearchEnabled(nodeIndex) ||
        (filteredKeys = await isEmbedEnabled(node)) ||
        (allConnectedNodesData && allConnectedNodesData.some(info => info.data?.type === 'link'))
    ) {
        try {
            searchQuery = await constructSearchQuery(latestUserMessage, truncatedRecentContext, node);
        } catch (err) {
            Logger.err("In constructing search query:", err);
        }
    }
    
    if (isGoogleSearchEnabled(nodeIndex)) {
        const content = handleNaturalLanguageSearch(searchQuery, latestUserMessage);
        aiCall.addSystemPrompt(Prompt.googleSearch(content));
    }

    // --- PROCESS IMAGE, TEXT, LINK NODES ---
    // --- LINK NODES HANDLING ---
    const prompt = await Prompt.searchQuery(
        latestUserMessage,
        searchQuery,
        filteredKeys,
        topN,
        truncatedRecentContext,
        node,
        allConnectedNodesData
    );
    if (prompt) aiCall.addSystemPrompt(prompt);

    let totalTokenCount = TokenCounter.forMessages(aiCall.messages);
    let remainingTokens = Math.max(0, maxTokens - totalTokenCount);
    const maxContextSize = Elem.byId('node-max-context-' + nodeIndex).value;

    let textNodeInfo = [];
    const TOKEN_COST_PER_IMAGE = 150; // Flat token cost for each image node

    // Process image nodes from the gathered data
    allConnectedNodesData
        .filter( (info)=>(info.data && info.data.type === 'image') )
    .forEach( (info)=>{
        if (remainingTokens < TOKEN_COST_PER_IMAGE) {
            Logger.warn("Not enough tokens to include the image:", info.node);
            return;
        }

        if (info.data.data) {
            aiCall.addUserPrompt([{
                type: 'image_url',
                image_url: { url: info.data.data }
            }]);
            remainingTokens -= TOKEN_COST_PER_IMAGE;
        } else {
            Logger.warn("Failed to retrieve image data for:", info.node);
        }
    });


    let messageTrimmed = false;

    // Update remainingTokens
    allConnectedNodesData
    .filter(info => info.data) // Only process nodes with data
    .forEach(info => {
      // Ensure we have a valid string in info.data.data
      if (!info.data.data?.replace) return;

      // Create a new object with the data property as a string
      const nodeInfoForUpdate = { ...info, data: info.data.data };
      [remainingTokens, totalTokenCount, messageTrimmed] = updateInfoList(
        nodeInfoForUpdate,
        textNodeInfo,
        remainingTokens,
        totalTokenCount,
        maxContextSize
      );
    });

    // Text Nodes
    if (textNodeInfo.length > 0) {
        const memoryIntro = "Available text nodes/notes CONNECTED to MEMORY:";
        const memoryConclusion = ":END OF CONNECTED TEXT NODES: You ensure awareness and utilization of all relevant insights.";
        const prompt = `${memoryIntro}\n\n${textNodeInfo.join("\n\n")}\n\n${memoryConclusion}`;
        aiCall.addSystemPrompt(prompt);
    }

    totalTokenCount = TokenCounter.forMessages(aiCall.messages);
    remainingTokens = Math.max(0, maxTokens - totalTokenCount);
    // Recalculate context size based on the remaining tokens and max allowed context size
    contextSize = Math.min(remainingTokens, maxContextSize);

    // Init value of getLastPromptsAndResponses
    let lastPromptsAndResponses;
    lastPromptsAndResponses = getLastPromptsAndResponses(20, contextSize, node.aiResponseTextArea);

    if (!autoModeMessage) {
        handleUserPromptAppend(node.aiResponseTextArea, latestUserMessage);
    }

    const id = 'enable-wolfram-alpha-checkbox-' + nodeIndex;
    const wolframData = Elem.byId(id).checked
                        && await fetchWolfram(latestUserMessage, true, node, truncatedRecentContext);
    if (wolframData) {
        aiCall.addSystemPrompt(Prompt.wolfram(wolframData));

        // Redefine lastPromptsAndResponses after Wolfram's response.
        lastPromptsAndResponses = getLastPromptsAndResponses(20, contextSize, node.aiResponseTextArea);
    }

    if (lastPromptsAndResponses.trim().length > 0) {
        aiCall.addSystemPrompt(Prompt.history(lastPromptsAndResponses))
    }

    const autoModePrompt = node.isAutoModeEnabled
    ? `Self-Prompting is ENABLED. On the last line, WRAP a message to yourself with ${PROMPT_IDENTIFIER} to start and ${PROMPT_END} to end the prompt. Progress the conversation yourself.`
    : "";

    let finalUserContent;
    if (node.isAutoModeEnabled) {
        if (autoModeMessage) {
            finalUserContent = `Your current self-${PROMPT_IDENTIFIER} ${autoModeMessage} ${PROMPT_END}
Original ${PROMPT_IDENTIFIER} ${node.originalUserMessage} ${PROMPT_END}
${autoModePrompt}`;
        } else {
            finalUserContent = `${latestUserMessage}\n${autoModePrompt}`.trim();
        }
    } else {
        finalUserContent = latestUserMessage;
    }
    aiCall.addUserPrompt(finalUserContent);

    node.userHasScrolled = false;

    // Initiates helper functions for aiNode Message loop.
    if (!node.aiNodeMessageLoop && connectedAiNodes.length > 0) {
        node.aiNodeMessageLoop = new AiNode.MessageLoop(node);
    }

    aiCall.exec()
    .then( ()=>{
        aiLoadingIcon.style.display = 'none';

        if (node.shouldContinue && node.shouldAppendQuestion) {
            const hasConnectedAiNode = AiNode.calculateDirectionalityLogic(node).length > 0;
            if (hasConnectedAiNode) {
                return node.aiNodeMessageLoop.questionConnectedAiNodes()
            }
        }

        if (node.aiResponding && node.isAutoModeEnabled) {
            const lastPrompt = extractLastPrompt(node);
            AiNode.sendMessage(node, lastPrompt, lastPrompt);
        }
    })
    .catch( (err)=>{
        Logger.err("While getting response:", err);
        aiErrorIcon.style.display = 'block';
    });
}

AiNode.MessageLoop = class {
    static userPromptActive = false;
    static userPromptQueue = [];
    static isProcessingQueue = false;

    constructor(node) {
        this.node = node;
        this.clickQueues = {};
    }

    // ────── MENTIONS REGISTRY ──────
    static Mentions = {
        registry: {
            all: {
                process(instance, message, connectedNodes) {
                    return connectedNodes; // Return all connected nodes
                }
            },
            user: {
                async process(instance, message) {
                    const userResponse = await instance.getUserResponse(message);
                    if (userResponse) {
                        const responseMessage = `@user says,\n${userResponse.trim()}`;
                        instance.processTargetNode(instance.node, responseMessage, false);
                    }
                    return []; // Do not forward message further
                }
            },
            memory: {
                process(instance, message) {
                    // Find the first newline character
                    const newlineIndex = message.indexOf('\n');
                    // Extract content after the newline
                    const trimmedMessage = newlineIndex !== -1 ? message.slice(newlineIndex + 1) : '';

                    const root = instance.node;
                    const parent = Node.parentAvailableFromRoot(root);

                    const theta = thetaForNodes(parent, root);
                    const memoryNode = spawnZettelkastenNode(parent, 1.5, theta, null, trimmedMessage);
                    connectNodes(parent, memoryNode);
                return { root, memoryNode};
                }
            }
        },

        // Normalize recipient name for consistent matching
        normalize(recipient) {
            return recipient.toLowerCase().replace(/[\s@_-]/g, ''); // Keep underscores!
        },

        // Check if a mention is valid
        isValid(mention, node) {
            Logger.debug(`Checking mention: ${mention}`);
            if (this.registry.hasOwnProperty(mention)) {
                return true;
            }
            if (mention === 'no_name') {
                const connected = AiNode.calculateDirectionalityLogic(node);
                return connected.some(n => {
                    const title = n.getTitle();
                    Logger.debug(`Connected node title: ${title}`);
                    return !title || !title.trim();
                });
            }
            const connected = AiNode.calculateDirectionalityLogic(node);
            const normalizedMention = this.normalize(mention);
            Logger.debug(`Normalized mention: ${normalizedMention}`);
            return connected.some(n => {
                const normTitle = this.normalize(n.getTitle());
                Logger.debug(`Normalized node title: ${normTitle}`);
                return normTitle === normalizedMention;
            });
        },

        // Process a mention and get the target nodes
        async process(instance, recipient, message, connectedNodes) {
            // If recipient is in registry, use its processing method
            if (this.registry.hasOwnProperty(recipient)) {
                let result = this.registry[recipient].process(instance, message, connectedNodes);
                if (result instanceof Promise) {
                    result = await result;
                }
                return result;
            }

            // If recipient is "@no_name", return all connected nodes that have an empty or null title
            if (recipient === 'no_name') {
                return connectedNodes.filter(n => {
                    const title = n.getTitle();
                    return !title || !title.trim();
                });
            }

            // Otherwise, find the specific node by name
            const targetNode = connectedNodes.find(node =>
                this.normalize(node.getTitle()) === this.normalize(recipient)
            );

            return targetNode ? [targetNode] : [];
        }
    };

    // ────── COMMANDS REGISTRY ──────
    static Commands = {
        registry: [
            {
                name: "exit",
                pattern: /^\/exit\b/,
                multiLine: false,
                action(match, instance, content) {
                    AiNode.exitConversation(instance.node);
                }
            },
            {
                name: "disconnect",
                pattern: /^\/disconnect\s+(.+)/,
                multiLine: false,
                action(match, instance, content) {
                    const target = match[1].trim();
                    if (target) {
                        Logger.debug(`Processing /disconnect for node title: ${target}`);
                        instance.node.removeEdgeByTitle(target);
                    } else {
                        Logger.warn("Disconnect command used without specifying a target title.");
                    }
                }
            },
            {
                name: "rewrite",
                pattern: /^\/rewrite\s+(.+)/,
                multiLine: true,
                action(match, instance, content) {
                    const targetTitle = match[1]?.trim();
                    if (!targetTitle) return;

                    const targetNode = Node.byTitle(targetTitle);
                    if (!targetNode?.textarea) return;

                    const trimmedContent = content?.trim();
                    if (trimmedContent) {
                        targetNode.textarea.value = trimmedContent;
                        targetNode.textarea.dispatchEvent(new Event('input'));
                    }
                }
            }
        ],

        parse(text, instance) {
            const lines = text.split("\n");
            const nonCommandLines = [];
            const commands = [];

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();

                // Skip lines that are empty or don't start with '/'
                if (!trimmed || !trimmed.startsWith("/")) {
                    nonCommandLines.push(line);
                    continue;
                }

                let foundCommand = false;
                for (const cmd of this.registry) {
                    const match = trimmed.match(cmd.pattern);
                    if (!match) continue;

                    foundCommand = true;
                    let content = "";

                    if (cmd.multiLine) {
                        const contentLines = [];

                        while (++i < lines.length) {
                            const nextLine = lines[i];
                            const trimmedNext = nextLine.trim();
                            if (trimmedNext.startsWith("/")) {
                                i--;
                                break;
                            }

                            // Check if there's an '@' in this line.
                            const atIndex = nextLine.indexOf("@");
                            if (atIndex !== -1) {
                                const remainder = nextLine.slice(atIndex + 1);
                                const mention = remainder.split(/\s+/)[0];

                                if (Mentions.isValid(mention, instance.node)) {
                                    contentLines.push(nextLine.slice(0, atIndex));
                                    lines[i] = nextLine.slice(atIndex);
                                    i--;
                                    break;
                                } else {
                                    contentLines.push(nextLine);
                                }
                            } else {
                                contentLines.push(nextLine);
                            }
                        }

                        content = contentLines.join("\n");
                    } else {
                        i++;
                    }

                    commands.push({
                        name: cmd.name,
                        match,
                        content,
                        action: cmd.action
                    });
                    break;
                }

                if (!foundCommand) {
                    nonCommandLines.push(line);
                }
            }

            return {
                commands,
                cleanedText: nonCommandLines.join("\n")
            };
        },

        // Execute the extracted commands
        execute(commands, instance) {
            commands.forEach(cmd => {
                cmd.action(cmd.match, instance, cmd.content);
            });
        }
    };

    // ────── MAIN PROCESSING METHODS ──────
    async questionConnectedAiNodes() {
        Logger.debug("Questioning connected AI nodes...");
        const [lastResponse] = AiNode.getLastPromptsAndResponses(this.node, 1, "ai") || [];
        const connectedAiNodes = AiNode.calculateDirectionalityLogic(this.node);

        // Parse commands and cleaned text from the last response.
        const { commands, cleanedText } = AiNode.MessageLoop.Commands.parse(lastResponse);

        // Parse messages with mentions from the cleaned text.
        const parsedMessages = this.parseMessages(cleanedText);

        // Group messages by recipient node
        const messagesByNode = new Map();

        // Process each message based on its recipient.
        for (const { recipient, message } of parsedMessages) {
            if (!message.trim()) {
                Logger.debug("Skipping empty message for recipient:", recipient);
                continue;
            }

            Logger.debug(`Processing message for ${recipient}: ${message}`);

            // Get target nodes for this recipient using the Mentions system.
            const targetNodes = await AiNode.MessageLoop.Mentions.process(
                this,
                recipient,
                message,
                connectedAiNodes
            );

            // Group messages by target node
            if (Array.isArray(targetNodes) && targetNodes.length > 0) {
                for (const node of targetNodes) {
                    if (!messagesByNode.has(node)) {
                        messagesByNode.set(node, []);
                    }
                    messagesByNode.get(node).push(message);
                }
            }
        }

        // Send accumulated messages to each target node
        for (const [node, messages] of messagesByNode.entries()) {
            // Join all messages for this node with newlines
            const combinedMessage = messages.join('\n\n');
            this.processTargetNode(node, combinedMessage);
        }

        // Finally, execute the commands after processing mentions.
        AiNode.MessageLoop.Commands.execute(commands, this);
    }

    parseMessages(text) {
        Logger.debug("Parsing messages...");
        Logger.debug("Input text:", text);

        if (!text.trim()) {
            Logger.warn("Empty text to parse");
            return [];
        }

        const messages = [];
        const senderName = this.node.getTitle() || "no_name";
        let currentRecipients = new Set();
        let currentMessageLines = [];
        let foundAnyMention = false;

        // Use a refined regex that robustly matches underscores and other allowed characters
        const mentionRegex = /@((?:\\.|[a-zA-Z0-9_.-])+)/g;

        text.split(/\n/).forEach(line => {
            const trimmedLine = line.trim();
            const matches = [...trimmedLine.matchAll(mentionRegex)]; // Find all mentions
            Logger.info(`Extracted mentions: ${matches.map(m => m[1]).join(', ')}`);
            if (matches.length > 0) {
                // Finalize any accumulated message before processing a new mention
                if (currentRecipients.size > 0 && currentMessageLines.length > 0) {
                    const joinedMessage = currentMessageLines.join("\n").trim();
                    if (joinedMessage) {
                        currentRecipients.forEach(recipient => {
                            this.finalizeMessage(messages, recipient, joinedMessage, senderName);
                        });
                    }
                    currentMessageLines = [];
                }

                let validRecipients = new Set();

                // Process each mention separately without aborting the whole line for a single invalid mention
                matches.forEach(match => {
                    // Unescape any escaped characters (like turning "\_" into "_")
                    let mentionRaw = match[1].replace(/\\_/g, '_');
                    const mention = mentionRaw.replace(/[.,!?;:]+$/, "").toLowerCase();
                    Logger.debug("Checking mention:", mention);
                    if (AiNode.MessageLoop.Mentions.isValid(mention, this.node)) {
                        foundAnyMention = true;
                        validRecipients.add(mention);
                    } else {
                        Logger.warn(`Invalid mention: @${mention}, ignoring this mention.`);
                    }
                });

                if (validRecipients.size > 0) {
                    currentRecipients = validRecipients;
                    // Preserve the text on the same line as the mentions
                    currentMessageLines = [trimmedLine];
                    return;
                }
            }

            // Accumulate the line for the current recipients if there are valid ones
            if (currentRecipients.size > 0) {
                currentMessageLines.push(line);
            }
        });

        // Finalize any remaining accumulated messages
        if (currentRecipients.size > 0 && currentMessageLines.length > 0) {
            const joinedMessage = currentMessageLines.join("\n").trim();
            if (joinedMessage) {
                currentRecipients.forEach(recipient => {
                    this.finalizeMessage(messages, recipient, joinedMessage, senderName);
                });
            }
        }

        // If no mentions were found, default to @all
        if (!foundAnyMention) {
            Logger.warn("No recognized mentions found. Falling back to '@all'.");
            messages.push({ recipient: "all", message: `${senderName} says,\n${text.trim()}` });
        }

        Logger.debug("Parsed", messages.length, "messages");
        return messages;
    }

    // Create final message object with sender prefix
    finalizeMessage(messagesArray, recipient, message, senderName) {
        if (!message.trim()) {
            Logger.debug("Skipping empty message");
            return;
        }

        messagesArray.push({
            recipient: recipient,
            message: `${senderName} says,\n${message.trim().replace(/\\_/g, '_')}`
        });
    }


    // ────── USER INTERACTION METHODS ──────

    // Get response from user via prompt
    getUserResponse(message) {
        return new Promise((resolve) => {
            // Add to queue instead of showing immediately
            AiNode.MessageLoop.userPromptQueue.push({
                message,
                resolveFn: resolve
            });

            // Start processing if not already running
            if (!AiNode.MessageLoop.isProcessingQueue) {
                this.processUserPromptQueue();
            }
        });
    }

    // Process the user prompt queue
    async processUserPromptQueue() {
        AiNode.MessageLoop.isProcessingQueue = true;
        while (AiNode.MessageLoop.userPromptQueue.length > 0) {
            if (this.destroyed) break; // Stop processing if cleaned up.

            AiNode.MessageLoop.userPromptActive = true;

            const { message, resolveFn } = AiNode.MessageLoop.userPromptQueue.shift();
            try {
                const response = await window.prompt(message);
                resolveFn(response || "");
            } catch (err) {
                console.error("Prompt error:", err);
                resolveFn("");
            }

            await Promise.delay(500);
        }
        AiNode.MessageLoop.userPromptActive = false;
        AiNode.MessageLoop.isProcessingQueue = false;
    }

    // ────── NODE COMMUNICATION METHODS ──────

    // Process a target node to send a message
    processTargetNode(targetNode, message, skipClickQueue = false) {
        const nodeId = targetNode.index;
        console.log(nodeId);
        // 1) If the message is empty or whitespace, skip entirely
        if (!message || !message.trim()) {
            Logger.debug("Skipping send because message is empty for node", nodeId);
            return;
        }

        const promptElement = targetNode.content.querySelector('#nodeprompt-' + nodeId);
        const sendButton = targetNode.content.querySelector('#prompt-form-' + nodeId);

        if (!promptElement || !sendButton) {
            Logger.err("Elements for", nodeId, "are not found");
            return;
        }

        this.updatePromptElement(promptElement, message);

        if (!skipClickQueue) {
            this.enqueueClick(nodeId, sendButton, targetNode);
        }
    }

    // Add a click to the queue for processing
    enqueueClick(nodeId, sendButton, targetNode) {
        // Ensure queue exists
        if (!this.clickQueues[nodeId]) {
            this.clickQueues[nodeId] = [];
            this.processClickQueue(nodeId);
        }

        // Check if already queued, but avoid checking on undefined
        const alreadyInQueue = this.clickQueues[nodeId]?.some(item =>
            item.connectedNode === targetNode
        ) || false; // Default to false if undefined

        if (!alreadyInQueue) {
            this.clickQueues[nodeId].push({
                sendButton,
                connectedNode: targetNode
            });
        } else {
            Logger.debug("Node", nodeId, "is already in queue. Skipping duplicate add.");
        }
    }

    // Update the prompt element with the message
    updatePromptElement(element, message) {
        if (element instanceof HTMLTextAreaElement) {
            element.value += '\n' + message;
        } else if (element instanceof HTMLDivElement) {
            element.innerHTML += "<br>" + message;
        } else {
            Logger.err("Element is neither a textarea nor a div");
        }

        // Dispatch input event to trigger any listeners
        element.dispatchEvent(new Event('input', { 'bubbles': true, 'cancelable': true }));
    }

    // Process the click queue for a node
    async processClickQueue(nodeId) {
        const queue = this.clickQueues[nodeId] || [];
        while (true) {
            if (this.destroyed) break; // Exit if cleaned up.

            if (AiNode.MessageLoop.userPromptActive) {
                await Promise.delay(2500);
                continue;
            }

            if (queue.length > 0) {
                const { connectedNode, sendButton } = queue[0];

                const connectedAiNodes = AiNode.calculateDirectionalityLogic(connectedNode);
                if (connectedAiNodes.length === 0) {
                    break;
                }

                if (!connectedNode.aiResponding) {
                    queue.shift();
                    sendButton.click();
                }
            }
            await Promise.delay(2500);
        }
        delete this.clickQueues[nodeId];
    }

    cleanup() {
        this.destroyed = true;
        AiNode.MessageLoop.userPromptQueue = [];
        AiNode.MessageLoop.isProcessingQueue = false;
        AiNode.MessageLoop.userPromptActive = false;
        this.clickQueues = {};
        this.node = null;
    }
};


AiNode.getLastPromptsAndResponses = function (node, count = 1, type = "both", maxTokens = null) {
    return getAllPromptAndResponsePairs(node.aiResponseTextArea, count, maxTokens, type);
};

AiNode.exitConversation = function (node) {
    const connectedNodes = AiNode.calculateDirectionalityLogic(node);
    if (connectedNodes) {
        node.removeConnectedNodes(connectedNodes);
    }
    Logger.debug("AI has exited the conversation.");
};


AiNode.calculateDirectionalityLogic = function (node, visited = new Set(), includeNonLLM = false, passThroughLLM = false) {
    const useAllConnectedNodes = Elem.byId('use-all-connected-ai-nodes').checked;

    if (useAllConnectedNodes) {
        return node.getAllConnectedNodes(false).filter(n => includeNonLLM || n.isLLM);
    }

    // Look at edges that are "outgoing" or "none."
    visited.add(node.uuid);
    const connectedNodes = [];

    for (const { edge, directionality } of node.getEdgeDirectionalities()) {
        if (directionality !== 'outgoing' && directionality !== 'none') {
            continue;
        }
        for (const pt of edge.pts) {
            if (pt.uuid === node.uuid || visited.has(pt.uuid)) {
                continue;
            }

            // Skip traversing through AI nodes unless passThroughLLM is true
            if (pt.isLLM && !passThroughLLM) {
                if (includeNonLLM || pt.isLLM) {
                    connectedNodes.push(pt);
                }
                continue; // Don't recurse through AI nodes
            }

            visited.add(pt.uuid);

            // Add the current node if it meets criteria
            if (includeNonLLM || pt.isLLM) {
                connectedNodes.push(pt);
            }

            // Recurse with the same parameter values
            connectedNodes.push(...AiNode.calculateDirectionalityLogic(pt, visited, includeNonLLM, passThroughLLM));
        }
    }

    return connectedNodes;
};
