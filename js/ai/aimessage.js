Elem.byId('auto-mode-checkbox').addEventListener('change', function () {
    if (this.checked) Ai.isFirstAutoModeMessage = true;
});

async function sendMessage(event, autoModeMessage = null) {
    const activeInstance = getActiveZetCMInstanceInfo();
    const noteInput = activeInstance.textarea;
    const myCodeMirror = activeInstance.cm;

    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const promptElement = Elem.byId('prompt');
    const promptValue = promptElement.value;
    promptElement.value = ''; // Clear the textarea
    const promptEvent = new Event('input', {
        'bubbles': true,
        'cancelable': true
    });

    promptElement.dispatchEvent(promptEvent);

    const message = autoModeMessage ? autoModeMessage : promptValue;
    Ai.latestUserMessage = message;

    const isAutoModeEnabled = Elem.byId('auto-mode-checkbox').checked;

    if (isAutoModeEnabled && Ai.originalUserMessage === null) {
        Ai.originalUserMessage = message;
    }

    // Check if the last character in the note-input is not a newline, and add one if needed
    if (noteInput.value.length > 0 && noteInput.value[noteInput.value.length - 1] !== '\n') {
        myCodeMirror.replaceRange('\n', CodeMirror.Pos(myCodeMirror.lastLine()));
    }

    // Call generateKeywords function to get keywords
    const count = 3; // Set the number of desired keywords
    const keywordsArray = await generateKeywords(message, count);

    // Join the keywords array into a single string when needed for operations that require a string
    const keywordsString = keywordsArray.join(' ');

    // Use the first keyword from the array for specific lookups
    const firstKeyword = keywordsArray[0];

    let wikipediaSummaries;
    let wikipediaMessage;

    if (Wikipedia.isEnabled()) {
        // Fetch Wikipedia summaries using the first keyword
        wikipediaSummaries = await Wikipedia.getSummaries([firstKeyword]);

        // Format the Wikipedia summaries output
        wikipediaMessage = {
            role: "system",
            content: `Wikipedia Summaries (Keywords: ${keywordsString}): \n ${Array.isArray(wikipediaSummaries)
                ? wikipediaSummaries
                    .filter(s => s !== undefined && s.title !== undefined && s.summary !== undefined)
                    .map(s => `${s.title} (Relevance Score: ${s.relevanceScore.toFixed(2)}): ${s.summary}`)
                    .join("\n\n")
                : "Wiki Disabled"
                } END OF SUMMARIES`
        };
    }

    let searchQuery = null;
    let filteredKeys = null;

    if (isGoogleSearchEnabled() || (filteredKeys = await isEmbedEnabled())) {
        try {
            searchQuery = await constructSearchQuery(message);
        } catch (err) {
            Logger.err("Error constructing search query:", err);
            searchQuery = null;
        }
    }

    let searchResultsData = null;
    let searchResults = [];
    let searchResultsContent;
    let googleSearchMessage;

    if (isGoogleSearchEnabled()) {
        searchResultsData = await performSearch(searchQuery);

        if (searchResultsData) {
            searchResults = processSearchResults(searchResultsData);
            await displayResultsRelevantToMessage(searchResults, message);
        }
        searchResultsContent = searchResults.map((result, index) => {
            return `Search Result ${index + 1}: ${result.title} - ${result.description.substring(0, 100)}...\n[Link: ${result.link}]\n`;
        }).join('\n');

        googleSearchMessage = {
            role: "system",
            content: "Google Search RESULTS displayed to the user:<searchresults>" + searchResultsContent + "</searchresults> CITE your sources! Always REMEMBER to follow the <format> message",
        };
    }

    // Start the message
    let messages = [
        {
            role: "system",
            content: `${zettelkastenPrompt()}`,
        },
    ];

    if (Elem.byId('instructions-checkbox').checked) messages.push(instructionsMessage());
    if (Elem.byId('code-checkbox').checked) messages.push(codeMessage());
    if (Elem.byId('wiki-checkbox').checked) messages.push(wikipediaMessage);
    if (Elem.byId('google-search-checkbox').checked) messages.push(googleSearchMessage);
    if (Elem.byId('ai-nodes-checkbox').checked) messages.push(aiNodesMessage());

    if (searchQuery != null && filteredKeys) {
        // Obtain relevant keys based on the user message
        const relevantKeys = await Keys.getRelevant(message, null, searchQuery, filteredKeys);

        // Get relevant chunks based on the relevant keys
        const relevantChunks = await getRelevantChunks(searchQuery, topN, relevantKeys);
        const topNChunksContent = groupAndSortChunks(relevantChunks, MAX_CHUNK_SIZE);

        // Construct the embed message
        const embedMessage = {
            role: "system",
            content: `Top ${topN} MATCHED snippets of TEXT from extracted WEBPAGES:\n <topNchunks>` + topNChunksContent + `</topNchunks>\n> Provide EXACT INFORMATION from the given snippets! Use [Snippet n](source) to display references to exact snippets. Make exclusive use of the provided snippets.`
        };

        messages.push(embedMessage);
    }

    // calculate remaining tokens
    const maxTokens = Elem.byId('max-tokens-slider').value;
    const remainingTokens = Math.max(0, maxTokens - TokenCounter.forMessages(messages));
    const maxContextSize = Elem.byId('max-context-size-slider').value;
    const contextSize = Math.min(remainingTokens, maxContextSize);

// Get the context
    context = getLastPromptsAndResponses(100, contextSize);
    let topMatchedNodesContent = '';

    const existingTitles = extractTitlesFromContent(context);
    Logger.debug(`existingTitles`, existingTitles, context);
    // Replace the original search and highlight code with neuriteSearchNotes
    const topMatchedNodes = await neuriteSearchNotes(keywordsString);

    let titlesToForget = new Set();

    const nodeTag = Tag.node;
    const nodeContents = filterAndProcessNodesByExistingTitles(topMatchedNodes, existingTitles, titlesToForget, nodeTag);
    Logger.debug(nodeContents);
    topMatchedNodesContent = nodeContents.join("\n\n");

    // If forgetting is enabled, extract titles to forget
    if (Elem.byId('forget-checkbox').checked) {

        titlesToForget = await forget(message, `${context}\n\n${topMatchedNodesContent}`);

        Logger.info("Titles to Forget:", titlesToForget);

        // Use helper function to forget nodes from context
        context = removeTitlesFromContext(context, titlesToForget, nodeTag);

        // Refilter topMatchedNodesContent by removing titles to forget
        topMatchedNodesContent = filterAndProcessNodesByExistingTitles(topMatchedNodes, existingTitles, titlesToForget, nodeTag).join("\n\n");
        Logger.debug("Refiltered Top Matched Nodes Content:", topMatchedNodesContent);
    }

    // Check if the content string is not empty
    if (typeof topMatchedNodesContent === "string" && topMatchedNodesContent.trim() !== '') {
        if (!Elem.byId('instructions-checkbox').checked) {
            messages.splice(1, 0, {
                role: "system",
                content: `Semantically RELEVANT NOTES retrieved. BRANCH UNIQUE notes OFF OF the following ALREADY EXISTING nodes.:\n<topmatchednodes>${topMatchedNodesContent}</topmatchednodes>SYNTHESIZE missing, novel, and connected KNOWLEDGE from the given topmatchednodes.`,
            });
        }
    }

    if (context.trim() !== '') {
        // Add the recent dialogue message only if the context is not empty
        messages.splice(2, 0, {
            role: "system",
            content: `CONVERSATION HISTORY: <context>${context}</context>`,
        });
    }

    // Add Prompt
    if (autoModeMessage) {
        messages.push({
            role: "user",
            content: `Your current self-${PROMPT_IDENTIFIER} ${autoModeMessage} :
Original ${PROMPT_IDENTIFIER} ${Ai.originalUserMessage}
Self-Prompting is ENABLED, on the LAST line, end your response with ${PROMPT_IDENTIFIER} Message distinct from your current self-${PROMPT_IDENTIFIER} and original ${PROMPT_IDENTIFIER} to continue the flow of ideas (Consider if the original ${PROMPT_IDENTIFIER} has been ACCOMPLISHED while also branching into NOVEL INSIGHTS and UNIQUE TOPICS)]`,
        });
    } else {
        messages.push({
            role: "user",
            content: `${message} ${isAutoModeEnabled ? `Self-Prompting is ENABLED, on the last line, END your response with ${PROMPT_IDENTIFIER} message to continue the FLOW of ideas` : ''}`,
        });
    }

    let lineBeforeAppend = myCodeMirror.lastLine();

    // Add the user prompt and a newline only if it's the first message in auto mode or not in auto mode
    if (!autoModeMessage || (Ai.isFirstAutoModeMessage && autoModeMessage)) {
        handleUserPromptAppendCodeMirror(myCodeMirror, message, PROMPT_IDENTIFIER);
        myCodeMirror.replaceRange(`\n`, CodeMirror.Pos(myCodeMirror.lastLine()));
        Ai.isFirstAutoModeMessage = false;
    } else if (autoModeMessage) {
        myCodeMirror.replaceRange(`\n`, CodeMirror.Pos(lineBeforeAppend));
    }

    activeInstance.ui.scrollToLine(myCodeMirror, lineBeforeAppend + 2); // Scroll to the new last line
    userScrolledUp = false;

    // Handle Wolfram Loop after appending the prompt.

    let wolframData;

    if (Elem.byId('enable-wolfram-alpha').checked) {
        wolframData = await fetchWolfram(message);
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
    }

    // Main AI call
    await callchatAPI(messages, stream = true);

    // Only continue if shouldContinue flag is true and auto mode checkbox is checked
    if (shouldContinue && Elem.byId('auto-mode-checkbox').checked) {
        const extractedPrompt = extractLastPrompt();
        sendMessage(null, extractedPrompt);
    }

    return false;
}
