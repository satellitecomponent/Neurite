Prompt.autoMode = function(begin, end){
    return `Self-Prompting is ENABLED. On the last line, WRAP a message to yourself with ${begin} to begin and ${end} to end the prompt. Progress the conversation yourself.`
}
Prompt.googleSearch = function(content){
    return `Google Search RESULTS displayed to the user:<searchresults>${content}</searchresults> CITE your sources! Always REMEMBER to follow the <format> message`
}
Prompt.history = function(context){
    return `CONVERSATION HISTORY: <context>${context}</context>`
}
Prompt.markdownIdentity = function(aiId){
    return "You are " + aiId + ". Conversation renders via markdown."
}
Prompt.matchedNodes = function(content){
    return `Semantically RELEVANT NOTES retrieved. BRANCH UNIQUE notes OFF OF the following ALREADY EXISTING nodes.:\n<topmatchednodes>${content}</topmatchednodes>SYNTHESIZE missing, novel, and connected KNOWLEDGE from the given topmatchednodes.`
}
Prompt.searchQuery = async function(message, searchQuery, filteredKeys, topN, recentContext, node, allConnectedNodesData){
    if (!searchQuery || !filteredKeys) return;

    const relevantKeys = await (!node) ? Keys.getRelevant(message, recentContext, searchQuery, filteredKeys)
                             : Keys.getRelevantNodeLinks(
                                    allConnectedNodesData,
                                    message,
                                    searchQuery,
                                    filteredKeys,
                                    recentContext
                               );
    if (relevantKeys.length < 1) return;

    const relevantChunks = await getRelevantChunks(searchQuery, topN, relevantKeys);
    if (node) node.currentTopNChunks = relevantChunks;
    const topNChunks = groupAndSortChunks(relevantChunks, MAX_CHUNK_SIZE);
    return `Top ${topN} MATCHED snippets of TEXT from extracted WEBPAGES:\n <topNchunks>${topNChunks}</topNchunks>\n> Provide EXACT INFORMATION from the given snippets! Use [Snippet n](source) to display references to exact snippets. Make exclusive use of the provided snippets.`
}
Prompt.wikipedia = function(keywords, summaries){
    return `Wikipedia Summaries (Keywords: ${keywords}): \n ${summaries} END OF SUMMARIES`
}
Prompt.wolfram = function(data){
    createWolframNode(data);
    const textResult = data.wolframAlphaTextResult;
    Logger.info("wolframAlphaTextResult:", textResult);
    return "The Wolfram result has ALREADY been returned based off the current user message. INSTEAD of generating a new query, USE the following Wolfram result as CONTEXT: " + textResult;
}

async function sendMessage(event, autoModeMessage) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const activeInstance = getActiveZetCMInstanceInfo();
    const noteInput = activeInstance.textarea;
    const cm = activeInstance.cm;

    const promptElement = Elem.byId('prompt');
    const promptValue = promptElement.value;
    promptElement.value = ''; // Clear the textarea
    const promptEvent = new Event('input', {
        'bubbles': true,
        'cancelable': true
    });
    promptElement.dispatchEvent(promptEvent);

    const message = Ai.latestUserMessage = autoModeMessage || promptValue;

    Ai.isAutoModeEnabled = Elem.byId('auto-mode-checkbox').checked;
    if (Ai.isAutoModeEnabled && Ai.originalUserMessage === null) {
        Ai.originalUserMessage = message;
    }

    // Check if the last character in the note-input is not a newline, and add one if needed
    if (noteInput.value.length > 0 && noteInput.value[noteInput.value.length - 1] !== '\n') {
        cm.replaceRange('\n', CodeMirror.Pos(cm.lastLine()));
    }

    const arrKeywords = await generateKeywords(message, 3); // number of desired keywords
    const strKeywords = arrKeywords.join(' ');

    let wikipediaPrompt;
    if (Wikipedia.isEnabled()) {
        const summaries = await Wikipedia.getSummaries([arrKeywords[0]]);
        wikipediaPrompt = Prompt.wikipedia(strKeywords, summaries);
    }

    let searchQuery = null;
    let filteredKeys = null;

    if (isGoogleSearchEnabled() || (filteredKeys = await isEmbedEnabled())) {
        try {
            searchQuery = await constructSearchQuery(message);
        } catch (err) {
            Logger.err("In constructing search query:", err);
        }
    }

    let googleSearchPrompt;
    if (isGoogleSearchEnabled()) {
        const content = handleNaturalLanguageSearch(searchQuery, message);
        googleSearchPrompt = Prompt.googleSearch(content);
    }

    const aiCall = AiCall.stream().addSystemPrompt(Prompt.zettelkasten());
    if (Elem.byId('instructions-checkbox').checked) {
        aiCall.addSystemPrompt(Prompt.instructions())
    }
    if (Elem.byId('code-checkbox').checked) {
        aiCall.addSystemPrompt(Prompt.code())
    }
    if (wikipediaPrompt) aiCall.addSystemPrompt(wikipediaPrompt);
    if (googleSearchPrompt) aiCall.addSystemPrompt(googleSearchPrompt);
    if (Elem.byId('ai-nodes-checkbox').checked) {
        aiCall.addSystemPrompt(Prompt.aiNodes())
    }

    const searchQueryPrompt = await Prompt.searchQuery(message, searchQuery, filteredKeys, topN);
    if (searchQueryPrompt) aiCall.addSystemPrompt(searchQueryPrompt);

    // calculate remaining tokens
    const maxTokens = Elem.byId('max-tokens-slider').value;
    const remainingTokens = Math.max(0, maxTokens - TokenCounter.forMessages(aiCall.messages));
    const maxContextSize = Elem.byId('max-context-size-slider').value;
    const contextSize = Math.min(remainingTokens, maxContextSize);

    let context = getLastPromptsAndResponses(100, contextSize);

    const existingTitles = extractTitlesFromContent(context);
    Logger.debug(`existingTitles`, existingTitles, context);

    // Replace the original search and highlight code with neuriteSearchNotes
    const topMatchedNodes = await neuriteSearchNotes(strKeywords);
    const nodeContents = filterAndProcessNodesByExistingTitles(topMatchedNodes, existingTitles);
    Logger.debug(nodeContents);

    let topMatchedNodesContent = nodeContents.join("\n\n");

    // If forgetting is enabled, extract titles to forget
    if (Elem.byId('forget-checkbox').checked) {
        const titlesToForget = await forget(message, `${context}\n\n${topMatchedNodesContent}`);
        Logger.info("Titles to Forget:", titlesToForget);

        context = removeTitlesFromContext(context, titlesToForget);

        topMatchedNodesContent = filterAndProcessNodesByExistingTitles(topMatchedNodes, existingTitles, titlesToForget).join("\n\n");
        Logger.debug("Refiltered Top Matched Nodes Content:", topMatchedNodesContent);
    }

    if (topMatchedNodesContent.trim() !== '' && !Elem.byId('instructions-checkbox').checked) {
        const prompt = Prompt.matchedNodes(topMatchedNodesContent);
        aiCall.messages.splice(1, 0, Message.system(prompt));
    }

    if (context.trim() !== '') {
        aiCall.messages.splice(2, 0, Message.system(Prompt.history(context)))
    }

    const autoModePrompt = (!Ai.isAutoModeEnabled) ? ''
                         : Prompt.autoMode(PROMPT_IDENTIFIER, PROMPT_END);

    const prompt = (!autoModeMessage) ? `${message}\n${autoModePrompt}`.trim()
                 : `Your current self-${PROMPT_IDENTIFIER} ${autoModeMessage} ${PROMPT_END}
    Original ${PROMPT_IDENTIFIER} ${Ai.originalUserMessage} ${PROMPT_END}
    ${autoModePrompt}`;
    aiCall.addUserPrompt(prompt);

    const lineBeforeAppend = cm.lastLine();

    if (!autoModeMessage) {
        handleUserPromptAppendCodeMirror(cm, message, PROMPT_IDENTIFIER);
    } else if (autoModeMessage) {
        cm.replaceRange(`\n`, CodeMirror.Pos(lineBeforeAppend));
    }

    activeInstance.ui.scrollToLine(cm, lineBeforeAppend + 2); // Scroll to the new last line
    userScrolledUp = false;

    // Handle Wolfram Loop after appending the prompt.

    const wolframData = (!Elem.byId('enable-wolfram-alpha').checked) ? ''
                      : await fetchWolfram(message);
    if (wolframData) aiCall.addSystemPrompt(Prompt.wolfram(wolframData));

    await aiCall.exec();

    if (Ai.isResponding && Elem.byId('auto-mode-checkbox').checked) {
        sendMessage(null, extractLastPrompt())
    }
}
