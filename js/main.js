
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
            'js/interface/dropdown/neuritepanel.js',
            'js/interface/dropdown/signin.js',
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
        } catch (error) {
            console.error(`Error loading resource ${templateName}:`, error);
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

// Function to load content into a tab
async function loadTabContent(tabId, fileName) {
    try {
        const response = await fetch(`/resources/html/tabs/${fileName}`);
        if (!response.ok) {
            throw new Error(`Failed to load ${fileName}: ${response.statusText}`);
        }
        const content = await response.text();
        document.getElementById(tabId).innerHTML = content;
    } catch (error) {
        console.error(`Error loading tab content from ${fileName}:`, error);
    }
}

async function loadFunctionPanel() {
    try {
        const response = await fetch('/resources/html/tabs/functioncallingpanel.html');
        if (!response.ok) {
            throw new Error(`Failed to load functionpanel.html: ${response.statusText}`);
        }
        const content = await response.text();
        document.getElementById('left-panel').innerHTML = content;
    } catch (error) {
        console.error('Error loading function panel:', error);
    }
}

// Function to load all tabs
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