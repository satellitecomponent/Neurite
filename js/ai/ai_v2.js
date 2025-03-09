const Ai = {
    isResponding: false,
    latestUserMessage: null,
    isAutoModeEnabled: false,
    originalUserMessage: null,
    shouldContinue: true
};

let failCounter = 0;
const MAX_FAILS = 2;

// Active Requests Tracking
const activeRequests = new Map(); // Maps requestId to { type: 'global' | 'node', controller }

// Utility to Generate Unique Request IDs
let globalRequestIdCounter = 0;
function generateRequestId() {
    return `req-${Date.now()}-${++globalRequestIdCounter}`;
}

const Message = {};
Message.system = function(content){ return { role: 'system', content } }
Message.user = function(content){ return { role: 'user', content } }

class AiCall {
    customTemperature = null;
    inferenceOverride = null;
    messages = [];
    constructor(stream, node){
        this.node = node || null;
        this.stream = Boolean(stream);
    }
    static single(node){ return new AiCall(false, node) }
    static stream(node){ return new AiCall(true, node) }

    addSystemPrompt(prompt){
        this.messages.push(Message.system(prompt));
        return this;
    }
    addUserPrompt(prompt){
        this.messages.push(Message.user(prompt));
        return this;
    }
    exec(){
        return (this.node) ? this.#callchatLLMnode() : this.#callchatAPI();
    }

    async #callchatAPI(){
        Ai.shouldContinue = true;
        const requestId = generateRequestId();
        let streamedResponse = ""; // Local streamedResponse for this request

        function onBeforeCall() {
            Ai.isResponding = true;
            Ai.mainPrompt.setPause();
            Elem.byId('aiLoadingIcon').style.display = 'block';
            Elem.hideById('aiErrorIcon');
        }

        function onAfterCall() {
            if (!Ai.isAutoModeEnabled) {
                Ai.isResponding = false;
            }
            Ai.mainPrompt.setRefresh();
            Elem.hideById('aiLoadingIcon');
        }

        function onError(errorMsg) {
            Logger.err("In calling Ai API:", errorMsg);
            Elem.byId('aiErrorIcon').style.display = 'block';
            failCounter += 1;
            if (failCounter >= MAX_FAILS) {
                Logger.err("Max attempts reached. Stopping further API calls.");
                Ai.haltZettelkasten();
                resolveAiMessageIfAppropriate("Error: " + errorMsg, true);
            }
        }

        function onStreamingResponse(content) {
            // Verify if the request is still active
            if (!activeRequests.has(requestId) || !Ai.shouldContinue || content.trim() === "[DONE]") return;

            const myCodeMirror = window.currentActiveZettelkastenMirror;
            const scrollThreshold = 10; // Adjust as needed
            const scrollInfo = myCodeMirror.getScrollInfo();
            const isScrolledToBottom = scrollInfo.height - scrollInfo.clientHeight - scrollInfo.top <= scrollThreshold;

            const currentDoc = myCodeMirror.getDoc();
            const lastLine = currentDoc.lastLine();
            const lastLineLength = currentDoc.getLine(lastLine).length;
            myCodeMirror.replaceRange(content, CodeMirror.Pos(lastLine, lastLineLength));
            streamedResponse += content;

            if (isScrolledToBottom) {
                myCodeMirror.scrollTo(null, scrollInfo.height);
            }

            myCodeMirror.focus();
        }

        // Initialize AbortController for Zettelkasten Request
        const controller = new AbortController();
        activeRequests.set(requestId, { type: 'zettelkasten', controller });

        try {
            const responseData = await callAiApi({
                messages: this.messages,
                stream: this.stream,
                customTemperature: this.customTemperature,
                onBeforeCall,
                onAfterCall,
                onStreamingResponse,
                onError,
                inferenceOverride: null, // Assuming no override for global calls
                controller, // Pass the controller
                requestId // Pass the unique requestId
            });
            return streamedResponse || responseData;
        } finally {
            // Clean up after the request is done
            activeRequests.delete(requestId);
        }
    }

    async #callchatLLMnode(){
        const node = this.node;
        const requestId = generateRequestId();
        let streamedResponse = ""; // Local streamedResponse for this node's request

        function onBeforeCall() {
            node.aiResponding = true;
            node.regenerateButton.innerHTML = Svg.pause;
            node.content.querySelector('#aiLoadingIcon-' + node.index).style.display = 'block';
            node.content.querySelector('#aiErrorIcon-' + node.index).style.display = 'none';
        }

        function onAfterCall() {
            if (!node.isAutoModeEnabled) {
                node.aiResponding = false;
            }
            node.regenerateButton.innerHTML = Svg.refresh;
            node.content.querySelector('#aiLoadingIcon-' + node.index).style.display = 'none';
        }

        function onStreamingResponse(content) {
            // Verify if the request is still active
            if (!activeRequests.has(requestId) || !node.shouldContinue || content.trim() === "[DONE]") return;
            if (node.shouldContinue && content.trim() !== "[DONE]") TextArea.append.call(node.aiResponseTextArea, content)
        }

        function onError(errorMsg) {
            node.haltResponse();
            Logger.err("In calling Chat API:", errorMsg);
            node.content.querySelector('#aiErrorIcon-' + node.index).style.display = 'block';
        }
        const controller = node.controller;

        // Track the node-specific request
        activeRequests.set(requestId, { type: 'node', controller, node });

        return callAiApi({
            messages: this.messages,
            stream: this.stream,
            customTemperature: parseFloat(node.content.querySelector('#node-temperature-' + node.index).value),
            onBeforeCall,
            onAfterCall,
            onStreamingResponse,
            onError,
            inferenceOverride: this.inferenceOverride || Ai.determineModel(node),
            controller, // node-specific controller
            requestId
        });
    }
}

// AI.js

// UI Agnostic API Call

async function callAiApi({
    messages,
    stream = false,
    customTemperature = null,
    onBeforeCall,
    onAfterCall,
    onStreamingResponse,
    onError,
    inferenceOverride = null,
    controller,
    requestId
}) {
    Logger.info("Message Array", messages);

    if (useDummyResponses) {
        onBeforeCall();
        const randomResponse = dummyResponses[Math.floor(Math.random() * dummyResponses.length)];
        try {
            await imitateTextStream(randomResponse, onStreamingResponse);
        } catch (err) {
            Logger.err("With dummy response:", err);
            onError(err.message || err);
        } finally {
            onAfterCall();
        }
        return;
    }

    const params = getAPIParams(messages, stream, customTemperature, inferenceOverride);
    Logger.info("Message Array", messages);
    Logger.info("Token count:", TokenCounter.forMessages(messages));

    if (!params) {
        onError("Parameters are missing.");
        return;
    }

    // Sign-in check for Neurite provider
    if (params.providerId === 'neurite') {
        const isSignedIn = await checkNeuriteSignIn();
        if (!isSignedIn) return;
    }

    if (useProxy && requestId) params.body.requestId = requestId;

    const requestOptions = {
        method: "POST",
        headers: params.headers,
        body: JSON.stringify(params.body),
        signal: controller.signal,
    };

    // Use NeuriteBackend for Neurite provider
    let response;
    onBeforeCall();

    try {
        if (params.providerId === 'neurite') {
            // Use NeuriteBackend to make the API call
            response = await window.NeuriteBackend.request('/ai/get-response', requestOptions);
        } else {
            response = await fetch(params.API_URL, requestOptions);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'API request failed');
            }
        }

        let responseData = '';
        if (stream) {
            responseData = await streamAiResponse(response, (content) => {
                onStreamingResponse(content);
            }, 16); // Adjust delay as needed
        } else {
            const text = await response.text();
            try {
                const data = JSON.parse(text);
                responseData = extractContentFromResponse(data);
                if (!responseData) {
                    Logger.err("Unable to extract content from response:", data);
                    throw new Error("Unable to extract content from API response");
                }
            } catch (err) {
                Logger.err("In parsing JSON response:", err);
                throw new Error("Invalid JSON response from API");
            }
        }
        return responseData;
    } catch (err) {
        if (err.name === 'AbortError') {
            Logger.info("Response Halted");
            if (useProxy && requestId) await Request.send(new Ai.ctCancelRequest(requestId));
        } else {
            Logger.err(err);
            onError(err.message || err);
        }
    } finally {
        onAfterCall();
        // Check params.provider directly for Neurite
        if (params.providerId === 'neurite') {
            await neuritePanel.fetchUserBalanceThrottled(); // Use the throttled method
        }
        // Remove the request from activeRequests if it's still there
        if (requestId && activeRequests.has(requestId)) {
            activeRequests.delete(requestId);
        }
    }
}

Ai.ctCancelRequest = class {
    constructor(requestId){
        this.url = 'http://localhost:7070/cancel';
        this.options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId })
        };
        this.requestId = requestId;
    }
    onFailure(){ return `Failed to cancel request ${this.requestId} on server:` }
}

function extractContentFromResponse(data) {
    // Try to extract content from various possible locations in the response
    const choice = data.choices && data.choices[0];
    if (choice) {
        const content = choice.message?.content || choice.text;
        if (content) return content.trim();
    }
    const content = data.message?.content || data.content;
    return (content ? content.trim() : null);
}

async function streamAiResponse(response, onStreamingResponse, delay = 10) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = '';
    let finalResponse = '';
    let isFirstChunk = true;

    while (true) {
        const read = await reader.read();
        if (read.done) break;
        buffer += decoder.decode(read.value, { stream: true });

        let contentMatch;
        while ((contentMatch = buffer.match(/{[^}]*"content":"((?:[^\\"]|\\.)*)"[^}]*}/)) !== null) {
            const content = JSON.parse('"' + contentMatch[1] + '"');
            finalResponse += content;

            // Process the first chunk immediately, then introduce delay for subsequent chunks
            if (isFirstChunk) {
                onStreamingResponse(content);
                isFirstChunk = false;
            } else {
                await Promise.delay(delay);
                onStreamingResponse(content);
            }
            buffer = buffer.slice(contentMatch.index + contentMatch[0].length);
        }
    }
    return finalResponse;
}
