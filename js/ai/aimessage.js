let isFirstMessage = true; // Initial value set to true
let originalUserMessage = null;



document.getElementById("auto-mode-checkbox").addEventListener("change", function () {
    if (this.checked) {
        isFirstAutoModeMessage = true;
    }
});


async function sendMessage(event, autoModeMessage = null) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    // Check if the message is a URL and if it is, only execute constructSearchQuery and nothing else
    const message = autoModeMessage ? autoModeMessage : document.getElementById("prompt").value;
    if (isUrl(message)) {
        constructSearchQuery(message);
        return; // This will stop the function execution here
    }

    let isAutoModeEnabled = document.getElementById("auto-mode-checkbox").checked;

    promptElement = document.getElementById("prompt");
    promptElement.value = ''; // Clear the textarea
    latestUserMessage = message;
    const promptEvent = new Event('input', {
        'bubbles': true,
        'cancelable': true
    });

    promptElement.dispatchEvent(promptEvent);


    if (isAutoModeEnabled && originalUserMessage === null) {
        originalUserMessage = message;
    }

    const noteInput = document.getElementById("note-input");


    // Check if the last character in the note-input is not a newline, and add one if needed
    if (noteInput.value.length > 0 && noteInput.value[noteInput.value.length - 1] !== '\n') {
        myCodeMirror.replaceRange("\n", CodeMirror.Pos(myCodeMirror.lastLine()));
    }

    // Convert nodes object to an array of nodes
    const nodesArray = Object.values(nodes);

    let keywordsArray = [];
    let keywords = '';

    // Call generateKeywords function to get keywords
    const count = 3; // Change the count value as needed
    keywordsArray = await generateKeywords(message, count);

    // Join the keywords array into a single string
    keywords = keywordsArray.join(' ');



    const keywordString = keywords.replace("Keywords: ", "");
    const splitKeywords = keywordString.split(',').map(k => k.trim());
    const firstKeyword = splitKeywords[0];
    // Convert the keywords string into an array by splitting on spaces

    let wikipediaSummaries;

    if (isWikipediaEnabled()) {
        wikipediaSummaries = await getWikipediaSummaries([firstKeyword]);
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

    // In your main function, check if searchQuery is null before proceeding with the Google search
    const searchQuery = await constructSearchQuery(message);

    let searchResultsData = null;
    let searchResults = [];

    if (isGoogleSearchEnabled()) {
        searchResultsData = await performSearch(searchQuery);
    }

    if (searchResultsData) {
        searchResults = processSearchResults(searchResultsData);
        searchResults = await getRelevantSearchResults(message, searchResults);


        displaySearchResults(searchResults);
    }

    const searchResultsContent = searchResults.map((result, index) => {
        return `Search Result ${index + 1}: ${result.title} - ${result.description.substring(0, 100)}...\n[Link: ${result.link}]\n`;
    }).join('\n');

    const googleSearchMessage = {
        role: "system",
        content: "Google Search RESULTS displayed to the user:<searchresults>" + searchResultsContent + "</searchresults> CITE your sources! Always REMEMBER to follow the <format> message",
    };


    const embedCheckbox = document.getElementById("embed-checkbox");




    let tagsChanged = false;

    // Check if the node or reference tags have changed
    const storedNodeTag = localStorage.getItem('nodeTag');
    const storedRefTag = localStorage.getItem('refTag');
    if (storedNodeTag !== tagValues.nodeTag || storedRefTag !== tagValues.refTag) {
        localStorage.setItem('nodeTag', tagValues.nodeTag);
        localStorage.setItem('refTag', tagValues.refTag);
    }

    // Always use the original Zettelkasten prompt
    const zettelkastenPromptToUse = zettelkastenPrompt();

    // Create the messages
    let messages = [
        {
            role: "system",
            content: `${zettelkastenPromptToUse}`,
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

    if (embedCheckbox && embedCheckbox.checked) {
        // Obtain relevant keys based on the user message
        const relevantKeys = await getRelevantKeys(message, null, searchQuery);

        // Get relevant chunks based on the relevant keys
        const relevantChunks = await getRelevantChunks(searchQuery, searchResults, topN, relevantKeys);
        const topNChunksContent = groupAndSortChunks(relevantChunks, MAX_CHUNK_SIZE);

        // Construct the embed message
        const embedMessage = {
            role: "system",
            content: `Top ${topN} MATCHED snippets of TEXT from extracted WEBPAGES:\n <topNchunks>` + topNChunksContent + `</topNchunks>\n Provide RELEVANT information from the given <topNchunks>. CITE sources!`
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
    let existingTitles = extractTitlesFromContent(context, nodeTag);

    // Replace the original search and highlight code with neuriteSearchNotes
    const topMatchedNodes = await neuriteSearchNotes(keywords);

    let titlesToForget = new Set();

    // Use helper function to get the content
    const nodeContents = filterAndProcessNodesByExistingTitles(topMatchedNodes, existingTitles, titlesToForget, nodeTag);
    //console.log(nodeContents);
    topMatchedNodesContent = nodeContents.join("\n\n");

    // If forgetting is enabled, extract titles to forget
    if (document.getElementById("forget-checkbox").checked) {
        console.log("User message being sent to forget:", message);
        titlesToForget = await forget(message, `${context}\n\n${topMatchedNodesContent}`);

        console.log("Titles to Forget:", titlesToForget);

        // Use helper function to remove forgotten nodes from context
        context = removeTitlesFromContext(context, titlesToForget, nodeTag);

        // Refilter topMatchedNodesContent by removing titles to forget
        topMatchedNodesContent = filterAndProcessNodesByExistingTitles(topMatchedNodes, existingTitles, titlesToForget, nodeTag).join("\n\n");
        console.log("Refiltered Top Matched Nodes Content:", topMatchedNodesContent);
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


    const commonInstructions = getCommonInstructions(tagValues, isBracketLinks);


    // Add Common Instructions as a separate system message
    messages.push({
        role: "system",
        content: commonInstructions
    });

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



    // Add the user prompt and a newline only if it's the first message in auto mode or not in auto mode
    if (!autoModeMessage || (isFirstAutoModeMessage && autoModeMessage)) {
        let lineBeforeAppend = myCodeMirror.lastLine();
        scrollToLine(myCodeMirror, lineBeforeAppend); // Scroll to the line before the prompt
        myCodeMirror.replaceRange(`\n\n${PROMPT_IDENTIFIER} ${message}\n\n`, CodeMirror.Pos(lineBeforeAppend));
        scrollToLine(myCodeMirror, lineBeforeAppend + 1); // Scroll to the line just after the prompt
        userScrolledUp = false;
        isFirstAutoModeMessage = false;
    } else if (autoModeMessage) {
        let lineBeforeAppend = myCodeMirror.lastLine();
        scrollToLine(myCodeMirror, lineBeforeAppend); // Scroll to the line before the prompt
        myCodeMirror.replaceRange(`\n`, CodeMirror.Pos(lineBeforeAppend));
        scrollToLine(myCodeMirror, lineBeforeAppend + 1); // Scroll to the new last line
        userScrolledUp = false;
    }


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


    const stream = true;

    // Main AI call
    if (stream) {
        await callchatAPI(messages, stream);
    } else {
        let aiResponse = await callchatAPI(messages, stream);

        if (aiResponse) {
            const noteInput = document.getElementById("note-input");
            if (noteInput.value[noteInput.value.length - 1] !== '\n') {
                myCodeMirror.replaceRange("\n", CodeMirror.Pos(myCodeMirror.lastLine()));
            }
            myCodeMirror.replaceRange(aiResponse + "\n", CodeMirror.Pos(myCodeMirror.lastLine()));
        } else {
            console.error('AI response was undefined');
        }
    }

    isAutoModeEnabled = document.getElementById("auto-mode-checkbox").checked;

    // Only continue if shouldContinue flag is true and auto mode checkbox is checked
    if (shouldContinue && isAutoModeEnabled) {
        const extractedPrompt = extractLastPrompt();
        sendMessage(null, extractedPrompt);
    }

    return false;
}