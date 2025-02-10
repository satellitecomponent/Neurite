class Stored {
    constructor(key){ this.key = key }
    delete(){ localStorage.removeItem(this.key) }
    load(){ return JSON.parse(localStorage.getItem(this.key)) }
    save(obj){ localStorage.setItem(this.key, JSON.stringify(obj)) }
}

function formatResultAsTitle(result) {
    let titleString;

    if (typeof result === 'object' && result !== null) {
        try {
            titleString = JSON.stringify(result);
        } catch {
            titleString = '[Complex Object]';
        }
    } else if (typeof result === 'undefined') {
        titleString = 'undefined';
    } else if (typeof result === 'symbol') {
        titleString = 'Symbol';
    } else if (typeof result === 'bigint') {
        titleString = `BigInt (${result.toString()})`;
    } else if (Array.isArray(result)) {
        titleString = '[Array]';
    } else if (typeof result === 'function') {
        titleString = `Function ${result.name || '(anonymous)'}`;
    } else if (result instanceof Error) {
        titleString = `Error (${result.message})`;
    } else {
        titleString = result.toString();
    }

    // Truncate the title if it's too long
    if (titleString.length > 200) {
        titleString = titleString.substring(0, 197) + '...';
    }

    return "Result: " + titleString;
}

function generateUUID(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c)=>{
        const r = Math.random() * 16 | 0;
        const v = (c === 'x' ? r : (r & 0x3 | 0x8));
        return v.toString(16);
    })
}

['click', 'mousedown', 'wheel', 'dragstart', 'dragend']
.forEach(Event.stopPropagationByNameForThis, nodePanel);
On.mousemove(nodePanel, (e)=>{
    if (!App.viewCode.div.contains(e.target)) e.stopPropagation();
});

CodeMirror.defineMode("ignoreCodeBlocks", function (config) {
    var jsMode = CodeMirror.getMode(config, { name: "javascript" });

    return {
        token: function (stream, state) {
            // Skip code block markers
            if (stream.match("```")) {
                stream.skipToEnd();
                return null;
            }

            // Extract and match the next word token
            if (stream.match(/^\w+/)) {
                var currentToken = stream.current();
                if (functionNameList.includes(currentToken)) {
                    return "neurite-function-name"; // Custom style for function names
                }
                stream.backUp(currentToken.length); // Back up to reprocess this token in jsMode
            }

            // Use JavaScript mode for all other text
            return jsMode.token(stream, state.jsState);
        },
        startState: function () {
            return {
                jsState: CodeMirror.startState(jsMode)
            };
        },
        copyState: function (state) {
            return {
                jsState: CodeMirror.copyState(jsMode, state.jsState)
            };
        },
        // Other necessary methods from jsMode (if needed)
    };
});

const AsyncFunction = async function(){}.constructor;
View.Code = class CodeView {
    btnRegen = Elem.byId('function-regen-button');
    btnRun = Elem.byId('function-run-button');
    btnSend = Elem.byId('function-send-button');
    div = document.querySelector('.function-call-panel');
    #divItemList = document.querySelector('.function-call-list');
    iconError = Elem.byId('functionErrorIcon');
    iconLoading = Elem.byId('functionLoadingIcon');
    inputPrompt = Elem.byId('function-prompt');
    isAiProcessing = false;
    mostRecentMsg = '';
    #stored = new Stored('neuriteFunctionCalls');
    svgSend = this.btnSend.querySelector('svg');

    init(){
        this.#btnClear.init();
        On.click(this.btnRun, this.runCode);
        this.cm.init();
        this.#initDivItemList(this.#divItemList);
        this.initForRequestfunctioncall();

        (this.#stored.load() || []).forEach(this.#addItemFromData, this);
    }

    #CM = class {
        mode = "ignoreCodeBlocks"; // Use the custom mode
        lineNumbers = false;
        lineWrapping = true;
        scrollbarStyle = 'simple';
        theme = 'default';
        #userScrolledUp = false;

        constructor(textArea){
            this.cm = CodeMirror.fromTextArea(textArea, this)
        }
        get value(){ return this.cm.getValue() }
        empty(){ this.cm.setValue('') }
        init(){
            const cm = this.cm;
            cm.display.wrapper.classList.add('neurite-function-cm-style');
            cm.on('change', this.#onChange);
            cm.on('scroll', this.#onScroll);
        }
        #onScroll = ()=>{
            const scrollInfo = this.cm.getScrollInfo();
            const top = scrollInfo.height - scrollInfo.top - scrollInfo.clientHeight;
            this.#userScrolledUp = (top >= 1);
        }
        #onChange = ()=>{
            if (this.#userScrolledUp) return;

            // Scroll to the bottom
            this.cm.scrollTo(null, this.cm.getScrollInfo().height);
        }
        updateContent(content){
            this.cm.setValue(content);
            this.cm.refresh();
        }
    }
    cm = new this.#CM(Elem.byId('neurite-function-cm'));

    runCode = ()=>{
        const code = this.cm.value;
        const codeBlocks = CodeView.extractCodeBlocks(code);
        const codeToRun = codeBlocks.length > 0 ? codeBlocks.join('\n') : code;

        this.#forEachItem(this.#removeActiveState);

        const defaultTitle = CodeView.titleForCode(codeToRun);
        this.#customConsole.logs = [defaultTitle];
        this.#runCode(code, codeToRun, defaultTitle);
    }

    #CustomConsole = class {
        logs = [];
        constructor(onCustomLog){
            this.onCustomLog = onCustomLog;
            for (const funcName in console){
                if (!this[funcName]) this[funcName] = console[funcName]
            }
        }
        #renderArg(arg){
            const isErr = arg instanceof Error;
            return (isErr) ? `<span class="error-log">${arg.message}</span>`
                : (typeof arg === 'object') ? JSON.stringify(arg) : String(arg);
        }
        customLog = (...args)=>{
            args.forEach( (arg, index)=>{
                if (index > 0) this.logs.push(' ');
                this.logs.push(this.#renderArg(arg));
            });
            this.onCustomLog();
        }
        log(...args){
            console.log(...args);
            this.customLog(...args);
        }
        error(...args){
            console.error(...args);
            this.customLog(...args);
        }
    }
    #customConsole = new this.#CustomConsole(()=>this.#updateTitleOfItem);

    #itemId = null;
    async #runCode(code, codeToRun, defaultTitle){
        const originalOnError = window.onerror;
        window.onerror = (message, source, lineno, colno, error)=>{
            this.#customConsole.customLog(message, error);
            return false;
        };

        try {
            const customFuncToRun = AsyncFunction('originalConsole', 'customConsole',
                `const console = customConsole;
                ${codeToRun}`);
            const result = await customFuncToRun(console, this.#customConsole);
            this.#addItem(defaultTitle, code);
            if (result !== undefined) {
                this.#customConsole.logs.push(JSON.stringify(result));
            }
        } catch (err) {
            Logger.err('In executing code:', err);
            this.#addItem(err.message, code, true);
        }

        // Cleanup
        window.onerror = originalOnError;
        this.#updateTitleOfItem();
        this.cm.empty();
    }

    #updateTitleOfItem(){ // based on collected logs
        const title = this.#customConsole.logs.join(' \n');
        const item = document.querySelector(`[data-item-id="${this.#itemId}"]`);
        if (!item) return;

        item.innerHTML = title.replace(/\n/g, '<br>');

        // Update callData with the new title
        const callData = JSON.parse(item.dataset.callData);
        callData.functionName = title.replace(/<br>/g, '\n'); // Convert <br> back to \n for the data structure
        item.dataset.callData = JSON.stringify(callData);
        item.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    #addItem(functionName, code, isError = false){
        const currentCoords = neuriteGetMandelbrotCoords(); // Get current coordinates

        const item = Html.make.div('function-call-item');
        if (isError) item.dataset.isError = isError;

        item.dataset.itemId = this.#itemId = generateUUID();

        // Replace newline characters with <br> tags for HTML rendering
        const formattedFunctionName = functionName.replace(/\n/g, '<br>');
        item.innerHTML = formattedFunctionName;
        item.originalText = code;

        // Store code along with the current zoom and pan
        const callData = {
            code,
            zoom: currentCoords.zoom,
            pan: currentCoords.pan,
            functionName,
            isError
        };
        item.dataset.callData = JSON.stringify(callData);

        if (isError) {
            item.classList.add('error-item');

            const errorIcon = Elem.byId('funcErrorIcon').cloneNode(true);
            errorIcon.style.display = 'inline-block';
            errorIcon.classList.add('func-error-icon');

            item.insertBefore(errorIcon, item.firstChild);
        }

        On.mouseenter(item, this.#onItemEntered);
        On.mouseleave(item, this.#onItemLeft);
        On.click(item, this.#onItemClicked);

        this.#divItemList.appendChild(item);
        item.scrollIntoView({ behavior: 'smooth', block: 'end' });

        this.#stored.save(this.#getItems());
    }
    #onItemEntered(e){
        const item = e.currentTarget;
        item.classList.add('hover-state');
        if (item.dataset.isError) item.classList.add('error-hover-state');
    }
    #onItemLeft(e){
        const item = e.currentTarget;
        item.classList.remove('hover-state');
        if (item.dataset.isError) item.classList.remove('error-hover-state');
    }
    #onItemClicked = (e)=>{
        this.#forEachItem(this.#removeActiveState);

        const item = e.currentTarget;
        const classList = item.classList;
        classList.add('active-state');
        if (item.dataset.isError) classList.add('error-active-state');
    }

    #forEachItem(cb, ct){
        this.#divItemList.querySelectorAll('div').forEach(cb, ct)
    }
    #removeActiveState(item){
        item.classList.remove('active-state');
        item.classList.remove('error-active-state');
    }

    static titleForCode(code){
        const blockCommentRegex = /\/\*([\s\S]*?)\*\//;
        const lineCommentRegex = /\/\/(.*)/;

        const blockMatch = code.match(blockCommentRegex);
        const lineMatch = code.match(lineCommentRegex);

        const blockCommentPos = blockMatch ? blockMatch.index : -1;
        const lineCommentPos = lineMatch ? code.indexOf(lineMatch[0]) : -1;

        // Use the comment that appears first in the code
        let title;
        if (blockCommentPos !== -1 && (blockCommentPos < lineCommentPos || lineCommentPos === -1)) {
            title = blockMatch[1].trim();
        } else if (lineCommentPos !== -1) {
            title = lineMatch[1].trim();
        }

        // If no title is extracted, use a default title with timestamp
        return title || ("Code executed at " + new Date().toLocaleString());
    }

    #initDivItemList(div){
        On.click(div, this.#onItemListClicked);
        On.mouseenter(div, this.#onItemListEntered);
        On.mouseleave(div, this.#onItemListLeft);
    }
    #onItemListClicked = (e)=>{
        if (e.target.tagName !== 'DIV') return;

        this.cm.empty();
        if (!e.target.classList.contains('active-state')) return;

        const originalText = e.target.originalText;
        if (originalText) this.cm.updateContent(originalText);
    }
    #onItemListEntered = (e)=>{
        if (e.currentTarget.children.length > 0) this.#btnClear.show()
    }
    #onItemListLeft = (e)=>{
        this.#btnClear.hidePerTarget(e.relatedTarget)
    }

    #ButtonClear = class {
        constructor(btn, onClicked){
            this.btn = btn;
            this.onClicked = onClicked;
        }
        init(){
            const btn = this.btn;
            On.mouseenter(btn, this.#onEntered);
            On.mouseleave(btn, Elem.hide.bind(null, btn));
            On.click(btn, this.#onClicked);
        }
        #onEntered(e){ e.currentTarget.style.display = 'block' }
        #onClicked = (e)=>{
            this.onClicked(e);
            Elem.hide(e.currentTarget);
        }
        hidePerTarget(target){
            if (!this.btn.contains(target)) Elem.hide(this.btn)
        }
        show(){ this.btn.style.display = 'block' }
    }
    #onBtnClearClicked = (e)=>{
        this.#divItemList.innerHTML = '';
        this.#stored.delete();
    }
    #btnClear = new this.#ButtonClear(Elem.byId('clear-function-calls-button'),
                                      this.#onBtnClearClicked);

    #getItems(){
        const items = [];
        const cb = (item)=>items.push(JSON.parse(item.dataset.callData)) ;
        this.#forEachItem(cb);
        return items;
    }
    #addItemFromData(data){
        this.#addItem(data.functionName, data.code, data.isError)
    }

    static extractCodeBlocks(code){
        // Regular expression to match code blocks enclosed in triple backticks, ignoring any language label
        const blockDelimiter = /```.*?\n([\s\S]*?)```/g;
        const matches = code.match(blockDelimiter) || [];
        return matches.map( (block)=>{
            // Extract the content within the backticks, excluding the language label
            const contentMatch = block.match(/```.*?\n([\s\S]*?)```/);
            return contentMatch ? contentMatch[1].trim() : '';
        });
    }
}
