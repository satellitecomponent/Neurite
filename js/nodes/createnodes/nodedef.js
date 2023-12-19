

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
    n.setAttribute("style", "background-color: #222226; color: #bbb; overflow-y: scroll; resize: both; width: 259px; line-height: 1.4; display: none;");
    n.style.position = "absolute";

    let elements = [n];

    let buttonCallback = null;

    let button = document.createElement("button");
    button.innerHTML = "Run Code";
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

    let windowDiv = node.content.querySelector('.window');  // Find the .content div
    let editableDiv = createContentEditableDiv(n);  // Define editableDiv here
    node.contentEditableDiv = editableDiv;  // Assign it to the node's property
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

        const dotInterval = setInterval(() => {
            dotCount = (dotCount + 1) % 4;
            extractButton.textContent = "Extracting" + ".".repeat(dotCount);
        }, 500);

        let storageKey = link;
        if (node && node.fileName) {
            storageKey = node.fileName;
        }

        async function processExtraction(text, storageKey) {
            extractButton.textContent = "Storing...";
            await storeTextData(storageKey, text);
            extractButton.textContent = "Extracted";
        }

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
                await fetchAndStoreWebPageContent(link);
                extractButton.textContent = "Extracted";
            }
        } catch (error) {
            console.error('Error during extraction:', error);
            extractButton.textContent = "Extract Failed";
            alert("An error occurred during extraction. Please ensure that the extract server is running on your localhost. Localhosts can be found at the Github link in the ? tab.");
        } finally {
            clearInterval(dotInterval);
        }
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
    aiResponseDiv.setAttribute("style", "background: linear-gradient(to bottom, rgba(34, 34, 38, 0), #222226); color: inherit; border: none; border-color: #8882; width: 100%; max-height: 80%; height: 80%; overflow-y: auto; overflow-x: hidden; resize: none; word-wrap: break-word; user-select: none; line-height: 1.75;");
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
    promptTextArea.classList.add('custom-scrollbar', 'custom-textarea'); // Add the class here
    promptTextArea.onmousedown = cancel;  // Prevent dragging
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

    // Create settings button
    const aiNodeSettingsButton = document.createElement('button');
    aiNodeSettingsButton.type = "button";
    aiNodeSettingsButton.id = 'aiNodeSettingsButton';
    aiNodeSettingsButton.style.cssText = "display: flex; justify-content: center; align-items: center; padding: 3px; z-index: 1; font-size: 14px; cursor: pointer; background-color: #222226; transition: background-color 0.3s; border: inset; border-color: #8882; width: 30px; height: 30px;";

    // Clone the SVG element
    const settingsIcon = document.getElementById('aiNodeSettingsIcon').cloneNode(true);
    settingsIcon.style.display = 'inline-block';

    // Append the SVG to the button
    aiNodeSettingsButton.appendChild(settingsIcon);

    // Initialize the button's active state as false
    aiNodeSettingsButton.isActive = false;

    // Add event listeners
    aiNodeSettingsButton.addEventListener('mouseover', function () {
        this.style.backgroundColor = this.isActive ? '#888' : '#ddd';
    });
    aiNodeSettingsButton.addEventListener('mouseout', function () {
        this.style.backgroundColor = this.isActive ? '#888' : '#222226';
    });
    aiNodeSettingsButton.addEventListener('mousedown', function () {
        this.style.backgroundColor = '#888';
    });
    aiNodeSettingsButton.addEventListener('mouseup', function () {
        this.style.backgroundColor = this.isActive ? '888' : '#ddd';
    });
    aiNodeSettingsButton.addEventListener('click', function (event) {
        this.isActive = !this.isActive;  // Toggle the active state
        toggleSettings(event, aiNodeSettingsContainer);  // Call your existing function
        // Set the background color based on the new active state
        this.style.backgroundColor = this.isActive ? '#888' : '#ddd';
    });

    // Create the loader and error icons container
    let statusIconsContainer = document.createElement("div");
    statusIconsContainer.className = 'status-icons-container';
    statusIconsContainer.style.cssText = 'position: absolute; top: 40px; right: 80px; width: 20px; height: 20px;';

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
    buttonDiv.appendChild(aiNodeSettingsButton);
    buttonDiv.style.cssText = "display: flex; flex-direction: column; align-items: flex-end; margin-bottom: 12px; margin-top: 4px;";

    // Create the promptDiv with relative position
    let promptDiv = document.createElement("div");
    promptDiv.style.cssText = "display: flex; flex-direction: row; justify-content: space-between; align-items: center; position: relative;"; // Added position: relative;

    // Append statusIconsContainer to the promptDiv instead of wrapperDiv
    promptDiv.appendChild(statusIconsContainer);
    promptDiv.appendChild(promptTextArea);
    promptDiv.appendChild(buttonDiv);

    // Wrap elements in a div
    let ainodewrapperDiv = document.createElement("div");
    ainodewrapperDiv.className = 'ainodewrapperDiv';
    ainodewrapperDiv.style.position = 'relative'; // <-- Add this line to make sure the container has a relative position
    ainodewrapperDiv.style.width = "580px";
    ainodewrapperDiv.style.height = "560px";

    ainodewrapperDiv.appendChild(aiResponseTextArea);
    ainodewrapperDiv.appendChild(aiResponseDiv);
    ainodewrapperDiv.appendChild(promptDiv);

    const initialTemperature = document.getElementById('model-temperature').value;
    const initialMaxTokens = document.getElementById('max-tokens-slider').value;
    const initialMaxContextSize = document.getElementById('max-context-size-slider').value;

    // Create and configure the settings
    const LocalLLMSelect = createAndConfigureLocalLLMDropdown(llmNodeCount);
    const temperatureSliderContainer = createSlider(`node-temperature-${llmNodeCount}`, 'Temperature', initialTemperature, 0, 1, 0.1);
    const maxTokensSliderContainer = createSlider(`node-max-tokens-${llmNodeCount}`, 'Max Tokens', initialMaxTokens, 10, 16000, 1);
    const maxContextSizeSliderContainer = createSlider(`node-max-context-${llmNodeCount}`, 'Max Context', initialMaxContextSize, 1, initialMaxTokens, 1);

    // Fetch the actual slider input from the containers
    const maxTokensSlider = maxTokensSliderContainer.querySelector('input[type=range]');
    const maxContextSizeSlider = maxContextSizeSliderContainer.querySelector('input[type=range]');

    // Fetch the corresponding label for the maxContextSizeSlider
    const maxContextSizeLabel = maxContextSizeSliderContainer.querySelector('label');

    // Use the autoContextTokenSync function to handle the synchronization
    autoContextTokenSync(maxTokensSlider, maxContextSizeSlider);

    // Add an event listener to the maxContextSizeSlider to update its label with percentage
    maxContextSizeSlider.addEventListener('input', function () {
        const maxContextValue = parseInt(this.value, 10);
        const maxContextMax = parseInt(this.max, 10);
        const ratio = Math.round((maxContextValue / maxContextMax) * 100);
        maxContextSizeLabel.innerText = `Context: ${ratio}% \n(${maxContextValue} tokens) `;
    });
    // Trigger the input event programmatically
    maxContextSizeSlider.dispatchEvent(new Event('input'));

    // Create settings container
    const aiNodeSettingsContainer = createSettingsContainer();


    // Add the dropdown (LocalLLMSelect) into settings container
    aiNodeSettingsContainer.appendChild(LocalLLMSelect);  // LocalLLMSelect is the existing dropdown
    aiNodeSettingsContainer.appendChild(temperatureSliderContainer);
    aiNodeSettingsContainer.appendChild(maxTokensSliderContainer);
    aiNodeSettingsContainer.appendChild(maxContextSizeSliderContainer);

    const firstSixOptions = allOptions.slice(0, 6);
    const checkboxArray1 = createCheckboxArray(llmNodeCount, firstSixOptions);
    aiNodeSettingsContainer.appendChild(checkboxArray1);

    const customInstructionsTextarea = createCustomInstructionsTextarea(llmNodeCount);
    aiNodeSettingsContainer.appendChild(customInstructionsTextarea);

    setupCustomDropdown(LocalLLMSelect, true);

    // Add settings container to the ainodewrapperDiv
    ainodewrapperDiv.appendChild(aiNodeSettingsContainer);

   
    // Pass this div to addNodeAtNaturalScale
    let node = addNodeAtNaturalScale(name, []);


    let windowDiv = node.content.querySelector(".window");
    windowDiv.style.resize = 'both';

    // Append the ainodewrapperDiv to windowDiv of the node
    windowDiv.appendChild(ainodewrapperDiv);

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
    node.ainodewrapperDiv = ainodewrapperDiv;
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

    const haltCheckbox = checkboxArray1.querySelector(`input[id="halt-questions-checkbox-${llmNodeCount}"]`);

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
        // Update the checkbox to reflect the halted state
        if (haltCheckbox) {
            haltCheckbox.checked = true;
        }
    };

    if (haltCheckbox) {
        haltCheckbox.addEventListener('change', function () {
            node.aiResponseHalted = this.checked;
            if (this.checked) {
                node.haltResponse();
            }
        });
    }

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

        // Reset the flag and uncheck the checkbox
        node.aiResponseHalted = false;

        if (haltCheckbox) {
            haltCheckbox.checked = false;
        }

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

function conditionalStopPropagation(event) {
    if (!altHeld) {
        event.stopPropagation();
    }
}

function createSettingsContainer() {
    const settingsContainer = document.createElement('div');
    settingsContainer.className = 'ainode-settings-container';
    settingsContainer.style.display = 'none';  // Initially hidden

    // Add the listener for mousedown event
    settingsContainer.addEventListener('mousedown', conditionalStopPropagation, false);

    // Add the listener for dblclick event
    settingsContainer.addEventListener('dblclick', conditionalStopPropagation, false);

    return settingsContainer;
}

// Function to toggle the settings container
function toggleSettings(event, settingsContainer) {
    event.stopPropagation();
    const display = settingsContainer.style.display;
    settingsContainer.style.display = display === 'none' || display === '' ? 'grid' : 'none';
}


function createSlider(id, label, initialValue, min, max, step) {
    const sliderDiv = document.createElement('div');
    sliderDiv.classList.add('slider-container');

    const sliderLabel = document.createElement('label');
    sliderLabel.setAttribute('for', id);
    sliderLabel.innerText = `${label}: ${initialValue}`;

    const sliderInput = document.createElement('input');
    sliderInput.type = 'range';
    sliderInput.id = id;

    // First, set the min and max
    sliderInput.min = min;
    sliderInput.max = max;

    // Then, set the step and initial value
    sliderInput.step = step;
    sliderInput.value = initialValue;

    // Event listener to update label when the slider value changes
    sliderInput.addEventListener('input', function () {
        sliderLabel.innerText = `${label}: ${this.value}`;
        setSliderBackground(sliderInput);  // Add custom background
    });

    sliderDiv.appendChild(sliderLabel);
    sliderDiv.appendChild(sliderInput);

    sliderInput.dispatchEvent(new Event('input'));

    return sliderDiv;
}



function createAndConfigureLocalLLMDropdown(llmNodeCount) {
    // Create the Local LLM dropdown
    let LocalLLMSelect = document.createElement("select");
    LocalLLMSelect.id = `dynamicLocalLLMselect-${llmNodeCount}`;
    LocalLLMSelect.classList.add('inline-container');
    LocalLLMSelect.style.backgroundColor = "#222226";
    LocalLLMSelect.style.border = "none";

    let localLLMCheckbox = document.getElementById("localLLM");

    // Create an array to store the options
    let options = [
        new Option('OpenAI', 'OpenAi', false, true),
        new Option('Red Pajama 3B f32', 'RedPajama-INCITE-Chat-3B-v1-q4f32_0', false, false),
        new Option('Vicuna 7B f32', 'vicuna-v1-7b-q4f32_0', false, false),
        new Option('Llama 2 7B f32', 'Llama-2-7b-chat-hf-q4f32_1', false, false),
        //new Option('Llama 2 13B f32', 'Llama-2-13b-chat-hf-q4f32_1', false, false),
        new Option('Llama 2 70B f16', 'Llama-2-70b-chat-hf-q4f16_1', false, false),
        //new Option('WizardCoder 15B f32', '"WizardCoder-15B-V1.0-q4f32_1', false, false),
        new Option('gpt-3.5-turbo', 'gpt-3.5-turbo', false, false),
        //new Option('gpt-3.5-turbo-16k', 'gpt-3.5-turbo-16k', false, false),
        //new Option('gpt-3.5-turbo-0613', 'gpt-3.5-turbo-0613', false, false),
        new Option('gpt-3.5-16k-0613', 'gpt-3.5-turbo-16k-0613', false, false),
        new Option('gpt-4', 'gpt-4', false, false),
        new Option('gpt-4-0613', 'gpt-4-0613', false, false),
        new Option('gpt-4-vision', 'gpt-4-vision-preview', false, false),
        new Option('gpt-3.5-1106', 'gpt-3.5-turbo-1106', false, false),
        new Option('gpt-4-1106', 'gpt-4-1106-preview', false, false)
    ];

    // Add options to the select
    options.forEach((option, index) => {
        LocalLLMSelect.add(option, index);
    });

    // Initial setup based on checkbox state
    options.forEach((option) => {
        if (option.value === 'OpenAi' || option.value.startsWith('gpt-')) {
            option.hidden = false;  // Always show
        } else {
            option.hidden = !localLLMCheckbox.checked;  // Show or hide based on checkbox initial state
        }
    });

    // Add change event listener to the checkbox
    localLLMCheckbox.addEventListener('change', function () {
        options.forEach((option) => {
            if (option.value === 'OpenAi' || option.value.startsWith('gpt-')) {
                option.hidden = false;  // Always show
            } else {
                option.hidden = !this.checked;  // Show or hide based on checkbox
            }
        });

        // Also update the visibility of custom options
        const customOptions = document.querySelectorAll('.options-replacer div');
        customOptions.forEach((customOption) => {
            const value = customOption.getAttribute('data-value');
            if (value === 'OpenAi' || value.startsWith('gpt-')) {
                customOption.style.display = 'block';  // Always show
            } else {
                customOption.style.display = this.checked ? 'block' : 'none';  // Show or hide based on checkbox
            }
        });
    });

    return LocalLLMSelect;
}

const allOptions = [
    { id: 'google-search', label: 'Search' },
    { id: 'code', label: 'Code' },
    { id: 'halt-questions', label: 'Halt' },
    { id: 'embed', label: 'Data' },
    { id: 'enable-wolfram-alpha', label: 'Wolfram' },
    { id: 'wiki', label: 'Wiki' }
];

// Function to create a checkbox array with a subset of options
function createCheckboxArray(llmNodeCount, subsetOptions) {
    const checkboxArrayDiv = document.createElement('div');
    checkboxArrayDiv.className = 'checkboxarray';

    for (const option of subsetOptions) {
        const checkboxDiv = document.createElement('div');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `${option.id}-checkbox-${llmNodeCount}`;
        checkbox.name = `${option.id}-checkbox-${llmNodeCount}`;

        const label = document.createElement('label');
        label.setAttribute('for', checkbox.id);
        label.innerText = option.label;

        checkboxDiv.appendChild(checkbox);
        checkboxDiv.appendChild(label);
        checkboxArrayDiv.appendChild(checkboxDiv);
    }

    return checkboxArrayDiv;
}

function createCustomInstructionsTextarea(llmNodeCount) {
    const textareaDiv = document.createElement('div');
    textareaDiv.className = 'textarea-container';

    const textarea = document.createElement('textarea');
    textarea.id = `custom-instructions-textarea-${llmNodeCount}`;
    textarea.className = 'custom-scrollbar';  // Apply the custom-scrollbar class here
    textarea.placeholder = 'Enter custom instructions here...';

    textareaDiv.appendChild(textarea);

    return textareaDiv;
}

function createImageNode(imageSrc, title, isUrl = false) {
    let node;

    // If isUrl is true, we assume imageSrc is a direct URL to an image.
    if (isUrl) {
        node = addNodeAtNaturalScale(title, imageSrc); // Assuming this function takes a URL or base64 data
        node.isImageNode = true;
        node.imageUrl = imageSrc;
        console.log("URL Found", node.imageUrl);
    } else {
        // If isUrl is false, we assume imageSrc is an HTMLImageElement that needs conversion
        if (!(imageSrc instanceof HTMLImageElement) || !imageSrc.src) {
            console.error('createImageNode was called without a valid image element or src');
            return null;
        }

        node = addNodeAtNaturalScale(title, imageSrc); // Assuming this function takes a URL or base64 data
        node.isImageNode = true;
        node.imageData = null; // Placeholder for base64 data

        // Determine whether the source is a blob URL or a Data URL (base64)
        if (imageSrc.src.startsWith('blob:')) {
            // Convert blob URL to base64 because the OpenAI API cannot access blob URLs
            convertImageToBase64(imageSrc.src, base64String => {
                node.imageData = base64String;
                console.log("Image converted to base64", base64String);
            });
        } else {
            // If it's not a blob, we can use the src directly (data URL or external URL)
            node.imageUrl = imageSrc.src;
            console.log("Image URL or Data URL found", imageSrc.src);
        }
    }

    return node;
}