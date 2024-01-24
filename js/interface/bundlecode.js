

let pyodideLoadingPromise = null;
let pyodide = null;
let loadedPackages = {};

// List of Python's built-in modules
let builtinModules = [
    "io",
    "base64",
    // Add more built-in modules here as needed
];

async function loadPyodideAndSetup(pythonView) {
    let pyodideLoadPromise = loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.0/full/",
    });
    pyodide = await pyodideLoadPromise;

    // Define the JavaScript function to be called from Python
    function outputHTML(html) {
        let resultDiv = document.createElement("div");
        resultDiv.innerHTML = html || '';
        pythonView.appendChild(resultDiv);
    }
    window.outputHTML = outputHTML;

    // Add the output_html function to Python builtins
    pyodide.runPython(`
        from js import window

        def output_html(html):
            window.outputHTML(html)

        __builtins__.output_html = output_html
    `);

    console.log('Pyodide loaded');
}

async function runPythonCode(code, pythonView) {
    pythonView.innerHTML = "Initializing Pyodide and dependencies...";

    if (!pyodide) {
        if (!pyodideLoadingPromise) {
            pyodideLoadingPromise = loadPyodideAndSetup(pythonView);
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

        let result = pyodide.runPython(code);

        return result;
    } catch (error) {
        return error.message;
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
        hiddenTextarea.value = editableDiv.innerText;
    } else {
        console.warn('Either editableDiv or hiddenTextarea is missing');
    }
}

async function handleCodeButton(button, textarea, node) {
    button.onclick = async function () {
        // Explicitly sync the content before using it
        syncContent(node);

        if (button.innerHTML === 'Run Code') {
            node.contentEditableDiv.style.display = "none";

            let re = /```(.*?)\n([\s\S]*?)```/gs;
            let codeBlocks = textarea.value.matchAll(re);

            let allPythonCode = '';
            let allWebCode = [];

            for (let block of codeBlocks) {
                let language = block[1].trim();
                let code = block[2];

                if (language === 'python') {
                    allPythonCode += '\n' + code;
                } else if (language === 'html' || language === 'css' || language === 'javascript' || language === '') {
                    allWebCode.push({ data: `Text Content: \n\`\`\`${language}\n${code}\n\`\`\`` });
                }
            }

            if (allPythonCode !== '') {
                if (!textarea.pythonView) {
                    textarea.pythonView = document.createElement("div");
                    textarea.parentNode.insertBefore(textarea.pythonView, textarea.nextSibling);
                }
                textarea.pythonView.style.display = "block";
                console.log('Running Python code...');
                let result = await runPythonCode(allPythonCode, textarea.pythonView);
                console.log('Python code executed, result:', result);
            }

            let allConnectedNodesInfo = getAllConnectedNodesData(node);
            allConnectedNodesInfo.push(...allWebCode);
            let bundledContent = bundleWebContent(allConnectedNodesInfo);

            if (textarea.htmlView) {
                textarea.htmlView.remove();
            }

            textarea.htmlView = document.createElement("iframe");
            textarea.htmlView.style.border = "none";
            textarea.htmlView.style.boxSizing = "border-box";
            textarea.htmlView.style.width = "100%";
            textarea.htmlView.style.height = "100%";

            textarea.htmlView.onmousedown = function (event) {
                event.stopPropagation();
            };

            textarea.parentNode.insertBefore(textarea.htmlView, textarea.nextSibling);

            textarea.htmlView.srcdoc = `${bundledContent.html}\n${bundledContent.css}\n${bundledContent.js}`;

            let windowDiv = textarea.htmlView.parentNode;
            while (windowDiv && (!windowDiv.win || !windowDiv.classList.contains('window'))) {
                windowDiv = windowDiv.parentNode;
            }
            if (windowDiv) {
                observeParentResize(windowDiv, textarea.htmlView);
            }


            button.innerHTML = 'Code Text';
            button.style.backgroundColor = '#717171';
        } else {
            node.contentEditableDiv.style.display = "block";
            if (textarea.htmlView) {
                textarea.htmlView.style.display = "none";
                textarea.htmlView.srcdoc = "";
            }
            if (textarea.pythonView) {
                textarea.pythonView.style.display = "none";
                textarea.pythonView.innerHTML = "";
            }
            button.innerHTML = 'Run Code';
            button.style.backgroundColor = '';
        }
    };
}