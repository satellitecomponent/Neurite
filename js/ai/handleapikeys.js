// Custom Endpoint
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
    const selectData = { modelName, endpoint, key };

    // Add the new model to the dropdown and update localStorage
    addToCustomModelDropdown(select, selectData, 'customModelDropdown');

    // Close modal after adding
    closeModal();
}

document.addEventListener('DOMContentLoaded', function () {
    const select = document.getElementById('custom-model-select');
    loadDropdownFromLocalStorage(select, 'customModelDropdown');
});

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

// Check if the AI proxy server is working
async function checkProxyServer() {
    try {
        const response = await fetch('http://localhost:7070/check');
        if (response.ok) {
            useProxy = true;
            console.log('AI proxy server is working');
        } else {
            useProxy = false;
            console.log('AI proxy server is not enabled. SeeNeurite/Localhost Servers/ai-proxy folder for our ai-proxy.js file. Fetch requests will be made through js until the page is refreshed while the ai-proxy is running.');
        }
    } catch (error) {
        useProxy = false;
        console.log('AI proxy server is not enabled. See Neurite/Localhost Servers/ai-proxy folder for our ai-proxy.js file. Fetch requests will be made through js until the page is refreshed while the ai-proxy is running.');
    }
}

// Call the checkProxyServer function when the page loads
window.addEventListener('load', checkProxyServer);

// Function to provide API keys to the proxy server
async function provideAPIKeys() {
    const openaiApiKey = document.getElementById("api-key-input").value;
    const groqApiKey = document.getElementById("GROQ-api-key-input").value;
    //const claudeApiKey = document.getElementById("anthropic-api-key-input").value;

    try {
        const response = await fetch('http://localhost:7070/api-keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            //body: JSON.stringify({ openaiApiKey, groqApiKey, claudeApiKey })
            body: JSON.stringify({ openaiApiKey, groqApiKey })
        });

        if (response.ok) {
            console.log('API keys provided to the proxy server');
        } else {
            console.log('Failed to provide API keys to the proxy server');
        }
    } catch (error) {
        console.log('Failed to provide API keys to the proxy server');
    }
}

function getAPIParams(messages, stream, customTemperature, modelOverride = null) {
    const modelSelect = document.getElementById('model-select');
    const modelInput = document.getElementById('model-input');
    const localModelSelect = document.getElementById('local-model-select');
    const customModelSelect = document.getElementById('custom-model-select');
    let model = modelOverride || (modelSelect.value === 'other' ? modelInput.value : modelSelect.value);
    console.log(`model`, model);
    let API_KEY;
    let API_URL;

    if (useProxy) {
        // Use the AI proxy server
        if (model.includes("GROQ")) {
            API_URL = "http://localhost:7070/groq";
        } else if (model.includes("claude")) {
            API_URL = "http://localhost:7070/claude";
        } else if (model.includes("ollama")) {
            API_URL = "http://localhost:7070/ollama";

            model = localModelSelect.value;
        } else if (model.includes("custom")) {
            const selectedOption = customModelSelect.options[customModelSelect.selectedIndex];
            API_URL = selectedOption.getAttribute('data-endpoint');
            API_KEY = selectedOption.getAttribute('data-key');
            model = selectedOption.text; // Assuming the model name is the text content of the option
        } else {
            API_URL = "http://localhost:7070/openai";
        }
        // Provide API keys to the proxy server
        provideAPIKeys();
    } else {
        // Use the direct API endpoints
        if (model.includes("GROQ")) {
            API_URL = "https://api.groq.com/openai/v1/chat/completions";
            API_KEY = document.getElementById("GROQ-api-key-input").value;
        } else if (model.includes("claude")) {
            alert("Claude model can only be used with the AI proxy server. Please enable the proxy server and refresh the page.");
            return null;
        } else if (model.includes("ollama")) {
            alert("Ollama can only be used with the AI proxy server. Please enable the LocalHost Servers and refresh the page.");
            return null;
        } else if (model.includes("custom")) {
            alert("Custom Endpoints can only be used with the AI proxy server. Please enable the LocalHost Servers and refresh the page.");
            return null;
        } else {
            API_URL = "https://api.openai.com/v1/chat/completions";
            API_KEY = document.getElementById("api-key-input").value;
        }
    }

    // Remove the "GROQ-" prefix from the model value
    model = model.replace(/^GROQ-/, '');

    if (!useProxy && !API_KEY) {
        alert("Please enter your API key");
        return null;
    }

    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    if (!useProxy) {
        headers.append("Authorization", `Bearer ${API_KEY}`);
    }

    const temperature = customTemperature !== null ? customTemperature
        : parseFloat(document.getElementById('model-temperature').value);
    let max_tokens = document.getElementById('max-tokens-slider').value;

    return {
        headers,
        body: JSON.stringify({
            model,
            messages,
            max_tokens: parseInt(max_tokens),
            temperature,
            stream
        }),
        API_URL
    };
}