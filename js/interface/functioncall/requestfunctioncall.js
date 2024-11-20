function haltFunctionAi() {
    for (const [requestId, requestInfo] of activeRequests.entries()) {
        if (requestInfo.type === 'function') {
            requestInfo.controller.abort();
            activeRequests.delete(requestId);
        }
    }

    isAiProcessing = false; // Ensure the state is updated

    if (functionSendSvg) {
        functionSendSvg.innerHTML = `<use xlink:href="#play-icon"></use>`;
    }
}

let isAiProcessing = false;

const functionSendSvg = functionSendButton.querySelector('svg');
const functionPrompt = Elem.byId('function-prompt');

On.click(functionSendButton, (e)=>{
    if (isAiProcessing) {
        haltFunctionAi();
    } else {
        requestFunctionCall();
    }
});

On.keydown(functionPrompt, (e)=>{
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // avoid form submission
        requestFunctionCall(); // handle sending the message
    }
});

let mostRecentFunctionMessage = '';

On.click(functionRegenButton, (e)=>{
    functionPrompt.value = mostRecentFunctionMessage
});

function updateMostRecentMessage(newMessage) {
    mostRecentFunctionMessage = newMessage
}

// Function to handle new message requests
function requestFunctionCall() {
    let userMessage = functionPrompt.value.trim();
    updateMostRecentMessage(userMessage);
    if (userMessage === '') {
        userMessage = prompt("Enter message:");

        // Check if the user provided input or cancelled the prompt
        if (userMessage === null || userMessage.trim() === '') {
            Logger.info("No input provided. Request cancelled.");
            return;
        }

        functionPrompt.value = userMessage; // optional
    }

    functionPrompt.value = '';

    const event = new Event('input', { bubbles: true, cancelable: true });
    functionPrompt.dispatchEvent(event);

    const neuralTelemetryPrompt = createTelemetryPrompt(neuralTelemetry, false);
    let systemMessages = [
        { role: "system", content: neuriteNeuralApiPrompt },
        { role: "system", content: neuralTelemetryPrompt }
    ];

    const maxContextSize = Elem.byId('max-context-size-slider').value;
    // Apply trimming to system messages, excluding the user message from the trimming process
    systemMessages = trimSystemMessages(systemMessages, maxContextSize);

    const requestMessages = systemMessages.concat({ role: "user", content: userMessage });

    // Call the new function to handle the API call
    return getFunctionResponse(requestMessages);
}

function trimSystemMessages(systemMessages, maxTokens) {
    let totalTokenCount = TokenCounter.forMessages(systemMessages);
    if (totalTokenCount > maxTokens) {
        for (let i = systemMessages.length - 1; i >= 0; i--) {
            systemMessages[i].content = trimToTokenCount(systemMessages[i].content, maxTokens);
            totalTokenCount = TokenCounter.forMessages(systemMessages);
            if (totalTokenCount <= maxTokens) break;
        }
    }
    return systemMessages;
}

function getFunctionResponse(requestMessages) {
    return callAiApi({
        messages: requestMessages,
        stream: true,
        customTemperature: null,
        onBeforeCall: () => {
            isAiProcessing = true;
            updateUiForProcessing();
        },
        onAfterCall: () => {
            isAiProcessing = false;
            updateUiForIdleState();
        },
        onStreamingResponse: (content) => {
            if (!activeRequests.has(requestId)) return;

            neuriteFunctionCM.getDoc().replaceRange(content, CodeMirror.Pos(neuriteFunctionCM.lastLine()));
        },
        onError: (err) => {
            functionErrorIcon.style.display = 'block';
            Logger.err(err);
        }
    });
}

function updateUiForProcessing() {
    functionSendSvg.innerHTML = Svg.use.pause;
    functionLoadingIcon.style.display = 'block';
    functionErrorIcon.style.display = 'none';

    neuriteFunctionCM.setValue('');
}

function updateUiForIdleState() {
    functionSendSvg.innerHTML = Svg.use.play;
    functionLoadingIcon.style.display = 'none';
}
