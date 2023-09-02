//webLLM.ts
declare var myCodeMirror: any;
declare var CodeMirror: any;

import * as webllm from "@mlc-ai/web-llm";

let chat;
let llmInitialized = false;
let responseCount = 1; // Start from 1
let conversationHistory = []; // Stores the history of conversation turns
const maxConversationHistory = 0; // Specify the maximum number of conversation turns you want to keep as context
const noteInput = myCodeMirror; // Use CodeMirror instance
let userHasScrolledUp = false;

// Event Listener for user scroll
noteInput.on('scroll', () => {
    const scrollInfo = myCodeMirror.getScrollInfo();
    userHasScrolledUp = scrollInfo.height - scrollInfo.top !== scrollInfo.clientHeight;
});


const appConfig = {
    "model_list": [
        {
            "model_url": "https://huggingface.co/mlc-ai/mlc-chat-RedPajama-INCITE-Chat-3B-v1-q4f32_0/resolve/main/",
            "local_id": "RedPajama-INCITE-Chat-3B-v1-q4f32_0"
        },
        {
            "model_url": "https://huggingface.co/mlc-ai/mlc-chat-vicuna-v1-7b-q4f32_0/resolve/main/",
            "local_id": "vicuna-v1-7b-q4f32_0"
        },
        {
            "model_url": "https://huggingface.co/mlc-ai/mlc-chat-RedPajama-INCITE-Chat-3B-v1-q4f16_0/resolve/main/",
            "local_id": "RedPajama-INCITE-Chat-3B-v1-q4f16_0",
            "required_features": ["shader-f16"],
        },
        {
            "model_url": "https://huggingface.co/mlc-ai/mlc-chat-Llama-2-7b-chat-hf-q4f32_1/resolve/main/",
            "local_id": "Llama-2-7b-chat-hf-q4f32_1"
        },
        {
            "model_url": "https://huggingface.co/mlc-ai/mlc-chat-Llama-2-13b-chat-hf-q4f32_1/resolve/main/",
            "local_id": "Llama-2-13b-chat-hf-q4f32_1"
        },
        {
            "model_url": "https://huggingface.co/mlc-ai/mlc-chat-Llama-2-70b-chat-hf-q4f16_1/resolve/main/",
            "local_id": "Llama-2-70b-chat-hf-q4f16_1",
            "required_features": ["shader-f16"],
        },
        {
            "model_url": "https://huggingface.co/mlc-ai/mlc-chat-WizardCoder-15B-V1.0-q4f32_1/resolve/main",
            "local_id": "WizardCoder-15B-V1.0-q4f32_1",
        }
    ],
    "model_lib_map": {
        "vicuna-v1-7b-q4f32_0": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/vicuna-v1-7b-q4f32_0-webgpu-v1.wasm",
        "RedPajama-INCITE-Chat-3B-v1-q4f32_0": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/RedPajama-INCITE-Chat-3B-v1-q4f32_0-webgpu-v1.wasm",
        "RedPajama-INCITE-Chat-3B-v1-q4f16_0": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/RedPajama-INCITE-Chat-3B-v1-q4f16_0-webgpu-v1.wasm",
        "Llama-2-7b-chat-hf-q4f32_1": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-2-7b-chat-hf-q4f32_1-webgpu.wasm",
        "Llama-2-13b-chat-hf-q4f32_1": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-2-13b-chat-hf-q4f32_1-webgpu.wasm",
        "Llama-2-70b-chat-hf-q4f16_1": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-2-70b-chat-hf-q4f16_1-webgpu.wasm",
        "WizardCoder-15B-V1.0-q4f32_1": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/WizardCoder-15B-V1.0-q4f32_1-webgpu.wasm"
    },
    "use_web_worker": true
}


async function initializeLLM(model) {
    chat = new webllm.ChatWorkerClient(new Worker(
        new URL('./worker.ts', import.meta.url),
        { type: 'module' }
    ));

    let lastReportLength = 0; // Store the length of the last report

    chat.setInitProgressCallback((report: webllm.InitProgressReport) => {
        // Get the current content from CodeMirror
        let currentContent = noteInput.getValue();
        // Remove the last report
        currentContent = currentContent.substring(0, currentContent.length - lastReportLength);
        // Append the new report
        currentContent += report.text + "\n";
        // Set the updated content back into CodeMirror
        noteInput.setValue(currentContent);
        // Store the length of the new report
        lastReportLength = report.text.length + 1; // +1 for the newline
    });

    // Pass the appConfig to the reload function
    await chat.reload(model, undefined, appConfig);
    chat.currentModel = model;
    llmInitialized = true;
}

document.getElementById('downloadAiButton').addEventListener('click', async () => {
    const loadingIcon = document.getElementById('loadingIcon');
    const aiLoadingIcon = document.getElementById('aiLoadingIcon');
    const errorIcon = document.getElementById('errorIcon');
    const aiErrorIcon = document.getElementById('aiErrorIcon');
    const selectedModel = (document.getElementById('LocalLLMselect') as HTMLInputElement).value;

    llmInitialized = false; // Mark chat as uninitialized

    // Show loading icons
    loadingIcon.style.display = 'block';
    if (aiLoadingIcon) aiLoadingIcon.style.display = 'block';
    //Hide error
    errorIcon.style.display = 'none';
    if (aiErrorIcon) aiErrorIcon.style.display = 'none';

    // Enable the local LLM checkbox
    const localLLMCheckbox = document.getElementById('localLLM') as HTMLInputElement;
    localLLMCheckbox.checked = true;

    // Manually trigger the change event
    localLLMCheckbox.dispatchEvent(new Event('change'));

    try {
        // Initialize AI
        await initializeLLM(selectedModel);

        // If successful, hide error icons (in case they were previously shown)
        errorIcon.style.display = 'none';
        if (aiErrorIcon) aiErrorIcon.style.display = 'none';
    } catch (error) {
        // Show error icons in case of an error
        errorIcon.style.display = 'block';
        if (aiErrorIcon) aiErrorIcon.style.display = 'block';

        // Optionally, log the error to the console for debugging
        console.error('Error initializing AI:', error);
    } finally {
        // Hide loading icons regardless of success or failure
        loadingIcon.style.display = 'none';
        if (aiLoadingIcon) aiLoadingIcon.style.display = 'none';
    }
});

let serverAvailable: boolean | null = null;

const checkServerAvailability = async () => {
    try {
        const response = await fetch('http://127.0.0.1:8085/ping');
        serverAvailable = response.ok;
    } catch (error) {
        serverAvailable = false;
    }
};

const getServerResponse = async (message: string): Promise<string | null> => {
    if (serverAvailable === false) {
        return null;
    }

    try {
        const response = await fetch('http://127.0.0.1:8085/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: message }),
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data.response;
    } catch (error) {
        if (error.message !== "Failed to fetch") {
            console.error('Error communicating with the server:', error);
        }
        return null;
    }
};

// Call this function on page refresh to determine if the server is available
checkServerAvailability();

document.getElementById('prompt-form').addEventListener('submit', async (event) => {
    const localLLMCheckbox = document.getElementById("localLLM");

    // If the LLM checkbox is not checked, don't submit the form.
    if (!(localLLMCheckbox as HTMLInputElement).checked) {
        event.preventDefault();
        return;
    }

    event.preventDefault(); // Prevent the form from being submitted

    const promptInput = document.getElementById("prompt");
    const LocalLLMselect = document.getElementById("LocalLLMselect");
    let lastMessageLength = 0;
    const selectedModel = (LocalLLMselect as HTMLSelectElement).value;

    const generateProgressCallback = (_step, message) => {
        // Remove the last intermediate message
        const currentContent = noteInput.getValue().substring(0, noteInput.getValue().length - lastMessageLength);
        // Append the latest intermediate message
        const formattedMessage = "\nnode: LLM" + responseCount.toString() + "\n" + message + "\nref:";
        noteInput.setValue(currentContent + formattedMessage);
        // Store the length of the current message to be able to remove it next time
        lastMessageLength = formattedMessage.length;
        // Refresh the content of CodeMirror
        noteInput.refresh();

        //this does not currently work
        const isScrolledToBottom = noteInput.scrollHeight - noteInput.clientHeight <= noteInput.scrollTop + 1;
        if (isScrolledToBottom && !userHasScrolledUp) {
            noteInput.scrollTop = noteInput.scrollHeight;
            myCodeMirror.scrollTo(null, myCodeMirror.getScrollInfo().height);
        }
    };

    const prompt = (promptInput as HTMLInputElement).value;
    console.log(prompt);
    const userPrompt = (noteInput.getValue() ? '\n' : '') + "Prompt: " + (promptInput as HTMLInputElement).value + "\n";

    noteInput.replaceRange(userPrompt, CodeMirror.Pos(noteInput.lastLine()));

    if (!llmInitialized || chat.currentModel !== selectedModel) {
        await initializeLLM(selectedModel);
    }

    // Try getting a response from the server
    const serverResponse = await getServerResponse((promptInput as HTMLInputElement).value);

    if (serverResponse) {
        const serverMessage = "\nnode: LLM" + responseCount.toString() + "\n" + serverResponse + "\nref:\n";
        noteInput.setValue(noteInput.getValue() + serverMessage);
        responseCount++;
        conversationHistory.push({ prompt: (promptInput as HTMLInputElement).value, response: serverResponse });
    } else {
        if (!llmInitialized || chat.currentModel !== selectedModel) {
            await initializeLLM(selectedModel);
        }
        const reply = await chat.generate(prompt, generateProgressCallback);
        const finalContent = noteInput.getValue().substring(0, noteInput.getValue().length - lastMessageLength);
        const finalMessage = "\nnode: LLM" + responseCount.toString() + "\n" + reply + "\nref:\n";
        noteInput.setValue(finalContent + finalMessage);
        responseCount++;
        conversationHistory.push({ prompt: (promptInput as HTMLInputElement).value, response: reply });
    }

    (promptInput as HTMLInputElement).value = ''; // Clear the prompt input
});



declare global {
    interface Window {
        generateLocalLLMResponse: any;
        callWebLLMGeneric: (messages: any[]) => Promise<string>;
    }
}

let messageQueue = [];
let isProcessing = false;

window.generateLocalLLMResponse = async function (node, messages) {
    node.localAiResponding = true; // Set the flag right here

    const localLLMCheckbox = document.getElementById("localLLM");
    if (!(localLLMCheckbox as HTMLInputElement).checked) {
        node.localAiResponding = false; // Reset if needed
        return;
    }

    // Get the selected model
    const llmNodeIndex = node.index;
    const LocalLLMselect = document.getElementById(`dynamicLocalLLMselect-${llmNodeIndex}`);
    const selectedModel = (LocalLLMselect as HTMLSelectElement).value;

    // If the selected model is 'openai', return immediately
    if (selectedModel === 'OpenAi') {
        return;
    }

    // Only take the last message in the messages array
    const lastMessage = messages[messages.length - 1].content;

    // Adds a deferred object to resolve the promise later
    let deferred: any = { resolve: null };
    deferred.promise = new Promise<string>(resolve => {
        deferred.resolve = resolve;
    });

    // Push it into the queue
    messageQueue.push({
        node,
        messageString: lastMessage,
        selectedModel,
        deferred
    });

    if (!isProcessing) {
        processQueue();
    }

    return deferred.promise;
}
async function processQueue() {
    if (messageQueue.length === 0) {
        return;
    }

    isProcessing = true;

    const { node, messageString, selectedModel, deferred } = messageQueue.shift();
    let lastMessageLength = 0;
    const aiResponseTextArea = document.getElementById(node.id);

    const generateProgressCallback = (_step, message) => {
        (aiResponseTextArea as HTMLTextAreaElement).value = (aiResponseTextArea as HTMLTextAreaElement).value.substring(0, (aiResponseTextArea as HTMLTextAreaElement).value.length - lastMessageLength);
        const formattedMessage = message;
        (aiResponseTextArea as HTMLTextAreaElement).value += formattedMessage;
        lastMessageLength = formattedMessage.length;
        aiResponseTextArea.dispatchEvent(new Event('input'));
    };

    console.log("Messages sent to LLM:", messageString);

    const updateTextAreaWithMessage = (textArea: HTMLTextAreaElement, message: string) => {
        textArea.value = textArea.value.substring(0, textArea.value.length - lastMessageLength) + message;
        textArea.dispatchEvent(new Event('input'));
        setTimeout(() => {
            textArea.dispatchEvent(new Event('input'));
        }, 30);
    }

    const serverReply = await getServerResponse(messageString);

    if (serverReply) {
        updateTextAreaWithMessage(aiResponseTextArea as HTMLTextAreaElement, serverReply);
        node.localAiResponding = false;
    } else {
        if (!llmInitialized || chat.currentModel !== selectedModel) {
            await initializeLLM(selectedModel);
        }
        const reply = await chat.generate(messageString, generateProgressCallback);
        updateTextAreaWithMessage(aiResponseTextArea as HTMLTextAreaElement, reply);
        node.localAiResponding = false;

        // Resolve the promise with the reply message
        deferred.resolve(reply); 
    }

    isProcessing = false;

    if (messageQueue.length > 0) {
        processQueue();
    } else {
        deferred.resolve();  // Resolve the promise when queue is empty
    }
}
//window.callWebLLMGeneric = async function (messages) {
    // Get the selected model
    //const LocalLLMselect = document.getElementById('LocalLLMselect');
    //const selectedModel = (LocalLLMselect as HTMLSelectElement).value;

    // Check if the current model is not the selected one or if LLM is not initialized yet
    //if (!llmInitialized || chat.currentModel !== selectedModel) {
        // Initialize the LLM with the selected model
        //await initializeLLM(selectedModel);
    //}

    // Convert the messages array to a string
    //const prompt = messages.join(" ");

    // A progress callback that does nothing
    //const generateProgressCallback = (_step, _message) => { };

    // Generate a response using the webLLM
    //const reply = await chat.generate(prompt, generateProgressCallback);

    // Return the AI's response
    //console.log(reply);
    //return reply;
//};