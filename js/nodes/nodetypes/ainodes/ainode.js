function createAndDrawLlmNode(){
    createLlmNode().draw()
}
function createLlmNode(name = '', sx, sy, x, y) {
    const llmNodeCount = AiNode.count;

    // Create the AI response textarea
    const aiResponseTextArea = Html.new.textarea()
    aiResponseTextArea.id = 'LLMnoderesponse-' + llmNodeCount;
    aiResponseTextArea.style.display = 'none';

    // Create the AI response container
    const aiResponseDiv = Html.make.div('custom-scrollbar ai-response-div');
    aiResponseDiv.id = 'LLMnoderesponseDiv-' + llmNodeCount;

    // Create the user prompt textarea
    const promptTextArea = Html.make.textarea('custom-scrollbar custom-textarea');
    promptTextArea.id = 'nodeprompt-' + llmNodeCount;

    // Create the send button (keeping inline styles)
    const sendButton = Html.new.button();
    sendButton.type = "submit";
    sendButton.id = 'prompt-form-' + llmNodeCount;
    sendButton.style.cssText = "display: flex; justify-content: center; align-items: center; padding: 3px; z-index: 1; font-size: 14px; cursor: pointer; background-color: #222226; transition: background-color 0.3s; border: inset; border-color: #8882; width: 30px; height: 30px;";
    sendButton.innerHTML = Svg.play;

    // Create the regenerate button (keeping inline styles)
    const regenerateButton = Html.new.button();
    regenerateButton.type = "button";
    regenerateButton.id = "prompt-form";
    regenerateButton.style.cssText = "display: flex; justify-content: center; align-items: center; padding: 3px; z-index: 1; font-size: 14px; cursor: pointer; background-color: #222226; transition: background-color 0.3s; border: inset; border-color: #8882; width: 30px; height: 30px;";
    regenerateButton.innerHTML = Svg.refresh;

    // Create settings button (keeping inline styles)
    const aiNodeSettingsButton = Html.new.button();
    aiNodeSettingsButton.type = "button";
    aiNodeSettingsButton.id = 'aiNodeSettingsButton';
    aiNodeSettingsButton.style.cssText = "display: flex; justify-content: center; align-items: center; padding: 3px; z-index: 1; font-size: 14px; cursor: pointer; background-color: #222226; transition: background-color 0.3s; border: inset; border-color: #8882; width: 30px; height: 30px;";
    const settingsIcon = Elem.byId('aiNodeSettingsIcon').cloneNode(true);
    settingsIcon.style.display = 'inline-block';
    aiNodeSettingsButton.appendChild(settingsIcon);
    aiNodeSettingsButton.isActive = false;

    // Create the loader and error icons container (keeping inline styles)
    const statusIconsContainer = Html.make.div('status-icons-container');
    statusIconsContainer.style.cssText = 'position: absolute; top: 42px; right: 90px; width: 20px; height: 20px;';

    // Create the loader icon
    const aiLoadingIcon = Html.make.div('loader');
    aiLoadingIcon.id = 'aiLoadingIcon-' + llmNodeCount;
    aiLoadingIcon.style.display = 'none';

    // Create the error icon
    const aiErrorIcon = Html.make.div('error-icon-css');
    aiErrorIcon.id = 'aiErrorIcon-' + llmNodeCount;
    aiErrorIcon.style.display = 'none';

    // Create the 'X' mark inside the error icon
    const xMark = Html.make.div('error-x-mark');
    const xMarkLeft = Html.make.div('error-x-mark-left');
    const xMarkRight = Html.make.div('error-x-mark-right');
    xMark.append(xMarkLeft, xMarkRight);
    aiErrorIcon.appendChild(xMark);

    statusIconsContainer.append(aiLoadingIcon, aiErrorIcon);

    // Create a div to wrap prompt textarea and buttons
    const buttonDiv = Html.make.div('button-container');
    buttonDiv.append(sendButton, regenerateButton, aiNodeSettingsButton);

    // Create the promptDiv
    const promptDiv = Html.make.div('prompt-container');
    promptDiv.append(statusIconsContainer, promptTextArea, buttonDiv);

    // Wrap elements in a div
    const ainodewrapperDiv = Html.make.div('ainodewrapperDiv');
    ainodewrapperDiv.append(aiResponseTextArea, aiResponseDiv, promptDiv);

    const { containerDiv, textarea: customInstructionsTextarea } = createCustomInstructionsTextarea();
    ainodewrapperDiv.appendChild(AiNode.makeSettingsContainer(llmNodeCount, containerDiv));

    // Pass this div to addNodeAtNaturalScale
    const node = new Node();

    const divView = NodeView.addAtNaturalScale(node, name, []).div;
    divView.style.resize = 'both';
    divView.style.minWidth = `450px`;
    divView.style.minHeight = `535px`;
    divView.appendChild(ainodewrapperDiv);

    // Additional configurations
    node.id = aiResponseTextArea.id;
    node.index = llmNodeCount;
    node.aiResponding = false;
    node.localAiResponding = false;
    node.latestUserMessage = null;
    node.shouldContinue = true;

    node.shouldAppendQuestion = false;
    node.aiResponseHalted = false;
    node.savedLLMSelection = '';

    node.currentTopNChunks = null;

    node.push_extra_cb((node) => {
        return {
            f: "textarea",
            a: {
                p: [0, 0, 1],
                v: node.view.titleInput.value
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

AiNode.init = function(node, restoreNewLines){
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
    const resHandler = new ResponseHandler(node);
    nodeResponseHandlers.set(node, resHandler); // map response handler to node

    node.removeLastResponse = resHandler.removeLastResponse.bind(resHandler);
    Elem.forEachChild(resHandler.node.aiResponseDiv, resHandler.restoreResponse, resHandler);

    node.haltResponse = AiNode.HaltResponse.bind(AiNode, node);

    if (restoreNewLines) {
        node.aiResponseDiv.querySelectorAll('pre').forEach( (pre)=>{
            pre.innerHTML = pre.innerHTML.split(App.NEWLINE_PLACEHOLDER).join('\n');
        })
    }
}

AiNode.HaltResponse = function(node){
    if (node.aiResponding) {
        // AI is responding, so we want to stop it
        node.controller.abort(); // Send the abort signal to the fetch request
        node.aiResponding = false;
        node.shouldContinue = false;
        node.regenerateButton.innerHTML = Svg.refresh;
        node.promptTextArea.value = node.latestUserMessage; // Add the last user message to the prompt input

        // Access the resHandler from the nodeResponseHandlers map
        const resHandler = nodeResponseHandlers.get(node);

        // If currently in a code block
        if (resHandler?.inCodeBlock) {
            // Add closing backticks to the current code block content
            resHandler.codeBlockContent += '```\n';

            // Render the final code block
            resHandler.renderCodeBlock(resHandler.codeBlockContent, true);

            // Reset the code block state
            resHandler.codeBlockContent = '';
            resHandler.codeBlockStartIndex = -1;
            resHandler.inCodeBlock = false;

            // Clear the textarea value to avoid reprocessing
            node.aiResponseTextArea.value = resHandler.previousContent + resHandler.codeBlockContent;

            // Update the previous content length
            resHandler.previousContentLength = node.aiResponseTextArea.value.length;
            node.aiResponseTextArea.dispatchEvent(new Event('input'));
        }
        node.aiResponseHalted = true;
    }

    if (node.haltCheckbox) node.haltCheckbox.checked = true;

    // Reinitialize the controller for future use
    node.controller = new AbortController();

    // Remove the node's request from activeRequests
    for (const [requestId, requestInfo] of activeRequests.entries()) {
        if (requestInfo.type === 'node' && requestInfo.node === node) {
            activeRequests.delete(requestId);
            break;
        }
    }
}

AiNode.setupResponseDivListeners = function(node){
    const aiResponseDiv = node.aiResponseDiv;
    On.mousedown(aiResponseDiv, (e)=>{
        if (!e.altKey) e.stopPropagation()
    });

    On.mouseenter(aiResponseDiv, (e)=>{
        aiResponseDiv.style.userSelect = 'text'
    });
    On.mouseleave(aiResponseDiv, (e)=>{
        aiResponseDiv.style.userSelect = 'none'
    });
    On.wheel(aiResponseDiv, (e)=>{
        // If the Shift key is not being held down, stop the event propagation
        if (!App.nodeMode) e.stopPropagation();
    }, { passive: false });

    let userHasScrolled = false;

    function scrollToBottom(){
        aiResponseDiv.scrollTo({
            top: aiResponseDiv.scrollHeight,
            behavior: 'smooth'
        })
    }
    On.input(node.aiResponseTextArea, ()=>{
        if (!userHasScrolled) Promise.delay(1).then(scrollToBottom)
    });

    const epsilon = 5; // Tolerance in pixels

    const handleScroll = () => {
        if (Math.abs(aiResponseDiv.scrollTop + aiResponseDiv.clientHeight - aiResponseDiv.scrollHeight) > epsilon) {
            userHasScrolled = true;
        } else {
            userHasScrolled = false;
        }
    };

    On.scroll(aiResponseDiv, handleScroll);

    // Update text highlighting
    On.keydown(document, (e)=>{
        if (e.altKey) aiResponseDiv.style.userSelect = 'none';
    });
    On.keyup(document, (e)=>{
        if (!e.altKey) aiResponseDiv.style.userSelect = 'text';
    });
}

AiNode.setupPromptTextAreaListeners = function(node){
    const textArea = node.promptTextArea;
    On.mousedown(textArea, Event.stopPropagation); // Prevent dragging
    On.input(textArea, autoGrow);
    On.focus(textArea, autoGrow);
    On.mouseenter(textArea, (e)=>{
        textArea.style.userSelect = 'text';
    });
    On.mouseleave(textArea, (e)=>{
        textArea.style.userSelect = 'none';
    });
    On.keydown(textArea, (e)=>{
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            AiNode.sendMessage(node);
        }
    });
}

AiNode.setupSendButtonListeners = function(node){
    const button = node.sendButton;

    const haltCheckbox = node.haltCheckbox;

    On.mouseover(button, Elem.setBothColors.bind(button, '#222226', '#293e34'));
    On.mouseout(button, Elem.setBothColors.bind(button, '#ddd', '#222226'));
    On.mousedown(button, Elem.setBackgroundColor.bind(button, '#45a049'));
    On.mouseup(button, Elem.setBackgroundColor.bind(button, '#ddd'));

    On.click(button, (e)=>{
        e.preventDefault();

        node.aiResponseHalted = false;
        node.shouldContinue = true;

        if (haltCheckbox) haltCheckbox.checked = false;

        AiNode.sendMessage(node);
    });

    if (haltCheckbox) {
        On.change(haltCheckbox, (e)=>{
            node.aiResponseHalted = haltCheckbox.checked;
            if (haltCheckbox.checked) node.haltResponse();
        });
    }
}

AiNode.setupRegenerateButtonListeners = function(node){
    const button = node.regenerateButton;
    const setBackColor = Elem.setBackgroundColor;
    On.mouseover(button, setBackColor.bind(button, '#333'));
    On.mouseout(button, setBackColor.bind(button, '#222226'));
    On.mousedown(button, setBackColor.bind(button, '#45a049'));
    On.mouseup(button, setBackColor.bind(button, '#222226'));

    node.regenerateResponse = function () {
        this.removeLastResponse();
        this.promptTextArea.value = this.latestUserMessage;
        this.regenerateButton.innerHTML = Svg.refresh;
    };

    On.click(button, (e)=>{
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
    On.mouseover(button, setBackColorPerIsActive.bind(button, '#1e3751', '#333'));
    On.mouseout(button, setBackColorPerIsActive.bind(button, '#1e3751', '#222226'));
    On.mousedown(button, Elem.setBackgroundColor.bind(button, '#1e3751'));
    On.mouseup(button, setBackColorPerIsActive.bind(button, '#1e3751', '#333'));
    On.click(button, (e)=>{
        button.isActive = !button.isActive;
        toggleSettings(e, container);
        setBackColorPerIsActive.call(button, '#1e3751', '#333');
    });

    On.mousedown(container, conditionalStopPropagation);
    On.dblclick(container, conditionalStopPropagation);
}

function conditionalStopPropagation(event) {
    if (!event.getModifierState(controls.altKey.value)) {
        event.stopPropagation();
    }
}

AiNode.makeSettingsContainer = function (nodeIndex, containerDiv) {
    function getSliderAttributes(id) {
        const elem = Elem.byId(id);
        return {
            value: elem.value,
            min: elem.min,
            max: elem.max,
            step: elem.step
        };
    }

    const tempAttrs = getSliderAttributes('model-temperature');
    const tokensAttrs = getSliderAttributes('max-tokens-slider');
    const contextAttrs = getSliderAttributes('max-context-size-slider');

    const container = Html.make.div('ainode-settings-container');
    container.style.display = 'none';
    container.append(
        createAndConfigureLocalLlmSelects(nodeIndex),
        Elem.makeSlider(`node-temperature-${nodeIndex}`, 'Temperature', tempAttrs.value, tempAttrs.min, tempAttrs.max, tempAttrs.step),
        Elem.makeSlider(`node-max-tokens-${nodeIndex}`, 'Max Tokens', tokensAttrs.value, tokensAttrs.min, tokensAttrs.max, tokensAttrs.step),
        Elem.makeSlider(`node-max-context-${nodeIndex}`, 'Max Context', contextAttrs.value, contextAttrs.min, Math.min(contextAttrs.max, tokensAttrs.value), contextAttrs.step),
        createCheckboxArray(nodeIndex, allOptions.slice(0, 6)),
        containerDiv
    );

    return container;
};


// Function to toggle the settings container
function toggleSettings(event, settingsContainer) {
    event.stopPropagation();
    const display = settingsContainer.style.display;
    settingsContainer.style.display = (display === 'none' || display === '' ? 'grid' : 'none');
}

Elem.makeSlider = function(id, label, initialValue, min, max, step){
    const sliderDiv = Html.make.div('slider-container');

    const sliderLabel = Html.new.label();
    sliderLabel.setAttribute('for', id);
    sliderLabel.innerText = label + ': ' + initialValue;

    const sliderInput = Html.new.input();
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
        On.input(slider, (e)=>{
            const label = node.content.querySelector(`label[for='${slider.id}']`);
            if (!label) return;

            const baseLabelText = label.innerText.split(':')[0];
            label.innerText = baseLabelText + ": " + slider.value;

            setSliderBackground(slider);
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
        On.input(maxContextSizeSlider, (e)=>{
            const maxContextSizeLabel = node.content.querySelector(`label[for='node-max-context-${node.index}']`);
            if (!maxContextSizeLabel) return;

            const maxContextValue = parseInt(maxContextSizeSlider.value, 10);
            const maxContextMax = parseInt(maxContextSizeSlider.max, 10);
            const ratio = Math.round((maxContextValue / maxContextMax) * 100);
            maxContextSizeLabel.innerText = `Context: ${ratio}% (${maxContextValue} tokens)`;
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
    node.neuriteModelSelect = getSelectByName(node, "neurite-model");
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
    On.change(dropdown, refresh);
    On.click(dropdown.closest('.dropdown-container'), refresh);
}

function createAndConfigureLocalLlmSelects(nodeIndex) {
    const className = 'local-llm-dropdown-container-' + nodeIndex
                    + ' inference-template-wrapper';
    const localLlmSelects = Html.make.div(className);

    localLlmSelects.append(
        createSelectWithWrapper('inference', 'inference', nodeIndex),
        createSelectWithWrapper('open-ai', 'openai', nodeIndex),
        createSelectWithWrapper('anthropic', 'anthropic', nodeIndex),
        createSelectWithWrapper('groq', 'groq', nodeIndex),
        createSelectWithWrapper('local-model', 'ollama', nodeIndex),
        createSelectWithWrapper('custom-model', 'custom', nodeIndex),
        createSelectWithWrapper('neurite-model', 'neurite', nodeIndex)
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

        const key = option.dataset.key;
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
    syncOptions('neurite-model-select', node.neuriteModelSelect, 'neurite-model-select-storage', setValues);
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
    const checkboxArrayDiv = Html.make.div('checkboxarray');

    for (const option of subsetOptions) {
        const checkboxDiv = Html.new.div();

        const checkbox = Html.new.input();
        checkbox.type = 'checkbox';
        checkbox.id = option.id + '-checkbox-' + nodeIndex;
        checkbox.name = option.id + '-checkbox-' + nodeIndex;

        const label = Html.new.label();
        label.setAttribute('for', checkbox.id);
        label.innerText = option.label;

        checkboxDiv.append(checkbox, label);
        checkboxArrayDiv.appendChild(checkboxDiv);
    }

    return checkboxArrayDiv;
}

function createCustomInstructionsTextarea() {
    const containerDiv = Html.make.div('custom-instructions-container');
    const promptLibraryButton = Html.make.button('prompt-library-button', 'Prompt Library');

    const textarea = Html.make.textarea('custom-instructions-textarea custom-scrollbar');
    textarea.placeholder = 'Enter custom instructions here...';
    textarea.id = `custom-instructions-textarea`; // Add a unique id

    containerDiv.append(promptLibraryButton, textarea);

    return { containerDiv, textarea };
}

function setupCustomInstructionsListeners(node) {
    const promptLibraryButton = node.content.querySelector('.prompt-library-button');

    if (!promptLibraryButton || !node.customInstructionsTextarea) {
        Logger.debug("Custom instructions elements not found for node:", node);
        return;
    }

    On.click(promptLibraryButton, openPromptLibrary.bind(null, node));
}
