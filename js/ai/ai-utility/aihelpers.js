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
    constructor() {
        this.tokenCount = 0;
    }
    static tokenize(str) {
        return str.match(/[\w]+|[^\s\w]/g) || [];
    }
    static forString(str) {
        return TokenCounter.tokenize(str).length;
    }
    static forMessages(messages) {
        const counter = new TokenCounter();
        messages.forEach(counter.addTokensOfMessage, counter);
        return counter.tokenCount;
    }
    addTokensOfItem(item) {
        if (item.type === 'text' && typeof item.text === 'string') {
            this.tokenCount += TokenCounter.forString(item.text);
        } else if (item.type === 'image_url') {
            this.tokenCount += TOKEN_COST_PER_IMAGE;
        }
    }
    addTokensOfMessage(message) {
        const content = message.content;
        if (typeof content === 'string') {
            this.tokenCount += TokenCounter.forString(content);
        } else if (Array.isArray(content)) {
            content.forEach(this.addTokensOfItem, this);
        }
    }
}


function updateInfoList(info, tempInfoList, remainingTokens, totalTokenCount, maxContextSize) {
    let flag = false;
    const cleanedData = info.data.replace("Text Content:", '');
    if (cleanedData.trim()) {
        const tempString = tempInfoList.join("\n\n") + "\n\n" + cleanedData;
        let tempTokenCount = TokenCounter.forString(tempString);

        if (tempTokenCount <= remainingTokens && totalTokenCount + tempTokenCount <= maxContextSize) {
            tempInfoList.push(cleanedData);
            remainingTokens -= tempTokenCount;
            totalTokenCount += tempTokenCount;
        } else {
            flag = true;
        }
    }
    return [remainingTokens, totalTokenCount, flag];
}

function ensureClosedBackticks(text) {
    const backtickCount = (text.match(/```/g) || []).length;
    if (backtickCount % 2 !== 0) text += '```';
    return text;
}

function handleUserPromptAppend(element, userMessage) {
    element.value = ensureClosedBackticks(element.value);
    element.dispatchEvent(new Event('input'));

    element.value += `\n\n${PROMPT_IDENTIFIER} ${userMessage} ${PROMPT_END}\n`;
    element.dispatchEvent(new Event('input'));
}

function handleUserPromptAppendCodeMirror(editor, userMessage, promptIdentifier) {
    const doc = editor.getDoc();
    const currentText = doc.getValue();
    const lineBeforeAppend = doc.lineCount();

    // Ensure no unclosed triple backticks in the current content
    doc.setValue(ensureClosedBackticks(currentText));

    // Append the user prompt with an explicit end marker
    editor.replaceRange(`\n${promptIdentifier}\n${userMessage}\n${PROMPT_END}\n`, { line: lineBeforeAppend, ch: 0 });
}

function getAllPromptAndResponsePairs(textarea, count = null, maxTokens = null, type = "both") {
    if (!textarea) {
        Logger.err("No active textarea found");
        return [];
    }

    const content = textarea.value || "";
    if (!content.trim()) return [];

    const pattern = new RegExp(
        `${PROMPT_IDENTIFIER}\\s*([\\s\\S]*?)${PROMPT_END}\\s*([\\s\\S]*?)(?=${PROMPT_IDENTIFIER}|$)`,
        "g"
    );

    const allMatches = [];
    let match;

    while ((match = pattern.exec(content)) !== null) {
        const userText = match[1].trim();
        const aiText = match[2].trim();
        allMatches.push({ user: userText, ai: aiText });
    }

    if (!allMatches.length) return [];

    // Get the last `count` items, reversing to maintain order
    let lastItems = count !== null ? allMatches.slice(-count).reverse() : allMatches.reverse();

    // Token limit enforcement
    if (maxTokens !== null) {
        let tokenCount = 0;
        const filteredItems = [];

        for (const item of lastItems) {
            const userTokens = TokenCounter.forString(item.user);
            const aiTokens = TokenCounter.forString(item.ai);

            if (tokenCount + userTokens + aiTokens > maxTokens) break;

            filteredItems.push(item);
            tokenCount += userTokens + aiTokens;
        }

        lastItems = filteredItems;
    }

    // Apply filtering: "both" (default), "user", or "ai"
    if (type === "user") return lastItems.map(pair => pair.user);
    if (type === "ai") return lastItems.map(pair => pair.ai);
    return lastItems; // Default: structured { user, ai } pairs
}

function getLastPromptsAndResponses(count, maxTokens = null, textarea = zetPanes.getActiveTextarea()) {
    const lastItems = getAllPromptAndResponsePairs(textarea, count, maxTokens, "both");
    if (!lastItems.length) return '';

    return lastItems
        .map(({ user, ai }) => `${PROMPT_IDENTIFIER} ${user} ${PROMPT_END}\n${ai}`)
        .join('\n') + '\n';
}


function removeLastResponse() {
    const noteInput = zetPanes.getActiveTextarea();
    const lines = noteInput.value.split('\n');

    // Find the index of the last "Prompt:"
    let lastPromptIndex = lines.length - 1;
    while (lastPromptIndex >= 0 && !lines[lastPromptIndex].startsWith(PROMPT_IDENTIFIER)) {
        lastPromptIndex -= 1;
    }
    if (lastPromptIndex < 0) return;

    lines.splice(lastPromptIndex, lines.length - lastPromptIndex);
    noteInput.value = lines.join('\n');
    window.currentActiveZettelkastenMirror.setValue(noteInput.value);
}

class MainPrompt {
    btnRegen = Elem.byId('regen-button');
    textArea = Elem.byId('prompt');
    use = this.btnRegen.querySelector('use');

    setLatestUserMessage(){
        this.textArea.value = Ai.latestUserMessage;
        this.setRefresh();
    }
    setPause(){ this.use.setAttribute('xlink:href', '#pause-icon') }
    setRefresh(){ this.use.setAttribute('xlink:href', '#refresh-icon') }
}

Ai.haltZettelkasten = function(){
    for (const [requestId, requestInfo] of activeRequests.entries()) {
        if (requestInfo.type !== 'zettelkasten') continue;

        requestInfo.controller.abort();
        activeRequests.delete(requestId);
    }

    Ai.isResponding = false;
    Ai.shouldContinue = false;
    Ai.isFirstAutoModeMessage = true;

    Ai.mainPrompt.setLatestUserMessage();
}
Ai.regenerateResponse = function(){
    removeLastResponse();
    Ai.mainPrompt.setLatestUserMessage();
}
Ai.init = function(){
    Ai.mainPrompt = new MainPrompt();
    Ai.mainPrompt.btnRegen.addEventListener("click", Ai.onRegenClicked);
}
Ai.onRegenClicked = function(){
    Ai[Ai.isResponding ? 'haltZettelkasten' : 'regenerateResponse']();
    Ai.mainPrompt.setLatestUserMessage();
}

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
    if (!inputText.trim()) return '';

    const tokens = TokenCounter.tokenize(inputText);

    // If already within limit, return as-is
    if (tokens.length <= maxTokens) return inputText;

    // Trim to maxTokens and reconstruct text
    return tokens.slice(0, maxTokens).join(' ');
}

function getLastLineFromTextArea(textArea) {
    const text = textArea.value;
    const lines = text.split('\n');
    return lines[lines.length - 1];
}

// Function to extract text within quotations
function getQuotedText(text) {
    const regex = /"([^"]*)"/g;
    const matches = [];
    let match;
    while (match = regex.exec(text)) {
        matches.push(match[1]);
    }
    return matches.length ? matches : null;
}
