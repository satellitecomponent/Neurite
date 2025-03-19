function setModelSelectorsVisibility(inferenceSelect) {
    const selectedValue = inferenceSelect.value.toLowerCase();
    const nodeIndex = inferenceSelect.id.split('-').pop(); // Extract the node index if present

    // Get the container of the inference select to scope the selection
    const container = inferenceSelect.closest('.local-llm-dropdown-container-' + nodeIndex) || Elem.byId('template-dropdowns');
    if (!container) {
        Logger.err("Container not found for inference select:", inferenceSelect);
        return;
    }

    // Hide all model selectors by default
    container.querySelectorAll('.dropdown-wrapper').forEach(wrapper => {
        if (!wrapper.id.startsWith('wrapper-inference')) { // Ensure the inference select wrapper is never hidden
            wrapper.style.display = 'none';
        }
    });

    // Show the relevant model selector based on the selected inference option
    const relevantWrapper = container.querySelector(`[id^="wrapper-${selectedValue}"]`);
    if (relevantWrapper) {
        relevantWrapper.style.display = 'flex';
    }
}

function setupInferenceDropdowns(container) {
    const inferenceSelect = container.querySelector('.model-selector.custom-select[id^="inference-select"]');

    // Set up initial visibility based on the selected inference option
    setModelSelectorsVisibility(inferenceSelect);

    On.change(inferenceSelect, (e)=>{
        setModelSelectorsVisibility(inferenceSelect);

        // Close the dropdown when an option is selected
        const selectReplacer = inferenceSelect.closest('.select-container').querySelector('.select-replacer');
        if (!selectReplacer) return;

        selectReplacer.classList.add('closed');
        const optionsReplacer = selectReplacer.querySelector('.options-replacer');
        if (optionsReplacer) optionsReplacer.classList.remove('show');
    });
}


setupInferenceDropdowns(Elem.byId('template-dropdowns'));



CustomDropdown.loadSelect = function(dropdown){
    const select = Elem.byId(dropdown.selectId);
    CustomDropdown.loadFromLocalStorage(select, dropdown.storageId);
    CustomDropdown.refreshDisplay(select);
}

CustomDropdown.loadSelect(CustomDropdown.model);


function saveApiConfig() {
    const endpoint = Elem.byId('apiEndpoint').value;
    const modelName = Elem.byId('apiModelName').value;
    if (!endpoint.trim() || !modelName.trim()) {
        alert("API Endpoint and Model Name are required.");
        return;
    }

    const selectData = {
        modelName,
        endpoint,
        key: Elem.byId('apiEndpointKey').value,
        value: Date.now().toString()
    };
    CustomDropdown.addModel(CustomDropdown.model, selectData);

    Modal.close();
}

function fetchCustomModelData(modelName) {
    let selectedOption = null;
    for (const option of Elem.byId('custom-model-select').options) {
        if (option.text === modelName) {
            selectedOption = option;
            break;
        }
    }
    if (!selectedOption) {
        Logger.err("No option found with model name:", modelName);
        return null;
    }

    const apiEndpoint = selectedOption.dataset.endpoint;
    const apiKey = selectedOption.dataset.key;

    if (!apiEndpoint) {
        Logger.err("Missing Custom Endpoint:", modelName);
        return null;
    }

    return {
        apiEndpoint: apiEndpoint,
        apiKey: apiKey
    };
}

function addApiConfigBtnListeners(){
    const onAdd = Modal.open.bind(Modal, 'apiConfigModalContent');
    On.click(Elem.byId('addApiConfigBtn'), onAdd);

    const onDelete = CustomDropdown.deleteSelectedOption.bind(CustomDropdown, CustomDropdown.model);
    On.click(Elem.byId('deleteApiConfigBtn'), onDelete);
}
addApiConfigBtnListeners()



//api keys

const LocalStorage = {};
LocalStorage.loadKey = function(inputId, storageId){
    Elem.byId(inputId).value = localStorage.getItem(storageId || inputId) || ''
}
LocalStorage.saveKey = function(inputId, storageId){
    localStorage.setItem(storageId || inputId, Elem.byId(inputId).value)
}
LocalStorage.loadKeys = function(){
    for (const providerId in Providers) {
        const provider = Providers[providerId]
        if (provider.inputId) this.loadKey(provider.inputId, provider.storageId)
    }
}
function saveKeys() {
    LocalStorage.saveKeys()
}
LocalStorage.saveKeys = function(){
    for (const providerId in Providers) {
        const provider = Providers[providerId]
        if (provider.inputId) this.saveKey(provider.inputId, provider.storageId)
    }
}
LocalStorage.loadKeys();

async function saveKeysToFile() {
    // Gather the keys
    const keys = {
        googleApiKey: Elem.byId('googleApiKey').value || '',
        googleSearchEngineId: Elem.byId('googleSearchEngineId').value || '',
        openaiApiKey: Elem.byId('api-key-input').value || '',
        wolframApiKey: Elem.byId('wolframApiKey').value || '',
        GROQApiKey: Elem.byId('GROQ-api-key-input').value || '',
        anthropicApiKey: Elem.byId('anthropic-api-key-input').value || '',
    };

    try {
        if ('showSaveFilePicker' in window) {
            const handle = await window.showSaveFilePicker({
                types: [
                    {
                        description: 'Text Files',
                        accept: {
                            'text/plain': ['.txt'],
                        },
                    },
                ],
            });
            const writable = await handle.createWritable();
            await writable.write(JSON.stringify(keys));
            await writable.close();
        } else {
            // Handle lack of support for showSaveFilePicker
            alert('Your browser does not support saving files.');
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            alert('An error occurred while saving: ' + error);
        }
    }
}

async function loadKeysFromFile() {
    try {
        if ('showOpenFilePicker' in window) {
            const [fileHandle] = await window.showOpenFilePicker();
            const file = await fileHandle.getFile();
            const contents = await file.text();

            const keys = JSON.parse(contents);
            for (providerId in Providers) {
                const provider = Providers[providerId];
                const inputId = provider.inputId;
                if (!inputId) continue;

                Elem.byId(inputId).value = keys[provider.storageId || inputId] || '';
            }
        } else {
            // Handle lack of support for showOpenFilePicker
            alert('Your browser does not support opening files.');
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            alert('An error occurred while loading: ' + error);
        }
    }
}

function clearKeys() {
    for (providerId in Providers) {
        const provider = Providers[providerId];
        const inputId = provider.inputId;
        if (!inputId) continue;

        localStorage.removeItem(provider.storageId || inputId);
        Elem.byId(inputId).value = '';
    }
}

Host.checkServer = async function(){
    useProxy = await Request.send(new Host.checkServer.ct());
    if (useProxy) {
        Ollama.library = await getOllamaLibrary();
    }
    Ollama.baseUrl = Ollama.getBaseUrl();
    await Ollama.selectOnPageLoad();
}
Host.checkServer.ct = class {
    url = Host.urlForPath('/check');
    onSuccess(){ return "AI proxy server is working" }
    onFailure(){ return "AI proxy server is not enabled. See Neurite/Localhost Servers/ai-proxy folder for our ai-proxy.js file. Fetch requests will be made through JS until the page is refreshed while the ai-proxy is running. -" }
}

Host.provideAPIKeys = async function(){
    await Request.send(new Host.provideAPIKeys.ct())
}
Host.provideAPIKeys.ct = class {
    constructor() {
        this.url = Host.urlForPath('/aiproxy/api-keys');
        this.options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                openaiApiKey: Elem.byId('api-key-input').value,
                groqApiKey: Elem.byId('GROQ-api-key-input').value,
                anthropicApiKey: Elem.byId('anthropic-api-key-input').value,
                ollamaBaseUrl: Ollama.userBaseUrl()
            })
        };
    }
    onFailure() { return "Failed to provide API keys to the proxy server"; }
}

function getAPIParams(messages, stream, customTemperature, inferenceOverride) {
    const { providerId, model } = inferenceOverride || Ai.determineModel();
    Logger.info("Selected Ai:", model);

    let API_KEY;
    let API_URL;
    let apiEndpoint;

    if (providerId === 'neurite') {
        // Neurite provider setup with specific endpoint and credentials
        API_URL = null;
        const headers = new Headers();
        headers.append("Content-Type", "application/json");

        // Build the request body
        const body = JSON.stringify({
            temperature: customTemperature !== null ? customTemperature
                : parseFloat(document.getElementById('model-temperature').value),
            messages,
            model, // include the specific model selected for neurite
            stream
        });

        return {
            headers,
            body,
            API_URL,
            providerId
        };
    }

    if (useProxy) {
        // Use the AI proxy server
        switch (providerId) {
            case 'GROQ':
                API_URL = Host.urlForPath('/aiproxy/groq');
                break;
            case 'anthropic':
                API_URL = Host.urlForPath('/aiproxy/anthropic');
                break;
            case 'ollama':
                API_URL = Host.urlForPath('/aiproxy/ollama/chat');
                break;
            case 'custom':
                // Assume 'modelName' is the name or identifier you are working with
                const apiDetails = fetchCustomModelData(model);
                if (!apiDetails) {
                    Logger.err("Failed to fetch API details for the model:", model);
                    break;
                }
                API_URL = Host.urlForPath('/aiproxy/custom');
                apiEndpoint = apiDetails.apiEndpoint;
                API_KEY = apiDetails.apiKey;
                break;
            default:
                API_URL = Host.urlForPath('/aiproxy/openai');
        }
        Host.provideAPIKeys();
    } else {
        // Use the direct API endpoints
        switch (providerId) {
            case 'GROQ':
                API_URL = 'https://api.groq.com/openai/v1/chat/completions';
                API_KEY = Elem.byId('GROQ-api-key-input').value;
                break;
            case 'claude':
                alert("Claude model can only be used with the AI proxy server. Please enable the proxy server and refresh the page.");
                return null;
            case 'ollama':
                API_URL = 'http://127.0.0.1:11434/api/chat';
                break;
            case 'custom':
                const apiDetails = fetchCustomModelData(model);
                API_URL = apiDetails.apiEndpoint;
                API_KEY = apiDetails.apiKey;
                break;
            default:
                API_URL = 'https://api.openai.com/v1/chat/completions';
                API_KEY = Elem.byId('api-key-input').value;
        }
    }

    if (!useProxy && !API_KEY && providerId !== 'ollama' && providerId !== 'custom' && providerId !== 'neurite') {
        alert("Please enter your API key");
        return null;
    }

    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    if (!useProxy && (providerId === 'OpenAi' || providerId === 'GROQ')) {
        headers.append("Authorization", `Bearer ${API_KEY}`);
    }

    const max_tokens = parseInt(Elem.byId('max-tokens-slider').value);
    const temperature = customTemperature ?? parseFloat(Elem.byId('model-temperature').value);
    const body = {model, messages, max_tokens, temperature, stream };

    if (providerId === 'ollama' || providerId === 'custom') {
        body.requestId = Date.now().toString();
    }

    if (apiEndpoint) {
        body.apiEndpoint = apiEndpoint;
        body.apiKey = API_KEY;
    }

    return {headers, body, API_URL};
}
