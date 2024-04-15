let pyodideLoadingPromise = null;
let pyodide = null;
let loadedPackages = {};
let pythonViewMap = new Map();

// List of Python's built-in modules
let builtinModules = ["io", "base64", "sys"];

async function loadPyodideAndSetup() {
    let pyodideLoadPromise = loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.0/full/",
    });
    pyodide = await pyodideLoadPromise;

    // Define the JavaScript function to be called from Python
    function outputHTML(html, identifier) {
        let pythonView = pythonViewMap.get(identifier);
        if (pythonView) {
            let resultDiv = document.createElement("div");
            resultDiv.innerHTML = html || '';
            pythonView.appendChild(resultDiv);
        }
    }
    window.outputHTML = outputHTML;

    pyodide.runPython(`
        import io
        import sys
        from js import window

        class CustomStdout(io.StringIO):
            def __init__(self, identifier):
                super().__init__()
                self.identifier = identifier

            def write(self, string):
                super().write(string)
                output_html(string, self.identifier)

        def output_html(html, identifier):
            window.outputHTML(html, identifier)

        def run_code_and_capture_output(code, identifier):
            old_stdout = sys.stdout
            sys.stdout = CustomStdout(identifier)  # Pass identifier to CustomStdout
            try:
                result = eval(code)
                if result is not None:
                    output_html(str(result), identifier)  # Pass identifier to output_html
            except:
                exec(code)
            finally:
                sys.stdout = old_stdout

        __builtins__.run_code_and_capture_output = run_code_and_capture_output
    `);

    console.log('Pyodide loaded');
}

async function runPythonCode(code, pythonView, uuid) {
    let identifier = uuid; // Retrieve the UUID
    pythonViewMap.set(identifier, pythonView); // Associate the view with the UUID
    
    pythonView.innerHTML = "Initializing Pyodide and dependencies...";

    if (!pyodide) {
        if (!pyodideLoadingPromise) {
            pyodideLoadingPromise = loadPyodideAndSetup();
        }
        await pyodideLoadingPromise;
    }

    try {
        pythonView.innerHTML = "";
        let imports = pyodide.runPython(
            'from pyodide.code import find_imports\n' +
            `find_imports('''${code}''')`
        );

        for (let module of imports) {
            if (!builtinModules.includes(module) && !loadedPackages[module]) {
                try {
                    await pyodide.loadPackage(module);
                    loadedPackages[module] = true;
                } catch (error) {
                    console.log(`Failed to load module: ${module}`);
                }
            }
        }

        // Pass the UUID when calling Python functions
        let result = pyodide.runPython(
            `run_code_and_capture_output('''${code}''', '${identifier}')`
        );

        pythonViewMap.delete(identifier); // Clean up
        return result;
    } catch (error) {
        return error.message;
    } finally {
        currentPythonView = null; // Reset the current Python view
    }
}




function bundleWebContent(nodesInfo) {
    let htmlContent = [];
    let cssContent = [];
    let jsContent = [];

    for (let nodeInfoObj of nodesInfo) {
        //console.log(nodeInfoObj); // Log the entire object here
        let nodeInfo = nodeInfoObj.data;

        if (typeof nodeInfo !== "string") {
            console.warn('Data is not a string:', nodeInfo);
            continue;
        }

        let splitContent = nodeInfo.split("Text Content:", 2);

        if (splitContent.length < 2) {
            console.warn('No content found for node');
            continue;
        }

        let content = splitContent[1].trim();
        let codeBlocks = content.matchAll(/```(.*?)\n([\s\S]*?)```/gs);

        for (let block of codeBlocks) {
            let language = block[1].trim();
            let code = block[2];

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
                    console.warn(`Language ${language} not supported for bundling.`);
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
    const editableDiv = node.content.querySelector('div[contenteditable]');
    const hiddenTextarea = node.content.querySelector('textarea.custom-scrollbar');

    if (editableDiv && hiddenTextarea) {
        syncTextareaWithContentEditable(hiddenTextarea, editableDiv);
    } else {
        console.warn('Either editableDiv or hiddenTextarea is missing');
    }
}

async function handleCodeExecution(textarea, htmlView, pythonView, node) {
    const currentState = node.codeEditingState;

    // Explicitly sync the content before using it
    syncContent(node);
    const contentEditableDiv = node.contentEditableDiv;
    const windowDiv = node.windowDiv;

    if (currentState === 'edit') {
        // Extract initial dimensions for later restoration
        const computedStyle = window.getComputedStyle(windowDiv);
        const initialWindowWidth = computedStyle.width;
        const initialWindowHeight = computedStyle.height;

        contentEditableDiv.classList.add('hidden-visibility');

        let { allPythonCode, allWebCode } = collectCodeBlocks(textarea);

        if (allPythonCode !== '') {
            pythonView.classList.remove('hidden');
            let result = await runPythonCode(allPythonCode, pythonView, node.uuid);
            console.log('Python code executed, result:', result);
        }

        if (allWebCode.length > 0) {
            displayHTMLView(allWebCode, htmlView, node, initialWindowWidth, initialWindowHeight);
        } else {
            htmlView.classList.add('hidden');
        }

        node.codeEditingState = 'code';
    } else {
        resetViewsAndContentEditable(node, htmlView, pythonView);
        contentEditableDiv.classList.remove('hidden-visibility');
        node.codeEditingState = 'edit';
    }
}

function collectCodeBlocks(textarea) {
    let re = /```(.*?)\n([\s\S]*?)```/gs;
    let codeBlocks = textarea.value.matchAll(re);

    let allPythonCode = '';
    let allWebCode = [];

    for (let block of codeBlocks) {
        let language = block[1].trim();
        let code = block[2];

        if (language === 'python') {
            allPythonCode += '\n' + code;
        } else if (['html', 'css', 'javascript', 'js', ''].includes(language)) {
            allWebCode.push({ data: `Text Content: \n\`\`\`${language}\n${code}\n\`\`\`` });
        }
    }

    return { allPythonCode, allWebCode };
}

function displayHTMLView(allWebCode, htmlView, node, initialWindowWidth, initialWindowHeight) {
    let allConnectedNodesInfo = getAllConnectedNodesData(node);
    allConnectedNodesInfo.push(...allWebCode);
    console.log(`allconnectednodesinfo`, allConnectedNodesInfo)
    let bundledContent = bundleWebContent(allConnectedNodesInfo);

    htmlView.style.width = initialWindowWidth;
    htmlView.style.height = initialWindowHeight;
    htmlView.classList.remove('hidden');
    htmlView.srcdoc = `${bundledContent.html}\n${bundledContent.css}\n${bundledContent.js}`;
}

function resetViewsAndContentEditable(node, htmlView, pythonView) {
    const windowDiv = node.windowDiv;
    htmlView.classList.add('hidden');
    pythonView.classList.add('hidden');

    // Resetting window dimensions is not required as they are not altered
}