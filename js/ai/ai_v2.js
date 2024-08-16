
let aiResponding = false;
let latestUserMessage = null;
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

async function callchatLLMnode(messages, node, stream = false, inferenceOverride = null) {
    // Define the callbacks
    function onBeforeCall() {
        node.aiResponding = true;
        node.regenerateButton.innerHTML = '<svg width="24" height="24"><use xlink:href="#pause-icon"></use></svg>';
        node.content.querySelector(`#aiLoadingIcon-${node.index}`).style.display = 'block';
        node.content.querySelector(`#aiErrorIcon-${node.index}`).style.display = 'none';
    }
    function onAfterCall() {
        node.aiResponding = false;
        node.regenerateButton.innerHTML = '<svg width="24" height="24" class="icon"><use xlink:href="#refresh-icon"></use></svg>';
        node.content.querySelector(`#aiLoadingIcon-${node.index}`).style.display = 'none';
    }
    function onStreamingResponse(content) {
        if (node.shouldContinue && content.trim() !== "[DONE]") {
            node.aiResponseTextArea.value += content;
            node.aiResponseTextArea.dispatchEvent(new Event("input"));
        }
    }
    function onError(errorMsg) {
        console.error("Error calling Chat API:", errorMsg);
        node.content.querySelector(`#aiErrorIcon-${node.index}`).style.display = 'block';
        if (node.haltCheckbox) {
            node.haltCheckbox.checked = true;
        }
    }

    // Determine the inference override if not provided
    if (!inferenceOverride) {
        const { provider, model } = determineAiNodeModel(node);
        inferenceOverride = { provider, model };
    }

    // Prepare the parameters for callAiApi
    const temperatureInput = node.content.querySelector(`#node-temperature-${node.index}`);
    const customTemperature = parseFloat(temperatureInput.value);

    // Call the generic API function
    return callAiApi({
        messages,
        stream,
        customTemperature,
        onBeforeCall,
        onAfterCall,
        onStreamingResponse,
        onError,
        inferenceOverride,
        controller: node.controller  // Pass the node-specific controller
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
    controller = null  // Accept a controller as a parameter, potentially null
}) {
    if (useDummyResponses) {
        onBeforeCall();
        const randomResponse = dummyResponses[Math.floor(Math.random() * dummyResponses.length)];
        try {
            await imitateTextStream(randomResponse, onStreamingResponse);
        } catch (error) {
            console.error("Error with dummy response:", error);
            onError(error.message || error);
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
    console.log("Message Array", messages);
    console.log("Token count:", getTokenCount(messages));

    if (!params) {
        onError("API key is missing.");
        return;
    }

    // Generate a unique requestId only if using proxy
    const requestId = useProxy ? Date.now().toString() : null;
    if (requestId) {
        params.body.requestId = requestId;
    }

    let requestOptions = {
        method: "POST",
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
                    console.error("Unable to extract content from response:", data);
                    throw new Error("Unable to extract content from API response");
                }
            } catch (parseError) {
                console.error("Error parsing JSON response:", parseError);
                throw new Error("Invalid JSON response from API");
            }
        }
        return responseData;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Response Halted');
            // Send a cancellation request to the server only if using proxy
            if (useProxy && requestId) {
                try {
                    const response = await fetch('http://localhost:7070/cancel', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ requestId })
                    });
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                } catch (cancelError) {
                    console.error("Error cancelling request on server:", cancelError);
                }
            }
        } else {
            console.error("Error:", error);
            onError(error.message || error);
        }
    } finally {
        onAfterCall();
    }
}

function extractContentFromResponse(data) {
    // Try to extract content from various possible locations in the response
    if (data.choices && data.choices[0]) {
        if (data.choices[0].message && data.choices[0].message.content) {
            return data.choices[0].message.content.trim();
        }
        if (data.choices[0].text) {
            return data.choices[0].text.trim();
        }
    }
    if (data.message && data.message.content) {
        return data.message.content.trim();
    }
    if (data.content) {
        return data.content.trim();
    }
    // If we can't find the content in any of the expected locations, return null
    return null;
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