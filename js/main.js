class Elem {
    static byId = document.getElementById.bind(document);
    static deepClone(elem){ return elem.cloneNode(true) }
    static displayBlock(elem){ if (elem) elem.style.display = 'block' }
    static findChild(elem, cb, ct){
        return Array.prototype.find.call(elem.children, cb, ct)
    }
    static forEachChild(elem, cb, ct){
        return Array.prototype.forEach.call(elem.children, cb, ct)
    }
    static hasDatasetIdThis(elem){
        return elem.dataset.id === this.valueOf()
    }
    static hasTextContentThis(elem){
        return elem.textContent === this.valueOf()
    }
    static hide(elem){ if (elem) elem.style.display = 'none' }
    static hideById(id){ Elem.hide(Elem.byId(id)) }
    static remove(elem){ elem.remove() }
    static setBackgroundColor(color){
        this.style.backgroundColor = color
    }
    static setBackgroundColorPerIsActive(colorActive, colorInactive){
        this.style.backgroundColor = (this.isActive ? colorActive : colorInactive)
    }
    static setBothColors(foreColor, backgroundColor){
        this.style.backgroundColor = backgroundColor;
        this.style.color = foreColor;
    }
}

Function.nop = function(){}
Object.forEach = function forEachValue(obj, cb, ct){
    for (const k in obj) cb.call(ct, obj[k])
}
Object.hasIdThis = function(obj){ return obj.id === this.valueOf() }
Object.hasNameThis = function(obj){ return obj.name === this.valueOf() }
Object.hasTitleThis = function(obj){ return obj.title === this.valueOf() }
Object.isntThis = function(obj){ return obj !== this.valueOf() }
Object.isThis = function(obj){ return obj === this.valueOf() }

globalThis.Logger = new (class {
    addLevel(prefix, funcName, id = funcName){
        const func = console[funcName].bind(console, prefix);
        this.#levels.push({ func, id });
        return this;
    }
    get level(){ return this.#level }
    set level(newLevel){
        const len = this.#levels.length;
        this.#level = Math.min(Math.max(-len, newLevel), len);
        this.#levels.forEach(this.#setFuncPerLevel, this);
        return this.#level;
    }
    get levelId(){ return this.#levels[this.#level - 1]?.id }
    set levelId(id){
        this.level = this.#levels.findIndex(Object.hasIdThis, id) + 1
    }
    on(){ return this.#switch(1) }
    off(){ return this.#switch(-1) }

    #levels = [];
    #level = 0;
    #setFuncPerLevel(level, index){
        this[level.id] = (index < this.#level ? level.func : Function.nop)
    }
    #switch(factor, dflt = 3){
        return this.level = factor * Math.abs(this.#level || dflt)
    }
});
Logger
    .addLevel("ERR:", 'error', 'err')
    .addLevel("WARN:", 'warn')
    .addLevel("INFO:", 'info')
    .addLevel("DEBUG:", 'log', 'debug');
Logger.levelId = 'info';

const Manager = {};

class Off {
    static thisEvent(target, cb, options){
        target.removeEventListener(this, cb, options)
    }
}
class On {
    static thisEvent(target, cb, options){
        target.addEventListener(this, cb, options)
    }
}
[
    'blur', 'change', 'click', 'contextmenu', 'dblclick',
    'drag', 'dragend', 'dragenter', 'dragleave', 'dragover', 'dragstart', 'drop',
    'error', 'focus', 'gesturechange', 'gestureend', 'gesturestart',
    'input', 'keydown', 'keypress', 'keyup', 'load', 'loadedmetadata',
    'message', 'mousedown', 'mouseenter', 'mouseleave',
    'mousemove', 'mouseout', 'mouseover', 'mouseup',
    'paste', 'resize', 'scroll',
    'touchcancel', 'touchend', 'touchmove', 'touchstart', 'transitionend',
    'visibilitychange', 'wheel'
].forEach( (eName)=>{
    On[eName] = On.thisEvent.bind(eName);
    Off[eName] = Off.thisEvent.bind(eName);
});

Request.makeJsonOptions = function(method, body){
    return {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }
}
Request.send = async function(ct){
    try {
        const resp = await fetch(ct.url, ct.options);
        if (!resp.ok) throw new Error("Response status: " + resp.statusText);

        if (ct.onSuccess) Logger.info(ct.onSuccess());
        return (ct.onResponse ? ct.onResponse(resp) : resp);
    } catch (err) {
        if (ct.onFailure) Logger.err(ct.onFailure(), err);
    }
}

const View = {};

class App {
    NEWLINE_PLACEHOLDER = "__NEWLINEplh__";

    cellularAutomata = new Manager.CellularAutomata();
    interface = new Interface();
    menuContext = new Menu.Context();
    menuSuggestions = new Menu.Suggestions();
    nodeSimulation = new NodeSimulation();
    pinnedItems = new Manager.PinnedItems('pinnedContextMenuItems');
    processedNodes = new ProcessedNodes();
    recentSuggestions = new Manager.RecentSuggestions('nodeMethodCalls');
    selectedNodes = new SelectedNodes();
    tabAi = new AiTab();
    tabEdit = new EditTab();
    telemetry = new NeuralTelemetry();
    viewCode = new View.Code();
    viewGraphs = new View.Graphs();
    zetPanes = new ZetPanes(Elem.byId('zetPaneContainer'));

    init(){
        Host.checkServer();
        Tag.init();
        Body.addEventListeners(document.body);
        Fractal.initializeSelect();
        this.nodeSimulation.start();
        Ai.init();
        Embeddings.init();
        Recorder.init();
        this.interface.init();
        this.tabEdit.init(settings);
        this.viewCode.init();
        this.viewGraphs.init();
        this.zetPanes.init();
        ZetPath.init();
        loadControls();
        updateSettingsFromControls();
        updateSavedViewsCache();
        displaySavedCoordinates();
        this.signalReady();
    }
    signalReady() {
        window.appReady = true; 
        if (window.startedViaElectron) {
            window.electronAPI?.sendReady?.();
        }
    }
    get nodeMode(){ return this.interface.nodeMode.val }
}

class PageLoad {
    static resources = [
        'svg/icons',
        'html/viewmatrix',
        'html/nodes',
        'html/modals',
        'html/tabs/dropdown'
    ];
    static scripts = [
        'js/globals.js',
        'js/interface/filetree.js',
        'js/zettelkasten/zetsyntax.js',
        'js/zettelkasten/zetcodemirror.js',
        'js/zettelkasten/zetplacementstrategy.js',
        'js/zettelkasten/zettelkasten.js',
        'js/zettelkasten/zetpath.js',
        'js/zettelkasten/zetsplitter.js',
        'js/interface/dropdown/customui/customdropdown.js',
        'js/interface/dropdown/customui/customcontrols.js',
        'js/interface/dropdown/customui/togglepanel.js',
        'js/interface/dropdown/customui/custommodal.js',
        'js/interface/dropdown/customui/displaysavedcoords.js',
        'js/interface/dropdown/customui/customsliders.js',
        'js/interface/dropdown/customui/customtooltip.js',
        'js/interface/dropdown/customui/customdialog.js',
        'js/interface/dropdown/customui/loadingicon.js',
        'js/interface/dropdown/tabs/notestab.js',
        'js/interface/dropdown/tabs/aitab.js',
        'js/interface/dropdown/tabs/datatab.js',
        'js/interface/dropdown/tabs/edittab.js',
        'js/interface/dropdown/dropdown.js',
        'js/interface/dropdown/neuritepanel.js',
        'js/interface/dropdown/signin.js',
        'js/mandelbrot/mandelbrot.js',
        'js/mandelbrot/updatefractal.js',
        'js/interface/interface.js',
        'js/interface/handledrop.js',
        'js/interface/dropdown/customui/record/record.js',
        'js/interface/dropdown/customui/rightclick/customcontextmenu.js',
        'js/interface/dropdown/customui/rightclick/suggestions.js',
        'js/nodes/nodeclass.js',
        'js/nodes/edgeclass.js',
        'js/nodes/nodeutilities.js',
        'js/nodes/createnodes/window.js',
        'js/nodes/createnodes/createnodes.js',
        'js/nodes/nodeinteraction/nodemode.js',
        'js/nodes/nodeinteraction/movenodes.js',
        'js/nodes/nodeinteraction/nodeactioninterface.js',
        'js/nodes/nodeinteraction/connect.js',
        'js/nodes/nodeinteraction/togglenodestate.js',
        'js/nodes/nodeinteraction/filternodes.js',
        'js/nodes/nodeinteraction/bundlecode.js:MODULE',
        'js/nodes/nodeinteraction/modalconnect.js',
        'js/nodes/nodeinteraction/nodesensor.js',
        'js/nodes/nodeinteraction/nodestep.js',
        'js/nodes/nodetypes/filetreenodes/filetreenode.js',
        'js/nodes/nodetypes/textnodes/contenteditable.js',
        'js/nodes/nodetypes/textnodes/textnode.js',
        'js/nodes/nodetypes/linknodes/linknode.js',
        'js/nodes/nodetypes/linknodes/importlink.js',
        'js/nodes/nodetypes/imagenodes/imagenode.js:MODULE',
        'js/nodes/nodetypes/medianodes/medianode.js',
        'js/nodes/nodetypes/wolframnodes/wolframnode.js',
        'js/ai/prompts.js',
        'js/nodes/nodetypes/ainodes/responsehandler.js',
        'js/nodes/nodetypes/ainodes/ainode.js',
        'js/nodes/nodetypes/ainodes/promptlibrary.js',
        'js/nodes/nodetypes/ainodes/ainodemessage.js',
        'js/ai/ai_v2.js',
        'js/ai/aimessage.js',
        'js/ai/ai-utility/aihelpers.js',
        'js/ai/ollama/ollama.js',
        'js/ai/ollama/ollama-api.js',
        'js/ai/ai-utility/handleapikeys.js',
        'js/ai/ai-utility/dummyai.js',
        'js/ai/automata.js',
        'js/ai/network.js',
        'js/interface/searchapi/embeddingsdb.js',
        'js/interface/searchapi/search.js',
        'js/interface/searchapi/searchapi.js',
        'js/interface/searchapi/wikipedia.js',
        'js/interface/searchapi/codeparser/parsemirror.js',
        'js/interface/searchapi/codeparser/gitparsed.js',
        'js/interface/searchapi/wolframapi.js',
        'js/interface/neuralapi.js',
        'js/interface/functioncall/functioncallingpanel.js',
        'js/interface/functioncall/neuraltelemetryprompt.js',
        'js/interface/functioncall/requestfunctioncall.js',
        'js/ai/vision.js',
        'js/interface/dropdown/savenet.js:MODULE'
    ];

    async loadResource(templateName){ // dynamically and append to body
        try {
            const response = await fetch(`/resources/${templateName}.html`);
            if (!response.ok) {
                throw new Error(`Failed to load ${templateName}: ${response.statusText}`);
            }
            const templateContent = await response.text();
            document.body.insertAdjacentHTML('beforeend', templateContent); // Append directly to body
        } catch (err) {
            Logger.err(`Error loading resource ${templateName}:`, err);
        }
    }

    loadScript(src){ // dynamically
        return new Promise( (resolve, reject)=>{
            const script = document.createElement('script');
            if (src.endsWith(':MODULE')) {
                src = src.slice(0, -7);
                script.type = 'module';
            }
            script.src = src;
            script.onload = resolve;
            script.onerror = ()=>{ reject(new Error("Failed to load script: " + src)) };
            document.body.appendChild(script);
        })
    }

    async mainLoad(){
        for (const resource of PageLoad.resources) await this.loadResource(resource); // sequentially
        await this.loadTabs(PageLoad.tabs); // in parallel
        for (const src of PageLoad.scripts) await this.loadScript(src); // sequentially
        Graph = new Graph();
        App = new App();
        App.init();
    }

    async loadTab(tabId, fileName){
        await Request.send(new PageLoad.tabContentLoader(tabId, fileName))
    }
    static tabContentLoader = class {
        constructor(tabId, fileName){
            this.url = '/resources/html/tabs/' + fileName;
            this.elem = Elem.byId(tabId);
            this.fileName = fileName;
        }
        onResponse(res){ res.text().then(this.onContent) }
        onContent = (content)=>{ this.elem.innerHTML = content }
        onFailure(){ return `Failed to load content from ${this.fileName}:` }
    }
    loadTabs(tabs){
        const proms = [];
        for (const tabId in tabs) proms.push(this.loadTab(tabId, tabs[tabId]));
        return Promise.all(proms);
    }
    static tabs = {
        'left-panel': 'functioncallingpanel.html',
        'tab1': 'notestab.html',
        'tab4': 'aitab.html',
        'tab2': 'fractaltab.html',
        'tab6': 'networkstab.html',
        'tab3': 'helptab.html'
    }
}

const pageLoader = new PageLoad();
pageLoader.mainLoad();
