let aiResponding = false;
let latestUserMessage = null;
let shouldContinue = true;

let failCounter = 0;
const MAX_FAILS = 2;

// Active Requests Tracking
const activeRequests = new Map(); // Maps requestId to { type: 'global' | 'node', controller }

// Utility to Generate Unique Request IDs
let globalRequestIdCounter = 0;
function generateRequestId() {
    return `req-${Date.now()}-${++globalRequestIdCounter}`;
}

// Call Chat API Function
async function callchatAPI(messages, stream = false, customTemperature = null) {
    shouldContinue = true;
    const requestId = generateRequestId();
    let streamedResponse = ""; // Local streamedResponse for this request

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
        console.error("Error calling AI API:", errorMsg);
        document.getElementById("aiErrorIcon").style.display = 'block';
        failCounter++;
        if (failCounter >= MAX_FAILS) {
            console.error("Max attempts reached. Stopping further API calls.");
            shouldContinue = false;
            haltZettelkastenAi();
            resolveAiMessageIfAppropriate("Error: " + errorMsg, true);
        }
    }

    function onStreamingResponse(content) {
        // Verify if the request is still active
        if (!activeRequests.has(requestId) || !shouldContinue || content.trim() === "[DONE]") return;

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
            messages,
            stream,
            customTemperature,
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

// Call Chat LLM Node Function
async function callchatLLMnode(messages, node, stream = false, inferenceOverride = null) {
    const requestId = generateRequestId();
    let streamedResponse = ""; // Local streamedResponse for this node's request

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
        // Verify if the request is still active
        if (!activeRequests.has(requestId) || !node.shouldContinue || content.trim() === "[DONE]") return;

        node.aiResponseTextArea.value += content;
        streamedResponse += content;
        node.aiResponseTextArea.dispatchEvent(new Event("input"));
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

    // Initialize AbortController for Node Request
    const controller = node.controller || new AbortController();
    node.controller = controller; // Ensure the node has its controller

    // Track the node-specific request
    activeRequests.set(requestId, { type: 'node', controller, node });

    try {
        const responseData = await callAiApi({
            messages,
            stream,
            customTemperature,
            onBeforeCall,
            onAfterCall,
            onStreamingResponse,
            onError,
            inferenceOverride,
            controller, // Pass the node-specific controller
            requestId // Pass the unique requestId
        });
        return streamedResponse || responseData;
    } finally {
        // Clean up after the node's request is done
        activeRequests.delete(requestId);
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
    controller = null,
    requestId,
}) {
    console.log("Message Array", messages);
    console.log("Token count:", getTokenCount(messages));

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

    const params = getAPIParams(messages, stream, customTemperature, inferenceOverride);

    if (!params) {
        onError("Parameters are missing.");
        return;
    }

    // Sign-in check for Neurite provider
    if (params.provider === 'neurite') {
        const isSignedIn = await checkNeuriteSignIn();
        if (!isSignedIn) {
            return;
        }
    }

    if (useProxy && requestId) {
        params.body.requestId = requestId;
    }

    // Prepare request options
    let requestOptions = {
        method: "POST",
        headers: params.headers,
        body: JSON.stringify(params.body),
        signal: controller.signal,
    };

    // Use NeuriteBackend for Neurite provider
    let response;
    onBeforeCall();

    try {
        if (params.provider === 'neurite') {
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
        // Check params.provider directly for Neurite
        if (params.provider === 'neurite') {
            await neuritePanel.fetchUserBalanceThrottled(); // Use the throttled method
        }
        // Remove the request from activeRequests if it's still there
        if (requestId && activeRequests.has(requestId)) {
            activeRequests.delete(requestId);
        }
    }
}

// Extract Content from Response
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

// Stream AI Response Function
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