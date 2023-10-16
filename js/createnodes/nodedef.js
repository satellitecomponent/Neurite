

function createTextNode(name = '', text = '', sx = undefined, sy = undefined, x = undefined, y = undefined, addCodeButton = false) {
    let t = document.createElement("input");
    t.setAttribute("type", "text");
    t.setAttribute("value", "untitled");
    t.setAttribute("style", "background:none; ");
    t.classList.add("title-input");

    let n = document.createElement("textarea");
    n.classList.add('custom-scrollbar');
    n.onmousedown = cancel;
    n.setAttribute("type", "text");
    n.setAttribute("size", "11");
    n.setAttribute("style", "background-color: #222226; color: #bbb; overflow-y: scroll; resize: both; width: 259px; line-height: 1.4;");
    n.style.display = "none";

    let elements = [n];

    let buttonCallback = null;

    let button = document.createElement("button");
    button.innerHTML = "Render Code";
    button.classList.add("code-button");

    // Initially hide the button
    button.style.display = "none";

    if (document.getElementById('code-checkbox')) {
        // Add an event listener to the checkbox to show/hide the button based on its state
        document.getElementById('code-checkbox').addEventListener('change', (event) => {
            // If addCodeButton is set, always show the button and return
            if (addCodeButton) {
                button.style.display = "block";
                return;
            }

            if (event.target.checked) {
                button.style.display = "block";
            } else {
                button.style.display = "none";
            }
        });

        // If the checkbox is initially checked, show the button
        if (document.getElementById('code-checkbox').checked) {
            button.style.display = "block";
        }
    }

    if (addCodeButton) {
        // If addCodeButton is set, always show the button
        button.style.display = "block";
    }

    let node = addNodeAtNaturalScale(name, [n]); // Just add the textarea for now

    let editableDiv = createContentEditableDiv(n);  // Define editableDiv here
    node.contentEditableDiv = editableDiv;  // Assign it to the node's property

    let windowDiv = node.content.querySelector('.window');  // Find the .content div
    windowDiv.appendChild(editableDiv);  // Append the contentEditable div to .content div

    // Store the callback to set up the button onclick handler.
    buttonCallback = (node) => handleCodeButton(button, n, node);
    windowDiv.appendChild(button);  // Append the button after the contentEditable div

    // Call the button callback after the node has been created.
    if (buttonCallback) {
        buttonCallback(node);
    }
    node.addCodeButton = addCodeButton;

    addEventsToContentEditable(editableDiv, n, node);
    watchTextareaAndSyncWithContentEditable(n, editableDiv);

    if (sx !== undefined) {
        x = (new vec2(sx, sy)).cmult(zoom).plus(pan);
        y = x.y;
        x = x.x;
    }

    if (x !== undefined) {
        node.pos.x = x;
    }

    if (y !== undefined) {
        node.pos.y = y;
    }

    node.push_extra_cb((node) => {
        return {
            f: "textarea",
            a: {
                p: [0, 0, 1],
                v: t.value
            }
        };
    })

    node.push_extra_cb((node) => {
        return {
            f: "textarea",
            a: {
                p: [0, 1, 0],
                v: n.value
            }
        };
    })

    node.isTextNode = true;

    return node;
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
    a.style.cssText = "display: block; padding: 10px; word-wrap: break-word; white-space: pre-wrap; color: #bbb; transition: color 0.2s ease, background-color 0.2s ease; background-color: #222226; border-radius: 5px";

    a.addEventListener('mouseover', function () {
        this.style.color = '#888';
        this.style.backgroundColor = '#1a1a1d'; // Change background color on hover
    }, false);

    a.addEventListener('mouseout', function () {
        this.style.color = '#bbb';
        this.style.backgroundColor = '#222226'; // Reset background color when mouse leaves
    }, false);

    let linkWrapper = document.createElement("div");
    linkWrapper.style.width = "300px";
    linkWrapper.style.padding = "20px 0"; // Add vertical padding
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

    //iframe button

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

    //extract text

    let extractButton = document.createElement("button");
    extractButton.textContent = "Extract Text";
    extractButton.classList.add("linkbuttons");

    extractButton.addEventListener("click", async function () {
        let dotCount = 0;

        // Start the dot animation
        const dotInterval = setInterval(() => {
            dotCount = (dotCount + 1) % 4; // Cycle dotCount between 0 and 3
            extractButton.textContent = "Extracting" + ".".repeat(dotCount);
        }, 500); // Update every 500 milliseconds

        let storageKey = link; // Default to link (blob URL)

        if (node && node.fileName) { // Check if fileName property exists
            storageKey = node.fileName; // Use fileName as storage key if available
        }

        async function processExtraction(text, storageKey) {
            // Chunk the extracted text
            const chunkedText = chunkText(text, MAX_CHUNK_SIZE, overlapSize);

            // Fetch embeddings for the chunked text
            const chunkedEmbeddings = await fetchChunkedEmbeddings(chunkedText);

            extractButton.textContent = "Storing...";

            // Store the embeddings in the database along with the extracted text
            await storeEmbeddingsAndChunksInDatabase(storageKey, chunkedText, chunkedEmbeddings);

            extractButton.textContent = "Extracted";
        }

        setTimeout(async function () {
            try {
                if (link.toLowerCase().endsWith('.pdf') || link.startsWith('blob:')) {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.9.179/build/pdf.worker.min.js';
                    const loadingTask = pdfjsLib.getDocument(link);
                    loadingTask.promise.then(async (pdf) => {
                        let extractedText = '';
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i);
                            const textContent = await page.getTextContent();
                            extractedText += textContent.items.map(item => item.str).join(' ');
                        }
                        await processExtraction(extractedText, storageKey);
                    }).catch(error => {
                        console.error('Error reading PDF:', error);
                        extractButton.textContent = "Extract Failed";
                    });
                } else {
                    const response = await fetch('http://localhost:4000/proxy?url=' + encodeURIComponent(link));
                    if (response.ok) {
                        const extractedText = await response.text();
                        await processExtraction(extractedText, link);
                    } else {
                        console.error('Failed to extract text:', response.statusText);
                        extractButton.textContent = "Extract Failed";
                        alert("Failed to connect to the local server. Please ensure that the extract server is running on your localhost. Localhosts can be found at the Github link in the ? tab.");
                    }
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

    //display through proxy

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

    node.isLink = true;

    return node;
}


function createLLMNode(name = '', sx = undefined, sy = undefined, x = undefined, y = undefined) {
    llmNodeCount++;

    // Create the AI response textarea
    let aiResponseTextArea = document.createElement("textarea");
    aiResponseTextArea.id = `LLMnoderesponse-${llmNodeCount}`;  // Assign unique id to each aiResponseTextArea
    aiResponseTextArea.style.display = 'none';  // Hide the textarea

    // Create the AI response container
    let aiResponseDiv = document.createElement("div");
    aiResponseDiv.id = `LLMnoderesponseDiv-${llmNodeCount}`;  // Assign unique id to each aiResponseDiv
    aiResponseDiv.classList.add('custom-scrollbar');

    // Modify the onmousedown function to check for the Alt key
    aiResponseDiv.onmousedown = function (event) {
        if (!event.altKey) {
            cancel(event); // Prevent dragging if Alt key is NOT pressed
        }
    };

    // Disable text highlighting when Alt key is down and re-enable when it's up
    document.addEventListener('keydown', function (event) {
        if (event.altKey) {
            aiResponseDiv.style.userSelect = 'none';
        }
    });

    document.addEventListener('keyup', function (event) {
        if (!event.altKey) {
            aiResponseDiv.style.userSelect = 'text';
        }
    });
    aiResponseDiv.setAttribute("style", "background: linear-gradient(to bottom, rgba(34, 34, 38, 0), #222226); color: inherit; border: none; border-color: #8882; width: 530px; height: 450px; overflow-y: auto; overflow-x: hidden; resize: both; word-wrap: break-word; user-select: none; padding-left: 25px; padding-right: 25px; line-height: 1.75;");
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
    promptTextArea.id = `nodeprompt-${llmNodeCount}`;
    promptTextArea.classList.add('custom-scrollbar');
    promptTextArea.onmousedown = cancel;  // Prevent dragging
    promptTextArea.setAttribute("style", "background-color: #222226; color: inherit; border: inset; border-color: #8882; width: 100%; height: 70px; overflow-y: hidden; padding: 10px; box-sizing: border-box; resize: none; user-select: none;");
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
    sendButton.id = `prompt-form-${llmNodeCount}`;
    sendButton.style.cssText = "display: flex; justify-content: center; align-items: center; padding: 3px; z-index: 1; font-size: 14px; cursor: pointer; background-color: #222226; transition: background-color 0.3s; border: inset; border-color: #8882; width: 30px; height: 30px;"; sendButton.addEventListener('mouseover', function () {
        this.style.backgroundColor = '#45a049';
        this.style.color = '#222226';
    });
    sendButton.innerHTML = `
    <svg width="24" height="24">
        <use xlink:href="#play-icon"></use>
    </svg>`;
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
    regenerateButton.id = "prompt-form";
    regenerateButton.style.cssText = "display: flex; justify-content: center; align-items: center; padding: 3px; z-index: 1; font-size: 14px; cursor: pointer; background-color: #222226; transition: background-color 0.3s; border: inset; border-color: #8882; width: 30px; height: 30px;";
    regenerateButton.innerHTML = `
    <svg width="24" height="24">
        <use xlink:href="#refresh-icon"></use>
    </svg>`;
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
    buttonDiv.style.cssText = "display: flex; flex-direction: column; align-items: flex-end; margin-bottom: 12px; margin-top: 4px;";

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


    // Options for the dropdown
    let option1 = new Option('Red Pajama 3B f32', 'RedPajama-INCITE-Chat-3B-v1-q4f32_0', false, true);
    let option2 = new Option('Vicuna 7B f32', 'vicuna-v1-7b-q4f32_0', false, false);
    let option3 = new Option('Llama 2 7B f32', 'Llama-2-7b-chat-hf-q4f32_1', false, false);
    let option4 = new Option('Llama 2 13B f32', 'Llama-2-13b-chat-hf-q4f32_1', false, false);
    let option5 = new Option('Llama 2 70B f16', 'Llama-2-70b-chat-hf-q4f16_1', false, false);
    let option6 = new Option('WizardCoder 15B f32', '"WizardCoder-15B-V1.0-q4f32_1', false, false);
    let option7 = new Option('OpenAI', 'OpenAi', false, false);

    LocalLLMSelect.add(option1, undefined);
    LocalLLMSelect.add(option2, undefined);
    LocalLLMSelect.add(option3, undefined);
    //LocalLLMSelect.add(option4, undefined);
    LocalLLMSelect.add(option5, undefined);
    //LocalLLMSelect.add(option6, undefined);
    LocalLLMSelect.add(option7, undefined);

    // Append dropdown to the div
    wrapperDiv.appendChild(LocalLLMSelect);
    setupCustomDropdown(LocalLLMSelect);

    // Find the parent .select-container after the setupCustomDropdown function
    let selectContainer = LocalLLMSelect.closest('.select-container');

    if (localLLMCheckbox.checked) {
        selectContainer.style.display = "block";
    } else {
        selectContainer.style.display = "none";
    }

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
    node.localAiResponding = false;
    node.latestUserMessage = null;
    node.controller = new AbortController();
    node.shouldContinue = true;
    node.LocalLLMSelectID = `dynamicLocalLLMselect-${llmNodeCount}`;
    node.index = llmNodeCount;
    node.isLLMNode = true;
    node.wrapperDiv = wrapperDiv;
    node.shouldAppendQuestion = false;
    node.aiResponseHalted = false;


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

    //Handles parsing of conversation divs.
    let responseHandler = new ResponseHandler(node);
    nodeResponseHandlers.set(node, responseHandler); // map response handler to node

    node.removeLastResponse = responseHandler.removeLastResponse.bind(responseHandler);

    node.haltResponse = function () {
        if (this.aiResponding) {
            // AI is responding, so we want to stop it
            this.controller.abort(); // This line sends the abort signal to the fetch request
            this.aiResponding = false;
            this.shouldContinue = false;
            this.regenerateButton.innerHTML = `
    <svg width="24" height="24" class="icon">
        <use xlink:href="#refresh-icon"></use>
    </svg>`;
            this.promptTextArea.value = this.latestUserMessage; // Add the last user message to the prompt input

            // If currently in a code block
            if (responseHandler.inCodeBlock) {
                // Add closing backticks to the current code block content
                responseHandler.codeBlockContent += '```\n';

                // Render the final code block
                responseHandler.renderCodeBlock(responseHandler.codeBlockContent, true);

                // Reset the code block state
                responseHandler.codeBlockContent = '';
                responseHandler.codeBlockStartIndex = -1;
                responseHandler.inCodeBlock = false;

                // Clear the textarea value to avoid reprocessing
                this.aiResponseTextArea.value = responseHandler.previousContent + responseHandler.codeBlockContent;

                // Update the previous content length
                responseHandler.previousContentLength = this.aiResponseTextArea.value.length;
                this.aiResponseTextArea.dispatchEvent(event);
            }
            this.aiResponseHalted = true;
        }
    };

    node.regenerateResponse = function () {
        if (!this.aiResponding) {
            // AI is not responding, so we want to regenerate
            this.removeLastResponse(); // Remove the last AI response
            this.promptTextArea.value = this.latestUserMessage; // Restore the last user message into the input prompt
            this.regenerateButton.innerHTML = `
    <svg width="24" height="24" class="icon">
        <use xlink:href="#refresh-icon"></use>
    </svg>`;
        }
    };

    // Add event listeners to buttons
    sendButton.addEventListener("click", function (e) {
        e.preventDefault();
        node.aiResponseHalted = false; // Reset the flag
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
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // Allow the new line to be added
            } else {
                e.preventDefault();
                sendLLMNodeMessage(node);
            }
        }
    });

    let timer = null;

    node.isLLM = true;

    return node;
}