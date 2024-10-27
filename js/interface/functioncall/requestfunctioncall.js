function haltFunctionAi() {
    if (!currentController) return;

    currentController.abort();
    currentController = null;

    isAiProcessing = false;  // Ensure the state is updated

    // Use global functionSendSvg if it's always the correct element
    if (functionSendSvg) {
        functionSendSvg.innerHTML = SVG.use.play;
    }
}

let isAiProcessing = false;

const functionSendSvg = functionSendButton.querySelector('svg');
const functionPrompt = Elem.byId('function-prompt');

functionSendButton.addEventListener('click', () => {
    if (isAiProcessing) {
        haltFunctionAi();
    } else {
        requestFunctionCall();
    }
});

functionPrompt.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // avoid form submission
        requestFunctionCall(); // handle sending the message
    }
});

let mostRecentFunctionMessage = '';

functionRegenButton.addEventListener('click', () => {
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
            neuriteFunctionCM.getDoc().replaceRange(content, CodeMirror.Pos(neuriteFunctionCM.lastLine()));
        },
        onError: (err) => {
            functionErrorIcon.style.display = 'block';
            Logger.err(err);
        }
    });
}

function updateUiForProcessing() {
    functionSendSvg.innerHTML = SVG.use.pause;
    functionLoadingIcon.style.display = 'block';
    functionErrorIcon.style.display = 'none';

    neuriteFunctionCM.setValue('');
}

function updateUiForIdleState() {
    functionSendSvg.innerHTML = SVG.use.play;
    functionLoadingIcon.style.display = 'none';
}
