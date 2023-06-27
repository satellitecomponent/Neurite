var nodeTagInput;
var refTagInput;
let llmNodeCreated = false;
{

    const nodeTableBody = document.getElementById('node-table-body');
    nodeTagInput = document.getElementById('node-tag');
    refTagInput = document.getElementById('ref-tag');
    const noteInput = myCodeMirror;
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
            tag_prefix = nodeTagInput.value;
        }
        if (name === undefined) {
            return new RegExp("(\\n|^)" + RegExp.escape(tag_prefix));
        }
        return new RegExp("(\\n|^)" + RegExp.escape(tag_prefix) + "[\t ]*" + RegExp.escape(name) + "[\t ]*(\n|$)");
    }

    function renameNode(from, to) {
        //(\n|^)(((#node:)[\t ]*from[\t ]*)|((#ref:)([^,\n]+,)*[\t ]*from[\t ]*(,[^,\n]+)*))(?=(\n|$))
        //$1$4$6$7 to$8$9
        const fe = RegExp.escape(from);
        const nodeRE = "(" + RegExp.escape(nodeTagInput.value) + ")[\\t ]*" + fe + "[\\t ]*";
        const refRE = "(" + RegExp.escape(refTagInput.value) + ")([^,\\n]+,)*[\\t ]*" + fe + "[\\t ]*(,[^,\\n]+)*";
        const tag = "((" + nodeRE + ")|(" + refRE + "))";
        const re = new RegExp("(\n|^)" + tag + "(?=(\n|$))", "g");
        const replacer = (match, p1, p2, p3, p4, p5, p6, p7, p8, p9, offset, string, groups) => {
            return p1 + (p4 ? p4 + " " : "") + (p6 ? p6 + " " : "") + (p7 || "") + to + (p8 || "");
        }
        return (s) => s.replace(re, replacer);
    }

function processInput() {
    const nodeTag = nodeTagInput.value;
    const refTag = refTagInput.value;

    for (const key in nodes) {
        if (nodes[key].nodeObject.removed) {
            delete nodes[key];
        } else {
            nodes[key].plainText = '';
            nodes[key].ref = '';
            nodes[key].live = false;
        }
    }

    const lines = noteInput.getValue().split('\n');
    let currentNodeTitle = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

            if (line.startsWith(nodeTag)) {
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
                        const node = nodeLines[i] = nodes[currentNodeTitle] = {
                            title: currentNodeTitle,
                            plainText: '',
                            ref: '',
                            live: true,
                            nodeObject: createTextNode(currentNodeTitle, '', (Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8),
                            edges: new Map(),
                            lineNum: i,
                        };

                        node.nodeObject.content.children[0].children[0].children[1].addEventListener('input', (e) => {
                            const name = node.title;
                            let newName = node.nodeObject.content.children[0].children[0].children[1].value.trim();
                            newName = newName.replace(",", "");
                            if (newName === node.title) {
                                return;
                            }
                            delete nodes[name];
                            if (nodes[newName]) {
                                let count = 2;
                                while (nodes[newName + "(" + count + ")"]) {
                                    count++;
                                }
                                newName += "(" + count + ")";
                                node.nodeObject.content.children[0].children[0].children[1].value = newName;
                            }
                            nodes[newName] = node;
                            node.title = newName;
                            const f = renameNode(name, node.nodeObject.content.children[0].children[0].children[1].value);
                            noteInput.setValue(f(noteInput.getValue()));  // instead of noteInput.value = f(noteInput.value);
                            noteInput.refresh();
                        });
                        node.nodeObject.content.children[0].children[1].children[0].addEventListener('input', (e) => {
                            let body = node.nodeObject.content.children[0].children[1].children[0].value;  // change const to let
                            // just replace between #node: [name] and the next tag
                            const name = node.title;
                            const nt = RegExp.escape(nodeTagInput.value);
                            const start = "((\\n|^)" + nt + "[\\t ]*" + RegExp.escape(name) + "[\\t ]*(\\n|$))";
                            const rt = RegExp.escape(refTagInput.value);
                            const end = "(?=((\\n" + nt + ")|(\\n" + rt + ")|$))";
                            const re = new RegExp(start + "((?=((" + nt + ")|(" + rt + ")|$))|(([^]*?)" + end + "))");

                            // Save cursor position
                            const cursorPosition = node.nodeObject.content.children[0].children[1].children[0].selectionStart;

                            // Modify the replace callback function to avoid adding newlines unnecessarily
                            noteInput.setValue(noteInput.getValue().replace(re, (match, p1, p2, p3, p4, p5, p6, p7, offset, string, groups) => {
                                p1 = p1 || "";
                                // Check if p1 ends with a newline OR if body is not an empty string
                                if (!p1.endsWith("\n") && body !== '') {
                                    p1 += "\n";
                                }
                                // If body ends with a newline, remove it
                                if (body.endsWith("\n")) {
                                    body = body.substring(0, body.length - 1);
                                }
                                // If p5 is not undefined, add newline after body
                                if (p5 !== undefined) {
                                    return p1 + body + "\n";
                                }
                                return p1 + body;
                            }));

                            // Restore cursor position
                            node.nodeObject.content.children[0].children[1].children[0].selectionStart = cursorPosition;
                            node.nodeObject.content.children[0].children[1].children[0].selectionEnd = cursorPosition;
                        });
                    }
                } else {
                    nodes[currentNodeTitle].plainText = "";
                    nodes[currentNodeTitle].nodeObject.content.children[0].children[1].children[0].value = nodes[currentNodeTitle].plainText; //144
                    if (nodeLines[nodes[currentNodeTitle].lineNum] === nodes[currentNodeTitle]) {
                        delete nodeLines[nodes[currentNodeTitle].lineNum];
                    }
                    nodes[currentNodeTitle].live = true;
                    nodes[currentNodeTitle].lineNum = i;
                    nodeLines[i] = nodes[currentNodeTitle];
                }
            } else if (line.startsWith("LLM:")) {
                let llmNodeTitle = line.substr("LLM:".length).trim();

                // If llmNodeTitle is empty after trimming, set it to "Untitled"
                if (llmNodeTitle === "") {
                    llmNodeTitle = "Untitled";
                }

                if (!nodes[llmNodeTitle] || nodes[llmNodeTitle].nodeObject.removed) {
                    let node;
                    if (nodeLines[i] && !nodeLines[i].nodeObject.removed) {
                        node = nodes[llmNodeTitle] = nodeLines[i];
                        if (nodes[node.title] === node) {
                            delete nodes[node.title];
                        }
                        node.title = llmNodeTitle;
                        node.live = true;
                        node.nodeObject.content.children[0].children[0].children[1].value = llmNodeTitle;
                    } else {
                        node = nodeLines[i] = nodes[llmNodeTitle] = {
                            title: llmNodeTitle,
                            nodeObject: createLLMNode(llmNodeTitle, (Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8),
                            edges: new Map(),
                            lineNum: i,
                            live: true,
                            plainText: '',  // Initialize plainText
                            isLLM: true,  // Mark it as LLM node
                        };

                        node.nodeObject.content.children[0].children[0].children[1].addEventListener('input', (e) => {
                            const oldName = node.title;
                            let newName = node.nodeObject.content.children[0].children[0].children[1].value.trim();
                            newName = newName.replace(",", "");
                            if (newName === node.title) {
                                return;
                            }
                            delete nodes[oldName];
                            if (nodes[newName]) {
                                let count = 2;
                                while (nodes[newName + "(" + count + ")"]) {
                                    count++;
                                }
                                newName += "(" + count + ")";
                                node.nodeObject.content.children[0].children[0].children[1].value = newName;
                            }
                            nodes[newName] = node;
                            node.title = newName;
                            const f = renameNode(oldName, newName);
                            noteInput.setValue(f(noteInput.getValue()));  // instead of noteInput.value = f(noteInput.value);
                            noteInput.refresh();
                        });
                    }
                } else {
                    nodes[llmNodeTitle].live = true;
                    nodes[llmNodeTitle].lineNum = i;
                    if (nodeLines[nodes[llmNodeTitle].lineNum] === nodes[llmNodeTitle]) {
                        delete nodeLines[nodes[llmNodeTitle].lineNum];
                    }
                    nodeLines[i] = nodes[llmNodeTitle];
                }
                currentNodeTitle = llmNodeTitle;  // Update currentNodeTitle at the end
            } else if (currentNodeTitle.startsWith("LLM:") && nodes[currentNodeTitle].isLLM) {
                if (line.startsWith("node:") || line.startsWith("ref:")) {
                    currentNodeTitle = '';
                } else {
                    nodes[currentNodeTitle].nodeObject.promptTextArea.value += line.trim();
                }
            } else if (line.startsWith(refTag)) {
                if (currentNodeTitle !== '') {
                    const references = line.substr(refTag.length).split(',').map(ref => ref.trim());
                    const thisNode = nodes[currentNodeTitle];
                    references.forEach(reference => {
                        if (nodes[reference]) {
                            if (!thisNode.edges.has(reference)) {
                                thisNode.edges.set(reference, connectDistance(thisNode.nodeObject, nodes[reference].nodeObject));
                            }
                        }
                    });
                    const refset = new Set(references);
                    for (const ref of thisNode.edges.keys()) {
                        if (!refset.has(ref)) {
                            const edge = thisNode.edges.get(ref);
                            if (edge) {
                                edge.remove();
                                thisNode.edges.delete(ref);
                            }
                        }
                    }
                }
        } else {
            if (currentNodeTitle !== '') {
                // If the line doesn't start with "LLM:", "ref:", or "node:"
                if (!line.startsWith("LLM:") && !line.startsWith("ref:") && !line.startsWith("node:")) {
                    let targetTextarea;
                    if (nodes[currentNodeTitle].isLLM) {
                        targetTextarea = nodes[currentNodeTitle].nodeObject.promptTextArea;
                    } else {
                        targetTextarea = nodes[currentNodeTitle].nodeObject.content.children[0].children[1].children[0];
                    }
                    if (nodes[currentNodeTitle].plainText !== '') {
                        nodes[currentNodeTitle].plainText += '\n';
                        targetTextarea.value = nodes[currentNodeTitle].plainText;
                    }
                    nodes[currentNodeTitle].plainText += line;
                    targetTextarea.value = nodes[currentNodeTitle].plainText; 
                    // Manually call the adjustTextareaHeight function to adjust the textarea height
                    adjustTextareaHeight(targetTextarea);
                }
            }
        }
    } {
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
        } {
            const dels = [];
            for (const k in nodeLines) {
                if (!nodeLines[k].live) {
                    nodeLines[k].nodeObject.remove();
                    dels.push(k);
                }
            }
            for (const k of dels) {
                delete nodeLines[k];
            }
        }

        //updateTable();
    }

    noteInput.on('change', processInput);  // instead of noteInput.addEventListener('input', processInput)
    nodeTagInput.addEventListener('input', processInput);
    refTagInput.addEventListener('input', processInput);

    function updateTable() {
        nodeTableBody.innerHTML = '';

        for (const nodeTitle in nodes) {
            const node = nodes[nodeTitle];

            const row = document.createElement('tr');
            const headerCell = document.createElement('td');
            const plainTextCell = document.createElement('td');
            const refCell = document.createElement('td');

            headerCell.textContent = node.title;
            row.appendChild(headerCell);
            plainTextCell.textContent = node.nodeObject.content.children[0].children[1].children[0].value.trim();
            refCell.innerHTML = node.ref.trim();
            row.appendChild(plainTextCell);
            row.appendChild(refCell);

            nodeTableBody.appendChild(row);
        }
    }

    //processInput();
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
    if (na.edges.some(edge => edge.pts.includes(nb)) && nb.edges.some(edge => edge.pts.includes(na))) {
        return;
    }

    let edge = new Edge([na, nb], distance, linkStrength, linkStyle);

    na.edges.push(edge);
    nb.edges.push(edge);

    edges.push(edge);
    return edge;
}