let previousContent = "";

async function callChatGPTApiForLLMNode(messages, node, stream = false) {
    // Reset shouldContinue
    node.shouldContinue = true;

    // Update aiResponding and the button
    node.aiResponding = true;
    node.regenerateButton.textContent = '\u275A\u275A'; // Double Vertical Bar unicode

    console.log("Messages sent to API:", messages);
    console.log("Token count for messages:", getTokenCount(messages));

    const API_KEY = document.getElementById("api-key-input").value;
    if (!API_KEY) {
        alert("Please enter your API key");
        return;
    }

    const API_URL = "https://api.openai.com/v1/chat/completions";

    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    headers.append("Authorization", `Bearer ${API_KEY}`);

    // Create a new AbortController each time the function is called
    node.controller = new AbortController();
    let signal = node.controller.signal;

    // Add the signal to your fetch request options
    const temperature = document.getElementById('model-temperature').value;
    const modelSelect = document.getElementById('model-select');
    const modelInput = document.getElementById('model-input');
    const model = modelSelect.value === 'other' ? modelInput.value : modelSelect.value;
    let max_tokens = document.getElementById('max-tokens-slider').value;

    const requestOptions = {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
            model: model,
            messages: messages,
            max_tokens: parseInt(max_tokens),
            temperature: parseFloat(temperature),
            stream: stream,
        }),
        signal: signal,
    };

    try {
        const response = await fetch(API_URL, requestOptions);
        if (!response.ok) {
            const errorData = await response.json();
            console.error("Error calling ChatGPT API:", errorData);
            node.aiResponseTextArea.value += "\nAn error occurred while processing your request.";

            // Display error icon and hide loading icon
            const aiErrorIcon = document.getElementById(`aiErrorIcon-${node.index}`);
            const aiLoadingIcon = document.getElementById(`aiLoadingIcon-${node.index}`);
            if (aiErrorIcon) aiErrorIcon.style.display = 'block';
            if (aiLoadingIcon) aiLoadingIcon.style.display = 'none';

            return;
        }

        if (stream) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done || !node.shouldContinue) break;

                buffer += decoder.decode(value, { stream: true });

                let contentMatch;
                while ((contentMatch = buffer.match(/"content":"((?:[^\\"]|\\.)*)"/)) !== null) {
                    const content = JSON.parse('"' + contentMatch[1] + '"');

                    if (!node.shouldContinue) break;

                    if (content.trim() !== "[DONE]") {
                        node.aiResponseTextArea.value += `${content}`;  // Append the AI's response to the textarea
                        node.aiResponseTextArea.dispatchEvent(new Event("input"));

                    }
                    buffer = buffer.slice(contentMatch.index + contentMatch[0].length);
                }
            }
        } else {
            const data = await response.json();
            console.log("Token usage:", data.usage);
            node.aiResponseTextArea.innerText += `${data.choices[0].message.content.trim()}`;  // Append the AI's response to the textarea
            node.aiResponseTextArea.dispatchEvent(new Event("input"));


        }
    } catch (error) {
        // Check if the error is because of the abort operation
        if (error.name === 'AbortError') {
            console.log('Fetch request was aborted');
        } else {
            console.error("Error calling ChatGPT API:", error);

            // Display error icon and hide loading icon
            const aiErrorIcon = document.getElementById(`aiErrorIcon-${node.index}`);
            const aiLoadingIcon = document.getElementById(`aiLoadingIcon-${node.index}`);
            if (aiErrorIcon) aiErrorIcon.style.display = 'block';
            if (aiLoadingIcon) aiLoadingIcon.style.display = 'none';
        }
    } finally {
        node.aiResponding = false;
        node.regenerateButton.textContent = "\u21BA";
    }
}

function trimToTokenCount(inputText, maxTokens) {
    let tokens = inputText.match(/[\w]+|[^\s\w]/g);
    let trimmedText = '';
    let currentTokenCount = 0;

    if (tokens !== null) {
        for (let token of tokens) {
            currentTokenCount += 1;
            if (currentTokenCount <= maxTokens) {
                trimmedText += token + ' ';
            } else {
                break;
            }
        }
    }

    return trimmedText;
}



async function sendLLMNodeMessage(node, message = null) {
    if (node.aiResponding) {
        console.log('AI is currently responding. Please wait for the current response to complete before sending a new message.');
        return;
    }

    const maxTokensSlider = document.getElementById('max-tokens-slider');
    let contextSize = 0;

    node.latestUserMessage = message ? message : node.promptTextArea.value;
    console.log(`Received message: "${node.latestUserMessage}"`);

    // Append the user prompt to the AI response area with a distinguishing mark and end tag
    node.aiResponseTextArea.value += `\n\n${PROMPT_IDENTIFIER} ${node.latestUserMessage}\n`;
    // Trigger the input event programmatically
    node.aiResponseTextArea.dispatchEvent(new Event('input'));
    // Clear the prompt textarea
    node.promptTextArea.value = '';
    node.promptTextArea.dispatchEvent(new Event('input'));

    let messages = [
        {
            role: "system",
            content: "You (Ai) are responding in an Ai node. Connected nodes are shared in the 'remember this' system message. Triple backtick and label your codeblocks"
        },
    ];

    if (document.getElementById("code-checkbox").checked) {
        messages.push(aiNodeCodeMessage());
    }

    if (document.getElementById("instructions-checkbox").checked) {
        messages.push(instructionsMessage());
    }



    let wikipediaSummaries;
    let keywordsArray = [];
    let keywords = '';

    if (isWikipediaEnabled()) {

        // Call generateKeywords function to get keywords
        const count = 3; // Change the count value as needed
        keywordsArray = await generateKeywords(node.latestUserMessage, count);

        // Join the keywords array into a single string
        keywords = keywordsArray.join(' ');



        const keywordString = keywords.replace("Keywords: ", "");
        const splitKeywords = keywordString.split(',').map(k => k.trim());
        const firstKeyword = splitKeywords[0];
    // Convert the keywords string into an array by splitting on spaces

        wikipediaSummaries = await getWikipediaSummaries([firstKeyword]);
    } else {
        wikipediaSummaries = "Wiki Disabled";
    }

    console.log("wikipediasummaries", wikipediaSummaries);
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

    // In your main function, check if searchQuery is null before proceeding with the Google search
    const searchQuery = await constructSearchQuery(node.latestUserMessage);
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
            content: `Top ${topN} matched chunks of text from extracted webpages:\n` + topNChunksContent + `\n Provide relevant information from the chunks as well as the respective source url. Do not repeat system contextualization`
        };

        messages.push(embedMessage);
    }

    let wolframData;

    if (document.getElementById("enable-wolfram-alpha").checked) {
        wolframData = await fetchWolfram(node.latestUserMessage);
    }

    if (wolframData) {
        const { table, wolframAlphaTextResult, reformulatedQuery } = wolframData;

        let content = [table];
        let scale = 1; // You can adjust the scale as needed

        let node = windowify(`${reformulatedQuery} - Wolfram Alpha Result`, content, toZ(mousePos), (zoom.mag2() ** settings.zoomContentExp), scale);
        htmlnodes_parent.appendChild(node.content);
        registernode(node);
        node.followingMouse = 1;
        node.draw();
        node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));

        const wolframAlphaMessage = {
            role: "system",
            content: `Wolfram Alpha Result: ${wolframAlphaTextResult}`
        };

        console.log("wolframAlphaTextResult:", wolframAlphaTextResult);
        messages.push(wolframAlphaMessage);
    }

    let allConnectedNodesData = getAllConnectedNodesData(node);

    let totalTokenCount = getTokenCount(messages);
    let remainingTokens = Math.max(0, maxTokensSlider.value - totalTokenCount);

    const maxContextSize = document.getElementById('max-context-size-slider').value;

    let messageTrimmed = false;

    let infoString = allConnectedNodesData.map(info => info.replace("Text Content:", "")).join("\n\n"); // Remove 'Text Content:' tag from each info and concatenate
    let infoWithIntro = "Remember this:\n" + infoString;

    let infoTokenCount = getTokenCount([{ content: infoWithIntro }]);
    if (infoTokenCount <= remainingTokens && totalTokenCount + infoTokenCount <= maxContextSize) {
        remainingTokens -= infoTokenCount;
        totalTokenCount += infoTokenCount;
        messages.push({
            role: "system",
            content: infoWithIntro
        });
    } else {
        let trimmedInfo = trimToTokenCount(infoWithIntro, Math.min(remainingTokens, maxContextSize - totalTokenCount));
        let trimmedInfoTokenCount = getTokenCount([{ content: trimmedInfo }]);
        remainingTokens -= trimmedInfoTokenCount;
        totalTokenCount += trimmedInfoTokenCount;
        messages.push({
            role: "system",
            content: trimmedInfo
        });
        messageTrimmed = true;
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

    // Update the value of getLastPromptsAndResponses
    const lastPromptsAndResponses = getLastPromptsAndResponses(10, contextSize, node.id);

    messages.push({
        role: "system",
        content: `Recent conversation:${lastPromptsAndResponses}` //Recent conversation removed from webLLM.ts
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

    if (document.getElementById("localLLM").checked && LocalLLMSelect.value !== 'OpenAi') {
        // Local LLM call
        window.generateLocalLLMResponse(node, messages)
            .finally(() => {
                node.aiResponding = false;
                aiLoadingIcon.style.display = 'none'; // Hide loading icon
            })
            .catch((error) => {
                console.error(`An error occurred while getting response: ${error}`);
                aiErrorIcon.style.display = 'block';  // Show error icon
            });
    } else {
        // OpenAI call
        callChatGPTApiForLLMNode(messages, node, true)
            .finally(() => {
                node.aiResponding = false;
                aiLoadingIcon.style.display = 'none'; // Hide loading icon
            })
            .catch((error) => {
                console.error(`An error occurred while getting response: ${error}`);
                aiErrorIcon.style.display = 'block';  // Show error icon
            });
    }
}

window.addEventListener('dblclick', function (e) {
    if (e.altKey) {
        e.preventDefault();
        // Assuming that the createLLMNode function takes x, y coordinates
        const node = createLLMNode('', undefined, undefined, e.clientX, e.clientY);
    }
});

// Update handleUserPrompt, handleMarkdown, and renderCodeBlock to make the created divs draggable
function makeDivDraggable(div, customTitle, handle) {
    handle = handle || div; // Default to the div itself if no handle is provided

    handle.addEventListener('mousedown', function () {
        // When the mouse button is pressed down, make the div draggable
        div.setAttribute('draggable', 'true');
    });

    handle.addEventListener('mouseup', function () {
        // When the mouse button is released, make the div non-draggable
        div.setAttribute('draggable', 'false');
    });

    div.addEventListener('dragstart', function (event) {
        event.dataTransfer.setData('text/plain', JSON.stringify([customTitle, div.innerText]));
    });

    // When dragging ends, make sure the div is non-draggable
    div.addEventListener('dragend', function () {
        div.setAttribute('draggable', 'false');
    });
}

function encodeHTML(str) {
    return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function decodeHTML(html) {
    let txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
}


//Handles Ai node conversation parsing for Prismjs and a div css.
//Creates div class, user-prompt, ai-response, code-block
class ResponseHandler {
    constructor(node) {
        this.node = node;
        this.previousContent = "";
        this.inCodeBlock = false;
        this.codeBlockContent = '';
        this.codeBlockStartIndex = -1;
        this.currentLanguage = "javascript";
        this.node.codeBlockCount = 0;
        this.processingQueue = Promise.resolve();
        this.previousContentLength = 0;
        this.responseCount = 0;

        this.node.aiResponseTextArea.addEventListener('input', () => {
            this.processingQueue = this.processingQueue.then(() => this.handleInput());
        });
    }

    async handleInput() {
        try {
            let content = this.node.aiResponseTextArea.value;
            let newContent = content.substring(this.previousContentLength);

            if (newContent.trim() === "") {
                newContent = newContent.replace(/ /g, "&nbsp;");
            }
            let trimmedNewContent = newContent.trim();

            if (trimmedNewContent.startsWith(`\n\n${PROMPT_IDENTIFIER} `)) {
                trimmedNewContent = trimmedNewContent.trimStart();
            }

            if (trimmedNewContent.startsWith(`${PROMPT_IDENTIFIER} `)) {
                let promptContent = trimmedNewContent.substring(8).trim();
                this.handleUserPrompt(promptContent);
                newContent = '';
            } else {
                if (this.inCodeBlock) {
                    this.codeBlockContent += newContent;
                    let endOfCodeBlockIndex = this.codeBlockContent.indexOf('```');
                    if (endOfCodeBlockIndex !== -1) {
                        let codeContent = this.codeBlockContent.substring(0, endOfCodeBlockIndex);
                        this.renderCodeBlock(codeContent, true);

                        this.codeBlockContent = '';
                        this.codeBlockStartIndex = -1;
                        this.inCodeBlock = false;

                        newContent = this.codeBlockContent.substring(endOfCodeBlockIndex + 3);
                    } else {
                        let endOfLanguageStringIndex = this.codeBlockContent.indexOf('\n');
                        if (endOfLanguageStringIndex !== -1) {
                            let languageString = this.codeBlockContent.substring(0, endOfLanguageStringIndex).trim();
                            if (languageString.length > 0) {
                                this.currentLanguage = languageString;
                            }
                        }
                        this.renderCodeBlock(this.codeBlockContent);
                        newContent = '';
                    }
                }

                if (newContent.length > 0) {
                    let startOfCodeBlockIndex = trimmedNewContent.indexOf('```');
                    if (startOfCodeBlockIndex !== -1) {
                        let markdown = newContent.substring(0, startOfCodeBlockIndex);
                        this.handleMarkdown(markdown);

                        this.inCodeBlock = true;
                        this.codeBlockStartIndex = this.previousContent.length + startOfCodeBlockIndex;
                        this.codeBlockContent = trimmedNewContent.substring(startOfCodeBlockIndex + 3);
                    } else if (!trimmedNewContent.startsWith('```') && !trimmedNewContent.endsWith('```')) {
                        this.handleMarkdown(newContent);
                    }
                }
            }

            this.previousContent = content;
            this.previousContentLength = this.previousContent.length;

        } catch (error) {
            console.error('Error while processing markdown:', error);
        }
    }

    handleUserPrompt(promptContent) {
        // Create a new div for the outer container
        let outerDiv = document.createElement('div');
        outerDiv.style.width = '100%';
        outerDiv.style.textAlign = 'right';

        // Create a new div for the user prompt
        let promptDiv = document.createElement('div');
        promptDiv.className = 'user-prompt';
        promptDiv.id = `prompt-${this.responseCount}`;  // Assign a unique ID to each prompt
        promptDiv.contentEditable = false; // Set contentEditable to false when the promptDiv is created

        // Replace newline characters with '<br>' and set as HTML content
        promptDiv.innerHTML = promptContent.replace(/\n/g, '<br>');

        // Append the prompt div to the outer div
        outerDiv.appendChild(promptDiv);

        // Append the outer div to the response area
        this.node.aiResponseDiv.appendChild(outerDiv);

        // Make the prompt div draggable
        makeDivDraggable(promptDiv, 'Prompt');

        let isEditing = false; // Flag to check if user is editing the content

        let handleKeyDown = function (event) {
            if (event.key === 'Enter' && event.shiftKey) {
                event.preventDefault();
                this.removeResponsesUntil(promptDiv.id);

                // Get the HTML content of the promptDiv
                let message = promptDiv.innerHTML;

                console.log(`Sending message: "${message}"`);
                sendLLMNodeMessage(this.node, message);
            }
        }.bind(this);

        // Set an onBlur event handler to handle when the div loses focus
        promptDiv.addEventListener('blur', function () {
            // If the div is in editing mode
            if (isEditing) {
                // Remove the .editing class
                promptDiv.classList.remove('editing');
                // Set contentEditable to false when div loses focus
                promptDiv.contentEditable = false;

                // Reset isEditing
                isEditing = false;

                // Reset styles to non-editing state
                promptDiv.style.backgroundColor = "#b799ce";
                promptDiv.style.color = "#222226";

                // Reset the cursor style to move
                promptDiv.style.cursor = "move";

                // Make the div draggable
                makeDivDraggable(promptDiv, 'Prompt');
                promptDiv.ondragstart = function () { return isEditing ? false : null; };

                // Remove the keydown event listener
                promptDiv.removeEventListener('keydown', handleKeyDown);
            }
        }.bind(this));

        // Add a double click listener to the prompt div
        promptDiv.addEventListener('dblclick', function (event) {
            // Prevent the default action of double click
            event.preventDefault();

            // Toggle isEditing
            isEditing = !isEditing;

            if (isEditing) {
                // Add the .editing class
                promptDiv.classList.add('editing');
                // Set contentEditable to true when entering edit mode
                promptDiv.contentEditable = true;

                // Remove draggable attribute
                promptDiv.removeAttribute('draggable');

                // Set the cursor style to text
                promptDiv.style.cursor = "text";

                // Set the background and text color to match original, remove inherited text decoration
                promptDiv.style.backgroundColor = "inherit";
                promptDiv.style.color = "#bbb";
                promptDiv.style.textDecoration = "none";
                promptDiv.style.outline = "none";
                promptDiv.style.border = "none";

                // Focus the div
                promptDiv.focus();

                // Add the keydown event listener when the promptDiv enters edit mode
                promptDiv.addEventListener('keydown', handleKeyDown);

                // Set promptDiv non-draggable
                promptDiv.ondragstart = function () { return false; };
            } else {
                // Remove the .editing class
                promptDiv.classList.remove('editing');
                // Set contentEditable to false when leaving edit mode
                promptDiv.contentEditable = false;


                // Handle leaving edit mode
                promptDiv.style.backgroundColor = "#b799ce";
                promptDiv.style.color = "#222226";

                // Set the cursor style to move
                promptDiv.style.cursor = "move";

                makeDivDraggable(promptDiv, 'Prompt');
                promptDiv.ondragstart = function () { return isEditing ? false : null; };
                promptDiv.removeEventListener('keydown', handleKeyDown);
            }

        }.bind(this));

        this.responseCount++;  // Increment the response count after each prompt
    }

    handleMarkdown(markdown) {
        if (markdown.trim().length > 0) {
            let sanitizedMarkdown = DOMPurify.sanitize(markdown);
            let lastWrapperDiv = this.node.aiResponseDiv.lastElementChild;

            if (lastWrapperDiv && lastWrapperDiv.className === 'response-wrapper') {
                let aiResponseDiv = lastWrapperDiv.getElementsByClassName('ai-response')[0];
                aiResponseDiv.innerHTML += sanitizedMarkdown.replace(/\n/g, "<br>");
            } else {
                let handleDiv = document.createElement('div');
                handleDiv.className = 'drag-handle';
                handleDiv.innerHTML = `
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
        `;

                let responseDiv = document.createElement('div');
                responseDiv.className = 'ai-response';
                responseDiv.innerHTML = sanitizedMarkdown.replace(/\n/g, "<br>");

                let wrapperDiv = document.createElement('div');
                wrapperDiv.className = 'response-wrapper';
                wrapperDiv.appendChild(handleDiv);
                wrapperDiv.appendChild(responseDiv);

                makeDivDraggable(wrapperDiv, 'AI Response', handleDiv);

                this.node.aiResponseDiv.appendChild(wrapperDiv);

                handleDiv.addEventListener('mouseover', function () {
                    wrapperDiv.classList.add('hovered');
                });

                handleDiv.addEventListener('mouseout', function () {
                    wrapperDiv.classList.remove('hovered');
                });
            }
        }
    }

    renderCodeBlock(content, isFinal = false) {
        let encodedContent = encodeHTML(content);
        let cleanedContent = encodedContent.split('\n').slice(1).join('\n');
        let decodedContent = decodeHTML(cleanedContent);

        let codeBlockDivId = `code-block-wrapper-${this.node.id}-${this.node.codeBlockCount}`;

        if (!isFinal && this.node.lastBlockId) {
            let oldBlock = document.getElementById(this.node.lastBlockId);
            if (oldBlock) {
                oldBlock.parentNode.removeChild(oldBlock);
            }
        }

        let existingContainerDiv = document.getElementById(codeBlockDivId);

        if (!existingContainerDiv) {
            existingContainerDiv = document.createElement('div');
            existingContainerDiv.id = codeBlockDivId;
            existingContainerDiv.className = "code-block-container";
            this.node.aiResponseDiv.appendChild(existingContainerDiv);

            let languageLabelDiv = document.createElement('div');
            languageLabelDiv.className = "language-label";
            existingContainerDiv.appendChild(languageLabelDiv);

            let existingWrapperDiv = document.createElement('div');
            existingWrapperDiv.className = "code-block-wrapper custom-scrollbar";
            existingContainerDiv.appendChild(existingWrapperDiv);

            let preDiv = document.createElement('pre');
            preDiv.className = "code-block";
            existingWrapperDiv.appendChild(preDiv);

            makeDivDraggable(existingContainerDiv, 'Code Block', languageLabelDiv);
        }

        let existingWrapperDiv = existingContainerDiv.getElementsByClassName('code-block-wrapper')[0];
        let preDiv = existingWrapperDiv.getElementsByClassName('code-block')[0];

        let codeElement = document.createElement("code");
        codeElement.className = `language-${this.currentLanguage}`;
        codeElement.textContent = decodedContent;

        Prism.highlightElement(codeElement);

        preDiv.innerHTML = '';
        preDiv.appendChild(codeElement);

        let languageLabelDiv = existingContainerDiv.getElementsByClassName('language-label')[0];
        languageLabelDiv.innerText = this.currentLanguage;
        languageLabelDiv.style.display = 'flex';
        languageLabelDiv.style.justifyContent = 'space-between';
        languageLabelDiv.style.alignItems = 'center';

        let copyButton = document.createElement('button');
        copyButton.innerText = 'Copy';
        copyButton.className = 'copy-btn';
        copyButton.onclick = function () {
            let textarea = document.createElement('textarea');
            textarea.value = decodedContent;
            document.body.appendChild(textarea);
            textarea.select();

            let successfulCopy = document.execCommand('copy');
            if (successfulCopy) {
                copyButton.innerText = "Copied!";
                setTimeout(() => {
                    copyButton.innerText = "Copy";
                }, 1200);
            }

            document.body.removeChild(textarea);
        };

        languageLabelDiv.appendChild(copyButton);
        languageLabelDiv.addEventListener('mouseover', function () {
            existingContainerDiv.classList.add('hovered');
        });

        languageLabelDiv.addEventListener('mouseout', function () {
            existingContainerDiv.classList.remove('hovered');
        });

        if (isFinal) {
            this.node.codeBlockCount++;
            this.node.lastBlockId = null;
        } else {
            this.node.lastBlockId = codeBlockDivId;
        }
    }

    removeLastResponse() {
        // Handling the div as per the new version
        let prompts = this.node.aiResponseDiv.querySelectorAll('.user-prompt');
        let lastPrompt = prompts[prompts.length - 1];
        let lastPromptId = lastPrompt ? lastPrompt.id : null;

        if (lastPrompt) {
            // Remove everything after the last 'user-prompt' div
            while (this.node.aiResponseDiv.lastChild !== lastPrompt.parentNode) {
                this.node.aiResponseDiv.removeChild(this.node.aiResponseDiv.lastChild);
            }
            // Remove the last 'user-prompt' div itself
            this.node.aiResponseDiv.removeChild(lastPrompt.parentNode);
        }

        // Handling the textarea as per the old version
        const lines = this.node.aiResponseTextArea.value.split("\n");

        // Find the index of the last "Prompt:"
        let lastPromptIndex = lines.length - 1;
        while (lastPromptIndex >= 0 && !lines[lastPromptIndex].startsWith(`${PROMPT_IDENTIFIER}`)) {
            lastPromptIndex--;
        }

        // Remove all lines from the last "Prompt:" to the end
        if (lastPromptIndex >= 0) {
            lines.length = lastPromptIndex;
            this.node.aiResponseTextArea.value = lines.join("\n");
            this.previousContentLength = this.node.aiResponseTextArea.value.length; // Update previousContentLength here
        }

        // Handle the case where a code block is being processed but is not yet complete
        if (this.inCodeBlock) {
            // Reset properties related to code block
            this.inCodeBlock = false;
            this.codeBlockContent = '';
            this.codeBlockStartIndex = -1;
            this.currentLanguage = "javascript";

            // Remove the partial code block from the div if present
            let codeBlockDiv = document.getElementById(`code-block-wrapper-${this.node.id}-${this.node.codeBlockCount}`);
            if (codeBlockDiv) {
                codeBlockDiv.parentNode.removeChild(codeBlockDiv);
            }

            // Remove the partial code block from the textarea
            let codeBlockStartLine = this.node.aiResponseTextArea.value.lastIndexOf("```", this.previousContentLength);
            if (codeBlockStartLine >= 0) {
                this.node.aiResponseTextArea.value = this.node.aiResponseTextArea.value.substring(0, codeBlockStartLine);
                this.previousContentLength = this.node.aiResponseTextArea.value.length; // Update previousContentLength again
            }
        }

        this.handleInput(); // Invoke handleInput here
        return lastPromptId;
    }

    removeResponsesUntil(id) {
        let lastRemovedId;
        do {
            lastRemovedId = this.removeLastResponse();
        } while (lastRemovedId !== id && lastRemovedId !== null);
    }
}



function createLLMNode(name = '', sx = undefined, sy = undefined, x = undefined, y = undefined) {
    // Create the AI response textarea
    let aiResponseTextArea = document.createElement("textarea");
    aiResponseTextArea.id = `LLMnoderesponse-${++llmNodeCount}`;  // Assign unique id to each aiResponseTextArea
    aiResponseTextArea.style.display = 'none';  // Hide the textarea

    // Create the AI response container
    let aiResponseDiv = document.createElement("div");
    aiResponseDiv.id = `LLMnoderesponseDiv-${llmNodeCount}`;  // Assign unique id to each aiResponseDiv
    aiResponseDiv.classList.add('custom-scrollbar');
    aiResponseDiv.onmousedown = cancel;  // Prevent dragging
    aiResponseDiv.setAttribute("style", "background-color: #222226; color: inherit; border: inset; border-color: #8882; width: 500px; height: 420px; overflow-y: auto; overflow-x: hidden; resize: both; word-wrap: break-word; user-select: none; padding-left: 25px; padding-right: 25px; line-height: 1.75;");
    aiResponseDiv.addEventListener('mouseenter', function () {
        aiResponseDiv.style.userSelect = "text";
    });
    aiResponseDiv.addEventListener('mouseleave', function () {
        aiResponseDiv.style.userSelect = "none";
    });
    // Add a 'wheel' event listener
    aiResponseDiv.addEventListener('wheel', function (event) {
        // If the Shift key is not being held down, stop the event propagation
        if (!event.shiftKey) {
            event.stopPropagation();
        }
    }, { passive: false });


    // Create the user prompt textarea
    let promptTextArea = document.createElement("textarea");
    promptTextArea.id = 'prompt';
    promptTextArea.classList.add('custom-scrollbar');
    promptTextArea.onmousedown = cancel;  // Prevent dragging
    promptTextArea.setAttribute("style", "background-color: #222226; color: inherit; border: inset; border-color: #8882; width: 270px; height: 55px; overflow-y: hidden; padding: 10px; box-sizing: border-box; resize: none; user-select: none;");
    promptTextArea.addEventListener('input', autoGrow);
    promptTextArea.addEventListener('mouseenter', function () {
        promptTextArea.style.userSelect = "text";
    });
    promptTextArea.addEventListener('mouseleave', function () {
        promptTextArea.style.userSelect = "none";
    });
    promptTextArea.addEventListener('input', autoGrow);

    // Create the send button
    let sendButton = document.createElement("button");
    sendButton.type = "submit";
    sendButton.innerText = "\u23F5";
    sendButton.id = "prompt-form";
    sendButton.style.cssText = "display: flex; justify-content: center; align-items: center; padding: 10px; z-index: 1; font-size: 14px; cursor: pointer; background-color: #222226; transition: background-color 0.3s; border: inset; border-color: #8882; width: 30px; height: 30px;"; sendButton.addEventListener('mouseover', function () {
        this.style.backgroundColor = '#45a049';
        this.style.color = '#222226';
    });
    sendButton.addEventListener('mouseout', function () {
        this.style.backgroundColor = '#222226';
        this.style.color = '#ddd';
    });
    sendButton.addEventListener('mousedown', function () {
        this.style.backgroundColor = '#45a049';
    });
    sendButton.addEventListener('mouseup', function () {
        this.style.backgroundColor = '#ddd';
    });

    // Create the regenerate button
    let regenerateButton = document.createElement("button");
    regenerateButton.type = "button";
    regenerateButton.innerText = "\u21BA";
    regenerateButton.id = "prompt-form";
    regenerateButton.style.cssText = "display: flex; justify-content: center; align-items: center; padding: 10px; z-index: 1; font-size: 14px; cursor: pointer; background-color: #222226; transition: background-color 0.3s; border: inset; border-color: #8882; width: 30px; height: 30px;";
    regenerateButton.addEventListener('mouseover', function () {
        this.style.backgroundColor = '#ddd';
        this.style.color = '#222226';
    });
    regenerateButton.addEventListener('mouseout', function () {
        this.style.backgroundColor = '#222226';
        this.style.color = '#ddd';
    });
    regenerateButton.addEventListener('mousedown', function () {
        this.style.backgroundColor = '#45a049';
    });
    regenerateButton.addEventListener('mouseup', function () {
        this.style.backgroundColor = '#ddd';
    });


    // Create the loader and error icons container
    let statusIconsContainer = document.createElement("div");
    statusIconsContainer.className = 'status-icons-container';
    statusIconsContainer.style.cssText = 'position: absolute; top: 15px; right: 80px; width: 20px; height: 20px;';

    // Create the loader icon
    let aiLoadingIcon = document.createElement("div");
    aiLoadingIcon.className = 'loader';
    aiLoadingIcon.id = `aiLoadingIcon-${llmNodeCount}`; // Assign unique id
    aiLoadingIcon.style.display = 'none';

    // Create the error icon
    let aiErrorIcon = document.createElement("div");
    aiErrorIcon.className = 'error-icon-css';
    aiErrorIcon.id = `aiErrorIcon-${llmNodeCount}`; // Assign unique id
    aiErrorIcon.style.display = 'none';

    // Create the 'X' mark inside the error icon
    let xMark = document.createElement("div");
    xMark.className = 'error-x-mark';

    let xMarkLeft = document.createElement("div");
    xMarkLeft.className = 'error-x-mark-left';

    let xMarkRight = document.createElement("div");
    xMarkRight.className = 'error-x-mark-right';

    xMark.appendChild(xMarkLeft);
    xMark.appendChild(xMarkRight);
    aiErrorIcon.appendChild(xMark); // Append the 'X' mark to the error icon

    // Append loader and error icons to container
    statusIconsContainer.appendChild(aiLoadingIcon);
    statusIconsContainer.appendChild(aiErrorIcon);


    // Create a div to wrap prompt textarea and buttons
    let buttonDiv = document.createElement("div");
    buttonDiv.appendChild(sendButton);
    buttonDiv.appendChild(regenerateButton);
    buttonDiv.style.cssText = "display: flex; flex-direction: column; align-items: flex-end;";

    // Create the promptDiv with relative position
    let promptDiv = document.createElement("div");
    promptDiv.style.cssText = "display: flex; flex-direction: row; justify-content: space-between; align-items: center; position: relative;"; // Added position: relative;

    // Append statusIconsContainer to the promptDiv instead of wrapperDiv
    promptDiv.appendChild(statusIconsContainer);
    promptDiv.appendChild(promptTextArea);
    promptDiv.appendChild(buttonDiv);

    // Wrap elements in a div
    let wrapperDiv = document.createElement("div");
    wrapperDiv.className = 'wrapperDiv';
    wrapperDiv.style.position = 'relative'; // <-- Add this line to make sure the container has a relative position

    wrapperDiv.appendChild(aiResponseTextArea);
    wrapperDiv.appendChild(aiResponseDiv);
    wrapperDiv.appendChild(promptDiv);

    // Create the Local LLM dropdown
    let LocalLLMSelect = document.createElement("select");
    LocalLLMSelect.id = `dynamicLocalLLMselect-${llmNodeCount}`;
    LocalLLMSelect.classList.add('inline-container');
    LocalLLMSelect.style.backgroundColor = "#222226";
    LocalLLMSelect.style.border = "none";

    let localLLMCheckbox = document.getElementById("localLLM");

    if (localLLMCheckbox.checked) {
        LocalLLMSelect.style.display = "block";
    } else {
        LocalLLMSelect.style.display = "none";
    }

    // Options for the dropdown
    let option1 = new Option('Red Pajama 3B f32', 'RedPajama-INCITE-Chat-3B-v1-q4f32_0', false, true);
    let option2 = new Option('Vicuna 7B f32', 'vicuna-v1-7b-q4f32_0', false, false);
    let option3 = new Option('OpenAI', 'OpenAi', false, false);

    LocalLLMSelect.add(option1, undefined);
    LocalLLMSelect.add(option2, undefined);
    LocalLLMSelect.add(option3, undefined); // Adding new option

    // Append dropdown to the div
    wrapperDiv.appendChild(LocalLLMSelect);

    // Pass this div to addNodeAtNaturalScale
    let node = addNodeAtNaturalScale(name, []);


    let windowDiv = node.content.querySelector(".window");
    windowDiv.style.resize = 'both';

    // Append the wrapperDiv to windowDiv of the node
    windowDiv.appendChild(wrapperDiv);

    // Additional configurations
    node.aiResponseTextArea = aiResponseTextArea;
    node.aiResponseDiv = aiResponseDiv;
    node.promptTextArea = promptTextArea;
    node.sendButton = sendButton;
    node.regenerateButton = regenerateButton;
    node.id = aiResponseTextArea.id;  // Store the id in the node object
    node.aiResponding = false;
    node.latestUserMessage = null;
    node.controller = new AbortController();
    node.shouldContinue = true;
    node.LocalLLMSelectID = `dynamicLocalLLMselect-${llmNodeCount}`;
    node.index = llmNodeCount;
    node.isLLMNode = true;
    node.wrapperDiv = wrapperDiv;


    // If user has not scrolled, it's safe to automatically scroll to bottom
    let userHasScrolled = false;

    // Tolerance in pixels (you can adjust this value)
    const epsilon = 5;

    // Function to handle scrolling
    const handleScroll = () => {
        if (Math.abs(node.aiResponseDiv.scrollTop + node.aiResponseDiv.clientHeight - node.aiResponseDiv.scrollHeight) > epsilon) {
            userHasScrolled = true;
        } else {
            userHasScrolled = false;
        }
    };

    // Event listener for scrolling
    node.aiResponseDiv.addEventListener('scroll', handleScroll);

    // Function to scroll to bottom
    const scrollToBottom = () => {
        if (!userHasScrolled) {
            setTimeout(() => {
                node.aiResponseDiv.scrollTo({
                    top: node.aiResponseDiv.scrollHeight,
                    behavior: 'smooth'
                });
            }, 0);
        }
    };

    // Call scrollToBottom whenever there's an input
    node.aiResponseTextArea.addEventListener('input', scrollToBottom);



    let responseHandler = new ResponseHandler(node);

    node.removeLastResponse = responseHandler.removeLastResponse.bind(responseHandler);

 

    node.haltResponse = function () {
        if (this.aiResponding) {
            // AI is responding, so we want to stop it
            this.controller.abort(); // This line sends the abort signal to the fetch request
            this.aiResponding = false;
            this.shouldContinue = false;
            this.regenerateButton.textContent = "\u21BA";
            this.promptTextArea.value = this.latestUserMessage; // Add the last user message to the prompt input
        }
    };

    node.regenerateResponse = function () {
        if (!this.aiResponding) {
            // AI is not responding, so we want to regenerate
            this.removeLastResponse(); // Remove the last AI response
            this.promptTextArea.value = this.latestUserMessage; // Restore the last user message into the input prompt
            this.regenerateButton.textContent = "\u21BA";
        }
    };

    // Add event listeners to buttons
    sendButton.addEventListener("click", function (e) {
        e.preventDefault();
        sendLLMNodeMessage(node);
    });

    regenerateButton.addEventListener("click", function () {
        if (node.aiResponding) {
            // If the AI is currently responding, halt the response
            node.haltResponse();
        } else {
            // Otherwise, regenerate the response
            node.regenerateResponse();
        }
    });

    node.promptTextArea.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            sendLLMNodeMessage(node);
        }
    });

    let timer = null;

    node.isLLM = true;

    return node;
}

document.getElementById("localLLM").addEventListener("change", function () {
    let llmNodes = document.querySelectorAll("[id^=dynamicLocalLLMselect-]");
    for (let i = 0; i < llmNodes.length; i++) {
        if (this.checked) {
            llmNodes[i].style.display = "block";
        } else {
            llmNodes[i].style.display = "none";
        }
    }
});

let llmNodeCount = 0;

function getConnectedNodes(node) {
    // Get the connected nodes
    let connectedNodes = node.edges ? node.edges
        .filter(edge => edge.pts && edge.pts.length === 2)
        .map(edge => edge.pts[0].uuid === node.uuid ? edge.pts[1] : edge.pts[0]) : [];

    // Check if connectedNodes have valid values and exclude the originating node itself
    connectedNodes = connectedNodes.filter(connectedNode =>
        connectedNode !== undefined &&
        connectedNode.uuid !== undefined &&
        connectedNode.uuid !== node.uuid);

   // console.log(`Identified ${connectedNodes.length} connected node(s)`);
    return connectedNodes;
}

function getNodeData(node) {
    const titleElement = node.content.querySelector("input.title-input");
    const title = titleElement ? titleElement.value : "No title found";

    // Here we're considering that there may be multiple textareas within a node
    const contentElements = node.content.querySelectorAll("textarea");
    let contents = [];
    contentElements.forEach(contentElement => {
        const content = contentElement ? contentElement.value : "No content found";
        contents.push(content);
    });

    const createdAt = node.createdAt;

    if (!createdAt) {
        console.warn(`getNodeData: Creation time for node ${node.uuid} is not defined.`);
    }

    //node UUID: ${node.uuid}\n \nCreation Time: ${createdAt}
    const nodeInfo = `${tagValues.nodeTag} ${title}\nText Content: ${contents.join("\n")}`;
    return nodeInfo;
}

function topologicalSort(node, visited, stack) {
    // Mark the current node as visited
    visited.add(node);

    // Get all connected nodes
    let connectedNodes = getConnectedNodes(node);

    // Recur for all connected nodes
    for (let connectedNode of connectedNodes) {
        if (!visited.has(connectedNode)) {
            topologicalSort(connectedNode, visited, stack);
        }
    }

    // Push current node to stack which stores the result
    stack.push(node);
}

function getAllConnectedNodesData(node) {
    let visited = new Set();
    let stack = []; // stack to store the result

    // Call the recursive helper function to store topological sort 
    // starting from the selected node
    topologicalSort(node, visited, stack);

    // Now we can process nodes in topological order
    let allConnectedNodesData = [];
    while (stack.length > 0) {
        let currentNode = stack.pop();

        // Ignore the initial node
        if (currentNode === node) {
            continue;
        }

        let currentNodeData = getNodeData(currentNode);
        allConnectedNodesData.push(currentNodeData);
    }

    return allConnectedNodesData;
}