const Ai = {
    isResponding: false,
    latestUserMessage: null,
    isFirstAutoModeMessage: true,
    originalUserMessage: null
};
let shouldContinue = true;


let failCounter = 0;
const MAX_FAILS = 2;

let streamedResponse = '';

async function callchatAPI(messages, stream = false, customTemperature = null) {
    shouldContinue = true;

    function onBeforeCall() {
        Ai.isResponding = true;
        document.querySelector('#regen-button use').setAttribute('xlink:href', '#pause-icon');
        Elem.byId('aiLoadingIcon').style.display = 'block';
        Elem.hideById('aiErrorIcon');
    }

    function onAfterCall() {
        Ai.isResponding = false;
        document.querySelector('#regen-button use').setAttribute('xlink:href', '#refresh-icon');
        Elem.hideById('aiLoadingIcon');
    }

    function onError(errorMsg) {
        Logger.err("In calling Ai API:", errorMsg);
        Elem.byId('aiErrorIcon').style.display = 'block';
        failCounter += 1;
        if (failCounter >= MAX_FAILS) {
            Logger.err("Max attempts reached. Stopping further API calls.");
            shouldContinue = false;
            if (currentController) {
                currentController.abort();
                currentController = null;
            }
            resolveAiMessageIfAppropriate("Error: " + errorMsg, true);
        }
    }

    function onStreamingResponse(content) {
        const myCodeMirror = window.currentActiveZettelkastenMirror;
        const scrollThreshold = 10; // Adjust this value as needed
        const scrollInfo = myCodeMirror.getScrollInfo();
        const isScrolledToBottom = scrollInfo.height - scrollInfo.clientHeight - scrollInfo.top <= scrollThreshold;

        if (shouldContinue && content.trim() !== "[DONE]") {
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
    }

    return callAiApi({
        messages,
        stream,
        customTemperature,
        onBeforeCall,
        onAfterCall,
        onStreamingResponse,
        onError
    });
}

async function handleStreamingForLLMnode(response, node) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = '';
    const fullResponse = [];

    while (true) {
        const read = await reader.read();
        if (read.done || !node.shouldContinue) break;

        buffer += decoder.decode(read.value, { stream: true });

        let contentMatch;
        while ((contentMatch = buffer.match(/"content":"((?:[^\\"]|\\.)*)"/)) !== null) {
            const content = JSON.parse('"' + contentMatch[1] + '"');
            if (!node.shouldContinue) break;

            if (content.trim() !== "[DONE]") {
                const func = TextArea.append.bind(node.aiResponseTextArea, content);
                await callWithDelay(func, 30);
            }
            fullResponse.push(content);
            buffer = buffer.slice(contentMatch.index + contentMatch[0].length);
        }
    }
    return fullResponse.join('');
}

function callchatLLMnode(messages, node, stream = false, inferenceOverride) {
    function onBeforeCall() {
        node.aiResponding = true;
        node.regenerateButton.innerHTML = SVG.pause;
        node.content.querySelector('#aiLoadingIcon-' + node.index).style.display = 'block';
        node.content.querySelector('#aiErrorIcon-' + node.index).style.display = 'none';
    }
    function onAfterCall() {
        node.aiResponding = false;
        node.regenerateButton.innerHTML = SVG.refresh;
        node.content.querySelector('#aiLoadingIcon-' + node.index).style.display = 'none';
    }
    function onStreamingResponse(content) {
        if (node.shouldContinue && content.trim() !== "[DONE]") TextArea.append.call(node.aiResponseTextArea, content)
    }
    function onError(errorMsg) {
        Logger.err("In calling Chat API:", errorMsg);
        node.content.querySelector('#aiErrorIcon-' + node.index).style.display = 'block';
        if (node.haltCheckbox) node.haltCheckbox.checked = true;
    }

    return callAiApi({
        messages,
        stream,
        customTemperature: parseFloat(node.content.querySelector('#node-temperature-' + node.index).value),
        onBeforeCall,
        onAfterCall,
        onStreamingResponse,
        onError,
        inferenceOverride: inferenceOverride || Ai.determineModel(node),
        controller: node.controller // node-specific controller
    });
}

        // UI agnostic api call

let currentController = null;

async function callAiApi({
    messages,
    stream = false,
    customTemperature = null,
    onBeforeCall,
    onAfterCall,
    onStreamingResponse,
    onError,
    inferenceOverride = null,
    controller = null
}) {
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

    if (!controller) {
        controller = new AbortController();
        currentController = controller;
    }

    const params = getAPIParams(messages, stream, customTemperature, inferenceOverride);
    Logger.info("Message Array", messages);
    Logger.info("Token count:", TokenCounter.forMessages(messages));

    if (!params) {
        onError("API key is missing.");
        return;
    }

    // Generate a unique requestId only if using proxy
    const requestId = useProxy ? Date.now().toString() : null;
    if (requestId) params.body.requestId = requestId;

    const requestOptions = {
        method: 'POST',
        headers: params.headers,
        body: JSON.stringify(params.body),
        signal: controller.signal,
    };

    onBeforeCall();

    try {
        const response = await fetch(params.API_URL, requestOptions);

        if (!response.ok) throw await response.json();

        let responseData = '';
        if (stream) {
            responseData = await streamAiResponse(response, onStreamingResponse);
        } else {
            const text = await response.text();
            try {
                const data = JSON.parse(text);

                // Extract content from the response, regardless of the exact structure
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
