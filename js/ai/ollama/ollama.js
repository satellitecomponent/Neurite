
async function ollamaSelectOnPageLoad() {
    const select = document.getElementById('local-model-select');
    const openModalButton = document.getElementById('openOllamaModalButton');

    await refreshOllamaModelList(select);
    restoreSelectSelectedValue(select.id);
    updateSelectedOptionDisplay(select);

    openModalButton.addEventListener('click', async () => {
        openModal('ollamaManagerModal');
        await refreshOllamaModal();
    });

    select.addEventListener('change', function () {
        // Store the selected value on change
        storeSelectSelectedValue(select.id);
    });
}

function updateOllamaDropdownOptions(select, tags) {
    // Clear existing options
    while (select.firstChild) {
        select.removeChild(select.firstChild);
    }

    // Add new options using addOptionToCustomDropdown
    tags.forEach(tag => {
        const displayText = tag.name;
        addOptionToCustomDropdown(select, { text: displayText, value: tag.model });
        updateSelectedOptionDisplay(select);
    });
}

async function refreshOllamaModelList(select) {
    const tags = await receiveOllamaModelList();
    updateOllamaDropdownOptions(select, tags);
    refreshCustomDropdownDisplay(select);
}

async function refreshOllamaModal() {
    // Assuming `local-model-select` is the id of the dropdown inside the modal
    const selectId = 'local-model-select';

    // Store the selected value before refreshing
    storeSelectSelectedValue(selectId);

    const tags = await receiveOllamaModelList();
    const availableModels = await getAvailableModels();
    const allModels = mergeModelLists(availableModels, tags);
    populateOllamaModal(allModels);
}


async function getAvailableModels() {
    if (!ollamaLibrary) {
        ollamaLibrary = await getOllamaLibrary();
    }

    const cleanedModels = [];

    ollamaLibrary.forEach(model => {
        const lines = model.name.split('\n').map(line => line.trim());
        const name = lines[0];
        const description = lines.find(line => line.length > 0 && line !== name);
        const sizes = lines.filter(line => /^\d+[Bb]$/.test(line)).map(size => size.toLowerCase());

        if (sizes.length === 0) {
            cleanedModels.push({
                name: name,
                title: description || ''
            });
        } else if (sizes.length === 1) {
            cleanedModels.push({
                name: name,
                title: description || ''
            });
        } else {
            const minSize = Math.min(...sizes.map(size => parseInt(size)));
            sizes.forEach(size => {
                if (parseInt(size) === minSize) {
                    cleanedModels.push({
                        name: name,
                        title: description || ''
                    });
                } else {
                    cleanedModels.push({
                        name: `${name}:${size}`,
                        title: description || ''
                    });
                }
            });
        }
    });

    return cleanedModels;
}

function mergeModelLists(availableModels, installedModels) {
    const installedModelNames = installedModels.map(model => model.name);
    return availableModels.map(model => ({
        ...model,
        installed: installedModelNames.includes(model.name)
    }));
}

function addOllamaDeleteButton(model, listItem) {
    const deleteButton = document.createElement('button');
    const select = document.getElementById('local-model-select');
    deleteButton.textContent = 'x';
    deleteButton.className = 'deletebuttons';
    deleteButton.addEventListener('click', async (event) => {
        event.stopPropagation(); // Prevent the click from triggering the list item click event
        const success = await deleteOllamaModel(model.name);
        if (success) {
            console.log(`Model ${model.name} deleted successfully`);
            listItem.classList.add('disconnected');
            listItem.classList.remove('connected');
            refreshOllamaModelList(select);
            refreshOllamaModal();
        } else {
            console.error(`Failed to delete model ${model.name}`);
        }
    });
    listItem.appendChild(deleteButton);
}

function populateOllamaModal(models) {
    const select = document.getElementById('local-model-select');
    const ollamaModelList = document.getElementById('ollamaModelList');
    if (!ollamaModelList) {
        console.error('ollamaModelList element not found');
        return;
    }

    ollamaModelList.innerHTML = ''; // Clear the existing list

    models.forEach(model => {
        const listItem = createModelListItem(model, select);
        ollamaModelList.appendChild(listItem);
    });
}

function createModelListItem(model, select) {
    const listItem = document.createElement('div');
    listItem.className = `model-item ${model.installed ? 'connected' : 'disconnected'}`;
    listItem.style.position = 'relative';
    listItem.title = model.title; // Set the title attribute for the tooltip

    // Create progress bar element
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    listItem.appendChild(progressBar);

    // Create model name element
    const modelName = document.createElement('div');
    modelName.textContent = model.name;
    modelName.className = 'model-name';
    listItem.appendChild(modelName);

    // Create loading icon element
    const loadingIcon = document.createElement('div');
    loadingIcon.className = 'loader';
    listItem.appendChild(loadingIcon);
    loadingIcon.style.display = 'none'; // Hide the loading icon initially

    // Add styles for the loading icon
    Object.assign(loadingIcon.style, {
        position: 'absolute',
        right: '15px',
        width: '15px',
        height: '15px'
    });

    // Create delete button element if the model is installed
    if (model.installed) {
        addOllamaDeleteButton(model, listItem);
    }

    listItem.addEventListener('click', () => handleOllamaModelClick(model, progressBar, listItem, select, loadingIcon));

    // Restore progress bar if model is being installed
    if (ollamaCurrentInstallNamesMap.has(model.name)) {
        installOllamaModelFromList(model.name, progressBar, listItem, select, loadingIcon);
    }

    return listItem;
}


const ollamaCurrentInstallNamesMap = new Map();

async function handleOllamaModelClick(model, progressBar, listItem, select, loadingIcon) {
    if (!model.installed) {
        if (!ollamaCurrentInstallNamesMap.has(model.name)) {
            ollamaCurrentInstallNamesMap.set(model.name, 0);
            loadingIcon.style.display = 'block'; // Show the loading icon when starting the installation
            installOllamaModelFromList(model.name, progressBar, listItem, select, loadingIcon);
        } else {
            console.log(`Model ${model.name} is already being installed`);
        }
    } else {
        console.log(`Model ${model.name} is already installed`);
    }
}

async function installOllamaModelFromList(modelName, progressBar, listItem, select, loadingIcon) {
    const success = await pullOllamaModelWithProgress(modelName, (progress) => {
        progressBar.style.width = `${progress}%`;
        ollamaCurrentInstallNamesMap.set(modelName, progress);
    });
    if (success) {
        console.log(`Model ${modelName} installed successfully`);
        listItem.classList.remove('disconnected');
        listItem.classList.add('connected');
        progressBar.style.width = '100%';
        addOllamaDeleteButton({ name: modelName, installed: true }, listItem);
        ollamaCurrentInstallNamesMap.delete(modelName);
        loadingIcon.style.display = 'none'; // Hide the loading icon when installation is complete
        refreshOllamaModelList(select);
    } else {
        console.error(`Failed to install model ${modelName}`);
        ollamaCurrentInstallNamesMap.delete(modelName);
        loadingIcon.style.display = 'none'; // Hide the loading icon on installation failure
    }
}




// This is for the case of not using the Ai-Proxy Server. Update by copying the returned library from Ai-Proxy.
const defaultOllamaModels = [
    {
        "name": "llama3\n        \n        \n\n  \n  Meta Llama 3: The most capable openly available LLM to date\n  \n  \n  \n    \n    8B\n    \n    70B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        1.3M\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        67 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      12 days ago"
    },
    {
        "name": "phi3\n        \n        \n\n  \n  Phi-3 Mini is a 3.8B parameters, lightweight, state-of-the-art open model by Microsoft.\n  \n  \n  \n    \n    4B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        205.1K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        6 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      3 weeks ago"
    },
    {
        "name": "wizardlm2\n        \n        \n\n  \n  State of the art large language model from Microsoft AI with improved performance on complex chat, multilingual, reasoning and agent use cases.\n  \n  \n  \n    \n    7B\n    \n    141B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        53K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        22 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 weeks ago"
    },
    {
        "name": "mistral\n        \n        \n\n  \n  The 7B model released by Mistral AI, updated to version 0.2.\n  \n  \n  \n    \n    7B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        781.5K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        68 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      8 weeks ago"
    },
    {
        "name": "gemma\n        \n        \n\n  \n  Gemma is a family of lightweight, state-of-the-art open models built by Google DeepMind. Updated to version 1.1\n  \n  \n  \n    \n    2B\n    \n    7B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        1.5M\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        102 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      5 weeks ago"
    },
    {
        "name": "mixtral\n        \n        \n\n  \n  A set of Mixture of Experts (MoE) model with open weights by Mistral AI in 8x7b and 8x22b parameter sizes.\n  \n  \n  \n    \n    47B\n    \n    141B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        244.2K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        69 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      3 days ago"
    },
    {
        "name": "llama2\n        \n        \n\n  \n  Llama 2 is a collection of foundation language models ranging from 7B to 70B parameters.\n  \n  \n  \n    \n    7B\n    \n    13B\n    \n    70B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        1.6M\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        102 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      3 months ago"
    },
    {
        "name": "codegemma\n        \n        \n\n  \n  CodeGemma is a collection of powerful, lightweight models that can perform a variety of coding tasks like fill-in-the-middle code completion, code generation, natural language understanding, mathematical reasoning, and instruction following.\n  \n  \n  \n    \n    2B\n    \n    7B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        78.6K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        85 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      2 weeks ago"
    },
    {
        "name": "command-r\n        \n        \n\n  \n  Command R is a Large Language Model optimized for conversational interaction and long context tasks.\n  \n  \n  \n    \n    35B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        37.1K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        17 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      7 weeks ago"
    },
    {
        "name": "command-r-plus\n        \n        \n\n  \n  Command R+ is a powerful, scalable large language model purpose-built to excel at real-world enterprise use cases.\n  \n  \n  \n    \n    104B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        29.8K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        6 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 weeks ago"
    },
    {
        "name": "llava\n        \n        \n\n  \n  🌋 LLaVA is a novel end-to-end trained large multimodal model that combines a vision encoder and Vicuna for general-purpose visual and language understanding. Updated to version 1.6.\n  \n  \n  \n    \n    7B\n    \n    13B\n    \n    34B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        225.7K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        98 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      3 months ago"
    },
    {
        "name": "dbrx\n        \n        \n\n  \n  DBRX is an open, general-purpose LLM created by Databricks.\n  \n  \n  \n    \n    132B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        6,559\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        7 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 weeks ago"
    },
    {
        "name": "codellama\n        \n        \n\n  \n  A large language model that can use text prompts to generate and discuss code.\n  \n  \n  \n    \n    7B\n    \n    13B\n    \n    34B\n    \n    69B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        457.4K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        199 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      9 days ago"
    },
    {
        "name": "qwen\n        \n        \n\n  \n  Qwen 1.5 is a series of large language models by Alibaba Cloud spanning from 0.5B to 110B parameters\n  \n  \n  \n    \n    14B\n    \n    32B\n    \n    72B\n    \n    0.5B\n    \n    2B\n    \n    4B\n    \n    8B\n    \n    110B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        366.6K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        379 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      3 weeks ago"
    },
    {
        "name": "dolphin-mixtral\n        \n        \n\n  \n  Uncensored, 8x7b and 8x22b fine-tuned models based on the Mixtral mixture of experts models that excels at coding tasks. Created by Eric Hartford.\n  \n  \n  \n    \n    47B\n    \n    141B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        241.6K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        87 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      2 weeks ago"
    },
    {
        "name": "llama2-uncensored\n        \n        \n\n  \n  Uncensored Llama 2 model by George Sung and Jarrad Hope.\n  \n  \n  \n    \n    7B\n    \n    65B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        191.2K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        34 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 months ago"
    },
    {
        "name": "deepseek-coder\n        \n        \n\n  \n  DeepSeek Coder is a capable coding model trained on two trillion code and natural language tokens.\n  \n  \n  \n    \n    1B\n    \n    7B\n    \n    33B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        142.4K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        102 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 months ago"
    },
    {
        "name": "mistral-openorca\n        \n        \n\n  \n  Mistral OpenOrca is a 7 billion parameter model, fine-tuned on top of the Mistral 7B model using the OpenOrca dataset.\n  \n  \n  \n    \n    7B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        124.4K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        17 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      7 months ago"
    },
    {
        "name": "nomic-embed-text\n        \n        \n\n  \n  A high-performing open embedding model with a large token context window.\n  \n  \n  \n    \n    137M\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        114.6K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        3 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      2 months ago"
    },
    {
        "name": "dolphin-mistral\n        \n        \n\n  \n  The uncensored Dolphin model based on Mistral that excels at coding tasks. Updated to version 2.8.\n  \n  \n  \n    \n    7B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        104.7K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        120 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      7 weeks ago"
    },
    {
        "name": "phi\n        \n        \n\n  \n  Phi-2: a 2.7B language model by Microsoft Research that demonstrates outstanding reasoning and language understanding capabilities.\n  \n  \n  \n    \n    3B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        101.6K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        18 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      3 months ago"
    },
    {
        "name": "orca-mini\n        \n        \n\n  \n  A general-purpose model ranging from 3 billion parameters to 70 billion, suitable for entry-level hardware.\n  \n  \n  \n    \n    3B\n    \n    7B\n    \n    13B\n    \n    65B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        97.8K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        119 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 months ago"
    },
    {
        "name": "nous-hermes2\n        \n        \n\n  \n  The powerful family of models by Nous Research that excels at scientific discussion and coding tasks.\n  \n  \n  \n    \n    11B\n    \n    34B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        80.4K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        33 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 months ago"
    },
    {
        "name": "zephyr\n        \n        \n\n  \n  Zephyr is a series of fine-tuned versions of the Mistral and Mixtral models that are trained to act as helpful assistants.\n  \n  \n  \n    \n    7B\n    \n    141B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        74.9K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        40 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 weeks ago"
    },
    {
        "name": "llama2-chinese\n        \n        \n\n  \n  Llama 2 based model fine tuned to improve Chinese dialogue ability.\n  \n  \n  \n    \n    7B\n    \n    13B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        66.1K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        35 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 months ago"
    },
    {
        "name": "wizard-vicuna-uncensored\n        \n        \n\n  \n  Wizard Vicuna Uncensored is a 7B, 13B, and 30B parameter model based on Llama 2 uncensored by Eric Hartford.\n  \n  \n  \n    \n    7B\n    \n    13B\n    \n    30B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        61.4K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        49 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 months ago"
    },
    {
        "name": "starcoder2\n        \n        \n\n  \n  StarCoder2 is the next generation of transparently trained open code LLMs that comes in three sizes: 3B, 7B and 15B parameters. \n  \n  \n  \n    \n    3B\n    \n    7B\n    \n    16B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        60.9K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        67 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      2 weeks ago"
    },
    {
        "name": "vicuna\n        \n        \n\n  \n  General use chat model based on Llama and Llama 2 with 2K to 16K context sizes.\n  \n  \n  \n    \n    7B\n    \n    13B\n    \n    30B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        59.6K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        111 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 months ago"
    },
    {
        "name": "tinyllama\n        \n        \n\n  \n  The TinyLlama project is an open endeavor to train a compact 1.1B Llama model on 3 trillion tokens.\n  \n  \n  \n    \n    1B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        52.6K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        36 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 months ago"
    },
    {
        "name": "openhermes\n        \n        \n\n  \n  OpenHermes 2.5 is a 7B model fine-tuned by Teknium on Mistral with fully open datasets.\n  \n  \n  \n    \n    7B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        51K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        35 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 months ago"
    },
    {
        "name": "starcoder\n        \n        \n\n  \n  StarCoder is a code generation model trained on 80+ programming languages.\n  \n  \n  \n    \n    1B\n    \n    3B\n    \n    7B\n    \n    15B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        48.3K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        100 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 months ago"
    },
    {
        "name": "yi\n        \n        \n\n  \n  Yi 1.5 is a high-performing, bilingual language model.\n  \n  \n  \n    \n    6B\n    \n    9B\n    \n    34B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        48K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        174 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      7 days ago"
    },
    {
        "name": "openchat\n        \n        \n\n  \n  A family of open-source models trained on a wide variety of data, surpassing ChatGPT on various benchmarks. Updated to version 3.5-0106.\n  \n  \n  \n    \n    7B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        47.8K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        50 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 months ago"
    },
    {
        "name": "dolphin-llama3\n        \n        \n\n  \n  Dolphin 2.9 is a new model with 8B and 70B sizes by Eric Hartford based on Llama 3 that has a variety of instruction, conversational, and coding skills.\n  \n  \n  \n    \n    8B\n    \n    70B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        47.4K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        54 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      9 days ago"
    },
    {
        "name": "tinydolphin\n        \n        \n\n  \n  An experimental 1.1B parameter model trained on the new Dolphin 2.8 dataset by Eric Hartford and based on TinyLlama.\n  \n  \n  \n    \n    1B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        44.2K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        18 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      3 months ago"
    },
    {
        "name": "mxbai-embed-large\n        \n        \n\n  \n  State-of-the-art large embedding model from mixedbread.ai\n  \n  \n  \n    \n    334M\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        42.7K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        4 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      13 days ago"
    },
    {
        "name": "wizardcoder\n        \n        \n\n  \n  State-of-the-art code generation model\n  \n  \n  \n    \n    7B\n    \n    13B\n    \n    33B\n    \n    34B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        42.6K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        67 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 months ago"
    },
    {
        "name": "stable-code\n        \n        \n\n  \n  Stable Code 3B is a coding model with instruct and code completion variants on par with models such as Code Llama 7B that are 2.5x larger.\n  \n  \n  \n    \n    3B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        42.5K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        36 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      7 weeks ago"
    },
    {
        "name": "neural-chat\n        \n        \n\n  \n  A fine-tuned model based on Mistral with good coverage of domain and language.\n  \n  \n  \n    \n    7B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        35.2K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        50 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      7 weeks ago"
    },
    {
        "name": "phind-codellama\n        \n        \n\n  \n  Code generation model based on Code Llama.\n  \n  \n  \n    \n    34B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        31.6K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        49 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 months ago"
    },
    {
        "name": "wizard-math\n        \n        \n\n  \n  Model focused on math and logic problems\n  \n  \n  \n    \n    7B\n    \n    13B\n    \n    65B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        31.6K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        64 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      5 months ago"
    },
    {
        "name": "starling-lm\n        \n        \n\n  \n  Starling is a large language model trained by reinforcement learning from AI feedback focused on improving chatbot helpfulness.\n  \n  \n  \n    \n    7B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        28.2K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        36 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 weeks ago"
    },
    {
        "name": "falcon\n        \n        \n\n  \n  A large language model built by the Technology Innovation Institute (TII) for use in summarization, text generation, and chat bots.\n  \n  \n  \n    \n    7B\n    \n    40B\n    \n    180B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        26.8K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        38 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 months ago"
    },
    {
        "name": "dolphincoder\n        \n        \n\n  \n  A 7B and 15B uncensored variant of the Dolphin model family that excels at coding, based on StarCoder2.\n  \n  \n  \n    \n    7B\n    \n    16B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        26.3K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        35 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      5 weeks ago"
    },
    {
        "name": "nous-hermes\n        \n        \n\n  \n  General use models based on Llama and Llama 2 from Nous Research.\n  \n  \n  \n    \n    7B\n    \n    13B\n    \n    65B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        25.9K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        63 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 months ago"
    },
    {
        "name": "orca2\n        \n        \n\n  \n  Orca 2 is built by Microsoft research, and are a fine-tuned version of Meta's Llama 2 models.  The model is designed to excel particularly in reasoning.\n  \n  \n  \n    \n    7B\n    \n    13B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        25.4K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        33 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      5 months ago"
    },
    {
        "name": "stablelm2\n        \n        \n\n  \n  Stable LM 2 is a state-of-the-art 1.6B and 12B parameter language model trained on multilingual data in English, Spanish, German, Italian, French, Portuguese, and Dutch.\n  \n  \n  \n    \n    2B\n    \n    12B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        24.4K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        84 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      13 days ago"
    },
    {
        "name": "sqlcoder\n        \n        \n\n  \n  SQLCoder is a code completion model fined-tuned on StarCoder for SQL generation tasks\n  \n  \n  \n    \n    7B\n    \n    15B\n    \n    69B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        24.2K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        48 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      3 months ago"
    },
    {
        "name": "dolphin-phi\n        \n        \n\n  \n  2.7B uncensored Dolphin model by Eric Hartford, based on the Phi language model by Microsoft Research.\n  \n  \n  \n    \n    3B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        23.4K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        15 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 months ago"
    },
    {
        "name": "solar\n        \n        \n\n  \n  A compact, yet powerful 10.7B large language model designed for single-turn conversation.\n  \n  \n  \n    \n    11B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        21.6K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        32 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      5 months ago"
    },
    {
        "name": "yarn-llama2\n        \n        \n\n  \n  An extension of Llama 2 that supports a context of up to 128k tokens.\n  \n  \n  \n    \n    7B\n    \n    13B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        20.6K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        67 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 months ago"
    },
    {
        "name": "deepseek-llm\n        \n        \n\n  \n  An advanced language model crafted with 2 trillion bilingual tokens.\n  \n  \n  \n    \n    7B\n    \n    67B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        20.4K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        64 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      5 months ago"
    },
    {
        "name": "codeqwen\n        \n        \n\n  \n  CodeQwen1.5 is a large language model pretrained on a large amount of code data.\n  \n  \n  \n    \n    7B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        19.9K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        21 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 weeks ago"
    },
    {
        "name": "bakllava\n        \n        \n\n  \n  BakLLaVA is a multimodal model consisting of the Mistral 7B base model augmented with the LLaVA  architecture.\n  \n  \n  \n    \n    7B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        19K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        17 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      5 months ago"
    },
    {
        "name": "llama3-gradient\n        \n        \n\n  \n  This model extends LLama-3 8B's context length from 8k to over 1m tokens.\n  \n  \n  \n    \n    8B\n    \n    70B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        18.7K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        35 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      2 weeks ago"
    },
    {
        "name": "all-minilm\n        \n        \n\n  \n  Embedding models on very large sentence level datasets.\n  \n  \n  \n    \n    23M\n    \n    33M\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        18.7K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        10 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      13 days ago"
    },
    {
        "name": "samantha-mistral\n        \n        \n\n  \n  A companion assistant trained in philosophy, psychology, and personal relationships. Based on Mistral.\n  \n  \n  \n    \n    7B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        18.5K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        49 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      7 months ago"
    },
    {
        "name": "medllama2\n        \n        \n\n  \n  Fine-tuned Llama 2 model to answer medical questions based on an open source medical dataset. \n  \n  \n  \n    \n    7B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        18K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        17 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 months ago"
    },
    {
        "name": "xwinlm\n        \n        \n\n  \n  Conversational model based on Llama 2 that performs competitively on various benchmarks.\n  \n  \n  \n    \n    7B\n    \n    13B\n    \n    65B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        17.6K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        80 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 months ago"
    },
    {
        "name": "wizardlm-uncensored\n        \n        \n\n  \n  Uncensored version of Wizard LM model \n  \n  \n  \n    \n    13B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        17.4K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        18 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 months ago"
    },
    {
        "name": "nous-hermes2-mixtral\n        \n        \n\n  \n  The Nous Hermes 2 model from Nous Research, now trained over Mixtral.\n  \n  \n  \n    \n    47B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        17.1K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        18 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 months ago"
    },
    {
        "name": "stable-beluga\n        \n        \n\n  \n  Llama 2 based model fine tuned on an Orca-style dataset. Originally called Free Willy.\n  \n  \n  \n    \n    7B\n    \n    13B\n    \n    65B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        17.1K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        49 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 months ago"
    },
    {
        "name": "wizardlm\n        \n        \n\n  \n  General use model based on Llama 2.\n  \n  \n  \n    \n    7B\n    \n    13B\n    \n    30B\n    \n    65B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        16.2K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        73 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      5 weeks ago"
    },
    {
        "name": "codeup\n        \n        \n\n  \n  Great code generation model based on Llama2.\n  \n  \n  \n    \n    13B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        15.6K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        19 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 months ago"
    },
    {
        "name": "yarn-mistral\n        \n        \n\n  \n  An extension of Mistral to support context windows of 64K or 128K.\n  \n  \n  \n    \n    7B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        15.1K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        33 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 months ago"
    },
    {
        "name": "everythinglm\n        \n        \n\n  \n  Uncensored Llama2 based model with support for a 16K context window.\n  \n  \n  \n    \n    13B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        14.6K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        18 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 months ago"
    },
    {
        "name": "meditron\n        \n        \n\n  \n  Open-source medical large language model adapted from Llama 2 to the medical domain.\n  \n  \n  \n    \n    7B\n    \n    69B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        13.9K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        22 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      5 months ago"
    },
    {
        "name": "llama-pro\n        \n        \n\n  \n  An expansion of Llama 2 that specializes in integrating both general language understanding and domain-specific knowledge, particularly in programming and mathematics.\n  \n  \n  \n    \n    8B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        13.8K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        33 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 months ago"
    },
    {
        "name": "magicoder\n        \n        \n\n  \n  🎩 Magicoder is a family of 7B parameter models trained on 75K synthetic instruction data using OSS-Instruct, a novel approach to enlightening LLMs with open-source code snippets.\n  \n  \n  \n    \n    7B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        11.6K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        18 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      5 months ago"
    },
    {
        "name": "stablelm-zephyr\n        \n        \n\n  \n  A lightweight chat model allowing accurate, and responsive output without requiring high-end hardware.\n  \n  \n  \n    \n    3B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        11.5K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        17 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 months ago"
    },
    {
        "name": "nexusraven\n        \n        \n\n  \n  Nexus Raven is a 13B instruction tuned model for function calling tasks. \n  \n  \n  \n    \n    13B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        11.5K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        32 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 months ago"
    },
    {
        "name": "codebooga\n        \n        \n\n  \n  A high-performing code instruct model created by merging two existing code models.\n  \n  \n  \n    \n    34B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        10.9K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        16 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 months ago"
    },
    {
        "name": "llama3-chatqa\n        \n        \n\n  \n  A model from NVIDIA based on Llama 3 that excels at conversational question answering (QA) and retrieval-augmented generation (RAG).\n  \n  \n  \n    \n    8B\n    \n    70B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        10.9K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        35 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      9 days ago"
    },
    {
        "name": "mistrallite\n        \n        \n\n  \n  MistralLite is a fine-tuned model based on Mistral with enhanced capabilities of processing long contexts.\n  \n  \n  \n    \n    7B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        10.3K\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        17 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 months ago"
    },
    {
        "name": "wizard-vicuna\n        \n        \n\n  \n  Wizard Vicuna is a 13B parameter model based on Llama 2 trained by MelodysDreamj.\n  \n  \n  \n    \n    13B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        9,700\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        17 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 months ago"
    },
    {
        "name": "llava-llama3\n        \n        \n\n  \n  A LLaVA model fine-tuned from Llama 3 Instruct with better scores in several benchmarks.\n  \n  \n  \n    \n    8B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        8,532\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        4 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      12 days ago"
    },
    {
        "name": "snowflake-arctic-embed\n        \n        \n\n  \n  A suite of text embedding models by Snowflake, optimized for performance.\n  \n  \n  \n    \n    23M\n    \n    33M\n    \n    109M\n    \n    137M\n    \n    334M\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        8,231\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        16 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 weeks ago"
    },
    {
        "name": "goliath\n        \n        \n\n  \n  A language model created by combining two fine-tuned Llama 2 70B models into one.\n  \n  \n  \n    \n    118B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        7,792\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        16 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 months ago"
    },
    {
        "name": "moondream\n        \n        \n\n  \n  moondream2 is a small vision language model designed to run efficiently on edge devices.\n  \n  \n  \n    \n    1B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        7,752\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        18 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      7 days ago"
    },
    {
        "name": "open-orca-platypus2\n        \n        \n\n  \n  Merge of the Open Orca OpenChat model and the Garage-bAInd Platypus 2 model. Designed for chat and code generation.\n  \n  \n  \n    \n    13B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        7,717\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        17 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 months ago"
    },
    {
        "name": "duckdb-nsql\n        \n        \n\n  \n  7B parameter text-to-SQL model made by MotherDuck and Numbers Station.\n  \n  \n  \n    \n    7B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        7,464\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        17 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      3 months ago"
    },
    {
        "name": "notux\n        \n        \n\n  \n  A top-performing mixture of experts model, fine-tuned with high-quality data.\n  \n  \n  \n    \n    47B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        7,311\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        18 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 months ago"
    },
    {
        "name": "megadolphin\n        \n        \n\n  \n  MegaDolphin-2.2-120b is a transformation of Dolphin-2.2-70b created by interleaving the model with itself.\n  \n  \n  \n    \n    120B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        7,251\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        19 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 months ago"
    },
    {
        "name": "notus\n        \n        \n\n  \n  A 7B chat model fine-tuned with high-quality data and based on Zephyr.\n  \n  \n  \n    \n    7B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        6,555\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        18 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      4 months ago"
    },
    {
        "name": "alfred\n        \n        \n\n  \n  A robust conversational model designed to be used for both chat and instruct use cases.\n  \n  \n  \n    \n    42B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        5,282\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        7 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 months ago"
    },
    {
        "name": "llava-phi3\n        \n        \n\n  \n  A new small LLaVA model fine-tuned from Phi 3 Mini.\n  \n  \n  \n    \n    4B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        4,781\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        4 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      12 days ago"
    },
    {
        "name": "falcon2\n        \n        \n\n  \n  Falcon2 is an 11B parameters causal decoder-only model built by TII and trained over 5T tokens.\n  \n  \n  \n    \n    11B\n    \n  \n  \n  \n    \n      \n        \n          \n        \n        3,378\n        \n           Pulls\n        \n      \n    \n    \n      \n        \n          \n          \n        \n        17 Tags\n      \n    \n    \n      \n        \n      \n      Updated \n      6 days ago"
    }
];