//webLLM.ts
import * as webllm from "@mlc-ai/web-llm";

let chat;
let llmInitialized = false;
let responseCount = 1; // Start from 1
let conversationHistory = []; // Stores the history of conversation turns
const maxConversationHistory = 3; // Specify the maximum number of conversation turns you want to keep as context
const noteInput = myCodeMirror; // Use CodeMirror instance
let userHasScrolledUp = false;

// Event Listener for user scroll
noteInput.on('scroll', () => {
    const scrollInfo = myCodeMirror.getScrollInfo();
    userHasScrolledUp = scrollInfo.height - scrollInfo.top !== scrollInfo.clientHeight;
});


const appConfig = {
    model_list: [
        {
            model_url: "https://huggingface.co/mlc-ai/mlc-chat-vicuna-v1-7b-q4f32_0/resolve/main/",
            local_id: "vicuna-v1-7b-q4f32_0"
        },
        {
            model_url: "https://huggingface.co/mlc-ai/mlc-chat-RedPajama-INCITE-Chat-3B-v1-q4f32_0/resolve/main/",
            local_id: "RedPajama-INCITE-Chat-3B-v1-q4f32_0"
        }
    ],
    model_lib_map: {
        "vicuna-v1-7b-q4f32_0": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/vicuna-v1-7b-q4f32_0-webgpu.wasm",
        "RedPajama-INCITE-Chat-3B-v1-q4f32_0": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/RedPajama-INCITE-Chat-3B-v1-q4f32_0-webgpu.wasm"
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

document.getElementById('LocalLLMselect').addEventListener('change', async (event) => {
    const selectedModel = event.target.value;
    llmInitialized = false; // Mark chat as uninitialized
    await initializeLLM(selectedModel);
});

document.getElementById('prompt-form').addEventListener('submit', async (event) => {
    const localLLMCheckbox = document.getElementById("localLLM");

    // If the LLM checkbox is not checked, don't submit the form.
    if (!localLLMCheckbox.checked) {
        event.preventDefault();
        return;
    }

    event.preventDefault(); // Prevent the form from being submitted

    const promptInput = document.getElementById("prompt");
    const LocalLLMselect = document.getElementById("LocalLLMselect");
    let lastMessageLength = 0;
    const selectedModel = LocalLLMselect.value;

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

    const prompt = context + "...End of previous conversation\n\nYou are an AI.\nCurrent Prompt: " + promptInput.value;
    console.log(prompt);
    const userPrompt = (noteInput.getValue() ? '\n' : '') + "Prompt: " + promptInput.value + "\n";
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
    conversationHistory.push({ prompt: promptInput.value, response: reply });
    // Limit conversation history to maxConversationHistory
    if (conversationHistory.length > maxConversationHistory) {
        conversationHistory.shift();
    }

    promptInput.value = ''; // Clear the prompt input
});

declare global {
    interface Window {
        generateLocalLLMResponse: any;
    }
}

let messageQueue = [];
let isProcessing = false;

window.generateLocalLLMResponse = async function (node, messages) {
    const localLLMCheckbox = document.getElementById("localLLM");

    // If the LLM checkbox is not checked, don't use local LLM.
    if (!localLLMCheckbox.checked) {
        return;
    }

    // Get the selected model
    const llmNodeIndex = node.index;
    const LocalLLMselect = document.getElementById(`dynamicLocalLLMselect-${llmNodeIndex}`);
    const selectedModel = LocalLLMselect.value;

    // If the selected model is 'openai', return immediately
    if (selectedModel === 'OpenAi') {
        return;
    }

    let messageString = "";

    // Process messages to build messageString
    messages.forEach((message, index) => {
        // Skip the first message
        if (index === 0) return;

        // Append connected node information
        if (index === 1) {
            messageString += message.content.replace("Node Creation Time: undefined", "end of connected nodes.");
        } else if (message.role === "user") {
            // This is the current prompt
            messageString += " \nYou are an ai.\nAnswer this Prompt: " + message.content;
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
        aiResponseTextArea.value = aiResponseTextArea.value.substring(0, aiResponseTextArea.value.length - lastMessageLength);
        // Append the latest intermediate message
        const formattedMessage = "\nAI: " + message;
        aiResponseTextArea.value += formattedMessage;
        // Store the length of the current message to be able to remove it next time
        lastMessageLength = formattedMessage.length;
        // Dispatch input event
        aiResponseTextArea.dispatchEvent(new Event('input'));
        // Auto scroll to bottom only if the user hasn't scrolled up
        if (!userHasScrolled) {
            aiResponseTextArea.scrollTop = aiResponseTextArea.scrollHeight;
        }
    };

    console.log("Messages sent to LLM: ", messageString); // Logging the processed message string

    if (!llmInitialized || chat.currentModel !== selectedModel) {
        await initializeLLM(selectedModel);
    }
    const reply = await chat.generate(messageString, generateProgressCallback);
    // Remove the last intermediate message
    aiResponseTextArea.value = aiResponseTextArea.value.substring(0, aiResponseTextArea.value.length - lastMessageLength);
    // Append the final response
    const finalMessage = "\nAI: " + reply;
    aiResponseTextArea.value += finalMessage;
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