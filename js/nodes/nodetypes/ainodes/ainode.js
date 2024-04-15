
function createLLMNode(name = '', sx = undefined, sy = undefined, x = undefined, y = undefined) {
    // Create the AI response textarea
    let aiResponseTextArea = document.createElement("textarea");
    aiResponseTextArea.id = `LLMnoderesponse-${llmNodeCount}`;  // Assign unique id to each aiResponseTextArea
    aiResponseTextArea.style.display = 'none';  // Hide the textarea

    // Create the AI response container
    let aiResponseDiv = document.createElement("div");
    aiResponseDiv.id = `LLMnoderesponseDiv-${llmNodeCount}`;  // Assign unique id to each aiResponseDiv
    aiResponseDiv.classList.add('custom-scrollbar', 'ai-response-div');
    aiResponseDiv.setAttribute("style", "background: linear-gradient(to bottom, rgba(34, 34, 38, 0), #222226); color: inherit; border: none; border-color: #8882; width: 100%; max-height: 80%; height: 80%; overflow-y: auto; overflow-x: hidden; resize: none; word-wrap: break-word; user-select: none; line-height: 1.75;");

    // Create the user prompt textarea
    let promptTextArea = document.createElement("textarea");
    promptTextArea.id = `nodeprompt-${llmNodeCount}`;
    promptTextArea.classList.add('custom-scrollbar', 'custom-textarea'); // Add the class here

    // Create the send button
    let sendButton = document.createElement("button");
    sendButton.type = "submit";
    sendButton.id = `prompt-form-${llmNodeCount}`;
    sendButton.style.cssText = "display: flex; justify-content: center; align-items: center; padding: 3px; z-index: 1; font-size: 14px; cursor: pointer; background-color: #222226; transition: background-color 0.3s; border: inset; border-color: #8882; width: 30px; height: 30px;";

    sendButton.innerHTML = `
    <svg width="24" height="24">
        <use xlink:href="#play-icon"></use>
    </svg>`;

    // Create the regenerate button
    let regenerateButton = document.createElement("button");
    regenerateButton.type = "button";
    regenerateButton.id = "prompt-form";
    regenerateButton.style.cssText = "display: flex; justify-content: center; align-items: center; padding: 3px; z-index: 1; font-size: 14px; cursor: pointer; background-color: #222226; transition: background-color 0.3s; border: inset; border-color: #8882; width: 30px; height: 30px;";
    regenerateButton.innerHTML = `
    <svg width="24" height="24">
        <use xlink:href="#refresh-icon"></use>
    </svg>`;

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
    ainodewrapperDiv.style.width = "500px";
    ainodewrapperDiv.style.height = "520px";

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

    // Add settings container to the ainodewrapperDiv
    ainodewrapperDiv.appendChild(aiNodeSettingsContainer);

    // Pass this div to addNodeAtNaturalScale
    let node = addNodeAtNaturalScale(name, []);

    let windowDiv = node.windowDiv;
    windowDiv.style.resize = 'both';

    // Append the ainodewrapperDiv to windowDiv of the node
    windowDiv.appendChild(ainodewrapperDiv);

    // Additional configurations
    node.id = aiResponseTextArea.id;  // Store the id in the node object
    node.index = llmNodeCount;
    node.aiResponding = false;
    node.localAiResponding = false;
    node.latestUserMessage = null;
    node.shouldContinue = true;
    node.LocalLLMSelectID = `dynamicLocalLLMselect-${node.index}`;
    node.isLLMNode = true;
    node.shouldAppendQuestion = false;
    node.aiResponseHalted = false;
    node.savedCheckboxStates = {};
    node.savedCustomInstructions = '';
    node.savedLLMSelection = '';
    node.savedTextContent = '';


    initAiNode(node);

    let timer = null;

    node.isLLM = true;

    return node;
}

function initAiNode(node) {
    llmNodeCount++;

    let ainodewrapperDiv = node.content.querySelector('.ainodewrapperDiv')
    node.ainodewrapperDiv = ainodewrapperDiv;

    let aiResponseDiv = node.content.querySelector('[id^="LLMnoderesponseDiv-"]');
    node.aiResponseDiv = aiResponseDiv;

    let aiResponseTextArea = node.content.querySelector('[id^="LLMnoderesponse-"]');
    node.aiResponseTextArea = aiResponseTextArea;

    let promptTextArea = node.content.querySelector('[id^="nodeprompt-"]');
    node.promptTextArea = promptTextArea;

    let sendButton = node.content.querySelector('[id^="prompt-form-"]');
    node.sendButton = sendButton;

    let haltCheckbox = node.content.querySelector('input[id^="halt-questions-checkbox"]');
    node.haltCheckbox = haltCheckbox;

    let regenerateButton = node.content.querySelector('#prompt-form');
    node.regenerateButton = regenerateButton;

    let localLLMSelect = node.content.querySelector(`[id^="dynamicLocalLLMselect-"]`);
    node.localLLMSelect = localLLMSelect;

    // Setup event listeners
    setupAiResponseTextAreaListener(node);
    setupAiNodeResponseDivListeners(node);
    setupAiNodePromptTextAreaListeners(node);
    setupAiNodeSendButtonListeners(node);
    setupAiNodeRegenerateButtonListeners(node);
    setupAiNodeSettingsButtonListeners(node);
    setupAiNodeLocalLLMDropdownListeners(node);
    setupAiNodeSliderListeners(node)
    setupAiNodeCheckBoxArrayListeners(node)
    setupAiNodeCustomInstructionsListeners(node)

    // Functions

    node.controller = new AbortController();

    //Handles parsing of conversation divs.
    let responseHandler = new ResponseHandler(node);
    nodeResponseHandlers.set(node, responseHandler); // map response handler to node

    node.removeLastResponse = responseHandler.removeLastResponse.bind(responseHandler);
    responseHandler.restoreAiResponseDiv()


    node.haltResponse = () => aiNodeHaltResponse(node);
}

function aiNodeHaltResponse(node) {
    if (node.aiResponding) {
        // AI is responding, so we want to stop it
        node.controller.abort(); // Send the abort signal to the fetch request
        node.aiResponding = false;
        node.shouldContinue = false;
        node.regenerateButton.innerHTML = `
            <svg width="24" height="24" class="icon">
                <use xlink:href="#refresh-icon"></use>
            </svg>`;
        node.promptTextArea.value = node.latestUserMessage; // Add the last user message to the prompt input

        // Access the responseHandler from the nodeResponseHandlers map
        let responseHandler = nodeResponseHandlers.get(node);

        // If currently in a code block
        if (responseHandler && responseHandler.inCodeBlock) {
            // Add closing backticks to the current code block content
            responseHandler.codeBlockContent += '```\n';

            // Render the final code block
            responseHandler.renderCodeBlock(responseHandler.codeBlockContent, true);

            // Reset the code block state
            responseHandler.codeBlockContent = '';
            responseHandler.codeBlockStartIndex = -1;
            responseHandler.inCodeBlock = false;

            // Clear the textarea value to avoid reprocessing
            node.aiResponseTextArea.value = responseHandler.previousContent + responseHandler.codeBlockContent;

            // Update the previous content length
            responseHandler.previousContentLength = node.aiResponseTextArea.value.length;
            node.aiResponseTextArea.dispatchEvent(new Event('input'));
        }
        node.aiResponseHalted = true;
    }

    // Update the halt checkbox to reflect the halted state
    const haltCheckbox = node.haltCheckbox;
    if (haltCheckbox) {
        haltCheckbox.checked = true;
    }
}

function setupAiNodeResponseDivListeners(node) {
    let aiResponseDiv = node.aiResponseDiv;
    let aiResponseTextArea = node.aiResponseTextArea;
    aiResponseDiv.onmousedown = function (event) {
        if (!event.altKey) {
            cancel(event);
        }
    };

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

    let userHasScrolled = false;

    // Function to scroll to bottom
    const scrollToBottom = () => {
        if (!userHasScrolled) {
            setTimeout(() => {
                aiResponseDiv.scrollTo({
                    top: aiResponseDiv.scrollHeight,
                    behavior: 'smooth'
                });
            }, 0);
        }
    };

    // Call scrollToBottom whenever there's an input
    aiResponseTextArea.addEventListener('input', scrollToBottom);


    // Tolerance in pixels
    const epsilon = 5;

    // Function to handle scrolling
    const handleScroll = () => {
        if (Math.abs(aiResponseDiv.scrollTop + aiResponseDiv.clientHeight - aiResponseDiv.scrollHeight) > epsilon) {
            userHasScrolled = true;
        } else {
            userHasScrolled = false;
        }
    };

    // Event listener for scrolling
    aiResponseDiv.addEventListener('scroll', handleScroll);

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

    // ... other event listeners for aiResponseDiv ...
}

// Function to handle setup of aiResponseTextArea listener
function setupAiResponseTextAreaListener(node) {
    const aiResponseTextArea = node.content.querySelector('[id^="LLMnoderesponse-"]');
    node.aiResponseTextArea = aiResponseTextArea;

    // Restore saved text content if available
    if (node.savedTextContent !== undefined) {
        aiResponseTextArea.value = node.savedTextContent;
    }

    // Function to save text content
    const saveTextContent = () => {
        node.savedTextContent = aiResponseTextArea.value;
    };

    // Attach debounced event listener
    aiResponseTextArea.addEventListener('input', debounce(saveTextContent, 300));
}


function setupAiNodePromptTextAreaListeners(node) {
    let promptTextArea = node.promptTextArea

    promptTextArea.onmousedown = cancel;  // Prevent dragging
    promptTextArea.addEventListener('input', autoGrow);
    promptTextArea.addEventListener('mouseenter', function () {
        promptTextArea.style.userSelect = "text";
    });
    promptTextArea.addEventListener('mouseleave', function () {
        promptTextArea.style.userSelect = "none";
    });
    promptTextArea.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendLLMNodeMessage(node);
        }
    });

    promptTextArea.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // Allow the new line to be added
            } else {
                e.preventDefault();
                sendLLMNodeMessage(node);
            }
        }
    });

    // ... other event listeners for promptTextArea ...
}

function setupAiNodeSendButtonListeners(node) {
    let sendButton = node.sendButton;

    let haltCheckbox = node.haltCheckbox;

    sendButton.addEventListener('mouseover', function () {
        this.style.backgroundColor = '#293e34';
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

    sendButton.addEventListener("click", function (e) {
        e.preventDefault();

        // Reset the flag and uncheck the checkbox
        node.aiResponseHalted = false;

        if (haltCheckbox) {
            haltCheckbox.checked = false;
        }

        sendLLMNodeMessage(node);
    });

    if (haltCheckbox) {
        haltCheckbox.addEventListener('change', function () {
            node.aiResponseHalted = this.checked;
            if (this.checked) {
                node.haltResponse();
            }
        });
    }
}

function setupAiNodeRegenerateButtonListeners(node) {
    let regenerateButton = node.regenerateButton;

    regenerateButton.addEventListener('mouseover', function () {
        this.style.backgroundColor = '#333';
    });
    regenerateButton.addEventListener('mouseout', function () {
        this.style.backgroundColor = '#222226';
    });
    regenerateButton.addEventListener('mousedown', function () {
        this.style.backgroundColor = '#45a049';
    });
    regenerateButton.addEventListener('mouseup', function () {
        this.style.backgroundColor = '#222226';
    });


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

    regenerateButton.addEventListener("click", function () {
        if (node.aiResponding) {
            // If the AI is currently responding, halt the response
            node.haltResponse();
        } else {
            // Otherwise, regenerate the response
            node.regenerateResponse();
        }
    });
}

function setupAiNodeSettingsButtonListeners(node) {
    let aiNodeSettingsButton = node.content.querySelector('#aiNodeSettingsButton');
    let aiNodeSettingsContainer = node.content.querySelector('.ainode-settings-container');

    aiNodeSettingsButton.addEventListener('mouseover', function () {
        this.style.backgroundColor = this.isActive ? '#1e3751' : '#333';
    });
    aiNodeSettingsButton.addEventListener('mouseout', function () {
        this.style.backgroundColor = this.isActive ? '#1e3751' : '#222226';
    });
    aiNodeSettingsButton.addEventListener('mousedown', function () {
        this.style.backgroundColor = '#1e3751';
    });
    aiNodeSettingsButton.addEventListener('mouseup', function () {
        this.style.backgroundColor = this.isActive ? '#1e3751' : '#333';
    });
    aiNodeSettingsButton.addEventListener('click', function (event) {
        this.isActive = !this.isActive;  // Toggle the active state
        toggleSettings(event, aiNodeSettingsContainer);  // Call your existing function
        // Set the background color based on the new active state
        this.style.backgroundColor = this.isActive ? '#1e3751' : '#333';
    });

    // Add the listener for mousedown event
    aiNodeSettingsContainer.addEventListener('mousedown', conditionalStopPropagation, false);

    // Add the listener for dblclick event
    aiNodeSettingsContainer.addEventListener('dblclick', conditionalStopPropagation, false);
}

function setupAiNodeLocalLLMDropdownListeners(node) {
    let selectElement = node.localLLMSelect;
    setupCustomDropdown(selectElement, true);
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

    sliderDiv.appendChild(sliderLabel);
    sliderDiv.appendChild(sliderInput);

    return sliderDiv;
}

function setupAiNodeSliderListeners(node) {
    // Assuming 'node.content' is the main container of your node
    const sliders = node.content.querySelectorAll('input[type=range]');

    sliders.forEach(slider => {
        // Attach event listener to each slider
        slider.addEventListener('input', function () {
            // Retrieve the associated label within the node
            const label = node.content.querySelector(`label[for='${slider.id}']`);
            if (label) {
                // Extract the base label text (part before the colon)
                const baseLabelText = label.innerText.split(':')[0];
                label.innerText = `${baseLabelText}: ${slider.value}`;

                setSliderBackground(slider);  // Assuming this is a predefined function
            }
            // Additional logic for each slider, if needed
        });

        // Trigger the input event to set initial state
        slider.dispatchEvent(new Event('input'));
    });

    setupContextSpecificSliderListeners(node);
}

function setupContextSpecificSliderListeners(node) {
    // Fetch default values from DOM elements and sliders
    const defaultTemperature = document.getElementById('model-temperature').value;
    const defaultMaxTokens = document.getElementById('max-tokens-slider').value;
    const defaultMaxContextSize = document.getElementById('max-context-size-slider').value;

    const temperatureSlider = node.content.querySelector('#node-temperature-' + node.index);
    const maxTokensSlider = node.content.querySelector('#node-max-tokens-' + node.index);
    const maxContextSizeSlider = node.content.querySelector('#node-max-context-' + node.index);

    // Set initial values and add event listeners
    if (temperatureSlider) {
        temperatureSlider.value = node.savedTemperature ?? defaultTemperature;
        temperatureSlider.dispatchEvent(new Event('input'));

        temperatureSlider.addEventListener('input', function () {
            node.savedTemperature = temperatureSlider.value;
        });
    }

    if (maxTokensSlider) {
        maxTokensSlider.value = node.savedMaxTokens ?? defaultMaxTokens;
        maxTokensSlider.dispatchEvent(new Event('input'));

        maxTokensSlider.addEventListener('input', function () {
            node.savedMaxTokens = maxTokensSlider.value;
        });
    }

    if (maxContextSizeSlider) {
        maxContextSizeSlider.value = node.savedMaxContextSize ?? defaultMaxContextSize;
        maxContextSizeSlider.dispatchEvent(new Event('input'));

        maxContextSizeSlider.addEventListener('input', function () {
            node.savedMaxContextSize = maxContextSizeSlider.value;
        });
    }


    // Event listener for maxContextSizeSlider
    if (maxContextSizeSlider) {
        maxContextSizeSlider.addEventListener('input', function () {
            const maxContextSizeLabel = node.content.querySelector(`label[for='node-max-context-${node.index}']`);
            if (maxContextSizeLabel) {
                const maxContextValue = parseInt(this.value, 10);
                const maxContextMax = parseInt(this.max, 10);
                const ratio = Math.round((maxContextValue / maxContextMax) * 100);
                maxContextSizeLabel.innerText = `Context: ${ratio}% (${maxContextValue} tokens)`;
            }
        });
    }

    // Handle synchronization if both sliders are present
    if (maxTokensSlider && maxContextSizeSlider) {
        aiTab.autoContextTokenSync(maxTokensSlider, maxContextSizeSlider);
    }

    // Additional specific behaviors for other sliders can be added here
}



function createAndConfigureLocalLLMDropdown(llmNodeCount) {
    // Create the Local LLM dropdown
    let LocalLLMSelect = document.createElement("select");
    LocalLLMSelect.id = `dynamicLocalLLMselect-${llmNodeCount}`;
    LocalLLMSelect.classList.add('inline-container');
    LocalLLMSelect.style.backgroundColor = "#222226";
    LocalLLMSelect.style.border = "none";

    //let localLLMCheckbox = document.getElementById("localLLM");

    // Create an array to store the options
    let options = [
        new Option('GLOBAL', 'GLOBAL', false, true),
        new Option('Ollama', 'ollama', false, false),

        new Option('gpt-3.5-turbo', 'gpt-3.5-turbo', false, false),
        //new Option('gpt-3.5-turbo-instruct', 'gpt-3.5-turbo-instruct', false, false),
        new Option('gpt-4', 'gpt-4', false, false),
        new Option('gpt-4-vision', 'gpt-4-vision-preview', false, false),

        new Option('GROQ-mixtral-8x7b-32768', 'GROQ-mixtral-8x7b-32768', false, false),
        new Option('GROQ-llama2-70b-4096', 'GROQ-llama2-70b-4096', false, false),
        new Option('Custom', 'custom', false, false),

        //new Option('claude-3-opus', 'claude-3-opus-20240229', false, false),
        //new Option('claude-3-sonnet', 'claude-3-sonnet-20240229', false, false)
    ];

    // Add options to the select
    options.forEach((option, index) => {
        LocalLLMSelect.add(option, index);
    });

    // Initial setup based on checkbox state
    /*options.forEach((option) => {
        if (option.value === 'OpenAi' || option.value.startsWith('gpt-') || option.value.startsWith('GROQ-') || option.value.startsWith('Ollama')) {
            option.hidden = false;  // Always show
        } else {
            option.hidden = !localLLMCheckbox.checked;  // Show or hide based on checkbox initial state
        }
    });*/

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

function setupAiNodeCheckBoxArrayListeners(node) {
    // Assuming each checkbox has a unique ID formatted as `${option.id}-checkbox-${llmNodeCount}`
    const checkboxes = node.content.querySelectorAll('.checkboxarray input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        // Check if savedCheckboxStates exists and then restore the saved state
        if (node.savedCheckboxStates && node.savedCheckboxStates.hasOwnProperty(checkbox.id)) {
            const savedState = node.savedCheckboxStates[checkbox.id];
            checkbox.checked = savedState;
        }

        // Attach event listener to save state on change
        checkbox.addEventListener('change', () => {
            if (!node.savedCheckboxStates) {
                node.savedCheckboxStates = {};
            }
            node.savedCheckboxStates[checkbox.id] = checkbox.checked;
        });
    });
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

function setupAiNodeCustomInstructionsListeners(node) {
    // Fetch the custom instructions textarea
    const customInstructionsTextarea = node.content.querySelector(`#custom-instructions-textarea-${node.index}`);

    if (customInstructionsTextarea) {
        // Restore the saved value if it exists
        if (node.savedCustomInstructions !== undefined) {
            customInstructionsTextarea.value = node.savedCustomInstructions;
        }

        // Attach event listener to save value on input
        customInstructionsTextarea.addEventListener('input', () => {
            node.savedCustomInstructions = customInstructionsTextarea.value;
        });
    }
}