const Providers = {
    anthropic: {domSelectId: 'anthropic-select', inputId: 'anthropic-api-key-input', nodeSelectId: 'anthropicSelect', storageId: 'anthropicApiKey'},
    googleApi: {inputId: 'googleApiKey'},
    googleSearchEngine: {inputId: 'googleSearchEngineId'},
    GROQ: {domSelectId: 'groq-select', inputId: 'GROQ-api-key-input', nodeSelectId: 'groqSelect', storageId: 'GROQApiKey'},
    ollama: {domSelectId: 'local-model-select', nodeSelectId: 'localModelSelect'},
    OpenAi: {domSelectId: 'open-ai-select', inputId: 'api-key-input', nodeSelectId: 'openAiSelect', storageId: 'openaiApiKey'},
    wolframApi: {inputId: 'wolframApiKey'},
    custom: { domSelectId: 'custom-model-select', nodeSelectId: 'customModelSelect' },
    neurite: { domSelectId: 'neurite-model-select', nodeSelectId: 'neuriteModelSelect' }
}

Ai.determineModel = function(node){
    const providerId = (node? node.inferenceSelect : Elem.byId('inference-select')).value;
    const provider = Providers[providerId];
    const select = (node ? node[provider.nodeSelectId] : Elem.byId(provider.domSelectId));
    const model = (providerId === 'custom' ? select.options[select.selectedIndex].text : select.value);
    return { providerId, model };
}

// Function to check if Embed (Data) is enabled
async function isEmbedEnabled(aiNode) {
    let checkbox = null;
    if (aiNode) {
        checkbox = aiNode.content.querySelector('#embed-checkbox-' + aiNode.index);
        if (!checkbox) Logger.info("Data checkbox not found in the AI node");
    } else {
        checkbox = Elem.byId('embed-checkbox');
    }
    if (!checkbox?.checked) return;

    const allKeys = await Keys.getAll();
    const visibleKeys = Keys.getVisible(allKeys);
    if (visibleKeys.length > 0) {
        return visibleKeys;
    } else {
        return false;
    }
}



const TOKEN_COST_PER_IMAGE = 200; // Flat token cost assumption for each image

class TokenCounter {
    constructor(){
        this.tokenCount = 0;
    }
    static forMessages(messages) {
        const counter = new TokenCounter();
        messages.forEach(counter.addTokensOfMessage, counter);
        return counter.tokenCount;
    }
    static forString(str) {
        const tokens = str.match(/[\w]+|[^\s\w]/g);
        return (tokens ? tokens.length : 0);
    }
    addTokensOfItem(item){
        if (item.type === 'text' && typeof item.text === 'string') {
            this.tokenCount += TokenCounter.forString(item.text);
        } else if (item.type === 'image_url') {
            this.tokenCount += TOKEN_COST_PER_IMAGE;
        }
    }
    addTokensOfMessage(message){
        const content = message.content;
        if (typeof content === 'string') {
            this.tokenCount += TokenCounter.forString(content);
        } else if (Array.isArray(content)) {
            content.forEach(addTokensOfItem);
        }
    }
}

function ensureClosedBackticks(text) {
    const backtickCount = (text.match(/```/g) || []).length;
    if (backtickCount % 2 !== 0) text += '```';
    return text;
}

function handleUserPromptAppend(element, userMessage, promptIdentifier) {
    element.value = ensureClosedBackticks(element.value);
    element.dispatchEvent(new Event('input'));
    element.value += `\n\n${promptIdentifier} ${userMessage}\n`; // Append the user prompt
    element.dispatchEvent(new Event('input'));
}

function handleUserPromptAppendCodeMirror(editor, userMessage, promptIdentifier) {
    const doc = editor.getDoc();
    const currentText = doc.getValue();
    const lineBeforeAppend = doc.lineCount();

    // Ensure no unclosed triple backticks in the current content
    doc.setValue(ensureClosedBackticks(currentText));

    // Append the user prompt to the CodeMirror editor
    editor.replaceRange(`\n\n${promptIdentifier} ${userMessage}\n`, { line: lineBeforeAppend, ch: 0 });
}

function getLastPromptsAndResponses(count, maxTokens, textarea = zetPanes.getActiveTextarea()) {
    if (!textarea) {
        Logger.err("No active textarea found");
        return '';
    }

    const lines = textarea.value.split('\n');
    const promptsAndResponses = [];
    let promptCount = 0;
    let tokenCount = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].startsWith(PROMPT_IDENTIFIER)) promptCount += 1;
        if (promptCount > count) break;

        tokenCount += lines[i].split(/\s+/).length;
        promptsAndResponses.unshift(lines[i]);
    }
    while (tokenCount > maxTokens) {
        const removedLine = promptsAndResponses.shift();
        tokenCount -= removedLine.split(/\s+/).length;
    }
    return promptsAndResponses.join('\n') + '\n';
}

function removeLastResponse() {
    const noteInput = zetPanes.getActiveTextarea();
    const lines = noteInput.value.split('\n');

    // Find the index of the last "Prompt:"
    let lastPromptIndex = lines.length - 1;
    while (lastPromptIndex >= 0 && !lines[lastPromptIndex].startsWith(PROMPT_IDENTIFIER)) {
        lastPromptIndex -= 1;
    }

    // Remove all lines from the last "Prompt:" to the end
    if (lastPromptIndex >= 0) {
        lines.splice(lastPromptIndex, lines.length - lastPromptIndex);
        noteInput.value = lines.join('\n');

        // Update the CodeMirror instance with the new value
        window.currentActiveZettelkastenMirror.setValue(noteInput.value);
    }
}

function haltZettelkastenAi() {
    for (const [requestId, requestInfo] of activeRequests.entries()) {
        if (requestInfo.type === 'zettelkasten') {
            requestInfo.controller.abort();
            activeRequests.delete(requestId);
        }
    }

    Ai.isResponding = false;
    shouldContinue = false;
    Ai.isFirstAutoModeMessage = true;

    document.querySelector('#regen-button use').setAttribute('xlink:href', '#refresh-icon');
    document.getElementById("prompt").value = Ai.latestUserMessage;
}

function regenerateResponse() {
    if (!Ai.isResponding) {
        // AI is not responding, so we want to regenerate
        removeLastResponse(); // Remove the last AI response
        document.getElementById("prompt").value = Ai.latestUserMessage; // Restore the last user message into the input prompt
        document.querySelector('#regen-button use').setAttribute('xlink:href', '#refresh-icon');

    }
}

document.getElementById("regen-button").addEventListener("click", function () {
    if (Ai.isResponding) {
        haltZettelkastenAi();
    } else {
        regenerateResponse();
    }
    Elem.byId('prompt').value = Ai.latestUserMessage;
    document.querySelector('#regen-button use').setAttribute('xlink:href', '#refresh-icon');
});

// Extract the prompt from the last message
function extractLastPrompt() {
    const lastMessage = getLastPromptsAndResponses(1, 400);
    const promptRegex = new RegExp(`${PROMPT_IDENTIFIER}\\s*(.*)`, "i");
    const match = promptRegex.exec(lastMessage);
    if (match) return match[1].trim();

    Logger.warn("Prompt not found in the last message. Sending with a blank prompt.");
    return '';
}

function trimToTokenCount(inputText, maxTokens) {
    const tokens = inputText.match(/[\w]+|[^\s\w]/g);
    let trimmedText = '';
    let currentTokenCount = 0;

    if (tokens !== null) {
        for (const token of tokens) {
            currentTokenCount += 1;
            if (currentTokenCount > maxTokens) break;

            trimmedText += token + ' ';
        }
    }

    return trimmedText;
}

async function getLastLineFromTextArea(textArea) {
    const text = textArea.value;
    const lines = text.split('\n');
    return lines[lines.length - 1];
}

// Function to extract text within quotations
async function getQuotedText(text) {
    const regex = /"([^"]*)"/g;
    const matches = [];
    let match;
    while (match = regex.exec(text)) {
        matches.push(match[1]);
    }
    return matches.length ? matches : null;
}
