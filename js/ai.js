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

                        // Scroll to the bottom
                        setTimeout(() => {
                            node.aiResponseTextArea.scrollTop = node.aiResponseTextArea.scrollHeight;
                        }, 1);
                    }
                    buffer = buffer.slice(contentMatch.index + contentMatch[0].length);
                }
            }
        } else {
            const data = await response.json();
            console.log("Token usage:", data.usage);
            node.aiResponseTextArea.value += `${data.choices[0].message.content.trim()}`;  // Append the AI's response to the textarea

            // Scroll to the bottom
            setTimeout(() => {
                node.aiResponseTextArea.scrollTop = node.aiResponseTextArea.scrollHeight;
            }, 1);
        }
    } catch (error) {
        // Check if the error is because of the abort operation
        if (error.name === 'AbortError') {
            console.log('Fetch request was aborted');
        } else {
            console.error("Error calling ChatGPT API:", error);
            node.aiResponseTextArea.value += "\nAn error occurred while processing your request.";
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



async function sendLLMNodeMessage(node) {
    if (node.aiResponding) {
        console.log('AI is currently responding. Please wait for the current response to complete before sending a new message.');
        return;
    }

    if (node.aiResponseTextArea.value !== "") {
        node.aiResponseTextArea.value += "\n\n";
    }

    const maxTokensSlider = document.getElementById('max-tokens-slider');
    let contextSize = 0;



    // Store the last prompt
    node.latestUserMessage = node.promptTextArea.value;

    let messages = [
        {
            role: "system",
            content: "Your responses are displayed within an Ai node. Connected nodes are shared as individual system messages."
        },
    ];

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
        content: "Google Search Results displayed to the user:" + searchResultsContent + "END OF SEARCH RESULTS"
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
            content: `The following are the top ${topN} matched chunks of text from extracted webpages: ` + topNChunksContent + `\n Provide relevant information from the chunks as well as the respective source url. Do not repeat system contextualization`
        };

        messages.push(embedMessage);
    }

    let connectedNodesInfo = getConnectedNodeData(node);

    let totalTokenCount = getTokenCount(messages);
    let remainingTokens = Math.max(0, maxTokensSlider.value - totalTokenCount);

    const maxContextSize = document.getElementById('max-context-size-slider').value;

    connectedNodesInfo.forEach(info => {
        let infoWithIntro = "node connected to memory: \n" + info;
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
            messages.push({
                role: "system",
                content: "Previous message trimmed due to token limits."
            });
        }
    });

    totalTokenCount = getTokenCount(messages);
    remainingTokens = Math.max(0, maxTokensSlider.value - totalTokenCount);

    // calculate contextSize again
    contextSize = Math.min(remainingTokens, maxContextSize);

    // Update the value of getLastPromptsAndResponses
    const lastPromptsAndResponses = getLastPromptsAndResponses(10, contextSize, node.id);

    messages.push({
        role: "system",
        content: `Recent conversation: \n ${lastPromptsAndResponses} End of recent conversation.`
    });

    messages.push({
        role: "user",
        content: node.promptTextArea.value
    });

    
    // Append the user prompt to the AI response area with a distinguishing mark
    node.aiResponseTextArea.value += `Prompt: ${node.promptTextArea.value}\n\n`;
    // Clear the prompt textarea
    node.promptTextArea.value = '';

    // Set a timeout to allow the UI to render the new value and update the scrollHeight
    setTimeout(() => {
        node.aiResponseTextArea.scrollTop = node.aiResponseTextArea.scrollHeight;
    }, 0);

    node.aiResponding = true;
    node.userHasScrolled = false;
    let LocalLLMSelect = document.getElementById(node.LocalLLMSelectID); // Use node property to get the correct select element

    // Check if local LLM checkbox is checked and if the selected value is not 'OpenAI'
    if (document.getElementById("localLLM").checked && LocalLLMSelect.value !== 'OpenAi') {
        // Local LLM call
        window.generateLocalLLMResponse(node, messages)
            .then(() => node.aiResponding = false)
            .catch((error) => {
                console.error(`An error occurred while getting response: ${error}`);
                node.aiResponding = false;
            });
    } else {
        // If the local LLM checkbox is not checked or 'OpenAI' is selected in dropdown, default to OpenAI call
        callChatGPTApiForLLMNode(messages, node, true)
            .then(() => node.aiResponding = false)
            .catch((error) => {
                console.error(`An error occurred while getting response: ${error}`);
                node.aiResponding = false;
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

function createLLMNode(name = '', sx = undefined, sy = undefined, x = undefined, y = undefined) {
    // Create the AI response textarea
    let aiResponseTextArea = document.createElement("textarea");
    aiResponseTextArea.id = `LLMnoderesponse-${++llmNodeCount}`;  // Assign unique id to each aiResponseTextArea
    aiResponseTextArea.classList.add('custom-scrollbar');
    aiResponseTextArea.onmousedown = cancel;  // Prevent dragging
    aiResponseTextArea.setAttribute("style", "background-color: #222226; color: inherit; border: inset; border-color: #8882; width: 400px; height: 250px; overflow: auto; resize: both;");

    // Create the user prompt textarea
    let promptTextArea = document.createElement("textarea");
    promptTextArea.id = 'prompt';
    promptTextArea.classList.add('custom-scrollbar');
    promptTextArea.onmousedown = cancel;  // Prevent dragging
    promptTextArea.setAttribute("style", "background-color: #222226; color: inherit; border: inset; border-color: #8882; width: 270px; height: 55px; overflow-y: hidden; padding: 10px; box-sizing: border-box; resize: none;");

    promptTextArea.addEventListener('input', autoGrow);

    // Create the send button
    let sendButton = document.createElement("button");
    sendButton.type = "submit";
    sendButton.innerText = "\u23F5";
    sendButton.id = "prompt-form";
    sendButton.style.cssText = "display: flex; justify-content: center; align-items: center; padding: 10px; z-index: 1; font-size: 14px; cursor: pointer; background-color: #222226; transition: background-color 0.3s; border: inset; border-color: #8882; width: 30px; height: 30px;";    sendButton.addEventListener('mouseover', function () {
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

    // Create a div to wrap prompt textarea and buttons
    let buttonDiv = document.createElement("div");
    buttonDiv.appendChild(sendButton);
    buttonDiv.appendChild(regenerateButton);
    buttonDiv.style.cssText = "display: flex; flex-direction: column; align-items: flex-end;";

    let promptDiv = document.createElement("div");
    promptDiv.style.cssText = "display: flex; justify-content: space-between;";
    promptDiv.appendChild(promptTextArea);
    promptDiv.appendChild(buttonDiv);

    // Wrap elements in a div
    let wrapperDiv = document.createElement("div");
    wrapperDiv.appendChild(aiResponseTextArea);
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
    let option1 = new Option('Vicuna 7B f32', 'vicuna-v1-7b-q4f32_0', false, true);
    let option2 = new Option('Red Pajama 3B f32', 'RedPajama-INCITE-Chat-3B-v1-q4f32_0', false, false);
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
    node.promptTextArea = promptTextArea;
    node.sendButton = sendButton;
    node.regenerateButton = regenerateButton;
    node.id = aiResponseTextArea.id;  // Store the id in the node object
    node.aiResponding = false;
    node.latestUserMessage = null;
    node.controller = new AbortController();
    node.shouldContinue = true;
    node.userHasScrolled = false;
    node.LocalLLMSelectID = `dynamicLocalLLMselect-${llmNodeCount}`;
    node.index = llmNodeCount;

    node.aiResponseTextArea.addEventListener('scroll', () => {
        if (node.aiResponseTextArea.scrollTop < node.aiResponseTextArea.scrollHeight - node.aiResponseTextArea.clientHeight) {
            node.userHasScrolled = true;
        } else {
            node.userHasScrolled = false;
        }
    });

    node.removeLastResponse = function () {
        const lines = this.aiResponseTextArea.value.split("\n");

        // Find the index of the last "Prompt:"
        let lastPromptIndex = lines.length - 1;
        while (lastPromptIndex >= 0 && !lines[lastPromptIndex].startsWith("Prompt:")) {
            lastPromptIndex--;
        }

        // Remove all lines from the last "Prompt:" to the end
        if (lastPromptIndex >= 0) {
            lines.splice(lastPromptIndex, lines.length - lastPromptIndex);
            this.aiResponseTextArea.value = lines.join("\n");
        }
    };

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

function getConnectedNodeData(node) {
    // Get the connected nodes
    let connectedNodes = node.edges ? node.edges
        .filter(edge => edge.pts && edge.pts.length === 2)
        .map(edge => edge.pts[0].uuid === node.uuid ? edge.pts[1] : edge.pts[0]) : [];

    // Check if connectedNodes have valid values and exclude the originating node itself
    connectedNodes = connectedNodes.filter(connectedNode =>
        connectedNode !== undefined &&
        connectedNode.uuid !== undefined &&
        connectedNode.uuid !== node.uuid);

    console.log(`Identified ${connectedNodes.length} connected node(s)`);

    // Store the info of each connected node
    let connectedNodesInfo = [];

    // Iterate over connected nodes and fetch the content
    for (let connectedNode of connectedNodes) {
        if (!connectedNode) {
            console.error('getConnectedNodeData: Connected node is not defined.');
            continue;
        }

        const titleElement = connectedNode.content.querySelector("input.title-input");
        const title = titleElement ? titleElement.value : "No title found";

        // Here we're considering that there may be multiple textareas within a node
        const contentElements = connectedNode.content.querySelectorAll("textarea");
        let contents = [];
        contentElements.forEach(contentElement => {
            const content = contentElement ? contentElement.value : "No content found";
            contents.push(content);
        });

        const createdAt = connectedNode.createdAt;

        if (!createdAt) {
            console.warn(`getConnectedNodeData: Creation time for node ${connectedNode.uuid} is not defined.`);
        }

        const connectedNodeInfo = `node UUID: ${connectedNode.uuid}\nnode: ${title}\nText Content: ${contents.join("\n")}\nCreation Time: ${createdAt}`;
        connectedNodesInfo.push(connectedNodeInfo);
    }

    return connectedNodesInfo;
}

        function getTokenCount(messages) {
            let tokenCount = 0;
            messages.forEach(message => {
                // match words, numbers, punctuations and whitespace
                let tokens = message.content.match(/[\w]+|[^\s\w]/g);
                if (tokens !== null) {
                    tokenCount += tokens.length;
                }
            });
            return tokenCount;
        }

const maxContextSizeSlider = document.getElementById("max-context-size-slider");
const maxContextSizeDisplay = document.getElementById("max-context-size-display");

// Display the default slider value
maxContextSizeDisplay.innerHTML = maxContextSizeSlider.value;

// Update the current slider value (each time you drag the slider handle)
maxContextSizeSlider.oninput = function () {
    maxContextSizeDisplay.innerHTML = this.value;
}

function getLastPromptsAndResponses(count, maxTokens, textareaId = "note-input") {
    const lines = document.getElementById(textareaId).value.split("\n");
    const promptsAndResponses = [];
    let promptCount = 0;
    let tokenCount = 0;

    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].startsWith("Prompt:")) {
            promptCount++;
        }
        if (promptCount > count) {
            break;
        }
        tokenCount += lines[i].split(/\s+/).length;
        promptsAndResponses.unshift(lines[i]);
    }

    while (tokenCount > maxTokens) {
        const removedLine = promptsAndResponses.shift();
        tokenCount -= removedLine.split(/\s+/).length;
    }

    const lastPromptsAndResponses = promptsAndResponses.join("\n") + "\n";
    // console.log("Last prompts and responses:", lastPromptsAndResponses);
    return lastPromptsAndResponses;
}

        let aiResponding = false;
        let latestUserMessage = null;
        let controller = new AbortController();
        let shouldContinue = true;

function removeLastResponse() {
    const noteInput = document.getElementById("note-input");
    const lines = noteInput.value.split("\n");

    // Find the index of the last "Prompt:"
    let lastPromptIndex = lines.length - 1;
    while (lastPromptIndex >= 0 && !lines[lastPromptIndex].startsWith("Prompt:")) {
        lastPromptIndex--;
    }

    // Remove all lines from the last "Prompt:" to the end
    if (lastPromptIndex >= 0) {
        lines.splice(lastPromptIndex, lines.length - lastPromptIndex);
        noteInput.value = lines.join("\n");

        // Update the CodeMirror instance with the new value
        myCodeMirror.setValue(noteInput.value);
    }
}

        function haltResponse() {
            if (aiResponding) {
                // AI is responding, so we want to stop it
                controller.abort();
                aiResponding = false;
                shouldContinue = false;
                document.getElementById("regen-button").textContent = "\u21BA";
                document.getElementById("prompt").value = latestUserMessage; // Add the last user message to the prompt input
            }
        }

        function regenerateResponse() {
            if (!aiResponding) {
                // AI is not responding, so we want to regenerate
                removeLastResponse(); // Remove the last AI response
                document.getElementById("prompt").value = latestUserMessage; // Restore the last user message into the input prompt
                document.getElementById("regen-button").textContent = "\u21BA";

            }
        }

        document.getElementById("regen-button").addEventListener("click", function () {
            if (aiResponding) {
                haltResponse();
            } else {
                regenerateResponse();
            }
        });

        function checkOtherModel(selectElement) {
            var modelInput = document.getElementById('model-input');
            if (selectElement.value === 'other') {
                // If 'Other...' is selected, show the text input field
                modelInput.style.display = 'inline';
            } else {
                // Otherwise, hide the text input field and clear its value
                modelInput.style.display = 'none';
                modelInput.value = '';
            }
        }

        document.getElementById('max-tokens-slider').addEventListener('input', function (e) {
            document.getElementById('max-tokens-display').innerText = e.target.value;
        });

        async function callChatGPTApi(messages, stream = false) {
            // Reset shouldContinue
            shouldContinue = true;

            // Update aiResponding and the button
            aiResponding = true;
            document.getElementById("regen-button").textContent = '\u275A\u275A'; // Double Vertical Bar unicode

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
            controller = new AbortController();
            let signal = controller.signal;

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
                    return "An error occurred while processing your request.";
                }

                const noteInput = document.getElementById("note-input");

                if (stream) {
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder("utf-8");
                    let buffer = "";

                    while (true) {
                        const {
                            value,
                            done
                        } = await reader.read();
                        // Break the loop if streaming is done or the shouldContinue flag is set to false
                        if (done || !shouldContinue) break;

                        buffer += decoder.decode(value, {
                            stream: true
                        });

                        // If shouldContinue is false, stop processing
                        if (!shouldContinue) break;

                        // Handle content processing only when shouldContinue is true
                        if (shouldContinue) {
                            let contentMatch;
                            while ((contentMatch = buffer.match(/"content":"((?:[^\\"]|\\.)*)"/)) !== null) {
                                const content = JSON.parse('"' + contentMatch[1] + '"');

                                if (!shouldContinue) break;

                                if (content.trim() !== "[DONE]") {
                                    const isScrolledToBottom = noteInput.scrollHeight - noteInput.clientHeight <= noteInput.scrollTop + 1;
                                    if (shouldContinue) {
                                        myCodeMirror.replaceRange(content, CodeMirror.Pos(myCodeMirror.lastLine()));
                                    }
                                    if (isScrolledToBottom && !userScrolledUp) {
                                        noteInput.scrollTop = noteInput.scrollHeight;
                                        myCodeMirror.scrollTo(null, myCodeMirror.getScrollInfo().height);
                                    }
                                    noteInput.dispatchEvent(new Event("input"));
                                }
                                buffer = buffer.slice(contentMatch.index + contentMatch[0].length);
                            }
                        }
                    }
                } else {
                    const data = await response.json();
                    console.log("Token usage:", data.usage);
                    return data.choices[0].message.content.trim();
                }
            } catch (error) {
                console.error("Error calling ChatGPT API:", error);
                return "An error occurred while processing your request.";
            } finally {
                aiResponding = false;
                document.getElementById("regen-button").textContent = "\u21BA";
            }
        }


async function fetchEmbeddings(text, model = "text-embedding-ada-002") {
    const useLocalEmbeddings = document.getElementById("local-embeddings-checkbox").checked;

    // If the "Use Local Embeddings" checkbox is checked, use the local model
    if (useLocalEmbeddings && window.generateEmbeddings) {
        try {
            // This assumes that the local embedding model is initialized
            // and assigned to window.generateEmbeddings
            const output = await window.generateEmbeddings(text, {
                pooling: 'mean',
                normalize: true,
            });
            // Convert Float32Array to regular array
            return Array.from(output.data);
        } catch (error) {
            console.error("Error generating local embeddings:", error);
            return [];
        }
    } else {
        // Use the API for embeddings

        const API_KEY = document.getElementById("api-key-input").value;
        if (!API_KEY) {
            alert("Please enter your API key");
            return;
        }

        const API_URL = "https://api.openai.com/v1/embeddings";

        const headers = new Headers();
        headers.append("Content-Type", "application/json");
        headers.append("Authorization", `Bearer ${API_KEY}`);

        const body = JSON.stringify({
            model: model,
            input: text,
        });

        const requestOptions = {
            method: "POST",
            headers: headers,
            body: body,
        };

        try {
            const response = await fetch(API_URL, requestOptions);
            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error fetching embeddings:", errorData);
                return [];
            }

            const data = await response.json();
            return data.data[0].embedding;
        } catch (error) {
            console.error("Error fetching embeddings:", error);
            return [];
        }
    }
}

function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0 || vecB.length === 0) {
        return 0;
    }

    let dotProduct = 0;
    let vecASquaredSum = 0;
    let vecBSquaredSum = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        vecASquaredSum += vecA[i] * vecA[i];
        vecBSquaredSum += vecB[i] * vecB[i];
    }

    const vecAMagnitude = Math.sqrt(vecASquaredSum);
    const vecBMagnitude = Math.sqrt(vecBSquaredSum);

    if (vecAMagnitude === 0 || vecBMagnitude === 0) {
        return 0;
    }

    return dotProduct / (vecAMagnitude * vecBMagnitude);
}

        class LRUCache {
            constructor(maxSize) {
                this.maxSize = maxSize;
                this.cache = new Map();
            }

            get(key) {
                const value = this.cache.get(key);
                if (value !== undefined) {
                    this.cache.delete(key);
                    this.cache.set(key, value);
                }
                return value;
            }

            set(key, value) {
                if (this.cache.size >= this.maxSize) {
                    const oldestKey = this.cache.keys().next().value;
                    this.cache.delete(oldestKey);
                }
                this.cache.set(key, value);
            }
        }

        const MAX_CACHE_SIZE = 100;
        const nodeCache = new LRUCache(MAX_CACHE_SIZE);

        function getNodeText() {
            const nodes = [];
            for (const child of htmlnodes_parent.children) {
                if (child.firstChild && child.firstChild.win) {
                    const node = child.firstChild.win;
                    const titleInput = node.content.querySelector("input.title-input");
                    const contentWrapper = node.content.querySelector("div.content");
                    const contentElement = contentWrapper ? contentWrapper.querySelector("textarea") : null;
                    const contentText = contentElement ? contentElement.value : '';

                    nodes.push({
                        ...node,
                        searchStrings: [
                            titleInput ? titleInput.value : '',
                            contentText ? contentText : ''
                        ]
                    });
                }
            }
            return nodes;
        }

        async function embeddedSearch(searchTerm) {
            const maxNodes = document.getElementById('node-count-slider').value;
            let keywords = searchTerm.toLowerCase().split(/,\s*/);

            const nodes = getNodeText();

            if (nodes.length === 0) {
                return [];
            }

            let matched = [];

            const fetchNodeEmbedding = async (node) => {
                //console.log('Node:', node);  // DEBUG
                //console.log('Node content:', node.content);  // DEBUG

                const titleElement = node.content.querySelector(".title-input");
                const contentElement = node.content.querySelector("textarea");
                const titleText = titleElement ? titleElement.value : '';
                const contentText = contentElement ? contentElement.value : '';

                //console.log('Extracted title text:', titleText);  // DEBUG
               // console.log('Extracted content text:', contentText);  // DEBUG

                const fullText = titleText + ' ' + contentText;

                const useLocalEmbeddings = document.getElementById("local-embeddings-checkbox").checked;
                const compoundKey = `${node.uuid}-${useLocalEmbeddings ? 'local' : 'openai'}`;

                const cachedEmbedding = nodeCache.get(compoundKey);
                if (cachedEmbedding) {
                    return cachedEmbedding;
                } else {
                    const embedding = await fetchEmbeddings(fullText);
                    nodeCache.set(compoundKey, embedding);
                    return embedding;
                }
            };

            const searchTermEmbeddingPromise = fetchEmbeddings(searchTerm);
            const nodeEmbeddingsPromises = nodes.map(fetchNodeEmbedding);
            const [keywordEmbedding, ...nodeEmbeddings] = await Promise.all([searchTermEmbeddingPromise, ...nodeEmbeddingsPromises]);

         //   console.log('Keyword Embedding:', keywordEmbedding);  // DEBUG

            for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i];

                const titleMatchScore = n.searchStrings[0].toLowerCase().includes(searchTerm.toLowerCase()) ? 1 : 0;
                const contentMatchScore = keywords.filter(keyword => {
                    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                    return n.searchStrings[1].match(regex);
                }).length;
                const weightedTitleScore = titleMatchScore * 10;
                const weightedContentScore = contentMatchScore;

                const nodeEmbedding = nodeEmbeddings[i];

                const dotProduct = keywordEmbedding.reduce((sum, value, index) => sum + (value * nodeEmbedding[index]), 0);
                const keywordMagnitude = Math.sqrt(keywordEmbedding.reduce((sum, value) => sum + (value * value), 0));
                const nodeMagnitude = Math.sqrt(nodeEmbedding.reduce((sum, value) => sum + (value * value), 0));

             //   console.log('Dot Product:', dotProduct);  // DEBUG
            //   console.log('Keyword Magnitude:', keywordMagnitude);  // DEBUG
             //   console.log('Node Magnitude:', nodeMagnitude);  // DEBUG

                const cosineSimilarity = dotProduct / (keywordMagnitude * nodeMagnitude);
                console.log('Cosine Similarity:', cosineSimilarity);

                const similarityThreshold = -1;
                const keywordMatchPercentage = 0.5;

                if (weightedTitleScore + weightedContentScore > 0 || cosineSimilarity > similarityThreshold) {
                    matched.push({
                        node: n,
                        title: n.title,
                        content: n.content.innerText,
                        weightedTitleScore: weightedTitleScore,
                        weightedContentScore: weightedContentScore,
                        similarity: cosineSimilarity,
                    });
                }
            }

            matched.sort((a, b) => (b.weightedTitleScore + b.weightedContentScore + b.similarity) - (a.weightedTitleScore + a.weightedContentScore + a.similarity));
            return matched.slice(0, maxNodes).map(m => m.node);
        }



        const nodeTitlesAndContent = [];

        for (let key in nodes) {
            let nodeTitle = nodes[key].title;
            let nodeContent = nodes[key].plainText;
            nodeTitlesAndContent.push({
                title: nodeTitle,
                content: nodeContent
            });
        }

        function clearSearchHighlights(nodesArray) {
            for (const node of nodesArray) {
                node.content.classList.remove("search_matched");
                node.content.classList.remove("search_nomatch");
            }
        }



        async function generateKeywords(message, count) {
            // Get last prompts and responses
            const lastPromptsAndResponses = getLastPromptsAndResponses(2, 150);

            // Prepare the messages array
            const messages = [
                {
                    role: "system",
                    content: `Recent conversation: ${ lastPromptsAndResponses } : end of recent conversation`,
                },
                {
                    role: "system",
                    content: `You provide key search terms for other LLMS`,
                },
                {
                    role: "user",
                    content: `Without any preface or final explanation, Generate three single-word, comma-separated keywords for the latest user message: ${message}.
Keywords should predict search relevance for context. Order by relevance, starting with a word from the message.`,
                },
            ];

            // Call the API
            const keywords = await callChatGPTApi(messages);

            // Return the keywords
            return keywords.split(',').map(k => k.trim());
        }


        function sampleSummaries(summaries, top_n_links) {
            const sampledSummaries = [];
            for (let i = 0; i < top_n_links; i++) {
                if (summaries.length > 0) {
                    const randomIndex = Math.floor(Math.random() * summaries.length);
                    const randomSummary = summaries.splice(randomIndex, 1)[0];
                    sampledSummaries.push(randomSummary);
                }
            }
            return sampledSummaries;
        }

        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        }

        function isNoveltyEnabled() {
            const checkbox = document.getElementById("novelty-checkbox");
            return checkbox.checked;
        }

        function isWikipediaEnabled() {
            const checkbox = document.getElementById("wiki-checkbox");
            return checkbox.checked;
        }

        async function getWikipediaSummaries(keywords, top_n_links = 3) {
            const allSummariesPromises = keywords.map(async (keyword) => {
                try {
                    const response = await fetch(
                        `http://localhost:5000/wikipedia_summaries?keyword=${keyword}&top_n_links=${top_n_links}`
                    );

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const data = await response.json();
                    const keywordSummaries = await calculateRelevanceScores(data, await fetchEmbeddings(keyword));
                    return keywordSummaries;
                } catch (error) {
                    console.error('Error fetching Wikipedia summaries:', error);
                    alert('Failed to fetch Wikipedia summaries. Please ensure your Wikipedia server is running on localhost:5000. Localhosts can be found at the Github link in the ? tab.');
                    return [];
                }
            });

            const allSummaries = await Promise.all(allSummariesPromises);
            const summaries = [].concat(...allSummaries); // Flatten the array of summaries

            // Sort the summaries by relevance score in descending order
            summaries.sort((a, b) => b.relevanceScore - a.relevanceScore);

            const combinedSummaries = [];

            // Include the top matched summary
            combinedSummaries.push(summaries[0]);

            // Check if the novelty checkbox is checked
            if (isNoveltyEnabled()) {
                // If checked, randomly pick two summaries from the remaining summaries
                const remainingSummaries = summaries.slice(1);
                shuffleArray(remainingSummaries);
                combinedSummaries.push(...sampleSummaries(remainingSummaries, 2));
            } else {
                // If not checked, push the top n summaries
                combinedSummaries.push(...summaries.slice(1, top_n_links));
            }

            return combinedSummaries;
        }


        async function calculateRelevanceScores(summaries, searchTermEmbedding) {
            // Use the existing searchTermEmbedding for cosine similarity calculations
            const titleEmbeddings = await Promise.all(summaries.map(summary => fetchEmbeddings(summary.title)));

            for (let i = 0; i < summaries.length; i++) {
                const similarity = cosineSimilarity(searchTermEmbedding, titleEmbeddings[i]);
                summaries[i].relevanceScore = similarity;
            }

            return summaries;
        }

const wolframmessage = `"Objective:
Generate a precise Wolfram Alpha query in response to the user's message.

Guidelines:
- Include only valid search queries with no preface or explanation.
- The query should be specific to the user's message and return relevant information from Wolfram Alpha.
- Respond with a single line of code.
- If the user's input is already valid Wolfram code, use it verbatim.
- In case of vague user input, provide a general alternative query.
All your of your output should simulate a query to Wolfram Alpha with no other explnation attatched. Any response other than valid Wolfram Code will produce an error.`

const nodeTag = document.getElementById("node-tag").value;
const refTag = document.getElementById("ref-tag").value;

const codeMessage = {
    role: "system",
    content: `Code Checkbox = true requires your response to include either HTML/JS or Python code, handled by Pyodide in the browser. Follow these steps:

${nodeTag} Explanation Title (Unique)
Provide a concise preface explaining what the code accomplishes. Either HTML/JS or Python.

${nodeTag} HTML/JS Code Title (Unique title)
Wrap your code in labeled triple backtick code blocks.
1. Structure your HTML with head and body tags.
2. Set canvas size in the HTML.
3. Enclose JavaScript within script tags inside HTML. Include all Javascript within the HTML rather than a seperate document.
4. JavaScript runs in an iframe and cannot access parent page DOM.
5. Properly close HTML tags.
6. Encapsulate any CSS within style tags in the head section.
7. Ensure the entire HTML/JS code is within a single node.

${nodeTag} Python Code Title (Unique title)
Wrap your code in labeled triple backtick code blocks.
1. Only use libraries: numpy, pandas, matplotlib, scipy, py, sympy, networkx.
2. For visuals, save figures as base64 strings in HTML img tags.
3. Convert non-visual outputs to strings or HTML tables.
4. Avoid file operations and system calls.
5. Handle exceptions with try/except blocks.
6. Return the result as the last expression, don't rely on print statements.
7. Label code blocks with 'python'.
8. Ensure the entire Python code is within a single node.

${nodeTag} Final Explanation Title (Unique)
1. Explain the code and its output clearly.
2. Align the explanation with code steps.
3. Make sure the response is self-contained and doesn't rely on external files or data unless created within the code.`
};

const instructionsMessage = {
    role: "system",
    content: `The How-to checkbox is on. Please explain the fractal mind map implementation:
${nodeTag} Essential Controls:
- Drag to move; Scroll to zoom; Alt + Scroll to rotate; Alt + Click to resize multiple nodes.
- Shift + Double Click within Mandelbrot set rendering to create a text node.
- Hold shift for 'Node Mode', freezing time for node interaction.
- Shift + Scroll on a window's edge to resize.
- Shift + click on two nodes to link; Shift + Double Click on links to delete.
- Double Click a node to anchor/unanchor.
- Drag and drop multimedia files into the fractal to create nodes.
- Embed iframes by pasting links.

${nodeTag} Zettelkasten:
- Type notes in main text area using ${nodeTag} and ${refTag} (node reference tag) format.
- Save/Load notes in the settings tab or by copying and pasting main text area's content.

${nodeTag} Advanced Controls:
- Checkboxes below main text area provide additional features.
- API key setup needed for Open-Ai, Google Search, and Wolfram Alpha. OpenAI, Google Programable Search, and Wolfram API key inputs are in the Ai tab. LocalHost servers required for Extracts, Wolfram, and Wiki. Instructions are in Github link at the ? tab.
- Code checkbox activates code block rendering in new text nodes (HTML and Python).
- Search checkbox displays relevant webpages or pdfs. Requires Google Search API key unless a direct link is input as your prompt. Direct link entry bypasses google search api key requirement.
- Extract button on webpage/pdf nodes sends text to vector embeddings database Requires extracts localhost server.
- Extract checkbox sends the relevant chunks of text from the extracted webpage as context to the ai.
- The Context tab includes controls for adjusting extracted text chunk size and number of chunks. The context tab also includes a text input for directly embedding text into the vector embeddings database.
- Wolfram checkbox displays relevant Wolfram Alpha results. Requires Wolfram localhost server.
- Wiki checkbox displays relevant Wikipedia results. Requires Wiki localhost server.
- Auto checkbox sets the AI into self-prompting mode.
- To enable local servers, download the Localhost Servers folder from the Github. Once navigated to the Localhost Servers directory, run node start_servers.js

Make sure to exclusivly reference the above described controls. Try not to make anything up which is not explained in the above instructions.`
};

const aiNodesMessage = {
    role: "system",
    content: `Do not repeat the following system context in your response. The AI Nodes checkbox is enabled, which means you are being requested by the user to create AI Chat nodes. Here is how to do it:
    1. Start by typing "LLM: (unique AI title)" to denote a new Large Language Model (LLM) node.
    2. In the next line, provide an initial prompt that will be sent to the AI.
    3. Connect LLM nodes to text or other LLM nodes to add them to the AI's memory context using ${refTag}.
    
    Example:
    LLM: Understanding AI
    What is Artificial Intelligence?
    ${refTag} AI Basics, Neural Networks

    Note: Interlink LLM nodes using reference tags. This allows for a complex and nuanced conversation environment by extending the memory/context of LLM nodes they are linked with.
    Use "LLM:" prefix when creating AI chat nodes. Do not repeat system messages.`,
};


const zettelkastenPrompt = `System message to AI: 
- Responses are visualized in a fractal mind-map called Neurite.
- Use node reference tag format for visual connections.
- Do not include the instructions in the response.
Format:
    ${nodeTag} Example Title
        - Ensure Unique/Specific Node Title
        - Write plain text.
        - Provide a concise explanation of a key idea.
        - Define references for that idea.
        - Break the response into multiple connected nodes.

    ${refTag} (Node Titles to Connect)
        - Connect the response to related nodes using reference tags.

Example:
    Prompt: Create a triangle.
    ${nodeTag} Point 1
    This is the first point in our triangle.
    ${refTag}

    ${nodeTag} Point 2
    This is the second point.
    ${refTag} Point 1

    ${nodeTag} Point 3
    This point completes the triangle.
    ${refTag} Point 1, Point 2`;


        const spatialAwarenessExample = `${nodeTag} Central Node
- This is the central node from which other nodes branch out.
${refTag} Node A, Node B

${nodeTag} Node A
- This node connects to the Central Node and branches out to Node C and Node D.
${refTag} Central Node, Node C, Node D

${nodeTag} Node B
- This node branches out from the Central Node to Node E and Node F.
${refTag} Central Node, Node E, Node F

${nodeTag} Node C
- This node is an end point from Node A.
${refTag} Node A

${nodeTag} Node D
- This node is an end point from Node A.
${refTag} Node A

etc..`;

        let summarizedZettelkastenPrompt = "";

        async function summarizeZettelkastenPrompt(zettelkastenPrompt) {
            const summarizedPromptMessages = [{
                role: "system",
                content: `zettelkastenPrompt ${zettelkastenPrompt}`,
            },
            {
                role: "system",
                content: `spatialAwarenessExample ${spatialAwarenessExample}`,
            },
            {
                role: "user",
                content: `Do not preface your response.
Based on your understanding of the fractal mind-map, tagging format, and spatial awareness example, create an advanced and concise guide that demoonstates to an Ai system how to most effectivly utilize the Zettelkasten format.
Write your entire response within the format. Its important to make sure to keep your response under 200 words. Your example should use 5 nodes total.
Each node should break the response into an iterative tapestry of thought reasoning that includes all relevant information to inform an ai system about proper use of the format.
Address your response to an ai system.`,
            },
            ];

            return await callChatGPTApi(summarizedPromptMessages);
        }

        let isZettelkastenPromptSent = false;

        // Check if the user's message is a URL
        const isUrl = (text) => {
            try {
                new URL(text);
                return true;
            } catch (_) {
                return false;
            }
        }

        let MAX_CHUNK_SIZE = 400;

        const maxChunkSizeSlider = document.getElementById('maxChunkSizeSlider');
        const maxChunkSizeValue = document.getElementById('maxChunkSizeValue');

        // Display the initial slider value
        maxChunkSizeValue.textContent = maxChunkSizeSlider.value;

        // Update the current slider value (each time you drag the slider handle)
        maxChunkSizeSlider.oninput = function () {
            MAX_CHUNK_SIZE = this.value;
            maxChunkSizeValue.textContent = this.value;
        }

        let topN = 5;
        const topNSlider = document.getElementById('topNSlider');
        const topNValue = document.getElementById('topNValue');

        topNSlider.addEventListener('input', function () {
            topN = this.value;
            topNValue.textContent = this.value;
        });


        let isFirstMessage = true; // Initial value set to true
        let originalUserMessage = null;

        async function handleAutoMode() {
            const lastMessage = getLastPromptsAndResponses(1, 400);
            //console.log("Last message: ", lastMessage); // Debugging line

            // Use promptToUse if lastMessage doesn't contain the AI-generated prompt.
            const promptRegex = /prompt:\s*(.*)/i;
            const match = promptRegex.exec(lastMessage);

            if (match) {
                const aiGeneratedPrompt = match[1].trim();
                //console.log("AI generated prompt: ", aiGeneratedPrompt); // Debugging line
                return aiGeneratedPrompt;
            } else {
                console.error("AI-generated prompt not found in the last message.");
                return promptToUse;
            }
        }

async function fetchWolfram(message) {
    let wolframAlphaResult = "not-enabled";
    let wolframAlphaTextResult = "";
    let reformulatedQuery = "";

    reformulatedQuery = await callChatGPTApi([
        {
            role: "system",
            content: `${wolframmessage}` 
        },
        {
            role: "user",
            content: `${message} Wolfram Query`,
        }
    ]);

    console.log("Reformulated query:", reformulatedQuery);

    // Call Wolfram Alpha API with the reformulated query
    const apiKey = document.getElementById("wolframApiKey").value;

    const response = await fetch("http://localhost:3000", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query: reformulatedQuery,
            apiKey: apiKey
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Error with Wolfram Alpha API call:", errorData.error);
        console.error("Full error object:", errorData);
        alert("An error occurred when making a request the Wolfram Alpha. Ensure the Wolfram server is running on your localhost with a valid Wolfram API key. The API input is in the Ai tab. Localhosts can be found at the Github link in the ? tab.");
        return;
    }

    const data = await response.json();
    console.log("Wolfram Alpha data:", data); // Debugging data object

    if (!data.pods) {
        return;
    }

    const table = document.createElement("table");
    table.style = "width: 100%; border-collapse: collapse;";

    for (const pod of data.pods) {
        const row = document.createElement("tr");

        const titleCell = document.createElement("td");
        titleCell.textContent = pod.title;
        titleCell.style = "padding: 10px; background-color: #222226;";

        const imageCell = document.createElement("td");
        imageCell.style = "padding: 10px; text-align: center; background-color: white";

        for (let i = 0; i < pod.images.length; i++) {
            const imageUrl = pod.images[i];
            const plaintext = pod.plaintexts[i];

            // Adding plaintext to wolframAlphaTextResult
            wolframAlphaTextResult += `${pod.title}: ${plaintext}\n`;

            const img = document.createElement("img");
            img.alt = `${reformulatedQuery} - ${pod.title}`;
            img.style = "display: block; margin: auto; border: none;";
            img.src = imageUrl;

            imageCell.appendChild(img);
        }

        row.appendChild(titleCell);
        row.appendChild(imageCell);
        table.appendChild(row);
    }


    return { table, wolframAlphaTextResult, reformulatedQuery };
}

async function sendMessage(event, autoModeMessage = null) {
    const localLLMCheckbox = document.getElementById("localLLM");
    if (localLLMCheckbox.checked) {
        // If local LLM is checked, don't do anything.
        return false;
    }
    const isAutoModeEnabled = document.getElementById("auto-mode-checkbox").checked;
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const message = autoModeMessage ? autoModeMessage : document.getElementById("prompt").value;
    document.getElementById("prompt").value = ''; // Clear the textarea
    latestUserMessage = message;


    if (isAutoModeEnabled && originalUserMessage === null) {
        originalUserMessage = message;
    }

    // Convert nodes object to an array of nodes
    const nodesArray = Object.values(nodes);

    let keywordsArray = [];
    let keywords = '';
    
    
            const noteInput = document.getElementById("note-input");

            // Check if the last character in the note-input is not a newline, and add one if needed
            if (noteInput.value.length > 0 && noteInput.value[noteInput.value.length - 1] !== '\n') {
                myCodeMirror.replaceRange("\n", CodeMirror.Pos(myCodeMirror.lastLine()));
            }

            const keywordString = keywords.replace("Keywords: ", "");
            const splitKeywords = keywordString.split(',').map(k => k.trim());
            const firstKeyword = splitKeywords[0];
            //  console.log("split?", splitKeywords[0])
            //console.log("first keyword", firstKeyword)
            console.log("keywords", keywords)
            //    console.log("keywords[0]", keywords[0])

            if (isWikipediaEnabled()) {
                const wikipediaSummaries = await getWikipediaSummaries(keywordsArray);
                // Use the summaries as needed
            }

            // Convert the keywords string into an array by splitting on spaces


            let wikipediaSummaries;

            if (isWikipediaEnabled()) {
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

            // In your main function, check if searchQuery is null before proceeding with the Google search
            const searchQuery = await constructSearchQuery(message);
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
                searchResults = await getRelevantSearchResults(message, searchResults);
            }

            displaySearchResults(searchResults);

            const searchResultsContent = searchResults.map((result, index) => {
                return `Search Result ${index + 1}: ${result.title} - ${result.description.substring(0, 100)}...\n[Link: ${result.link}]\n`;
            }).join('\n');

            const googleSearchMessage = {
                role: "system",
                content: "Google Search Results displayed to the user:" + searchResultsContent + "END OF SEARCH RESULTS  Always remember to follow the system context message that describes the format of your response."
            };


            const embedCheckbox = document.getElementById("embed-checkbox");


            const commonInstructions = `Remember to follow the below tag format for creating nodes.
${nodeTag} Titles on line of node tag without punctuation
Do not use these example titles.
Always use different node titles. 
Plain text on the next line for your response.
Always ensure each title is unique.
!Important! Try to never repeat already existing node titles.
${refTag} Titles of other nodes separated by commas.
${nodeTag} Write your own title
Make sure any new nodes have a unique title
Break your response up into multiple nodes
Avoid repeating this context message.
${refTag} Repeat titles to connect nodes.`;

            let messages = [
                {
                    role: "system",
                    content: `All of your responses should follow the below format instructions:\n ${!isZettelkastenPromptSent ? zettelkastenPrompt : summarizedZettelkastenPrompt} \n :Avoid repeating context messages.`,
                },
            ];

            if (document.getElementById("instructions-checkbox").checked) {
                messages.push(instructionsMessage);
            }


            if (document.getElementById("code-checkbox").checked) {
                messages.push(codeMessage);
            }

            if (document.getElementById("wiki-checkbox").checked) {
                messages.push(wikipediaMessage);
            }

            if (document.getElementById("google-search-checkbox").checked) {
                messages.push(googleSearchMessage);
            }

            if (document.getElementById("ai-nodes-checkbox").checked) {
                messages.push(aiNodesMessage);
            }

            if (embedCheckbox && embedCheckbox.checked) {
                const relevantChunks = await getRelevantChunks(searchQuery, searchResults, topN, false);

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
                    content: `Top ${topN} matched snippets of text from extracted webpages: ` + topNChunksContent + `\n Provide relevant information from each chunks as well as the respective source url in the plain text of the node. Remember to always follow the Zettelkasten format. Never repeat system contextualization`
                };

                messages.push(embedMessage);
            }

            let wolframData;

            if (document.getElementById("enable-wolfram-alpha").checked) {
                wolframData = await fetchWolfram(message);
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

            // Calculate total tokens used so far
            let totalTokenCount = getTokenCount(messages);

            // calculate remaining tokens
            const maxTokensSlider = document.getElementById('max-tokens-slider');
            const remainingTokens = Math.max(0, maxTokensSlider.value - totalTokenCount);
            const maxContextSize = document.getElementById('max-context-size-slider').value;
            const contextSize = Math.min(remainingTokens, maxContextSize);

            // Update the value of getLastPromptsAndResponses
            if (autoModeMessage) {
                context = getLastPromptsAndResponses(2, contextSize);
            } else {
                if (document.getElementById("instructions-checkbox").checked) {
                    context = getLastPromptsAndResponses(1, contextSize);
                } else {
                    context = getLastPromptsAndResponses(3, contextSize);
                }
            }

    let topMatchedNodesContent = [];

    if (!document.getElementById("code-checkbox").checked &&
        !document.getElementById("instructions-checkbox").checked &&
        !isUrl(message)) {
        // Call generateKeywords function to get keywords
        const count = 3; // Change the count value as needed
        keywordsArray = await generateKeywords(message, count);

        // Join the keywords array into a single string
        keywords = keywordsArray.join(' ');

        // Get the node tag value
        const nodeTag = document.getElementById("node-tag").value;

        // Extract titles from getLastPromptsAndResponses
        let contextmatch = getLastPromptsAndResponses(3, contextSize); // Adjust count and token number as necessary

        let existingTitles = new Set();
        const titleRegex = new RegExp(nodeTag + " (.*?)\\n", "g");
        let match;
        while ((match = titleRegex.exec(contextmatch)) !== null) {
            existingTitles.add(match[1].trim()); // Trim whitespaces from the title
        }

        // Use the embeddedSearch function to find the top matched nodes based on the keywords
        clearSearchHighlights(nodesArray); // Clear previous search highlights
        const topMatchedNodes = await embeddedSearch(keywords, nodesArray);
        for (const node of topMatchedNodes) {
            node.content.classList.add("search_matched");
        }
        console.log("Top Matched Nodes:", topMatchedNodes);

        // Extract the content of the top matched nodes and pass it as context to the AI
        // Filter getlastpromptsandresponses out of topMatchedNodesContent
        topMatchedNodesContent = topMatchedNodes
            .map((node) => {
                if (!node) {
                    return null;
                }

                const titleElement = node.content.querySelector("input.title-input");
                const title = titleElement && titleElement.value !== "" ? titleElement.value.trim() : "No title found";

                // If title already present in context, don't include the node
                if (existingTitles.has(title)) {
                    return null;
                }

                // Fetch all textareas directly in the node content, without considering the specific nested divs.
                const contentElements = node.content.querySelectorAll("textarea");
                const contents = Array.from(contentElements).map(contentElement => contentElement && contentElement.value !== "" ? contentElement.value : "No content found");
                // console.log("Content:", content);

                //     const connectedNodesInfo = node.edges
                //    ? node.edges.map((edge) => {
                //         if (edge.nodeA && edge.nodeB) {
                //              const connectedNode = edge.nodeA.uuid === node.uuid ? edge.nodeB : edge.nodeA;
                //              return `Connected Node Title: ${connectedNode.uuid}\nConnected Node UUID: ${connectedNode.uuid ?? "N/A"
                //                  }\nConnected Node Position: (${connectedNode.pos.x}, ${connectedNode.pos.y})`;
                //          } else {
                //              return ''; // Return an empty string or a placeholder message if connectedNode is undefined
                //           }
                //       }).join("\n")
                //          : '';
                //
                //      const edgeInfo = node.edges
                //           .map((edge) => {
                //               if (edge.nodeA && edge.nodeB) {
                //                   return `Edge Length: ${edge.length}\nEdge Strength: ${edge.strength}\nConnected Nodes UUIDs: ${edge.nodeA.uuid}, ${edge.nodeB.uuid}`;
                //               } else {
                //                   return ''; // Return an empty string or a placeholder message if connectedNode is undefined
                //               }
                //           }).join("\n");
                const createdAt = node.createdAt;

                //UUID: ${node.uuid}\n       Creation Time: ${createdAt}

                return `${nodeTag} ${title}\n ${contents.join("\n")}`;
            })
            .filter(content => content !== null) // Remove nulls
            .join("\n\n");
        //console.log("Top Matched Nodes Content:", topMatchedNodesContent);
    }

    if (!document.getElementById("code-checkbox").checked && !document.getElementById("instructions-checkbox").checked) {
        messages.splice(1, 0, {
            role: "system",
            content: `Matched notes from mind map.This is your long term memory. Expand from these existing nodes rather than rewriting them.\n${topMatchedNodesContent}`,
        });
    }

            // Add the recent dialogue message
            messages.splice(1, 0, {
                role: "system",
                content: `Already existing dialogue with user. These are nodes you should expand from rather than writing again. Empty on start of conversation. Continue in the same format: ${context}`,
            });



            // Add Prompt

            if (autoModeMessage) {
                messages.push({
                    role: "user",
                    content: `Your self-Prompt: ${autoModeMessage}
Original Prompt: ${originalUserMessage}
${commonInstructions}
Always end your response with a new line, then, Prompt: [prompt different from your current self prompt and original prompt to continue the conversation (consider if the original goal has been accomplished while also progressing the conversation in new directions)]`,
                });
            } else {
                messages.push({
                    role: "user",
                    content: `Current user Prompt: ${message}
${commonInstructions}
${isAutoModeEnabled ? "Always end your response with a new line, then, Prompt: [the prompt to continue the conversation]" : ""}`,
                });
            }


            // Add the user prompt and a newline only if it's the first message in auto mode or not in auto mode
            if (!autoModeMessage || (isFirstMessage && autoModeMessage)) {
                myCodeMirror.replaceRange(`\nPrompt: ${message}\n\n`, CodeMirror.Pos(myCodeMirror.lastLine()));
            }

            const stream = true;

            // Main AI call
            if (stream) {
                await callChatGPTApi(messages, stream);
            } else {
                let aiResponse = await callChatGPTApi(messages, stream);

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

            // Only continue if shouldContinue flag is true
            if (shouldContinue) {
                // Handle auto mode
                if (isAutoModeEnabled && shouldContinue) {
                    // If the summarized prompt has not been generated yet, use the original zettelkasten prompt
                    let zettelkastenPromptToUse = summarizedZettelkastenPrompt !== "" ? summarizedZettelkastenPrompt : zettelkastenPrompt;
                    const aiGeneratedPrompt = await handleAutoMode(zettelkastenPromptToUse);
                    sendMessage(null, aiGeneratedPrompt);
                }

                // Check if the Zettelkasten prompt should be sent
                if (!isZettelkastenPromptSent && summarizedZettelkastenPrompt === "" && shouldContinue) {
                    // Update the isZettelkastenPromptSent flag after sending the zettelkasten prompt for the first time
                    isZettelkastenPromptSent = true;

                    // Try to get summarizedZettelkastenPrompt from local storage
                    summarizedZettelkastenPrompt = localStorage.getItem('summarizedZettelkastenPrompt');

                    if (!summarizedZettelkastenPrompt) {
                        // If it's not in the local storage, generate it and save in local storage for future use
                        summarizedZettelkastenPrompt = await summarizeZettelkastenPrompt(zettelkastenPrompt);
                        localStorage.setItem('summarizedZettelkastenPrompt', summarizedZettelkastenPrompt);
                    }
                }

                
            }
            return false;

        }

    //ENDOFAI

        // console.log("Sending context to AI:", messages);
async function performSearch(searchQuery) {
    // Get the API Key and Search Engine ID from local storage
    const apiKey = localStorage.getItem('googleApiKey');
    const searchEngineId = localStorage.getItem('googleSearchEngineId');

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURI(searchQuery)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        return data;
    } catch (error) {
        console.error('Error fetching search results:', error);
        alert('Failed to fetch search results. Please ensure you have entered your Google Programmable Search API key and search engine ID in the Ai tab.');
        return null;
    }
}

        async function constructSearchQuery(userMessage) {
            const embedCheckbox = document.getElementById("embed-checkbox");
            if (!isGoogleSearchEnabled() && (!embedCheckbox || !embedCheckbox.checked)) {
                return "not-enabled"; // Return an empty string or any default value when search is disabled
            }

            // If the user's message is a URL, use it as the search query and create a link node
            if (isUrl(userMessage)) {
                createLinkNode("User provided link", userMessage, userMessage);
                return null; // Return null to indicate that no further processing is necessary
            }

            recentcontext = getLastPromptsAndResponses(2, 200);

            const queryContext = [{
                role: "system",
                content: `The following recent conversation may provide further context for generating your search query. \n ${recentcontext},`
            },
            {
                role: "system",
                content: "Construct search queries based on user prompts... Provide a search for the current user message. Keep in mind your response will be used both as a Google search and as an vector embedded search for finding relevant chunks of webpage/pdf text. The user can not see your output. Only provide a single search query most probable to result in webpages and chunks relevant to the user query. Do not preface or explain your output.",
            },
            {
                role: "user",
                content: userMessage,
            },
            ];

            const searchQuery = await callChatGPTApi(queryContext);
            return searchQuery;
        }


    


        async function getRelevantSearchResults(userMessage, searchResults, topN = 5) {
            const userMessageEmbedding = await fetchEmbeddings(userMessage);

            // Get the embeddings for the search results and store them in an array
            const searchResultEmbeddings = await Promise.all(
                searchResults.map(async result => {
                    const titleAndDescription = result.title + " " + result.description;
                    const embedding = await fetchEmbeddings(titleAndDescription);
                    return {
                        result,
                        embedding
                    };
                })
            );

            // Calculate the cosine similarity between the user message embedding and each search result embedding
            searchResultEmbeddings.forEach(resultEmbedding => {
                resultEmbedding.similarity = cosineSimilarity(userMessageEmbedding, resultEmbedding.embedding);
            });

            // Sort the search results by their similarity scores
            searchResultEmbeddings.sort((a, b) => b.similarity - a.similarity);

            // Return the top N search results
            return searchResultEmbeddings.slice(0, topN).map(resultEmbedding => resultEmbedding.result);
        }



        //SEARCHAPI



        function isGoogleSearchEnabled() {
            const googleSearchCheckbox = document.getElementById("google-search-checkbox");
            return googleSearchCheckbox && googleSearchCheckbox.checked;
        }


        function processSearchResults(results) {
            if (!results || !results.items || !Array.isArray(results.items)) {
                return []; // Return an empty array if no valid results are found
            }

            const formattedResults = results.items.map(item => {
                return {
                    title: item.title,
                    link: item.link,
                    description: item.snippet
                };
            });

            if (!Array.isArray(formattedResults)) {
                return "No results found";
            }

            return formattedResults;
        }

        const CORS_PROXY = "http://localhost:4000/proxy";

        async function fetchAndDisplayAllKeys() {
            try {
                const response = await fetch('http://localhost:4000/get-keys');
                if (!response.ok) {
                    console.error(`Failed to fetch keys:`, response.statusText);
                    return;
                }


                const keys = await response.json();
                const keyList = document.getElementById("key-list");
                // Clear existing keys
                keyList.innerHTML = "";

                for (let key of keys) {
                    // Create a new paragraph for the key
                    var listItem = document.createElement("p");

                    // Set the text of the paragraph to the key
                    listItem.textContent = key;

                    // Add the paragraph to the list
                    keyList.appendChild(listItem);

                    // Add a click event listener to the paragraph
                    // Make use of closures to capture each listItem instance separately
                    (function (listItem) {
                        listItem.addEventListener("click", (event) => {
                            event.stopPropagation();
                            listItem.classList.toggle("selected");
                        });
                    })(listItem);
                }
            } catch (error) {
                console.error(`(Server disconnect) Failed to fetch keys:`, error);
            }
        }

        window.onload = function () {
            fetchAndDisplayAllKeys();
        }

        document.getElementById('chunkAndStoreButton').addEventListener('click', chunkAndStoreInputExtract);

        async function deleteSelectedKeys() {
            // Get all selected keys
            const selectedKeys = Array.from(document.getElementsByClassName("selected")).map(el => el.textContent);

            // Send a request to the server to delete the chunks for each key
            for (let key of selectedKeys) {
                const response = await fetch(`http://localhost:4000/delete-chunks?key=${encodeURIComponent(key)}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    console.error(`Failed to delete chunks for key ${key}:`, response.statusText);
                }
            }

            // Refresh the key list
            fetchAndDisplayAllKeys();
        }

        async function chunkAndStoreInputExtract() {
            const chunkAndStoreButton = document.getElementById('chunkAndStoreButton');
            let dotCount = 0;

            // Start the dot animation
            const dotInterval = setInterval(() => {
                dotCount = (dotCount + 1) % 4; // Cycle dotCount between 0 and 3
                chunkAndStoreButton.textContent = "Chunking Input" + ".".repeat(dotCount);
            }, 500); // Update every 500 milliseconds

            try {
                // Get the input text from the textarea
                const inputText = document.getElementById('inputTextExtract').value;

                if (!inputText) {
                    alert("Please enter some text into the textarea");
                    return;
                }

                // Chunk the input text
                const chunkedText = chunkText(inputText, MAX_CHUNK_SIZE, overlapSize);

                // Fetch the embeddings for the chunks
                const chunkedEmbeddings = await fetchChunkedEmbeddings(chunkedText);

                // Get the key from the input field, or use the first sentence of the input text if no key was provided
                let key = document.getElementById('inputKeyExtract').value;
                if (!key) {
                    // Extract the first sentence from the input text
                    // This regex matches everything up to the first period, question mark, or exclamation mark
                    const firstSentenceMatch = inputText.match(/[^.!?]+[.!?]/);
                    key = firstSentenceMatch ? firstSentenceMatch[0] : inputText;
                }

                // Store the chunks and their embeddings in the database
                const success = await storeEmbeddingsAndChunksInDatabase(key, chunkedText, chunkedEmbeddings);

                chunkAndStoreButton.textContent = success ? "Store Chunks" : "Chunking Failed";

            } catch (error) {
                console.error(`Failed to chunk and store input:`, error); //1872
                chunkAndStoreButton.textContent = "Chunking Failed";
            } finally {
                // Stop the dot animation
                clearInterval(dotInterval);
            }
        }

async function storeEmbeddingsAndChunksInDatabase(key, chunks, embeddings) {
    console.log(`Storing embeddings and text chunks for key: ${key}`);

    // Check if local embeddings are used
    const useLocalEmbeddings = document.getElementById("local-embeddings-checkbox").checked;
    const source = useLocalEmbeddings ? 'local' : 'openai';

    try {
        for (let i = 0; i < chunks.length; i++) {
            const chunkKey = `${key}_chunk_${i}`;
            const response = await fetch('http://localhost:4000/store-embedding-and-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    key: chunkKey,
                    embedding: embeddings[i],
                    text: chunks[i],
                    source: source  // attach the source tag
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to store chunk ${i} for key ${key}: ${response.statusText}`);
            }
        }

        // If no errors, refresh the key list
        await fetchAndDisplayAllKeys();

        // If no errors, return true to indicate success
        return true;
    } catch (error) {
        console.error(`Failed to store chunks and embeddings for key ${key}:`, error);
        throw error;
    }
}

        async function fetchAndStoreWebPageContent(url) {
            try {
                const response = await fetch(`${CORS_PROXY}?url=${encodeURIComponent(url)}`);

                if (!response.ok) {
                    console.error(`Failed to fetch web page content for ${url}:`, response.statusText);
                    return null;
                }

                const contentType = response.headers.get("content-type");
                const extractedTextResponse = await fetch(`${CORS_PROXY}/extract-text?url=${encodeURIComponent(url)}`);
                const text = await extractedTextResponse.text();

                if (typeof text !== "string") {
                    console.warn(`Text type for ${url}: ${contentType}`);
                    console.warn(`Text for ${url}:`, text);
                    return null;
                }

                const chunkedText = chunkText(extractedText, MAX_CHUNK_SIZE, overlapSize);
                const chunkedEmbeddings = await fetchChunkedEmbeddings(chunkedText);

                // Store the chunked embeddings and text in the database
                await storeEmbeddingsAndChunksInDatabase(url, chunkedText, chunkedEmbeddings);
            } catch (error) {
                console.error(`Failed to fetch web page content for ${url}:`, error);
                alert("An error occurred fetching the top-n relevant chunks of extracted webpage text. Please ensure that the extract server is running on your localhost. Localhosts can be found at the Github link in the ? tab.");
                return null;
            }
        }

        async function fetchAllStoredEmbeddings() {
            try {
                const response = await fetch(`http://localhost:4000/fetch-all-embeddings`);

                if (!response.ok) {
                    console.error(`Failed to fetch stored embeddings:`, response.statusText);
                    return null;
                }

                // Parse the response text as JSON
                const embeddings = await response.json();
                //console.log('Fetched all stored embeddings:', embeddings);
                return embeddings;

            } catch (error) {
                console.error(`Failed to fetch stored embeddings:`, error);
                alert("An error occurred fetching the top-n relevant chunks of extracted webpage text. Please ensure that the extract server is running on your localhost. Localhosts can be found at the Github link in the ? tab.");
                return null;
            }
        }

        function chunkText(text, maxLength, overlapSize) {
    const sentences = text.match(/[^.!?]+\s*[.!?]+|[^.!?]+$/g);  // Modified regex to preserve punctuation and spaces
    const chunks = [];
    let chunkWords = [];
    let chunkLength = 0;

    for (const sentence of sentences) {
        const words = sentence.split(/\s+/);

        for (const word of words) {
            // Add 1 for the space if not the first word in the chunk
            const wordLengthWithSpace = chunkLength === 0 ? word.length : word.length + 1;

            // Check if single word exceeds maxLength
            if (word.length > maxLength) {
                throw new Error(`Word length exceeds maxLength: ${word}`);
            }

            // Check if adding new word exceeds maxLength
            if (chunkLength + wordLengthWithSpace > maxLength) {
                chunks.push(chunkWords.join(' '));
                chunkWords = chunkWords.slice(-overlapSize);
                chunkLength = chunkWords.join(' ').length;
            }

            // Add the word to the current chunk
            if (chunkLength > 0) {
                chunkWords.push(' ' + word);
                chunkLength += wordLengthWithSpace;
            } else {
                chunkWords.push(word);
                chunkLength += word.length;
            }
        }
    }

    // Add the remaining chunk if it's not empty
    if (chunkWords.length > 0) {
        chunks.push(chunkWords.join(' '));
    }

    return chunks;
}

async function getRelevantChunks(searchQuery, searchResults) {
    const searchQueryEmbedding = await fetchEmbeddings(searchQuery);

    const allEmbeddings = await fetchAllStoredEmbeddings();
    if (!allEmbeddings) {
        console.error("No embeddings were fetched. Please check the server logs for more information.");
        return [];
    }

    const useLocalEmbeddings = document.getElementById("local-embeddings-checkbox").checked;

    const chunkEmbeddings = allEmbeddings.flatMap(embedding => {
        if (!useLocalEmbeddings && embedding.source === 'local') {
            return []; // Ignore local embeddings when checkbox is not checked
        } else if (useLocalEmbeddings && embedding.source !== 'local') {
            return []; // Ignore non-local embeddings when checkbox is checked
        }
                if (typeof embedding.chunks === 'string') {
                    const result = {
                        link: embedding.key,
                        description: embedding.chunks
                    };
                    return [{
                        result,
                        embedding: embedding.embedding,
                        source: embedding.source // Extract source here
                    }];
                } else if (Array.isArray(embedding.chunks)) {
                    return embedding.chunks.map(chunk => {
                        const result = {
                            link: embedding.key,
                            description: chunk.text
                        };
                        return {
                            result,
                            embedding: chunk.embedding,
                            source: chunk.source // Extract source here
                        };
                    });
                } else {
                    return [];
                }
            });

            // Calculate the cosine similarity between the search query embedding and each chunk embedding
            chunkEmbeddings.forEach(chunkEmbedding => {
                const embedding = chunkEmbedding.embedding;
                const source = chunkEmbedding.source; // Use extracted source

                if (embedding && embedding.length > 0) {
                    let similarity = cosineSimilarity(
                        searchQueryEmbedding,
                        embedding
                    );


                    chunkEmbedding.similarity = similarity;
                } else {
                    chunkEmbedding.similarity = 0;
                }
            });
            //console.log("Chunk embeddings with similarity:", chunkEmbeddings); //4551

            // Sort the chunks by their similarity scores
            chunkEmbeddings.sort((a, b) => b.similarity - a.similarity);
            console.log("Sorted chunk embeddings:", chunkEmbeddings);

            // Return the top N chunks
            const topNChunks = chunkEmbeddings
                .slice(0, topN)
                .map(chunkEmbedding => ({
                    text: chunkEmbedding.result.description,
                    source: chunkEmbedding.result.link,
                    relevanceScore: chunkEmbedding.similarity
                }));
            console.log("Top N Chunks:", topNChunks);

            return topNChunks;
        }

        let overlapSize = document.getElementById('overlapSizeSlider').value;

        document.getElementById('overlapSizeSlider').addEventListener('input', function (e) {
            overlapSize = Number(e.target.value);
            document.getElementById('overlapSizeDisplay').textContent = overlapSize;
        });




async function fetchChunkedEmbeddings(textChunks, model = "text-embedding-ada-002") {
    const useLocalEmbeddings = document.getElementById("local-embeddings-checkbox").checked;

    // Array to store the embeddings
    const chunkEmbeddings = [];

    // Loop through each chunk of text
    for (const chunk of textChunks) {

        // Check if local embeddings should be used
        if (useLocalEmbeddings && window.generateEmbeddings) {
            try {
                // This assumes that the local embedding model is initialized
                // and assigned to window.generateEmbeddings
                const output = await window.generateEmbeddings(chunk, {
                    pooling: 'mean',
                    normalize: true,
                });
                // Convert Float32Array to regular array
                chunkEmbeddings.push(Array.from(output.data));
            } catch (error) {
                console.error("Error generating local embeddings:", error);
                chunkEmbeddings.push([]);
            }
        } else {
            // Use the API for embeddings
            const API_KEY = document.getElementById("api-key-input").value;
            if (!API_KEY) {
                alert("Please enter your API key");
                return;
            }

            const API_URL = "https://api.openai.com/v1/embeddings";

            const headers = new Headers();
            headers.append("Content-Type", "application/json");
            headers.append("Authorization", `Bearer ${API_KEY}`);

            const body = JSON.stringify({
                model: model,
                input: chunk,
            });

            const requestOptions = {
                method: "POST",
                headers: headers,
                body: body,
            };

            try {
                const response = await fetch(API_URL, requestOptions);
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error("Error fetching embeddings:", errorData);
                    chunkEmbeddings.push([]);
                    continue;
                }

                const data = await response.json();
                const embedding = data.data[0].embedding;

                chunkEmbeddings.push(embedding);
            } catch (error) {
                console.error("Error fetching embeddings:", error);
                chunkEmbeddings.push([]);
            }
        }
    }
    return chunkEmbeddings;
}

        function createLinkNode(name = '', text = '', link = '', sx = undefined, sy = undefined, x = undefined, y = undefined) {
            let t = document.createElement("input");
            t.setAttribute("type", "text");
            t.setAttribute("value", name);
            t.setAttribute("style", "background:none; ");
            t.classList.add("title-input");

            let a = document.createElement("a");
            a.setAttribute("href", link);
            a.setAttribute("target", "_blank");
            a.textContent = text;
            a.setAttribute("style", "display: block; padding: 10px; word-wrap: break-word; white-space: pre-wrap;");

            let linkWrapper = document.createElement("div");
            linkWrapper.style.width = "300px";
            linkWrapper.appendChild(a);

            let iframeWrapper = document.createElement("div");
            iframeWrapper.style.width = "100%";
            iframeWrapper.style.height = "0";
            iframeWrapper.style.flexGrow = "1";
            iframeWrapper.style.flexShrink = "1";
            iframeWrapper.style.display = "none";
            iframeWrapper.style.boxSizing = "border-box";

            let iframe = document.createElement("iframe");
            iframe.setAttribute("src", "");
            iframe.setAttribute("style", "width: 100%; height: 100%; border: none; overflow: auto;");

            iframe.addEventListener("load", () => {
                const buttonHeight = button.offsetHeight + displayButton.offsetHeight + extractButton.offsetHeight;
                const minHeight = iframe.offsetHeight + buttonHeight + 35;
                const currentHeight = parseInt(windowDiv.style.height, 10);

                if (currentHeight < minHeight) {
                    windowDiv.style.height = `${minHeight}px`;
                }
            });

            let button = document.createElement("button");
            button.textContent = "Load as iframe";
            button.classList.add("linkbuttons");

            button.addEventListener("click", () => {
                if (iframeWrapper.style.display === "none") {
                    iframeWrapper.appendChild(iframe);
                    linkWrapper.style.display = "none";
                    iframeWrapper.style.display = "block";
                    button.textContent = "Return to link";

                    // Set the src attribute of the iframe here
                    iframe.setAttribute("src", link);

                    // Adjust the height of the iframeWrapper to accommodate buttons
                    let availableHeight = windowDiv.offsetHeight - buttonsWrapper.offsetHeight;
                    iframeWrapper.style.height = availableHeight + 'px';
                } else {
                    linkWrapper.style.display = "block";
                    iframeWrapper.style.display = "none";
                    button.textContent = "Load as iframe";
                    // Clear the src attribute of the iframe here
                    iframe.setAttribute("src", "");
                }
            });

            let extractButton = document.createElement("button");
            extractButton.textContent = "Extract Text";
            extractButton.classList.add("linkbuttons");

            extractButton.addEventListener("click", function () {
                let dotCount = 0;

                // Start the dot animation
                const dotInterval = setInterval(() => {
                    dotCount = (dotCount + 1) % 4; // Cycle dotCount between 0 and 3
                    extractButton.textContent = "Extracting" + ".".repeat(dotCount);
                }, 500); // Update every 500 milliseconds

                setTimeout(async function () {
                    try {
                        // Send the link to the server for text extraction
                        const response = await fetch('http://localhost:4000/proxy?url=' + encodeURIComponent(link));

                        // Handle the server response
                        if (response.ok) {
                            const extractedText = await response.text();
                            console.log('Extracted text:', extractedText);

                            // Chunk the extracted text
                            const chunkedText = chunkText(extractedText, MAX_CHUNK_SIZE, overlapSize);

                            // Fetch embeddings for the chunked text
                            const chunkedEmbeddings = await fetchChunkedEmbeddings(chunkedText);

                            // Store the embeddings in the database along with the extracted text
                            await storeEmbeddingsAndChunksInDatabase(link, chunkedText, chunkedEmbeddings);

                            extractButton.textContent = "Extracted";
                        } else {
                            console.error('Failed to extract text:', response.statusText);
                            extractButton.textContent = "Extract Failed";
                            alert("Failed to connect to the local server. Please ensure that the extract server is running on your localhost. Localhosts can be found at the Github link in the ? tab.");
                        }
                    } catch (error) {
                        console.error('Error during extraction:', error);
                        extractButton.textContent = "Extract Failed";
                        alert("An error occurred during extraction. Please ensure that the extract server is running on your localhost. Localhosts can be found at the Github link in the ? tab.");
                    } finally {
                        // Stop the dot animation
                        clearInterval(dotInterval);
                    }
                }, 500);
            });

            let displayWrapper = document.createElement("div");
            displayWrapper.style.width = "100%";
            displayWrapper.style.height = "100%";
            displayWrapper.style.flexGrow = "1";
            displayWrapper.style.flexShrink = "1";
            displayWrapper.style.display = "none";
            displayWrapper.style.boxSizing = "border-box";

            let displayButton = document.createElement("button");
            displayButton.textContent = "Display Webpage";
            displayButton.classList.add("linkbuttons");

            displayButton.addEventListener("click", async function () {

                let displayIframe = displayWrapper.querySelector("iframe");

                if (displayIframe) {
                    displayIframe.remove();
                    displayButton.textContent = "Display Webpage";
                    displayWrapper.style.display = "none";
                    linkWrapper.style.display = "block";
                } else {
                    // Iframe does not exist, so fetch the webpage content and create it
                    const response = await fetch('http://localhost:4000/raw-proxy?url=' + encodeURIComponent(link));

                    if (response.ok) {
                        const webpageContent = await response.text();

                        displayIframe = document.createElement("iframe");
                        displayIframe.srcdoc = webpageContent;
                        displayIframe.style.width = "100%";
                        displayIframe.style.height = "100%";
                        displayIframe.style.overflow = "auto";

                        displayIframe.addEventListener("load", () => {
                            const buttonHeight = button.offsetHeight + displayButton.offsetHeight + extractButton.offsetHeight;
                            const minHeight = displayIframe.offsetHeight + buttonHeight + 35;
                            const currentHeight = parseInt(windowDiv.style.height, 10);

                            if (currentHeight < minHeight) {
                                windowDiv.style.height = `${minHeight}px`;
                            }
                        });

                        displayWrapper.appendChild(displayIframe);
                        displayButton.textContent = "Close Webpage";
                        displayWrapper.style.display = "block";
                        linkWrapper.style.display = "none";

                        let availableHeight = windowDiv.offsetHeight - buttonsWrapper.offsetHeight;
                        displayWrapper.style.height = availableHeight + 'px';
                    } else {
                        console.error('Failed to fetch webpage content:', response.statusText);
                        alert("An error occurred displaying the webpage through a proxy server. Please ensure that the extract server is running on your localhost. Localhosts can be found at the Github link in the ? tab.");
                    }
                }
            });


            let node = addNodeAtNaturalScale(name, []);
            let windowDiv = node.content.querySelector(".window");

            let buttonsWrapper = document.createElement("div");
            buttonsWrapper.classList.add("buttons-wrapper");
            buttonsWrapper.style.order = "1";
            buttonsWrapper.appendChild(button);
            buttonsWrapper.appendChild(displayButton);
            buttonsWrapper.appendChild(extractButton);

            let contentWrapper = document.createElement("div");
            contentWrapper.style.display = "flex";
            contentWrapper.style.flexDirection = "column";
            contentWrapper.style.alignItems = "center";
            contentWrapper.style.height = "100%";

            contentWrapper.appendChild(linkWrapper);
            contentWrapper.appendChild(iframeWrapper);
            contentWrapper.appendChild(displayWrapper);
            contentWrapper.appendChild(buttonsWrapper);

            windowDiv.appendChild(contentWrapper);

            let minWidth = Math.max(linkWrapper.offsetWidth, contentWrapper.offsetWidth) + 5;
            let minHeight = Math.max(linkWrapper.offsetHeight, contentWrapper.offsetHeight) + 35;
            windowDiv.style.width = minWidth + "px";
            windowDiv.style.height = minHeight + "px";

            // Initialize the resize observer
            observeContentResize(windowDiv, iframeWrapper, displayWrapper);

            return node;
        }

        function observeContentResize(windowDiv, iframeWrapper, displayWrapper) {
            const resizeObserver = new ResizeObserver((entries) => {
                for (let entry of entries) {
                    const {
                        width,
                        height
                    } = entry.contentRect;

                    // Find the buttonsWrapper inside windowDiv
                    const buttonsWrapper = windowDiv.querySelector(".buttons-wrapper");

                    if (buttonsWrapper) {
                        // Calculate the available height for the iframes
                        let buttonsHeight = buttonsWrapper.offsetHeight || 0;
                        let iframeHeight = Math.max(0, height - buttonsHeight - 50); // Subtract additional margin

                        // Update the width and height of iframeWrapper and displayWrapper
                        iframeWrapper.style.width = width + "px";
                        iframeWrapper.style.height = iframeHeight + "px";
                        displayWrapper.style.width = width + "px";
                        displayWrapper.style.height = iframeHeight + "px";
                    }
                }
            });

            resizeObserver.observe(windowDiv);
        }

        function createLinkElement(link, text) {
            const linkWrapper = document.createElement("div");
            linkWrapper.style.width = "300px";
            const a = document.createElement("a");
            a.setAttribute("href", link);
            a.setAttribute("target", "_blank");
            a.textContent = text;
            a.setAttribute("style", "display: block; padding: 10px; word-wrap: break-word; white-space: pre-wrap;");
            linkWrapper.appendChild(a);
            return linkWrapper;
        }

        function displaySearchResults(searchResults) {
            searchResults.forEach((result, index) => {
                let title = `Search Result ${index + 1}: ${result.title}`;
                let description = result.description.substring(0, 500) + "...";
                let link = result.link;

                let node = createLinkNode(title, description, link);

                htmlnodes_parent.appendChild(node.content);
                registernode(node);
                // Attach the node to the user's mouse
                node.followingMouse = 1;
                node.draw();
                node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
            });
        }