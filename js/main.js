class Elem {
    static byId = document.getElementById.bind(document);
    static hideById(id){
        const elem = Elem.byId(id);
        if (elem) elem.style.display = 'none';
    }
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
    static stopPropagationOfEvent(e){ e.stopPropagation() }
}

Function.nop = function(){}
Object.hasIdThis = function(obj){ return obj.id === this.valueOf() }
Logger = class {
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
}
Logger = new Logger()
    .addLevel("ERR:", 'error', 'err')
    .addLevel("WARN:", 'warn')
    .addLevel("INFO:", 'info')
    .addLevel("DEBUG:", 'log', 'debug');
Logger.levelId = 'info';

Request.send = async function(ct){
    try {
        const resp = await fetch(ct.url, ct.options);
        if (!resp.ok) throw new Error("Response status: " + resp.statusText);

        if (ct.onSuccess) Logger.info(ct.onSuccess());
        return resp;
    } catch (err) {
        if (ct.onFailure) Logger.err(ct.onFailure(), err);
    }
}

class PageLoad {
    constructor() {
        // Store resource file paths as class properties
        this.resources = [
            'svg/icons',
            'html/viewmatrix',
            'html/nodes',
            'html/modals',
            'html/tabs/dropdown'

        ];

        // Store script file paths as class properties
        this.scripts = [
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
            'js/interface/dropdown/customui/loadingicon.js',
            'js/interface/dropdown/tabs/notestab.js',
            'js/interface/dropdown/tabs/aitab.js',
            'js/interface/dropdown/tabs/datatab.js',
            'js/interface/dropdown/tabs/edittab.js',
            'js/interface/dropdown/dropdown.js',
            'js/mandelbrot/mandelbrot.js',
            'js/mandelbrot/updatefractal.js',
            'js/interface/interface.js',
            'js/interface/handledrop.js',
            'js/interface/dropdown/customui/record/record.js',
            'js/interface/dropdown/customui/rightclick/customcontextmenu.js',
            'js/interface/dropdown/customui/rightclick/suggestions.js',
            'js/nodes/nodeutilities.js',
            'js/nodes/nodeinteraction/nodemode.js',
            'js/nodes/nodeinteraction/movenodes.js',
            'js/nodes/nodeinteraction/nodeactioninterface.js',
            'js/nodes/nodeinteraction/connect.js',
            'js/nodes/nodeinteraction/togglenodestate.js',
            'js/nodes/nodeinteraction/filternodes.js',
            'js/nodes/nodeinteraction/bundlecode.js',
            'js/nodes/nodeinteraction/modalconnect.js',
            'js/nodes/nodeinteraction/nodesensor.js',
            'js/nodes/createnodes/window.js',
            'js/nodes/createnodes/createnodes.js',
            'js/nodes/nodeclass.js',
            'js/nodes/edgeclass.js',
            'js/nodes/nodeinteraction/nodestep.js',
            'js/nodes/nodetypes/filetreenodes/filetreenode.js',
            'js/nodes/nodetypes/textnodes/contenteditable.js',
            'js/nodes/nodetypes/textnodes/textnode.js',
            'js/nodes/nodetypes/linknodes/linknode.js',
            'js/nodes/nodetypes/linknodes/importlink.js',
            'js/nodes/nodetypes/imagenodes/imagenode.js',
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
            'js/ai/vision.js',
            'js/ai/ollama/ollama.js',
            'js/ai/ollama/ollama-api.js',
            'js/ai/ai-utility/handleapikeys.js',
            'js/ai/ai-utility/dummyai.js',
            'js/ai/automata.js',
            'js/ai/network.js',
            'js/interface/searchapi/search.js',
            'js/interface/searchapi/searchapi.js',
            'js/interface/searchapi/wikipedia.js',
            'js/interface/searchapi/embeddingsdb.js',
            'js/interface/searchapi/codeparser/parsemirror.js',
            'js/interface/searchapi/codeparser/gitparsed.js',
            'js/interface/searchapi/wolframapi.js',
            'js/interface/neuralapi.js',
            'js/interface/functioncall/functioncallingpanel.js',
            'js/interface/functioncall/neuraltelemetryprompt.js',
            'js/interface/functioncall/requestfunctioncall.js',
            'js/interface/dropdown/savenet.js'
        ];
    }

    // Method to load HTML templates dynamically and append to body
    async loadResources(templateName) {
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

    // Load all HTML resources sequentially from the stored resource list
    async loadAllResources() {
        for (const resource of this.resources) {
            await this.loadResources(resource);
        }
    }

    async collectHtml() {
        await loadAllTabs();
    }

    // Dynamically load a script and return a promise
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.body.appendChild(script);
        });
    }

    // Load all scripts sequentially from the stored script list
    async loadAllScripts() {
        for (const src of this.scripts) {
            await this.loadScript(src);
        }
    }

    // Main function to load resources and scripts
    async load() {
        await this.loadAllResources();  // Load all HTML and SVG resources first
        await this.collectHtml();
        await this.loadAllScripts();    // Load all scripts after resources are ready
    }
}

// Create an instance of PageLoader and load resources and scripts
const pageLoader = new PageLoad();
pageLoader.load();

async function loadTabContent(tabId, fileName) {
    const response = await Request.send(new loadTabContent.ct(fileName));
    if (!response) return;

    const content = await response.text();
    Elem.byId(tabId).innerHTML = content;
}
loadTabContent.ct = class {
    constructor(fileName){
        this.url = '/resources/html/tabs/' + fileName;
        this.fileName = fileName;
    }
    onFailure(){ return `Failed to load tab content from ${this.fileName}:` }
}

async function loadFunctionPanel(){
    const response = await Request.send(new loadFunctionPanel.ct());
    if (!response) return;

    const content = await response.text();
    Elem.byId('left-panel').innerHTML = content;
}
loadFunctionPanel.ct = class {
    constructor(){
        this.url = '/resources/html/tabs/functioncallingpanel.html';
    }
    onFailure(){ return "Failed to load function panel:" }
}

async function loadAllTabs() {
    await Promise.all([
        loadFunctionPanel(),
        loadTabContent('tab1', 'notestab.html'),
        loadTabContent('tab4', 'aitab.html'),
        loadTabContent('tab2', 'fractaltab.html'),
        loadTabContent('tab6', 'networkstab.html'),
        loadTabContent('tab3', 'helptab.html'),
    ]);
}
