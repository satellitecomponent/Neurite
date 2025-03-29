const Pyodide = new (class {
    prom = null;
    url = "https://cdn.jsdelivr.net/pyodide/v0.23.0/full/pyodide.mjs";
    load(){
        return this.prom = import(this.url).then(this.#onImported, this.#onError)
    }
    #onImported(loader){ return loader.loadPyodide() }
    #onError(err){
        Logger.err("Failed to load pyodide:", err);
        throw(err);
    }
});

class Python {
    static builtinModules = ["base64", "io", "random", "sys"];
    static loadedPackages = {};
    constructor(view){ this.view = view }

    outputHTML = (html)=>{ // JavaScript function to be called from Python
        this.view.appendChild(this.makeDiv(html))
    }
    makeDiv(html){
        const div = Html.new.div();
        div.innerHTML = html || '';
        return div;
    }

    async loadPyodideAndSetup(){
        window.outputHTML = this.outputHTML;

        const pyodide = await Pyodide.load();
        pyodide.runPython(this.codeSetup);

        Logger.info("Pyodide loaded");
        return pyodide;
    }
    codeSetup = `
        import io
        import sys
        from js import window

        class CustomStdout(io.StringIO):
            def __init__(self):
                super().__init__()

            def write(self, string):
                super().write(string)
                output_html(string)

        def output_html(html):
            window.outputHTML(html)

        def customize_stdout():
            __builtins__.old_stdout = sys.stdout
            sys.stdout = custom_stdout
        def restore_stdout():
            sys.stdout = old_stdout

        __builtins__.custom_stdout = CustomStdout()
        __builtins__.customize_stdout = customize_stdout
        __builtins__.restore_stdout = restore_stdout
    `;

    async runCode(code){
        this.view.innerHTML = "Initializing Pyodide and dependencies...";
        const pyodide = await (Pyodide.prom || this.loadPyodideAndSetup());

        try {
            this.view.innerHTML = "";
            const imports = pyodide.runPython(
                'from pyodide.code import find_imports\n' +
                `find_imports('''${code}''')`
            );

            const builtinModules = Python.builtinModules;
            const loadedPackages = Python.loadedPackages;
            for (const module of imports) {
                if (builtinModules.includes(module) ||
                    loadedPackages[module]) continue;

                try {
                    await pyodide.loadPackage(module);
                    loadedPackages[module] = true;
                } catch (err) {
                    Logger.info("Failed to load module:", module);
                }
            }

            pyodide.runPython("customize_stdout()");
            const result = await pyodide.runPythonAsync(code);
            pyodide.runPython("restore_stdout()");

            if (result !== undefined) this.outputHTML(result);
            return result;
        } catch (err) {
            return err.message;
        }
    }
}

function bundleWebContent(nodesInfo) {
    const htmlContent = [];
    const cssContent = [];
    const jsContent = [];

    for (const nodeInfoObj of nodesInfo) {
        Logger.debug(nodeInfoObj);
        const nodeInfo = nodeInfoObj.data;

        if (typeof nodeInfo !== "string") {
            Logger.warn("Data is not a string:", nodeInfo);
            continue;
        }

        const codeBlocks = nodeInfo.matchAll(/```(.*?)\n([\s\S]*?)```/gs);
        for (const block of codeBlocks) {
            const language = block[1].trim();
            const code = block[2];

            switch (language) {
                case 'html':
                case '':
                    htmlContent.push(code);
                    break;
                case 'css':
                    cssContent.push(code);
                    break;
                case 'javascript':
                    jsContent.push(code);
                    break;
                default:
                    Logger.warn("Language", language, "not supported for bundling.");
            }
        }
    }

    return {
        html: htmlContent.join('\n'),
        css: `<style>${cssContent.join('\n')}</style>`,
        js: `<script>${jsContent.join('\n')}</script>`
    };
}

function syncContent(node) {
    const editableDiv = node.contentEditableDiv;
    const hiddenTextarea = node.textarea;

    if (editableDiv && hiddenTextarea) {
        syncHiddenTextareaWithInputTextarea(hiddenTextarea, editableDiv);
    } else {
        Logger.warn("Either editableDiv or hiddenTextarea is missing")
    }
}

globalThis.handleCodeExecution = async function(node){
    // Explicitly sync the content before using it
    syncContent(node);

    const currentState = node.codeEditingState;
    if (currentState === 'edit') {
        // Extract initial dimensions for later restoration
        const computedStyle = window.getComputedStyle(node.view.div);
        const initialWindowWidth = computedStyle.width;
        const initialWindowHeight = computedStyle.height;

        node.textNodeSyntaxWrapper.classList.add('hidden-visibility');

        const { allPythonCode, allWebCode } = collectCodeBlocks(node.textarea.value);

        if (allPythonCode !== '') {
            node.pythonView.classList.remove('hidden');
            const python = new Python(node.pythonView);
            const result = await python.runCode(allPythonCode);
            Logger.info("Python code executed, result:", result);
        }

        if (allWebCode.length > 0) {
            await displayHTMLView(allWebCode, node, initialWindowWidth, initialWindowHeight);
        } else {
            node.htmlView.classList.add('hidden');
        }

        node.codeEditingState = 'code';
    } else {
        resetViewsAndContentEditable(node);
        node.textNodeSyntaxWrapper.classList.remove('hidden-visibility');
        node.codeEditingState = 'edit';
    }
};

function collectCodeBlocks(text) {
    const re = /```(.*?)\n([\s\S]*?)```/gs;
    const codeBlocks = text.matchAll(re);

    let allPythonCode = '';
    const allWebCode = [];

    for (const block of codeBlocks) {
        const language = block[1].trim();
        const code = block[2];

        if (language === 'python') {
            allPythonCode += '\n' + code;
        } else if (['html', 'css', 'javascript', 'js', ''].includes(language)) {
            allWebCode.push({ data: `\`\`\`${language}\n${code}\n\`\`\`` });
        }
    }

    return { allPythonCode, allWebCode };
}

async function displayHTMLView(allWebCode, node, initialWindowWidth, initialWindowHeight) {
    // Hide the syntax display div
    const displayDiv = node.content.querySelector('.syntax-display-div');
    if (displayDiv) {
        displayDiv.style.display = 'none';
        node.displayDiv = displayDiv;
    } else {
        Logger.warn("syntax-display-div not found.");
    }

    // Await the asynchronous connected nodes data
    const allConnectedNodesInfo = await node.getAllConnectedNodesData();
    allConnectedNodesInfo.push(...allWebCode);
    Logger.info("allconnectednodesinfo", allConnectedNodesInfo);

    // Pre-destructure text data:
    const processedNodesInfo = allConnectedNodesInfo.map(nodeInfoObj => {
        let data = nodeInfoObj.data;
        // If data is an object with a nested string, extract that string.
        if (typeof data === "object" && typeof data.data === "string") {
            data = data.data;
        }
        return { ...nodeInfoObj, data };
    });

    // Ensuring iframe is interactable
    const htmlView = node.htmlView;
    htmlView.style.width = initialWindowWidth;
    htmlView.style.height = initialWindowHeight;
    htmlView.classList.remove('hidden');

    // Use srcdoc to inject the content directly
    const bundledContent = bundleWebContent(processedNodesInfo);
    htmlView.srcdoc = `${bundledContent.html}\n\n${bundledContent.css}\n\n${bundledContent.js}`;
    Logger.info("htmlView.srcdoc", htmlView.srcdoc);

    // Ensure the iframe allows interactions
    htmlView.onload = function () {
        const iframeDocument = htmlView.contentDocument || htmlView.contentWindow.document;
        iframeDocument.body.style.pointerEvents = 'auto';
        iframeDocument.body.style.userSelect = 'auto';
        Logger.info("Iframe content loaded and interactable.");
    };
}

function resetViewsAndContentEditable(node) {
    node.htmlView.classList.add('hidden');
    node.pythonView.classList.add('hidden');

    // Show the syntax display div again
    if (node.displayDiv) node.displayDiv.style.display = '';

    // Resetting window dimensions is not required as they are not altered
}
