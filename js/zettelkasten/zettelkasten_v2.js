
var myCodeMirror;
let llmNodeCreated = false;
const noteInput = myCodeMirror;
let nodefromWindow = false;
let followMouseFromWindow = false;
let shouldAddCodeButton = false;


{

    const nodes = {};
    const nodeLines = {};
    const draggableWindows = document.querySelectorAll('.window');

    draggableWindows.forEach((draggableWindow) => {
        draggableWindow.addEventListener('mousedown', (event) => {
            draggableWindows.forEach((otherWindow) => {
                if (otherWindow !== draggableWindow) {
                    otherWindow.classList.add('disable-pointer-events');
                }
            });
        });

        draggableWindow.addEventListener('mouseup', (event) => {
            draggableWindows.forEach((otherWindow) => {
                if (otherWindow !== draggableWindow) {
                    otherWindow.classList.remove('disable-pointer-events');
                }
            });
        });
    });

    function nodeRE(name = undefined, tag_prefix = undefined) {
        if (tag_prefix === undefined) {
            tag_prefix = nodeTag;
        }
        if (name === undefined) {
            return new RegExp("(\\n|^)" + RegExp.escape(tag_prefix));
        }
        return new RegExp("(\\n|^)" + RegExp.escape(tag_prefix) + "[\t ]*" + RegExp.escape(name) + "[\t ]*(\n|$)");
    }

    function replaceInBrackets(s, from, to) {
        const open = '[';
        const close = ']';

        let index = s.indexOf(open);
        while (index !== -1) {
            const closeIndex = s.indexOf(close, index);
            if (closeIndex !== -1) {
                const insideBrackets = s.substring(index + 1, closeIndex).trim();
                if (insideBrackets === from.trim()) {
                    s = s.substring(0, index + 1) + to + s.substring(closeIndex);
                }
            }
            index = s.indexOf(open, index + 1);
        }
        return s;
    }

    function renameNode(from, to) {
        //(\n|^)(((#node:)[\t ]*from[\t ]*)|((#ref:)([^,\n]+,)*[\t ]*from[\t ]*(,[^,\n]+)*))(?=(\n|$))
        //$1$4$6$7 to$8$9
        const fe = RegExp.escape(from);
        const nodeRE = "(" + RegExp.escape(nodeTag) + ")[\\t ]*" + fe + "[\\t ]*";
        const refRE = "(" + RegExp.escape(refTag) + ")([^,\\n]+,)*[\\t ]*" + fe + "[\\t ]*(,[^,\\n]+)*";
        const tag = "((" + nodeRE + ")|(" + refRE + "))";
        const re = new RegExp("(\n|^)" + tag + "(?=(\n|$))", "g");
        const replacer = (match, p1, p2, p3, p4, p5, p6, p7, p8, p9, offset, string, groups) => {
            return p1 + (p4 ? p4 + " " : "") + (p6 ? p6 + " " : "") + (p7 || "") + to + (p8 || "");
        }
        return (s) => replaceInBrackets(s.replace(re, replacer), from, to);
    }

    function addNodeTagToZettelkasten(title, content = null) {
        const nodeTagLine = nodeTag + ' ' + title;
        let currentZettelkastenValue = noteInput.getValue();

        // Check if the content ends with a newline and add one or two newlines accordingly
        if (currentZettelkastenValue.endsWith('\n')) {
            currentZettelkastenValue += '\n' + nodeTagLine;
        } else {
            currentZettelkastenValue += '\n\n' + nodeTagLine;
        }

        // Add content if given
        if (content) {
            currentZettelkastenValue += '\n' + content;
        }

        noteInput.setValue(currentZettelkastenValue); // Assuming noteInput is the object to manipulate zettelkasten
        noteInput.refresh();
    }

    function initializeNodes(nodes) {
        for (const key in nodes) {
            if (nodes[key].nodeObject.removed) {
                delete nodes[key];
            } else {
                nodes[key].plainText = '';
                nodes[key].ref = '';
                nodes[key].live = false;
            }
        }
    }



    class ZettelkastenProcessor {
        constructor() {
            noteInput.on('change', this.processInput.bind(this));
            nodeTagInput.addEventListener('input', this.processInput.bind(this));
            refTagInput.addEventListener('input', this.processInput.bind(this));
        }


        //Main if else loop
        processInput() {

            initializeNodes(nodes);

            const lines = noteInput.getValue().split('\n');
            let currentNodeTitle = '';
            let processingNode = false; // New flag to check if we're inside a node block

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                if (line.startsWith(nodeTag)) {
                    processingNode = true;
                    currentNodeTitle = this.handleNode(line, i, nodeLines, nodes, currentNodeTitle);
                } else if (line.startsWith("LLM:")) {
                    currentNodeTitle = this.handleLLM(line, i, nodeLines, nodes, currentNodeTitle, addLLMNodeInputListener);
                } else if (nodes[currentNodeTitle] && nodes[currentNodeTitle].isLLM) {
                    currentNodeTitle = this.handleLLMPromptLine(line, nodeTag, refTag, currentNodeTitle, nodes);
                } else if (line.includes(refTag)) {
                    let processingNode = false;
                    this.handleReferenceLine(line, currentNodeTitle, nodes);
                } else if (processingNode && currentNodeTitle !== '') {
                    this.handleTextWithoutTags(line, currentNodeTitle, nodes);
                }
            }

            this.deleteInactiveNodes(nodes);
            this.deleteInactiveNodeLines(nodeLines);
        }


        //Creates nodes either from the Zettelkasten or the window.
        handleNode(line, i, nodeLines, nodes, currentNodeTitle) {
            currentNodeTitle = line.substr(nodeTag.length).trim();
            if (!nodes[currentNodeTitle] || nodes[currentNodeTitle].nodeObject.removed) {
                if (nodeLines[i] && !nodeLines[i].nodeObject.removed) {
                    const node = nodes[currentNodeTitle] = nodeLines[i];
                    if (nodes[node.title] === node) {
                        delete nodes[node.title];
                    }
                    node.title = currentNodeTitle;
                    node.live = true;
                    node.nodeObject.content.children[0].children[0].children[1].value = currentNodeTitle;
                } else {
                    let nodeObject;
                    if (nodefromWindow) { //flag set in createnodefromwindow in createnodes.js
                        nodeObject = createTextNode(currentNodeTitle, '', undefined, undefined, undefined, undefined, shouldAddCodeButton);
                        shouldAddCodeButton = false;
                        nodefromWindow = false; // Reset the flag
                        if (followMouseFromWindow) { //flag set in createnodefromwindow in createnodes.js
                            nodeObject.followingMouse = 1;
                            followMouseFromWindow = false; // Reset this flag as well
                        }
                    } else {
                        nodeObject = createTextNode(currentNodeTitle, '', (Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8);
                    }

                    const node = nodeLines[i] = nodes[currentNodeTitle] = {
                        title: currentNodeTitle,
                        plainText: '',
                        ref: '',
                        live: true,
                        nodeObject: nodeObject,
                        edges: new Map(),
                        lineNum: i,
                    };

                    //Event Listeners to handle sync between Node textarea and Codemirror.
                    //Handles sync between changes to each node title input and the Zettelkasten
                    const titleInputEventHandler = this.createTitleInputEventHandler(nodeLines[i], nodes, noteInput, nodeLines);
                    node.nodeObject.content.children[0].children[0].children[1].addEventListener('input', titleInputEventHandler);

                    // Handles sync between inputs to each node textarea and the Zettelkasten
                    const bodyHandler = this.getHandleNodeBodyInputEvent(node);
                    node.nodeObject.content.children[0].children[1].children[0].addEventListener('input', bodyHandler);
                }
            } else {
                nodes[currentNodeTitle].plainText = "";
                nodes[currentNodeTitle].nodeObject.content.children[0].children[1].children[0].value = nodes[currentNodeTitle].plainText;
                if (nodeLines[nodes[currentNodeTitle].lineNum] === nodes[currentNodeTitle]) {
                    delete nodeLines[nodes[currentNodeTitle].lineNum];
                }
                nodes[currentNodeTitle].live = true;
                nodes[currentNodeTitle].lineNum = i;
                nodeLines[i] = nodes[currentNodeTitle];
            }
            return currentNodeTitle;
        }

        //Syncs node titles and Zettelkasten
        createTitleInputEventHandler(node, nodes, noteInput, nodeLines) {
            return (e) => {
                const inputElement = node.nodeObject.content.children[0].children[0].children[1];
                let newName = inputElement.value.trim().replace(",", "");

                // If a count was previously added, attempt to remove it
                if (node.countAdded) {
                    const updatedTitle = newName.replace(/\(\d+\)$/, '').trim();
                    if (updatedTitle !== newName) {
                        newName = updatedTitle;
                        inputElement.value = newName;
                        node.countAdded = false;
                    }
                }

                const name = node.title;
                if (newName === node.title) {
                    return;
                }

                delete nodes[name];
                let countAdded = false;
                if (nodes[newName]) {
                    let count = 2;
                    while (nodes[newName + "(" + count + ")"]) {
                        count++;
                    }
                    newName += "(" + count + ")";
                    inputElement.value = newName;
                    countAdded = true;
                }

                nodes[newName] = node;
                node.title = newName;

                // Set cursor position to before the count if a count was added
                if (countAdded) {
                    const cursorPosition = newName.indexOf("(");
                    inputElement.setSelectionRange(cursorPosition, cursorPosition);
                }

                node.countAdded = countAdded;

                const f = renameNode(name, inputElement.value);
                noteInput.setValue(f(noteInput.getValue()));
                noteInput.refresh();
                scrollToTitle(node.title, noteInput);
            };
        }

        //Syncs node text and Zettelkasten
        getHandleNodeBodyInputEvent(node) {
            return (e) => {
                const textarea = node.nodeObject.content.children[0].children[1].children[0];
                let body = textarea.value;
                const name = node.title;

                // Save cursor position
                let cursorPosition = textarea.selectionStart;

                const { startLineNo, endLineNo } = getNodeSectionRange(name, noteInput);

                let originalValue = noteInput.getValue();
                const lines = originalValue.split('\n');

                // Replace the node's content
                const newNodeContent = [lines[startLineNo]].concat(body.split('\n'));
                lines.splice(startLineNo, endLineNo - startLineNo + 1, ...newNodeContent);

                const newValue = lines.join('\n');
                noteInput.setValue(newValue);
                noteInput.refresh();

                // Explicitly update the edges (references)
                const nodeLines = body.split('\n');
                for (const line of nodeLines) {
                    if (line.startsWith(refTag)) {
                        this.handleReferenceLine(line, node.title, nodes, false);
                    }
                }

                // Update the textarea value AFTER handling the references
                textarea.value = body;

                // Restore cursor position AFTER handling the references
                textarea.setSelectionRange(cursorPosition, cursorPosition);

                const linesAboveCursor = body.substr(0, cursorPosition).split("\n");
                const lineOffset = linesAboveCursor.length - 1;
                const charPosition = linesAboveCursor[lineOffset].length;

                scrollToTitle(node.title, noteInput, lineOffset, charPosition);
            }
        }

        handleReferenceLine(line, currentNodeTitle, nodes, shouldAppend = true) {
            let residualLine = '';
            let references = [];

            // If refTag is in bracketsMap, handle it as a bracketed reference.
            if (sortedBrackets.includes(refTag)) {
                const closingBracket = bracketsMap[refTag];
                if (line.includes(closingBracket)) {
                    const extracted = this.extractBracketedReferences(line, refTag, closingBracket);
                    residualLine = extracted.residualLine;
                    references = extracted.references;
                }
            } else {
                // Otherwise, handle it as a non-bracketed (CSV) reference.
                references = line.substr(refTag.length).split(',').map(ref => ref.trim());
                residualLine = ''; // Assume there is no residual line in this case.
            }

            this.handleRefTags(references, currentNodeTitle, nodes);


            // This is to display links from the Zettelkasten in the note textarea (not ideal for vector embeddings) to fix issues with replacing node body text.
            if (nodes[currentNodeTitle]) {
                if (nodes[currentNodeTitle].plainText !== '' && shouldAppend) {
                    nodes[currentNodeTitle].plainText += '\n';
                }
                if (shouldAppend) {
                    nodes[currentNodeTitle].plainText += line;  // Append the full line with the refTag
                }
                const targetTextarea = nodes[currentNodeTitle].nodeObject.content.children[0].children[1].children[0];
                targetTextarea.value = nodes[currentNodeTitle].plainText;

                adjustTextareaHeight(targetTextarea);
            }
        }

        //Creates edges based of given reference titles.
        handleRefTags(references, currentNodeTitle, nodes) {
            const thisNode = nodes[currentNodeTitle];

            if (!thisNode) {
                return;
            }

            // Create a Set of current edge keys for easy lookup
            const currentEdges = new Set(thisNode.edges.keys());

            // First remove the edges that should no longer exist
            for (const edge of currentEdges) {
                if (!references.includes(edge)) {
                    const edgeObject = thisNode.edges.get(edge);
                    if (edgeObject) { // Check if object exists before calling remove
                        edgeObject.remove();
                        thisNode.edges.delete(edge);
                    }
                }
            }

            // Then add new edges
            for (const reference of references) {
                if (!nodes[reference]) {
                    continue;
                }
                thisNode.edges.set(reference, connectDistance(thisNode.nodeObject, nodes[reference].nodeObject));
            }
        }

        extractBracketedReferences(line, openingBracket, closingBracket) {
            const references = [];
            let buffer = "";
            let insideBrackets = false;
            let residualLine = "";
            for (let i = 0; i < line.length; i++) {
                if (line.startsWith(openingBracket, i)) {
                    insideBrackets = true;
                    buffer = "";  // Clear the buffer
                    i += openingBracket.length - 1;  // Skip the bracket characters
                } else if (line.startsWith(closingBracket, i) && insideBrackets) {
                    insideBrackets = false;
                    if (buffer.length > 0) {
                        references.push(...buffer.split(',').map(ref => ref.trim()));
                    }
                    i += closingBracket.length - 1;  // Skip the bracket characters
                } else if (insideBrackets) {
                    buffer += line[i];
                } else {
                    residualLine += line[i];
                }
            }
            return { references, residualLine };
        }

        handleTextWithoutTags(line, currentNodeTitle, nodes) {
            let targetTextarea;
            if (nodes[currentNodeTitle].isLLM) {
                targetTextarea = nodes[currentNodeTitle].nodeObject.promptTextArea;
            } else {
                targetTextarea = nodes[currentNodeTitle].nodeObject.content.children[0].children[1].children[0];
            }

            //if (!nodes[currentNodeTitle].skipNewLine && nodes[currentNodeTitle].plainText !== '') {
            if (nodes[currentNodeTitle].plainText !== '') {
                nodes[currentNodeTitle].plainText += '\n';  // this will add a newline only if skipNewLine is false
            }

            nodes[currentNodeTitle].plainText += line;
            targetTextarea.value = nodes[currentNodeTitle].plainText;

            adjustTextareaHeight(targetTextarea);
            nodes[currentNodeTitle].skipNewLine = false;
        }

        deleteInactiveNodes(nodes) {
            const dels = [];
            for (const k in nodes) {
                if (!nodes[k].live) {
                    nodes[k].nodeObject.remove();
                    dels.push(k);
                }
            }
            for (const k of dels) {
                delete nodes[k];
            }
        }

        deleteInactiveNodeLines(nodeLines) {
            const nodeLineDels = [];
            for (const k in nodeLines) {
                if (!nodeLines[k].live) {
                    nodeLines[k].nodeObject.remove();
                    nodeLineDels.push(k);
                }
            }
            for (const k of nodeLineDels) {
                delete nodeLines[k];
            }
        }

        handleLLMPromptLine(line, nodeTag, refTag, currentNodeTitle, nodes) {
            if (line.startsWith(nodeTag) || line.startsWith(refTag)) {
                return '';
            } else {
                // Check if the promptTextArea is empty. If not, prefix with newline
                const prefix = nodes[currentNodeTitle].nodeObject.promptTextArea.value ? "\n" : "";
                nodes[currentNodeTitle].nodeObject.promptTextArea.value += prefix + line.trim();
                return currentNodeTitle;
            }
        }

        handleLLM(line, i, nodeLines, nodes, currentNodeTitle, addLLMNodeInputListener) {
            let llmNodeTitle = line.substr("LLM:".length).trim() || "Untitled";  // Default to "Untitled" if empty
            currentNodeTitle = llmNodeTitle;

            let LLMNode = nodes[llmNodeTitle];

            if (!LLMNode || LLMNode.nodeObject.removed) {
                if (nodeLines[i] && !nodeLines[i].nodeObject.removed) {
                    LLMNode = nodes[llmNodeTitle] = nodeLines[i];
                    delete nodes[LLMNode.title];
                    LLMNode.title = llmNodeTitle;
                    LLMNode.live = true;
                    LLMNode.nodeObject.content.children[0].children[0].children[1].value = llmNodeTitle;
                } else {
                    LLMNode = nodeLines[i] = nodes[llmNodeTitle] = {
                        title: llmNodeTitle,
                        nodeObject: createLLMNode(llmNodeTitle, (Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8),
                        edges: new Map(),
                        lineNum: i,
                        live: true,
                        plainText: '',
                        isLLM: true,
                    };
                    addLLMNodeInputListener(LLMNode);
                }
            } else {
                LLMNode.live = true;
                LLMNode.lineNum = i;
                delete nodeLines[LLMNode.lineNum];
                nodeLines[i] = LLMNode;
            }
            currentNodeTitle = llmNodeTitle;
            LLMNode.nodeObject.promptTextArea.value = "";
            return currentNodeTitle;
        }

        addLLMNodeInputListener(node) {
            node.nodeObject.content.children[0].children[0].children[1].addEventListener('input', (e) => {
                const oldName = node.title;
                let newName = e.target.value.trim().replace(",", "");

                if (newName === oldName) {
                    return;
                }

                delete nodes[oldName];

                if (nodes[newName]) {
                    let count = 2;
                    while (nodes[`${newName}(${count})`]) {
                        count++;
                    }
                    newName += `(${count})`;
                    e.target.value = newName;
                }

                nodes[newName] = node;
                node.title = newName;

                const f = renameNode(oldName, newName);
                noteInput.setValue(f(noteInput.getValue()));
                noteInput.refresh();
            });
        }
    }

    const zettelkastenProcessor = new ZettelkastenProcessor(noteInput, nodeTagInput, refTagInput);

    //end of enclosure
}



function connectDistance(na, nb, linkStrength = .1, linkStyle = {
    stroke: "none",
    "stroke-width": "0.005",
    fill: "lightcyan",
    opacity: "0.5"
}) {
    // Calculate the distance between the two nodes
    const dx = nb.pos.x - na.pos.x;
    const dy = nb.pos.y - na.pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check if edge already exists
    const existingEdge = na.edges.find(edge => edge.pts.includes(nb) && nb.edges.includes(edge));
    if (existingEdge) {
        return existingEdge;
    }

    let edge = new Edge([na, nb], distance, linkStrength, linkStyle);

    na.edges.push(edge);
    nb.edges.push(edge);

    edges.push(edge);
    return edge;
}

