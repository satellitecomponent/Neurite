function setModelSelectorsVisibility(inferenceSelect) {
    const selectedValue = inferenceSelect.value.toLowerCase();
    const nodeIndex = inferenceSelect.id.split('-').pop(); // Extract the node index if present

    // Get the container of the inference select to scope the selection
    const container = inferenceSelect.closest('.local-llm-dropdown-container-' + nodeIndex) || document.getElementById('template-dropdowns');

    if (!container) {
        console.error('Container not found for inference select', inferenceSelect);
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

    // Add change event listener to the inference select
    inferenceSelect.addEventListener('change', () => {
        setModelSelectorsVisibility(inferenceSelect);

        // Close the dropdown when an option is selected
        const selectReplacer = inferenceSelect.closest('.select-container').querySelector('.select-replacer');
        if (selectReplacer) {
            selectReplacer.classList.add('closed');
            const optionsReplacer = selectReplacer.querySelector('.options-replacer');
            if (optionsReplacer) {
                optionsReplacer.classList.remove('show');
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const templateDropdownsContainer = document.getElementById('template-dropdowns');
    // Delay the visibility update to ensure saved options are loaded
    setTimeout(() => {
        setupInferenceDropdowns(templateDropdownsContainer);
    }, 100); // Adjust the timeout duration as needed
});



document.addEventListener('DOMContentLoaded', function () {
    const select = document.getElementById('custom-model-select');
    loadDropdownFromLocalStorage(select, 'customModelDropdown');
});

function saveApiConfig() {
    const endpoint = document.getElementById('apiEndpoint').value;
    const key = document.getElementById('apiEndpointKey').value;
    const modelName = document.getElementById('apiModelName').value;

    // Validate the endpoint and model name
    if (!endpoint.trim() || !modelName.trim()) {
        alert("API Endpoint and Model Name are required.");
        return;
    }

    const select = document.getElementById('custom-model-select');

    // Create an object containing all necessary data
    const selectData = { modelName, endpoint, key, value: Date.now().toString() };

    // Add the new model to the dropdown and update localStorage
    addToCustomModelDropdown(select, selectData, 'customModelDropdown');

    // Close modal after adding
    closeModal();
}

function fetchCustomModelData(modelName) {
    const select = document.getElementById('custom-model-select');
    const options = select.options;
    let selectedOption = null;

    for (let option of options) {
        if (option.text === modelName) {
            selectedOption = option;
            break;
        }
    }

    if (!selectedOption) {
        console.error(`No option found with model name: ${modelName}`);
        return null;
    }

    const apiEndpoint = selectedOption.getAttribute('data-endpoint');
    const apiKey = selectedOption.getAttribute('data-key');

    if (!apiEndpoint) {
        console.error(`Missing Custom Endpoint: ${modelName}`);
        return null;
    }

    return {
        apiEndpoint: apiEndpoint,
        apiKey: apiKey
    };
}

document.getElementById('addApiConfigBtn').addEventListener('click', function () {
    openModal('apiConfigModalContent');
});

document.getElementById('deleteApiConfigBtn').addEventListener('click', function () {
    deleteSelectedOption('custom-model-select', 'customModelDropdown');
});




//api keys

// Load any saved keys from local storage
document.getElementById('googleApiKey').value = localStorage.getItem('googleApiKey') || '';
document.getElementById('googleSearchEngineId').value = localStorage.getItem('googleSearchEngineId') || '';
document.getElementById('api-key-input').value = localStorage.getItem('openaiApiKey') || '';
document.getElementById('wolframApiKey').value = localStorage.getItem('wolframApiKey') || '';
document.getElementById('GROQ-api-key-input').value = localStorage.getItem('GROQ-api-key-input') || '';
document.getElementById('anthropic-api-key-input').value = localStorage.getItem('anthropic-api-key-input') || '';

function saveKeys() {
    // Save keys to local storage
    localStorage.setItem('googleApiKey', document.getElementById('googleApiKey').value);
    localStorage.setItem('googleSearchEngineId', document.getElementById('googleSearchEngineId').value);
    localStorage.setItem('openaiApiKey', document.getElementById('api-key-input').value);
    localStorage.setItem('wolframApiKey', document.getElementById('wolframApiKey').value);
    localStorage.setItem('GROQ-api-key-input', document.getElementById('GROQ-api-key-input').value);
    localStorage.setItem('anthropic-api-key-input', document.getElementById('anthropic-api-key-input').value);
}

async function saveKeysToFile() {
    // Gather the keys
    const keys = {
        googleApiKey: document.getElementById('googleApiKey').value || '',
        googleSearchEngineId: document.getElementById('googleSearchEngineId').value || '',
        openaiApiKey: document.getElementById('api-key-input').value || '',
        wolframApiKey: document.getElementById('wolframApiKey').value || '',
        GROQApiKey: document.getElementById('GROQ-api-key-input').value || '',
        anthropicApiKey: document.getElementById('anthropic-api-key-input').value || '',
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
            document.getElementById('googleApiKey').value = keys.googleApiKey || '';
            document.getElementById('googleSearchEngineId').value = keys.googleSearchEngineId || '';
            document.getElementById('api-key-input').value = keys.openaiApiKey || '';
            document.getElementById('wolframApiKey').value = keys.wolframApiKey || '';
            document.getElementById('GROQ-api-key-input').value = keys.GROQApiKey || '';
            document.getElementById('anthropic-api-key-input').value = keys.anthropicApiKey || '';
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
    // Clear keys from local storage
    localStorage.removeItem('googleApiKey');
    localStorage.removeItem('googleSearchEngineId');
    localStorage.removeItem('openaiApiKey');
    localStorage.removeItem('wolframApiKey');
    localStorage.removeItem('GROQApiKey');
    localStorage.removeItem('anthropicApiKey');

    // Clear input fields
    document.getElementById('googleApiKey').value = '';
    document.getElementById('googleSearchEngineId').value = '';
    document.getElementById('api-key-input').value = '';
    document.getElementById('wolframApiKey').value = '';
    document.getElementById('GROQ-api-key-input').value = '';
    document.getElementById('anthropic-api-key-input').value = '';
}

// From ai.js

let useProxy = true;
let baseOllamaUrl = 'http://127.0.0.1:11434/api/';
let ollamaLibrary = null;

// Check if the AI proxy server is working
async function checkProxyServer() {
    try {
        const response = await fetch('http://localhost:7070/check');
        if (response.ok) {
            useProxy = true;
            console.log('AI proxy server is working');
        } else {
            useProxy = false;
            console.log('AI proxy server is not enabled. See Neurite/Localhost Servers/ai-proxy folder for our ai-proxy.js file. Fetch requests will be made through JS until the page is refreshed while the ai-proxy is running.');
        }
    } catch (error) {
        useProxy = false;
        console.log('AI proxy server is not enabled. See Neurite/Localhost Servers/ai-proxy folder for our ai-proxy.js file. Fetch requests will be made through JS until the page is refreshed while the ai-proxy is running.');
    }

    if (useProxy) {
        ollamaLibrary = await getOllamaLibrary();
    }

    await ollamaSelectOnPageLoad();
}

// Call the checkProxyServer function when the page loads
window.addEventListener('load', checkProxyServer);

// Function to provide API keys to the proxy server
async function provideAPIKeys() {
    const openaiApiKey = document.getElementById("api-key-input").value;
    const groqApiKey = document.getElementById("GROQ-api-key-input").value;
    const anthropicApiKey = document.getElementById("anthropic-api-key-input").value;
    try {
        const response = await fetch('http://localhost:7070/api-keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ openaiApiKey, groqApiKey, anthropicApiKey })
        });
        if (response.ok) {
            //console.log('API keys provided to the proxy server');
        } else {
            console.log('Failed to provide API keys to the proxy server');
        }
    } catch (error) {
        console.log('Failed to provide API keys to the proxy server');
    }
}

function getAPIParams(messages, stream, customTemperature, inferenceOverride = null) {
    if (!inferenceOverride) {
        inferenceOverride = determineGlobalModel();
    }
    const { provider, model } = inferenceOverride;
    console.log('Selected Ai:', model);
    let API_KEY;
    let API_URL;
    let apiEndpoint;

    if (useProxy) {
        // Use the AI proxy server
        switch (provider) {
            case 'GROQ':
                API_URL = "http://localhost:7070/groq";
                break;
            case 'anthropic':
                API_URL = "http://localhost:7070/anthropic";
                break;
            case 'ollama':
                API_URL = "http://127.0.0.1:11434/api/chat"; // Always fetch Ollama client side.
                break;
            case 'custom':
                // Assume 'modelName' is the name or identifier you are working with
                const apiDetails = fetchCustomModelData(model);
                if (!apiDetails) {
                    console.error("Failed to fetch API details for the model:", model);
                    break;  // Exit if no API details are found
                }
                // Now use the API details as needed
                API_URL = "http://localhost:7070/custom";
                apiEndpoint = apiDetails.apiEndpoint;
                API_KEY = apiDetails.apiKey;

                // Additional logic using API_URL, apiEndpoint, API_KEY as needed
                break;
                break;
            default:
                API_URL = "http://localhost:7070/openai";
        }
        // Provide API keys to the proxy server
        provideAPIKeys();
    } else {
        // Use the direct API endpoints
        switch (provider) {
            case 'GROQ':
                API_URL = "https://api.groq.com/openai/v1/chat/completions";
                API_KEY = document.getElementById("GROQ-api-key-input").value;
                break;
            case 'claude':
                alert("Claude model can only be used with the AI proxy server. Please enable the proxy server and refresh the page.");
                return null;
            case 'ollama':
                API_URL = "http://127.0.0.1:11434/api/chat";
                break;
            case 'custom':
                const apiDetails = fetchCustomModelData(model);
                API_URL = apiDetails.apiEndpoint;
                API_KEY = apiDetails.apiKey;
            default:
                API_URL = "https://api.openai.com/v1/chat/completions";
                API_KEY = document.getElementById("api-key-input").value;
        }
    }

    if (!useProxy && !API_KEY && provider !== 'ollama' && provider !== 'custom') {
        alert("Please enter your API key");
        return null;
    }

    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    if (!useProxy && (provider === 'OpenAi' || provider === 'GROQ')) {
        headers.append("Authorization", `Bearer ${API_KEY}`);
    }

    const temperature = customTemperature !== null ? customTemperature : parseFloat(document.getElementById('model-temperature').value);
    let max_tokens = document.getElementById('max-tokens-slider').value;

    const body = {
        model,
        messages,
        max_tokens: parseInt(max_tokens),
        temperature,
        stream
    };

    // Only include requestId in the body if it is 'ollama' or 'custom' provider
    if (provider === 'ollama' || provider === 'custom') {
        const requestId = Date.now().toString();
        body.requestId = requestId;
    }

    if (apiEndpoint) {
        body.apiEndpoint = apiEndpoint;
        body.apiKey = API_KEY;
    }

    return {
        headers,
        body,
        API_URL
    };
}