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
        }
    ],
    "model_lib_map": {
        "vicuna-v1-7b-q4f32_0": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/vicuna-v1-7b-q4f32_0-webgpu-v1.wasm",
        "RedPajama-INCITE-Chat-3B-v1-q4f32_0": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/RedPajama-INCITE-Chat-3B-v1-q4f32_0-webgpu-v1.wasm",
        "RedPajama-INCITE-Chat-3B-v1-q4f16_0": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/RedPajama-INCITE-Chat-3B-v1-q4f16_0-webgpu-v1.wasm"
    }
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

        if (!userHasScrolledUp) {
            noteInput.setCursor(noteInput.lineCount());
        }
    };

    let context = "";
    conversationHistory.forEach((turn) => {
        context += "Prompt: " + turn.prompt + "\nAI: " + turn.response + "\n";
    });

    const prompt = context + "Prompt: " + (promptInput as HTMLInputElement).value;
    console.log(prompt);
    const userPrompt = (noteInput.getValue() ? '\n' : '') + "Prompt: " + (promptInput as HTMLInputElement).value + "\n";

    noteInput.replaceRange(userPrompt, CodeMirror.Pos(noteInput.lastLine()));

    if (!llmInitialized || chat.currentModel !== selectedModel) {
        await initializeLLM(selectedModel);
    }
    const reply = await chat.generate(prompt, generateProgressCallback);
    // Remove the last intermediate message
    const finalContent = noteInput.getValue().substring(0, noteInput.getValue().length - lastMessageLength);
    // Append the final response
    const finalMessage = "\nnode: LLM" + responseCount.toString() + "\n" + reply + "\nref:\n";
    noteInput.setValue(finalContent + finalMessage);
    // Refresh the content of CodeMirror
    noteInput.refresh();
    // Increment the response count after the final response
    responseCount++;

    // Save this conversation turn to history
    conversationHistory.push({ prompt: (promptInput as HTMLInputElement).value, response: reply });
    // Limit conversation history to maxConversationHistory
    if (conversationHistory.length > maxConversationHistory) {
        conversationHistory.shift();
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
    const localLLMCheckbox = document.getElementById("localLLM");

    // If the LLM checkbox is not checked, don't use local LLM.
    if (!(localLLMCheckbox as HTMLInputElement).checked) {
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

    // Filter out the first message and the second-to-last message
    const filteredMessages = messages.filter((message, index) => {
        return !(index === 0 || index === messages.length - 2);
    });

    let messageString = "";

    // Process filteredMessages to build messageString
    filteredMessages.forEach((message, index) => {
        if (index === 0) {
            messageString += message.content.replace("Node Creation Time: undefined", "end of connected nodes.");
        } else if (message.role === "user") {
            // This is the current prompt
            messageString += `Prompt: ${message.content}`;
        } else {
            messageString += message.content;
        }
    });

    messageQueue.push({
        node,
        messageString,
        selectedModel
    });

    // If not currently processing a message, start processing the queue
    if (!isProcessing) {
        processQueue();
    }
}
async function processQueue() {
    if (messageQueue.length === 0) {
        return;
    }

    isProcessing = true;

    // Get the first message in the queue
    const { node, messageString, selectedModel } = messageQueue.shift();

    let lastMessageLength = 0;

    // Access the aiResponseTextArea of the node
    const aiResponseTextArea = document.getElementById(node.id);

    let userHasScrolled = false;

    // Check if the user has scrolled
    aiResponseTextArea.addEventListener('scroll', () => {
        if (aiResponseTextArea.scrollTop + aiResponseTextArea.clientHeight < aiResponseTextArea.scrollHeight) {
            userHasScrolled = true;
        }
    });

    const generateProgressCallback = (_step, message) => {
        // Remove the last intermediate message
        (aiResponseTextArea as HTMLTextAreaElement).value = (aiResponseTextArea as HTMLTextAreaElement).value.substring(0, (aiResponseTextArea as HTMLTextAreaElement).value.length - lastMessageLength);
        // Append the latest intermediate message
        const formattedMessage = "\nAI: " + message;
        (aiResponseTextArea as HTMLTextAreaElement).value += formattedMessage;
        // Store the length of the current message to be able to remove it next time
        lastMessageLength = formattedMessage.length;
        // Dispatch input event
        aiResponseTextArea.dispatchEvent(new Event('input'));
        // Auto scroll to bottom only if the user hasn't scrolled up
        if (!userHasScrolled) {
            aiResponseTextArea.scrollTop = aiResponseTextArea.scrollHeight;
        }
    };

    console.log("Messages sent to LLM:", messageString); // Logging the processed message string

    if (!llmInitialized || chat.currentModel !== selectedModel) {
        await initializeLLM(selectedModel);
    }
    const reply = await chat.generate(messageString, generateProgressCallback);
    // Remove the last intermediate message
    (aiResponseTextArea as HTMLTextAreaElement).value = (aiResponseTextArea as HTMLTextAreaElement).value.substring(0, (aiResponseTextArea as HTMLTextAreaElement).value.length - lastMessageLength);
    // Append the final response
    const finalMessage = "\nAI: " + reply;
    (aiResponseTextArea as HTMLTextAreaElement).value += finalMessage;
    // Dispatch input event
    aiResponseTextArea.dispatchEvent(new Event('input'));
    // Auto scroll to bottom for the final message only if the user hasn't scrolled up
    if (!userHasScrolled) {
        aiResponseTextArea.scrollTop = aiResponseTextArea.scrollHeight;
    }

    isProcessing = false;

    // If there are more messages in the queue, process the next one
    if (messageQueue.length > 0) {
        processQueue();
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