
function createLlmNode(name = '', sx, sy, x, y) {
    const llmNodeCount = AiNode.count;

    // Create the AI response textarea
    let aiResponseTextArea = document.createElement('textarea');
    aiResponseTextArea.id = 'LLMnoderesponse-' + llmNodeCount;
    aiResponseTextArea.style.display = 'none';

    // Create the AI response container
    let aiResponseDiv = document.createElement('div');
    aiResponseDiv.id = 'LLMnoderesponseDiv-' + llmNodeCount;
    aiResponseDiv.classList.add('custom-scrollbar', 'ai-response-div');

    // Create the user prompt textarea
    let promptTextArea = document.createElement('textarea');
    promptTextArea.id = 'nodeprompt-' + llmNodeCount;
    promptTextArea.classList.add('custom-scrollbar', 'custom-textarea');

    // Create the send button (keeping inline styles)
    let sendButton = document.createElement('button');
    sendButton.type = "submit";
    sendButton.id = 'prompt-form-' + llmNodeCount;
    sendButton.style.cssText = "display: flex; justify-content: center; align-items: center; padding: 3px; z-index: 1; font-size: 14px; cursor: pointer; background-color: #222226; transition: background-color 0.3s; border: inset; border-color: #8882; width: 30px; height: 30px;";
    sendButton.innerHTML = SVG.play;

    // Create the regenerate button (keeping inline styles)
    let regenerateButton = document.createElement('button');
    regenerateButton.type = "button";
    regenerateButton.id = "prompt-form";
    regenerateButton.style.cssText = "display: flex; justify-content: center; align-items: center; padding: 3px; z-index: 1; font-size: 14px; cursor: pointer; background-color: #222226; transition: background-color 0.3s; border: inset; border-color: #8882; width: 30px; height: 30px;";
    regenerateButton.innerHTML = SVG.refresh;

    // Create settings button (keeping inline styles)
    const aiNodeSettingsButton = document.createElement('button');
    aiNodeSettingsButton.type = "button";
    aiNodeSettingsButton.id = 'aiNodeSettingsButton';
    aiNodeSettingsButton.style.cssText = "display: flex; justify-content: center; align-items: center; padding: 3px; z-index: 1; font-size: 14px; cursor: pointer; background-color: #222226; transition: background-color 0.3s; border: inset; border-color: #8882; width: 30px; height: 30px;";
    const settingsIcon = Elem.byId('aiNodeSettingsIcon').cloneNode(true);
    settingsIcon.style.display = 'inline-block';
    aiNodeSettingsButton.appendChild(settingsIcon);
    aiNodeSettingsButton.isActive = false;

    // Create the loader and error icons container (keeping inline styles)
    let statusIconsContainer = document.createElement('div');
    statusIconsContainer.className = 'status-icons-container';
    statusIconsContainer.style.cssText = 'position: absolute; top: 42px; right: 90px; width: 20px; height: 20px;';

    // Create the loader icon
    let aiLoadingIcon = document.createElement('div');
    aiLoadingIcon.className = 'loader';
    aiLoadingIcon.id = 'aiLoadingIcon-' + llmNodeCount;
    aiLoadingIcon.style.display = 'none';

    // Create the error icon
    let aiErrorIcon = document.createElement('div');
    aiErrorIcon.className = 'error-icon-css';
    aiErrorIcon.id = 'aiErrorIcon-' + llmNodeCount;
    aiErrorIcon.style.display = 'none';

    // Create the 'X' mark inside the error icon
    let xMark = document.createElement('div');
    xMark.className = 'error-x-mark';
    let xMarkLeft = document.createElement('div');
    xMarkLeft.className = 'error-x-mark-left';
    let xMarkRight = document.createElement('div');
    xMarkRight.className = 'error-x-mark-right';
    xMark.appendChild(xMarkLeft);
    xMark.appendChild(xMarkRight);
    aiErrorIcon.appendChild(xMark);

    // Append loader and error icons to container
    statusIconsContainer.appendChild(aiLoadingIcon);
    statusIconsContainer.appendChild(aiErrorIcon);

    // Create a div to wrap prompt textarea and buttons
    let buttonDiv = document.createElement('div');
    buttonDiv.className = 'button-container';
    buttonDiv.appendChild(sendButton);
    buttonDiv.appendChild(regenerateButton);
    buttonDiv.appendChild(aiNodeSettingsButton);

    // Create the promptDiv
    let promptDiv = document.createElement('div');
    promptDiv.className = 'prompt-container';
    promptDiv.appendChild(statusIconsContainer);
    promptDiv.appendChild(promptTextArea);
    promptDiv.appendChild(buttonDiv);

    // Wrap elements in a div
    let ainodewrapperDiv = document.createElement('div');
    ainodewrapperDiv.className = 'ainodewrapperDiv';

    ainodewrapperDiv.appendChild(aiResponseTextArea);
    ainodewrapperDiv.appendChild(aiResponseDiv);
    ainodewrapperDiv.appendChild(promptDiv);

    const { containerDiv, textarea: customInstructionsTextarea } = createCustomInstructionsTextarea();
    ainodewrapperDiv.appendChild(AiNode.makeSettingsContainer(llmNodeCount, containerDiv));

    // Pass this div to addNodeAtNaturalScale
    let node = addNodeAtNaturalScale(name, []);

    let windowDiv = node.windowDiv;
    windowDiv.style.resize = 'both';
    windowDiv.style.minWidth = `450px`;
    windowDiv.style.minHeight = `535px`;

    // Append the ainodewrapperDiv to windowDiv of the node
    windowDiv.appendChild(ainodewrapperDiv);
    // Additional configurations
    node.id = aiResponseTextArea.id;  // Store the id in the node object
    node.index = llmNodeCount;
    node.aiResponding = false;
    node.localAiResponding = false;
    node.latestUserMessage = null;
    node.shouldContinue = true;

    node.isLLMNode = true;
    node.shouldAppendQuestion = false;
    node.aiResponseHalted = false;
    node.savedLLMSelection = '';

    node.currentTopNChunks = null;

    node.push_extra_cb((node) => {
        return {
            f: "textarea",
            a: {
                p: [0, 0, 1],
                v: node.titleInput.value
            }
        };
    });

    node.push_extra_cb((node) => {
        return {
            f: "textareaId",
            a: {
                p: customInstructionsTextarea.id,
                v: customInstructionsTextarea.value
            }
        };
    });

    node.push_extra_cb((node) => {
        return {
            f: "textareaId",
            a: {
                p: promptTextArea.id,
                v: promptTextArea.value
            }
        };
    });

    node.push_extra_cb((node) => {
        return {
            f: "textareaId",
            a: {
                p: aiResponseTextArea.id,
                v: aiResponseTextArea.value
            }
        };
    });

    const checkboxes = node.content.querySelectorAll('.checkboxarray input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        node.push_extra_cb((node) => {
            return {
                f: "checkboxId",
                a: {
                    p: checkbox.id,
                    v: checkbox.checked
                }
            };
        });
    });

    // Fetch default values from DOM elements and sliders
    const defaultTemperature = Elem.byId('model-temperature').value;
    const defaultMaxTokens = Elem.byId('max-tokens-slider').value;
    const defaultMaxContextSize = Elem.byId('max-context-size-slider').value;

    // Set initial values for sliders using node.push_extra_cb
    node.push_extra_cb((node) => {
        return {
            f: "sliderId",
            a: {
                p: 'node-temperature-' + node.index,
                v: node.temperature,
                d: defaultTemperature
            }
        };
    });

    node.push_extra_cb((node) => {
        return {
            f: "sliderId",
            a: {
                p: 'node-max-tokens-' + node.index,
                v: node.maxTokens,
                d: defaultMaxTokens
            }
        };
    });

    node.push_extra_cb((node) => {
        return {
            f: "sliderId",
            a: {
                p: 'node-max-context-' + node.index,
                v: node.maxContextSize,
                d: defaultMaxContextSize
            }
        };
    });


    node.isLLM = true;

    AiNode.init(node);


    return node;
}

AiNode.init = function(node){
    AiNode.count += 1;

    const content = node.content;
    node.ainodewrapperDiv = content.querySelector('.ainodewrapperDiv');
    node.aiResponseDiv = content.querySelector('[id^="LLMnoderesponseDiv-"]');
    node.aiResponseTextArea = content.querySelector('[id^="LLMnoderesponse-"]');
    node.promptTextArea = content.querySelector('[id^="nodeprompt-"]');
    node.sendButton = content.querySelector('[id^="prompt-form-"]');
    node.haltCheckbox = content.querySelector('input[id^="halt-questions-checkbox"]');
    node.regenerateButton = content.querySelector('#prompt-form');

    // This is now the container for our inferenence select dropdown.
    node.localLLMSelect = content.querySelector('.local-llm-dropdown-container-' + node.index);

    node.customInstructionsTextarea = content.querySelector('.custom-instructions-textarea');

    AiNode.setSelects(node);

    // Setup event listeners
    AiNode.setupResponseDivListeners(node);
    AiNode.setupPromptTextAreaListeners(node);
    AiNode.setupSendButtonListeners(node);
    AiNode.setupRegenerateButtonListeners(node);
    AiNode.setupSettingsButtonListeners(node);
    AiNode.setupLocalLLMDropdownListeners(node);
    AiNode.setupSliderListeners(node);
    setupCustomInstructionsListeners(node);

    // Functions

    node.controller = new AbortController();

    // Handles parsing of conversation divs.
    const responseHandler = new ResponseHandler(node);
    nodeResponseHandlers.set(node, responseHandler); // map response handler to node

    node.removeLastResponse = responseHandler.removeLastResponse.bind(responseHandler);
    responseHandler.restoreAiResponseDiv()

    node.haltResponse = AiNode.HaltResponse.bind(AiNode, node);
}

AiNode.HaltResponse = function(node){
    if (node.aiResponding) {
        // AI is responding, so we want to stop it
        node.controller.abort(); // Send the abort signal to the fetch request
        node.aiResponding = false;
        node.shouldContinue = false;
        node.regenerateButton.innerHTML = SVG.refresh;
        node.promptTextArea.value = node.latestUserMessage; // Add the last user message to the prompt input

        // Access the responseHandler from the nodeResponseHandlers map
        const responseHandler = nodeResponseHandlers.get(node);

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

    if (node.haltCheckbox) node.haltCheckbox.checked = true;

    // Reinitialize the controller for future use
    node.controller = new AbortController();
}

AiNode.setupResponseDivListeners = function(node){
    const aiResponseDiv = node.aiResponseDiv;
    aiResponseDiv.onmousedown = function (e) {
        if (!e.altKey) cancel(e)
    };

    aiResponseDiv.addEventListener('mouseenter', function () {
        aiResponseDiv.style.userSelect = 'text'
    });
    aiResponseDiv.addEventListener('mouseleave', function () {
        aiResponseDiv.style.userSelect = 'none'
    });

    // Add a 'wheel' event listener
    aiResponseDiv.addEventListener('wheel', function (event) {
        // If the Shift key is not being held down, stop the event propagation
        if (!nodeMode) {
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
    node.aiResponseTextArea.addEventListener('input', scrollToBottom);


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
        if (!event.altKey) aiResponseDiv.style.userSelect = 'text';
    });
}

AiNode.setupPromptTextAreaListeners = function(node){
    const textArea = node.promptTextArea;
    textArea.onmousedown = cancel;  // Prevent dragging
    textArea.addEventListener('input', autoGrow);
    textArea.addEventListener('focus', autoGrow);
    textArea.addEventListener('mouseenter', function () {
        textArea.style.userSelect = 'text';
    });
    textArea.addEventListener('mouseleave', function () {
        textArea.style.userSelect = 'none';
    });
    textArea.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            AiNode.sendMessage(node);
        }
    });
}

AiNode.setupSendButtonListeners = function(node){
    const button = node.sendButton;

    const haltCheckbox = node.haltCheckbox;

    button.addEventListener('mouseover', Elem.setBothColors.bind(button, '#222226', '#293e34'));
    button.addEventListener('mouseout', Elem.setBothColors.bind(button, '#ddd', '#222226'));
    button.addEventListener('mousedown', Elem.setBackgroundColor.bind(button, '#45a049'));
    button.addEventListener('mouseup', Elem.setBackgroundColor.bind(button, '#ddd'));

    button.addEventListener('click', function (e) {
        e.preventDefault();

        node.aiResponseHalted = false;
        node.shouldContinue = true;

        if (haltCheckbox) haltCheckbox.checked = false;

        AiNode.sendMessage(node);
    });

    if (haltCheckbox) {
        haltCheckbox.addEventListener('change', function () {
            node.aiResponseHalted = this.checked;
            if (this.checked) node.haltResponse();
        });
    }
}

AiNode.setupRegenerateButtonListeners = function(node){
    const button = node.regenerateButton;
    const setBackColor = Elem.setBackgroundColor;
    button.addEventListener('mouseover', setBackColor.bind(button, '#333'));
    button.addEventListener('mouseout', setBackColor.bind(button, '#222226'));
    button.addEventListener('mousedown', setBackColor.bind(button, '#45a049'));
    button.addEventListener('mouseup', setBackColor.bind(button, '#222226'));

    node.regenerateResponse = function () {
        if (this.aiResponding) return;

        this.removeLastResponse();
        this.promptTextArea.value = this.latestUserMessage;
        this.regenerateButton.innerHTML = SVG.refresh;
    };

    button.addEventListener('click', function () {
        if (node.aiResponding) {
            node.haltResponse()
        } else {
            node.regenerateResponse()
        }
    });
}

AiNode.setupSettingsButtonListeners = function(node){
    const button = node.content.querySelector('#aiNodeSettingsButton');
    const container = node.content.querySelector('.ainode-settings-container');

    const setBackColorPerIsActive = Elem.setBackgroundColorPerIsActive;
    button.addEventListener('mouseover', setBackColorPerIsActive.bind(button, '#1e3751', '#333'));
    button.addEventListener('mouseout', setBackColorPerIsActive.bind(button, '#1e3751', '#222226'));
    button.addEventListener('mousedown', Elem.setBackgroundColor.bind(button, '#1e3751'));
    button.addEventListener('mouseup', setBackColorPerIsActive.bind(button, '#1e3751', '#333'));
    button.addEventListener('click', function (e) {
        this.isActive = !this.isActive;
        toggleSettings(e, container);
        setBackColorPerIsActive.call(this, '#1e3751', '#333');
    });

    container.addEventListener('mousedown', conditionalStopPropagation, false);
    container.addEventListener('dblclick', conditionalStopPropagation, false);
}

function conditionalStopPropagation(event) {
    if (!event.getModifierState(controls.altKey.value)) {
        event.stopPropagation();
    }
}

AiNode.makeSettingsContainer = function(nodeIndex, containerDiv){
    const initialTemperature = Elem.byId('model-temperature').value;
    const initialMaxTokens = Elem.byId('max-tokens-slider').value;
    const initialMaxContextSize = Elem.byId('max-context-size-slider').value;

    const container = document.createElement('div');
    container.className = 'ainode-settings-container';
    container.style.display = 'none';
    container.append(
        createAndConfigureLocalLlmSelects(nodeIndex),
        Elem.makeSlider('node-temperature-' + nodeIndex, 'Temperature', initialTemperature, 0, 1, 0.1),
        Elem.makeSlider('node-max-tokens-' + nodeIndex, 'Max Tokens', initialMaxTokens, 10, 16000, 1),
        Elem.makeSlider('node-max-context-' + nodeIndex, 'Max Context', initialMaxContextSize, 1, initialMaxTokens, 1),
        createCheckboxArray(nodeIndex, allOptions.slice(0, 6)),
        containerDiv
    );
    return container;
}

// Function to toggle the settings container
function toggleSettings(event, settingsContainer) {
    event.stopPropagation();
    const display = settingsContainer.style.display;
    settingsContainer.style.display = (display === 'none' || display === '' ? 'grid' : 'none');
}

Elem.makeSlider = function(id, label, initialValue, min, max, step){
    const sliderDiv = document.createElement('div');
    sliderDiv.classList.add('slider-container');

    const sliderLabel = document.createElement('label');
    sliderLabel.setAttribute('for', id);
    sliderLabel.innerText = label + ': ' + initialValue;

    const sliderInput = document.createElement('input');
    sliderInput.type = 'range';
    sliderInput.id = id;
    sliderInput.min = min;
    sliderInput.max = max;
    sliderInput.step = step;
    sliderInput.value = initialValue;

    sliderDiv.append(sliderLabel, sliderInput);
    return sliderDiv;
}



AiNode.setupSliderListeners = function(node){
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

                setSliderBackground(slider);
            }
            // Additional logic for each slider, if needed
        });

        // Trigger the input event to set initial state
        slider.dispatchEvent(new Event('input'));
    });

    AiNode.setupContextSpecificSliderListeners(node);
}
AiNode.setupContextSpecificSliderListeners = function(node){
    // Event listener for maxContextSizeSlider
    const maxContextSizeSlider = node.content.querySelector('#node-max-context-' + node.index);
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
    const maxTokensSlider = node.content.querySelector('#node-max-tokens-' + node.index);
    if (maxTokensSlider && maxContextSizeSlider) {
        aiTab.autoContextTokenSync(maxTokensSlider, maxContextSizeSlider);
    }

    // Additional specific behaviors for other sliders can be added here
}

function getSelectByName(node, name){
    return node.content.querySelector(`#${name}-select-${node.index}`)
}

AiNode.setSelects = function(node){
    node.inferenceSelect = getSelectByName(node, "inference");
    node.openAiSelect = getSelectByName(node, "open-ai");
    node.anthropicSelect = getSelectByName(node, "anthropic");
    node.groqSelect = getSelectByName(node, "groq");
    node.localModelSelect = getSelectByName(node, "local-model");
    node.customModelSelect = getSelectByName(node, "custom-model");
}

AiNode.setupLocalLLMDropdownListeners = function(node){
    const dropdowns = node.localLLMSelect.querySelectorAll('.model-selector.custom-select');
    dropdowns.forEach(AiNode.setupCustomSelect, node);

    setupInferenceDropdowns(node.localLLMSelect);
}
AiNode.setupCustomSelect = function(dropdown){
    const node = this;

    if (!dropdown.dataset.initialized) {
        AiNode.refreshOptions(node, true);
        CustomDropdown.setup(dropdown, true);
        dropdown.dataset.initialized = 'true';
    } else {
        CustomDropdown.restoreState(dropdown);
    }
    CustomDropdown.addEventListeners(dropdown);

    const refresh = AiNode.refreshOptions.bind(null, node, false); // false needed to not setValues
    dropdown.addEventListener('change', refresh);
    dropdown.closest('.dropdown-container').addEventListener('click', refresh);
}

function createAndConfigureLocalLlmSelects(nodeIndex) {
    const localLlmSelects = document.createElement('div');
    localLlmSelects.className = `local-llm-dropdown-container-${nodeIndex}`; // for easier selection
    localLlmSelects.classList.add('inference-template-wrapper');

    localLlmSelects.append(
        createSelectWithWrapper('inference', 'inference', nodeIndex),
        createSelectWithWrapper('open-ai', 'openai', nodeIndex),
        createSelectWithWrapper('anthropic', 'anthropic', nodeIndex),
        createSelectWithWrapper('groq', 'groq', nodeIndex),
        createSelectWithWrapper('local-model', 'ollama', nodeIndex),
        createSelectWithWrapper('custom-model', 'custom', nodeIndex)
    );
    return localLlmSelects;
}

function syncOptions(sourceId, targetSelect, storageId, setValue) {
    const sourceSelect = Elem.byId(sourceId);
    const ct = new ctSyncOptions(sourceSelect, targetSelect);
    // Remove from targetSelect options missing from sourceSelect
    Array.from(targetSelect.options).forEach(ct.removeNonExistent, ct);
    // Add to targetSelect missing options of sourceSelect
    Array.from(sourceSelect.options).forEach(ct.addNonExistent, ct);
    if (setValue) targetSelect.value = sourceSelect.value;
}
const ctSyncOptions = class {
    constructor(sourceSelect, targetSelect){
        this.sourceValues = new Set(Array.from(sourceSelect.options).map(this.valueOf));
        this.existingValues = new Set(Array.from(targetSelect.options).map(this.valueOf));
        this.targetSelect = targetSelect;
    }
    valueOf(obj){ return obj.value }
    removeNonExistent(option){
        if (this.sourceValues.has(option.value)) return;

        this.targetSelect.removeChild(option);
        CustomDropdown.refreshDisplay(this.targetSelect);
    }
    addNonExistent(option){
        const optionValue = option.value;
        if (this.existingValues.has(optionValue)) return;

        const key = option.getAttribute('data-key');
        CustomDropdown.addOption(this.targetSelect, option.text, optionValue, key);
        this.existingValues.add(optionValue);
    }
}

AiNode.refreshOptions = function(node, setValues){
    // Sync options from global dropdowns to node-specific dropdowns
    syncOptions('inference-select', node.inferenceSelect, 'inference-select-storage', setValues);
    syncOptions('open-ai-select', node.openAiSelect, 'open-ai-select-storage', setValues);
    syncOptions('anthropic-select', node.anthropicSelect, 'anthropic-select-storage', setValues);
    syncOptions('groq-select', node.groqSelect, 'groq-select-storage', setValues);
    syncOptions('local-model-select', node.localModelSelect, 'local-model-select-storage', setValues);
    syncOptions('custom-model-select', node.customModelSelect, 'custom-model-select-storage', setValues);
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
function createCheckboxArray(nodeIndex, subsetOptions) {
    const checkboxArrayDiv = document.createElement('div');
    checkboxArrayDiv.className = 'checkboxarray';

    for (const option of subsetOptions) {
        const checkboxDiv = document.createElement('div');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = option.id + '-checkbox-' + nodeIndex;
        checkbox.name = option.id + '-checkbox-' + nodeIndex;

        const label = document.createElement('label');
        label.setAttribute('for', checkbox.id);
        label.innerText = option.label;

        checkboxDiv.appendChild(checkbox);
        checkboxDiv.appendChild(label);
        checkboxArrayDiv.appendChild(checkboxDiv);
    }

    return checkboxArrayDiv;
}

function createCustomInstructionsTextarea() {
    const containerDiv = document.createElement('div');
    containerDiv.className = 'custom-instructions-container';

    const promptLibraryButton = document.createElement('button');
    promptLibraryButton.textContent = 'Prompt Library';
    promptLibraryButton.className = 'prompt-library-button';

    const textarea = document.createElement('textarea');
    textarea.className = 'custom-instructions-textarea custom-scrollbar';
    textarea.placeholder = 'Enter custom instructions here...';
    textarea.id = `custom-instructions-textarea`; // Add a unique id

    containerDiv.appendChild(promptLibraryButton);
    containerDiv.appendChild(textarea);

    return { containerDiv, textarea };
}

function setupCustomInstructionsListeners(node) {
    const promptLibraryButton = node.content.querySelector('.prompt-library-button');

    if (!promptLibraryButton || !node.customInstructionsTextarea) {
        //console.error('Custom instructions elements not found for node:', node);
        return;
    }

    promptLibraryButton.onclick = () => openPromptLibrary(node);
}
