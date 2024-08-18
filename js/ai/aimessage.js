let isFirstMessage = true; // Initial value set to true
let originalUserMessage = null;



document.getElementById("auto-mode-checkbox").addEventListener("change", function () {
    if (this.checked) {
        isFirstAutoModeMessage = true;
    }
});


async function sendMessage(event, autoModeMessage = null) {
    const activeInstance = getActiveZetCMInstanceInfo();
    const { ui, parser, cmInstance, textarea, paneId } = activeInstance;
    const noteInput = textarea;
    const myCodeMirror = cmInstance;

    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const promptElement = document.getElementById("prompt");
    const promptValue = promptElement.value;
    promptElement.value = ''; // Clear the textarea
    const promptEvent = new Event('input', {
        'bubbles': true,
        'cancelable': true
    });

    promptElement.dispatchEvent(promptEvent);


    const message = autoModeMessage ? autoModeMessage : promptValue;
    latestUserMessage = message;

    let isAutoModeEnabled = document.getElementById("auto-mode-checkbox").checked;


    if (isAutoModeEnabled && originalUserMessage === null) {
        originalUserMessage = message;
    }


    // Check if the last character in the note-input is not a newline, and add one if needed
    if (noteInput.value.length > 0 && noteInput.value[noteInput.value.length - 1] !== '\n') {
        myCodeMirror.replaceRange("\n", CodeMirror.Pos(myCodeMirror.lastLine()));
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

    if (isWikipediaEnabled()) {
        // Fetch Wikipedia summaries using the first keyword
        wikipediaSummaries = await getWikipediaSummaries([firstKeyword]);

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
        } catch (error) {
            console.error('Error constructing search query:', error);
            searchQuery = null; // Set to null if there's an error
        }
    } else {
        searchQuery = null;
    }

    let searchResultsData = null;
    let searchResults = [];
    let searchResultsContent;
    let googleSearchMessage;

    if (isGoogleSearchEnabled()) {
        searchResultsData = await performSearch(searchQuery);

        if (searchResultsData) {
            searchResults = processSearchResults(searchResultsData);
            searchResults = await getRelevantSearchResults(message, searchResults);


            displaySearchResults(searchResults);
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

    if (document.getElementById("instructions-checkbox").checked) {
        messages.push(instructionsMessage());
    }

    if (document.getElementById("code-checkbox").checked) {
        messages.push(codeMessage());
    }

    if (document.getElementById("wiki-checkbox").checked) {
        messages.push(wikipediaMessage);
    }

    if (document.getElementById("google-search-checkbox").checked) {
        messages.push(googleSearchMessage);
    }

    if (document.getElementById("ai-nodes-checkbox").checked) {
        messages.push(aiNodesMessage());
    }

    if (searchQuery != null && filteredKeys) {
        // Obtain relevant keys based on the user message
        const relevantKeys = await getRelevantKeys(message, null, searchQuery, filteredKeys);

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

    // Calculate total tokens used so far
    let totalTokenCount = getTokenCount(messages);

    // calculate remaining tokens
    const maxTokensSlider = document.getElementById('max-tokens-slider');
    const remainingTokens = Math.max(0, maxTokensSlider.value - totalTokenCount);
    const maxContextSize = document.getElementById('max-context-size-slider').value;
    const contextSize = Math.min(remainingTokens, maxContextSize);

// Get the context
    context = getLastPromptsAndResponses(100, contextSize);
    let topMatchedNodesContent = "";

    // Use the helper function to extract titles
    let existingTitles = extractTitlesFromContent(context);
    //console.log(`existingTitles`, existingTitles, context);
    // Replace the original search and highlight code with neuriteSearchNotes
    const topMatchedNodes = await neuriteSearchNotes(keywordsString);

    let titlesToForget = new Set();

    // Use helper function to get the content
    const nodeContents = filterAndProcessNodesByExistingTitles(topMatchedNodes, existingTitles, titlesToForget, nodeTag);
    //console.log(nodeContents);
    topMatchedNodesContent = nodeContents.join("\n\n");

    // If forgetting is enabled, extract titles to forget
    if (document.getElementById("forget-checkbox").checked) {

        titlesToForget = await forget(message, `${context}\n\n${topMatchedNodesContent}`);

        console.log("Titles to Forget:", titlesToForget);

        // Use helper function to forget nodes from context
        context = removeTitlesFromContext(context, titlesToForget, nodeTag);

        // Refilter topMatchedNodesContent by removing titles to forget
        topMatchedNodesContent = filterAndProcessNodesByExistingTitles(topMatchedNodes, existingTitles, titlesToForget, nodeTag).join("\n\n");
        //console.log("Refiltered Top Matched Nodes Content:", topMatchedNodesContent);
    }

    // Check if the content string is not empty
    if (typeof topMatchedNodesContent === "string" && topMatchedNodesContent.trim() !== "") {
        if (!document.getElementById("instructions-checkbox").checked) {
            messages.splice(1, 0, {
                role: "system",
                content: `Semantically RELEVANT NOTES retrieved. BRANCH UNIQUE notes OFF OF the following ALREADY EXISTING nodes.:\n<topmatchednodes>${topMatchedNodesContent}</topmatchednodes>SYNTHESIZE missing, novel, and connected KNOWLEDGE from the given topmatchednodes.`,
            });
        }
    }

    if (context.trim() !== "") {
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
Original ${PROMPT_IDENTIFIER} ${originalUserMessage}
Self-Prompting is ENABLED, on the LAST line, end your response with ${PROMPT_IDENTIFIER} Message distinct from your current self-${PROMPT_IDENTIFIER} and original ${PROMPT_IDENTIFIER} to continue the flow of ideas (Consider if the original ${PROMPT_IDENTIFIER} has been ACCOMPLISHED while also branching into NOVEL INSIGHTS and UNIQUE TOPICS)]`,
        });
    } else {
        messages.push({
            role: "user",
            content: `${message} ${isAutoModeEnabled ? `Self-Prompting is ENABLED, on the last line, END your response with ${PROMPT_IDENTIFIER} message to continue the FLOW of ideas` : ""}`,
        });
    }

    let lineBeforeAppend = myCodeMirror.lastLine();

    // Add the user prompt and a newline only if it's the first message in auto mode or not in auto mode
    if (!autoModeMessage || (isFirstAutoModeMessage && autoModeMessage)) {
        handleUserPromptAppendCodeMirror(myCodeMirror, message, PROMPT_IDENTIFIER);
        myCodeMirror.replaceRange(`\n`, CodeMirror.Pos(myCodeMirror.lastLine()));
        isFirstAutoModeMessage = false;
    } else if (autoModeMessage) {
        myCodeMirror.replaceRange(`\n`, CodeMirror.Pos(lineBeforeAppend));
    }

    ui.scrollToLine(myCodeMirror, lineBeforeAppend + 2); // Scroll to the new last line
    userScrolledUp = false;

    // Handle Wolfram Loop after appending the prompt.


    let wolframData;

    if (document.getElementById("enable-wolfram-alpha").checked) {
        wolframData = await fetchWolfram(message);
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
    }

    // Main AI call
    await callchatAPI(messages, stream = true);

    isAutoModeEnabled = document.getElementById("auto-mode-checkbox").checked;

    // Only continue if shouldContinue flag is true and auto mode checkbox is checked
    if (shouldContinue && isAutoModeEnabled) {
        const extractedPrompt = extractLastPrompt();
        sendMessage(null, extractedPrompt);
    }

    return false;
}