
let aiResponding = false;
let latestUserMessage = null;
let controller = new AbortController();
let shouldContinue = true;


let failCounter = 0;
const MAX_FAILS = 2;

let streamedResponse = "";

async function callchatAPI(messages, stream = false, customTemperature = null) {
    shouldContinue = true;

    function onBeforeCall() {
        aiResponding = true;
        document.querySelector('#regen-button use').setAttribute('xlink:href', '#pause-icon');
        document.getElementById("aiLoadingIcon").style.display = 'block';
        document.getElementById("aiErrorIcon").style.display = 'none';
        console.log("Messages sent to API:", messages);
        console.log("Token count for messages:", getTokenCount(messages));
    }

    function onAfterCall() {
        aiResponding = false;
        document.querySelector('#regen-button use').setAttribute('xlink:href', '#refresh-icon');
        document.getElementById("aiLoadingIcon").style.display = 'none';
    }

    function onError(errorMsg) {
        console.error("Error calling Ai API:", errorMsg);
        document.getElementById("aiErrorIcon").style.display = 'block';
        failCounter++;
        if (failCounter >= MAX_FAILS) {
            console.error("Max attempts reached. Stopping further API calls.");
            shouldContinue = false;
            if (controller) {
                controller.abort();
            }
            resolveAiMessageIfAppropriate("Error: " + errorMsg, true);
        }
    }

    function onStreamingResponse(content) {
        // Implement the specific UI logic for streaming content here
        const noteInput = document.getElementById("note-input");
        const isScrolledToBottom = noteInput.scrollHeight - noteInput.clientHeight <= noteInput.scrollTop + 1;

        if (shouldContinue && content.trim() !== "[DONE]") {
            myCodeMirror.replaceRange(content, CodeMirror.Pos(myCodeMirror.lastLine()));
            streamedResponse += content;

            if (isScrolledToBottom && !userScrolledUp) {
                noteInput.scrollTop = noteInput.scrollHeight;
                myCodeMirror.scrollTo(null, myCodeMirror.getScrollInfo().height);
            }
            noteInput.dispatchEvent(new Event("input"));
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

async function appendWithDelay(content, node, delay) {
    return new Promise((resolve) => {
        setTimeout(() => {
            node.aiResponseTextArea.value += content;
            node.aiResponseTextArea.dispatchEvent(new Event("input"));
            resolve();
        }, delay);
    });
}

async function handleStreamingForLLMnode(response, node) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let fullResponse = "";

    while (true) {
        const { value, done } = await reader.read();
        if (done || !node.shouldContinue) break;

        buffer += decoder.decode(value, { stream: true });

        let contentMatch;
        while ((contentMatch = buffer.match(/"content":"((?:[^\\"]|\\.)*)"/)) !== null) {
            const content = JSON.parse('"' + contentMatch[1] + '"');
            if (!node.shouldContinue) break;

            if (content.trim() !== "[DONE]") {
                await appendWithDelay(content, node, 30);
            }
            fullResponse += content; // append content to fullResponse
            buffer = buffer.slice(contentMatch.index + contentMatch[0].length);
        }
    }
    return fullResponse; // return the entire response
}

async function callchatLLMnode(messages, node, stream = false, selectedModel = null) {
    // Define the callbacks
    function onBeforeCall() {
        node.aiResponding = true;
        node.regenerateButton.innerHTML = '<svg width="24" height="24"><use xlink:href="#pause-icon"></use></svg>';
        document.getElementById(`aiLoadingIcon-${node.index}`).style.display = 'block';
        document.getElementById(`aiErrorIcon-${node.index}`).style.display = 'none';
        console.log("Messages sent to API:", messages);
    }

    function onAfterCall() {
        node.aiResponding = false;
        node.regenerateButton.innerHTML = '<svg width="24" height="24" class="icon"><use xlink:href="#refresh-icon"></use></svg>';
        document.getElementById(`aiLoadingIcon-${node.index}`).style.display = 'none';
    }

    function onStreamingResponse(content) {
        if (node.shouldContinue && content.trim() !== "[DONE]") {
            node.aiResponseTextArea.value += content;
            node.aiResponseTextArea.dispatchEvent(new Event("input"));
        }
    }

    function onError(errorMsg) {
        console.error("Error calling ChatGPT API:", errorMsg);
        document.getElementById(`aiErrorIcon-${node.index}`).style.display = 'block';
        if (node.haltCheckbox) {
            node.haltCheckbox.checked = true;
        }
    }

    // Prepare the parameters for callAiApi
    const customTemperature = parseFloat(document.getElementById(`node-temperature-${node.index}`).value);
    const modelOverride = selectedModel || determineModel();

    // Call the generic API function
    return callAiApi({
        messages,
        stream,
        customTemperature,
        onBeforeCall,
        onAfterCall,
        onStreamingResponse,
        onError,
        modelOverride
    });
}


        // UI agnostic api call

let currentController = null;

async function callAiApi({ messages, stream = false, customTemperature = null, onBeforeCall, onAfterCall, onStreamingResponse, onError, modelOverride = null }) {
    if (useDummyResponses) {
        onBeforeCall();
        try {
            await streamDummyAiResponse(onStreamingResponse);
        } catch (error) {
            console.error("Error with dummy response:", error);
            onError(error.message || error);
        } finally {
            onAfterCall();
        }
        return;
    }

    // Get API parameters, including the locally determined API URL
    const params = getAPIParams(messages, stream, customTemperature, modelOverride);
    console.log("Message Array", messages);
    if (!params) {
        onError("API key is missing.");
        return;
    }

    currentController = new AbortController();
    let requestOptions = {
        method: "POST",
        headers: params.headers,
        body: params.body,
        signal: currentController.signal,
    };

    onBeforeCall();  // Pre API call UI updates

    try {
        const response = await fetch(params.API_URL, requestOptions);
        if (!response.ok) throw await response.json();

        let responseData = '';
        if (stream) {
            // Await the complete streamed response
            responseData = await streamAiResponse(response, onStreamingResponse);
        } else {
            const data = await response.json();
            responseData = data.choices && data.choices[0].message ? data.choices[0].message.content.trim() : '';
        }

        return responseData; // This is either the full streamed response or the directly fetched response
    } catch (error) {
        console.error("Error:", error);
        onError(error.message || error);
    } finally {
        onAfterCall(); // Post API call UI updates
    }
}

async function streamAiResponse(response, onStreamingResponse, delay = 10) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let finalResponse = ""; // Initialize an empty string to accumulate the final response
    let isFirstChunk = true;

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let contentMatch;
        while ((contentMatch = buffer.match(/{[^}]*"content":"((?:[^\\"]|\\.)*)"[^}]*}/)) !== null) {
            const content = JSON.parse('"' + contentMatch[1] + '"');
            finalResponse += content; // Append the content to the final response

            // Process the first chunk immediately, then introduce delay for subsequent chunks
            if (isFirstChunk) {
                onStreamingResponse(content);
                isFirstChunk = false;
            } else {
                await new Promise(resolve => setTimeout(resolve, delay));
                onStreamingResponse(content);
            }
            buffer = buffer.slice(contentMatch.index + contentMatch[0].length);
        }
    }

    return finalResponse; // Return the accumulated final response
}