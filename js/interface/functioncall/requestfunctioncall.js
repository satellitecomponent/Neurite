View.Code.prototype.haltFunctionAi = function(){
    for (const [requestId, requestInfo] of activeRequests.entries()) {
        if (requestInfo.type !== 'function') continue;

        requestInfo.controller.abort();
        activeRequests.delete(requestId);
    }

    this.isAiProcessing = false; // Ensure the state is updated

    this.svgSend.innerHTML = `<use xlink:href="#play-icon"></use>`;
}

View.Code.prototype.initForRequestfunctioncall = function(){
    On.click(this.btnSend, this.onBtnSendClicked.bind(this));
    On.keydown(this.inputPrompt, this.onInputPromptKeyDown.bind(this));
    On.click(this.btnRegen, this.onBtnRegenClicked.bind(this));
}

View.Code.prototype.onBtnSendClicked = function(e){
    if (this.isAiProcessing) this.haltFunctionAi()
    else this.requestFunctionCall()
}

View.Code.prototype.onInputPromptKeyDown = function(e){
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // avoid form submission
        this.requestFunctionCall();
    }
}

View.Code.prototype.onBtnRegenClicked = function(e){
    this.inputPrompt.value = this.mostRecentMsg
}

View.Code.prototype.getPromptMessage = function () {
    const inputMessage = this.inputPrompt.value.trim();
    this.mostRecentMsg = inputMessage;
    if (inputMessage !== '') return Promise.resolve(inputMessage);

    return new Promise((resolve) => {
        window.prompt("Enter message:")
            .then((dialogueMessage) => {
                const trimmedMessage = dialogueMessage && dialogueMessage.trim();
                if (trimmedMessage !== '') {
                    resolve(trimmedMessage);
                } else {
                    Logger.info("No input provided. Request cancelled.");
                    resolve(null);
                }
            })
            .catch((error) => {
                Logger.error("Prompt failed:", error);
                resolve(null);
            });
    });
};

View.Code.prototype.requestFunctionCall = async function () {
    const content = await this.getPromptMessage();
    if (!content) return;

    this.inputPrompt.value = '';

    const event = new Event('input', { bubbles: true, cancelable: true });
    this.inputPrompt.dispatchEvent(event);

    const neuralTelemetryPrompt = createTelemetryPrompt(neuralTelemetry, false);
    const messages = [
        { role: "system", content: neuriteNeuralApiPrompt },
        { role: "system", content: neuralTelemetryPrompt }
    ];

    const maxContextSize = Elem.byId('max-context-size-slider').value;
    View.Code.trimMessages(messages, maxContextSize);

    messages.push({ role: "user", content });

    return this.getFunctionResponse(messages);
}

View.Code.trimMessages = function(messages, maxTokens){
    for (let i = messages.length - 1; i >= 0; i--) {
        if (TokenCounter.forMessages(messages) <= maxTokens) break;

        const msg = messages[i];
        msg.content = trimToTokenCount(msg.content, maxTokens);
    }
}

View.Code.prototype.getFunctionResponse = function(messages){
    const requestId = generateRequestId();
    const controller = new AbortController();

    activeRequests.set(requestId, { type: 'function', controller });

    return callAiApi({
        messages,
        stream: true,
        customTemperature: null,
        onBeforeCall: ()=>{
            this.isAiProcessing = true;
            this.updateUiForProcessing();
        },
        onAfterCall: ()=>{
            this.isAiProcessing = false;
            this.updateUiForIdleState();
        },
        onStreamingResponse: (content)=>{
            if (!activeRequests.has(requestId)) return;

            const cm = this.cm.cm;
            cm.getDoc().replaceRange(content, CodeMirror.Pos(cm.lastLine()));
        },
        onError: (err)=>{
            this.iconError.style.display = 'block';
            Logger.err(err);
        },
        controller,
        requestId
    });
}

View.Code.prototype.updateUiForProcessing = function() {
    this.svgSend.innerHTML = Svg.use.pause;
    this.iconLoading.style.display = 'block';
    Elem.hide(this.iconError);

    this.cm.empty();
}

View.Code.prototype.updateUiForIdleState = function() {
    this.svgSend.innerHTML = Svg.use.play;
    Elem.hide(this.iconLoading);
}
