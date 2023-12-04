
async function requestFunctionCall() {
    const userMessage = functionPrompt.value;

    // Clear the prompt textarea and trigger an input event
    functionPrompt.value = '';
    const event = new Event('input', {
        bubbles: true,
        cancelable: true,
    });
    functionPrompt.dispatchEvent(event);

    const neuralTelemetryPrompt = createTelemetryPrompt(neuralTelemetry);

    const requestMessages = [
        { role: "system", content: neuralAPIMessage },
        { role: "system", content: neuralTelemetryPrompt },
        { role: "user", content: userMessage }
    ];

    callAiApi({
        messages: requestMessages,
        stream: true,
        customTemperature: null,
        API_URL: "https://api.openai.com/v1/chat/completions",
        onBeforeCall: () => {
            functionLoadingIcon.style.display = 'block';
            functionErrorIcon.style.display = 'none';
            functionSendSvg.innerHTML = `<use xlink:href="#pause-icon"></use>`;
            neuriteFunctionCM.setValue('');
        },
        onAfterCall: () => {
            functionLoadingIcon.style.display = 'none';
            functionSendSvg.innerHTML = `<use xlink:href="#play-icon"></use>`;
        },
        onStreamingResponse: (content) => {
            neuriteFunctionCM.getDoc().replaceRange(content, CodeMirror.Pos(neuriteFunctionCM.lastLine()));
        },
        onError: (error) => {
            functionErrorIcon.style.display = 'block';
            console.error("Error:", error);
        }
    });
}