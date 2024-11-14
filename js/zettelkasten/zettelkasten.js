let nodefromWindow = false;
let followMouseFromWindow = false;

function nodeRE(name = undefined, tag_prefix = undefined) {
    if (tag_prefix === undefined) {
        tag_prefix = Tag.node;
    }
    if (name === undefined) {
        return new RegExp("(\\n|^)" + RegExp.escape(tag_prefix));
    }
    return new RegExp("(\\n|^)" + RegExp.escape(tag_prefix) + "[\t ]*" + RegExp.escape(name) + "[\t ]*(\n|$)");
}

function replaceInBrackets(s, from, to) {
    const open = Tag.ref;
    const close = getClosingBracket(open);

    let index = s.indexOf(open);
    while (index !== -1) {
        const closeIndex = s.indexOf(close, index);
        if (closeIndex !== -1) {
            const insideBrackets = s.substring(index + open.length, closeIndex).trim();
            if (insideBrackets === from.trim()) {
                s = s.substring(0, index + open.length) + to + s.substring(closeIndex);
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
    const nodeRE = '(' + RegExp.escape(Tag.node) + ")[\\t ]*" + fe + "[\\t ]*";
    const refRE = '(' + RegExp.escape(Tag.ref) + ")([^,\\n]+,)*[\\t ]*" + fe + "[\\t ]*(,[^,\\n]+)*";
    const tag = "((" + nodeRE + ")|(" + refRE + "))";
    const re = new RegExp("(\n|^)" + tag + "(?=(\n|$))", "g");
    const replacer = (match, p1, p2, p3, p4, p5, p6, p7, p8, p9, offset, string, groups) => {
        return p1 + (p4 ? p4 + ' ' : '') + (p6 ? p6 + ' ' : '') + (p7 || '') + to + (p8 || '');
    }
    return (s) => replaceInBrackets(s.replace(re, replacer), from, to);
}

class ZettelkastenProcessor {
    constructor(codeMirrorInstance, parser) {
        this.noteInput = codeMirrorInstance;
        this.parser = parser;
        this.prevNoteInputLines = [];
        this.placementStrategy = new NodePlacementStrategy([], {});
        this.nodes = {};
        this.nodeLines = {};

        this.noteInput.on('change', this.processInput);
    }

    updatePlacementPath(pathObject) {
        if (this.placementStrategy) this.placementStrategy.updatePath(pathObject)
    }

    spawnNodeFromZettelkasten(currentNodeTitle) {
        ProcessedNodes.update();
        this.placementStrategy.nodeObjects = ProcessedNodes.map;
        return this.placementStrategy.calculatePositionAndScale(currentNodeTitle);
    }

    findFirstChangedLine(lines) {
        return lines.findIndex((line, i) => line !== this.prevNoteInputLines[i]) || Math.min(this.prevNoteInputLines.length, lines.length);
    }

    findChangedNode(lines) {
        for (let i = this.findFirstChangedLine(lines); i >= 0; i--) {
            if (typeof lines[i] === 'undefined') break;

            const match = lines[i].match(nodeTitleRegexGlobal);
            if (match) return Node.byTitle(match[1].trim());
        }
    }

    initializeNodes() {
        for (const key in this.nodes) {
            if (this.nodes[key].nodeObject.removed) {
                delete this.nodes[key];
            } else {
                this.nodes[key].plainText = '';
                this.nodes[key].ref = '';
                this.nodes[key].live = false;
            }
        }
    }

    processInput = ()=>{
        if (bypassZettelkasten) {
            bypassZettelkasten = false;
            return;
        }

        this.initializeNodes(); // Use instance-specific initializeNodes method
        const lines = this.noteInput.getValue().split('\n');
        let currentNodeTitle = '';

        lines.forEach((line, index) => {
            currentNodeTitle = this.processLine(line, lines, index, this.nodes, currentNodeTitle);
        });

        if (!processAll) {
            this.processChangedNode(lines, this.nodes);
        }

        this.cleanupNodes(this.nodes, this.nodeLines);
        this.prevNoteInputLines = lines.slice(); // Update prevNoteInputLines with the current lines
        processAll = false;
        restoreZettelkastenEvent = false;
    }

    processLine(line, lines, index, nodes, currentNodeTitle) {
        const currentNode = nodes[currentNodeTitle];
        if (line.startsWith(Tag.node)) {
            return this.handleNode(line, index, this.nodeLines, nodes, currentNodeTitle);
        }

        if (line.startsWith(LLM_TAG)) {
            return this.handleLLM(line, index, this.nodeLines, nodes, currentNodeTitle, this.addLLMNodeInputListener);
        }

        if (currentNode && currentNode.isLLM) {
            return this.handleLlmPromptLine(line, Tag.node, Tag.ref, currentNodeTitle, nodes)
        }

        if (processAll && restoreZettelkastenEvent) {
            // Call without the start and end lines
            this.handlePlainTextAndReferences(line, currentNodeTitle, nodes, null, null, lines);
        }

        return currentNodeTitle;
    }

    handlePlainTextAndReferences(line, currentNodeTitle, nodes, startLine = null, endLine = null, lines = null) {
        //this.removeStaleReferences(currentNodeTitle, nodes);

        if (line.includes(Tag.ref)) {
            // If startLine and endLine are null, handleReferenceLine will use its default behavior
            this.handleReferenceLine(line, currentNodeTitle, nodes, lines, true, startLine, endLine);
        } else if (nodes[currentNodeTitle]) {
            this.handleTextWithoutTags(line, currentNodeTitle, nodes);
        }
    }

    // Updated to handle processChangedNode
    processChangedNode(lines, nodes) {
        const changedNode = this.findChangedNode(lines);
        if (!changedNode) return;

        const changedNodeTitle = changedNode.getTitle();
        const { startLineNo, endLineNo } = this.parser.getNodeSectionRange(changedNodeTitle);

        let nodeContainsReferences = false;
        let nodeReferencesCleared = false;
        for (let i = startLineNo + 1; i <= endLineNo && i < lines.length; i++) {
            // Process each line and update the nodeContainsReferences flag
            this.handlePlainTextAndReferences(lines[i], changedNodeTitle, nodes, startLineNo, endLineNo, lines);
            if (lines[i].includes(Tag.ref)) {
                nodeContainsReferences = true;
                nodeReferencesCleared = false;
            }
        }

        // Clear references if no references are found and they haven't been cleared already
        if (!nodeContainsReferences && !nodeReferencesCleared) {
            this.handleRefTags([], changedNodeTitle, nodes, lines);
            nodeReferencesCleared = true;
            Logger.debug("References cleared for node:", changedNodeTitle);
        }
    }

    cleanupNodes(nodes, nodeLines) {
        this.deleteInactiveNodes(nodes);
        this.deleteInactiveNodeLines(nodeLines);
    }

    handleNode(line, i, nodeLines, nodes, currentNodeTitle) {
        currentNodeTitle = line.substr(Tag.node.length).trim();

        if (restoreZettelkastenEvent) {
            const savedNode = Node.byTitle(currentNodeTitle);
            if (savedNode) {
                const node = this.establishZettelkastenNode(savedNode, currentNodeTitle, nodeLines, nodes);
                nodeLines[i] = node;
                nodes[currentNodeTitle] = node;
                return currentNodeTitle;
            }

            Logger.info("No existing node found for title:", currentNodeTitle);
        }

        if (!nodes[currentNodeTitle] || nodes[currentNodeTitle].nodeObject.removed) {
            if (nodeLines[i] && !nodeLines[i].nodeObject.removed) {
                const node = nodes[currentNodeTitle] = nodeLines[i];
                if (nodes[node.title] === node) {
                    delete nodes[node.title];
                }
                node.title = currentNodeTitle;
                node.live = true;
                node.nodeObject.view.titleInput.value = currentNodeTitle;
            } else {
                let nodeObject;
                if (nodefromWindow) {
                    nodeObject = TextNode.create(currentNodeTitle);
                    nodefromWindow = false;
                    if (followMouseFromWindow) {
                        nodeObject.followingMouse = 1;
                        followMouseFromWindow = false;
                    }
                } else {
                    nodeObject = this.spawnNodeFromZettelkasten(currentNodeTitle);
                }

                const node = this.establishZettelkastenNode(nodeObject, currentNodeTitle, nodeLines, nodes);
                nodeLines[i] = node;
                nodes[currentNodeTitle] = node;
            }
        } else {
            nodes[currentNodeTitle].plainText = '';
            nodes[currentNodeTitle].nodeObject.textarea.value = nodes[currentNodeTitle].plainText;
            if (nodeLines[nodes[currentNodeTitle].lineNum] === nodes[currentNodeTitle]) {
                delete nodeLines[nodes[currentNodeTitle].lineNum];
            }
            nodes[currentNodeTitle].live = true;
            nodes[currentNodeTitle].lineNum = i;
            nodeLines[i] = nodes[currentNodeTitle];
        }
        return currentNodeTitle;
    }

    establishZettelkastenNode(domNode, currentNodeTitle, nodeLines, nodes) {
        if (!domNode) {
            Logger.warn("DOM node is undefined, cannot establish Zettelkasten node.");
            return null;
        }

        const node = {
            title: currentNodeTitle,
            plainText: '',
            ref: '',
            live: true,
            nodeObject: domNode,
            edges: new Map(),
            lineNum: null
        };

        this.attachContentEventListenersToNode(node, nodes, nodeLines);

        return node;
    }

    attachContentEventListenersToNode(node, nodes, nodeLines) {
        const inputElement = node.nodeObject.view.titleInput;
        On.input(inputElement, this.createTitleInputEventHandler(node, nodes, nodeLines, inputElement));

        const textarea = node.nodeObject.textarea;
        On.input(textarea, this.getHandleNodeBodyInputEvent(node, textarea));
    }

    //Syncs node titles and Zettelkasten
    createTitleInputEventHandler(node, nodes, nodeLines, inputElement) {
        return (e) => {
            if (e.target !== inputElement) return;

            let newName = inputElement.value.trim().replace(',', '');
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
            if (newName === node.title) return;

            delete nodes[name];
            let countAdded = false;
            if (nodes[newName]) {
                let count = 2;
                while (nodes[newName + '(' + count + ')']) {
                    count++;
                }
                newName += '(' + count + ')';
                inputElement.value = newName;
                countAdded = true;
            }
            nodes[newName] = node;
            node.title = newName;
            // Set cursor position to before the count if a count was added
            if (countAdded) {
                const cursorPosition = newName.indexOf('(');
                inputElement.setSelectionRange(cursorPosition, cursorPosition);
            }
            node.countAdded = countAdded;

            // Collect the relevant CodeMirror instances to update
            const cmInstancesToUpdate = new Set();

            // Get the CodeMirror instance for the current node
            const currentNodeInstance = getZetNodeCMInstance(name);
            if (currentNodeInstance) {
                cmInstancesToUpdate.add(currentNodeInstance.cm);
            }

            // Process the nodes connected by edges
            for (const edge of node.nodeObject.edges) {
                // Find the connected node that is not the current node
                const connectedNode = edge.pts.find(pt => pt !== node.nodeObject);

                if (connectedNode && connectedNode.isTextNode) {
                    const connectedNodeInstance = getZetNodeCMInstance(connectedNode.getTitle());
                    if (connectedNodeInstance?.cm !== currentNodeInstance.cm) {
                        cmInstancesToUpdate.add(connectedNodeInstance.cm);
                    }
                }
            }

            // Update the collected CodeMirror instances
            const renameNodeInInstance = renameNode(name, newName);
            for (const cm of cmInstancesToUpdate) {
                processAll = true;
                const updatedValue = renameNodeInInstance(cm.getValue());
                cm.setValue(updatedValue);
                cm.refresh();
            }

            zetPanes.switchPane(currentNodeInstance.paneId);
            currentNodeInstance.ui.scrollToTitle(node.title);
        };
    }

    //Syncs node text and Zettelkasten
    getHandleNodeBodyInputEvent(node, textarea) {
        return (e) => {
            if (e.target !== textarea) return;

            const body = textarea.value;
            const name = node.title;
            const { startLineNo, endLineNo } = this.parser.getNodeSectionRange(name);
            let originalValue = this.noteInput.getValue();
            const lines = originalValue.split('\n');

            // Create the updated content
            let updatedContent = lines[startLineNo] + '\n'; // Node title line
            updatedContent += body;

            // Replace the node's content using replaceRange
            const from = { line: startLineNo, ch: 0 };
            const to = { line: Math.max(startLineNo, endLineNo), ch: (lines[endLineNo] || '').length };

            this.noteInput.operation(() => {
                this.noteInput.replaceRange(updatedContent, from, to);

                // Handle references
                body.split('\n').forEach((line, index) => {
                    if (line.startsWith(Tag.ref)) {
                        this.handleReferenceLine(line, node.title, this.nodes, body.split('\n'), false, startLineNo + 1 + index, startLineNo + 1 + index);
                    }
                });
            });
        };
    }

    extractAllReferencesFromRange(startLine, endLine, lines) {
        const allReferences = [];
        for (let i = startLine; i <= endLine; i++) {
            const line = lines[i];
            if (!line || !line.includes(Tag.ref)) continue;

            const extractedRefs = this.extractReferencesFromLine(line);
            allReferences.push(...extractedRefs);
        }
        return allReferences;
    }

    // Modified handleReferenceLine to use optional given range or generate one if not provided
    handleReferenceLine(line, currentNodeTitle, nodes, lines, shouldAppend = true, startLineIndex = null, endLineIndex = null) {
        const currentNode = nodes[currentNodeTitle];
        if (!currentNode) return;

        let allReferences;

        // Check if the startLineIndex and endLineIndex are within the bounds of the lines array
        if (startLineIndex !== null && endLineIndex !== null && startLineIndex >= 0 && endLineIndex < lines.length) {
            allReferences = this.extractAllReferencesFromRange(startLineIndex, endLineIndex, lines);
        } else {
            // Get node section range dynamically if not provided
            const { startLineNo, endLineNo } = this.parser.getNodeSectionRange(currentNodeTitle);
            allReferences = this.extractAllReferencesFromRange(startLineNo + 1, endLineNo, lines); // +1 to skip the title
        }

        this.handleRefTags(allReferences, currentNodeTitle, nodes, lines);

        // Build plain text for node after tags
        if (shouldAppend) {
            const linesToAdd = [currentNode.plainText, line].filter(Boolean);
            currentNode.plainText = linesToAdd.join('\n');

            const targetTextarea = currentNode.nodeObject.content.children[0].children[1].children[0];
            targetTextarea.value = currentNode.plainText;
        }
    }

    extractReferencesFromLine(line) {
        const refTag = Tag.ref;
        if (!sortedBrackets.includes(refTag)) {
            return line.substr(refTag.length).split(',').map(ref => ref.trim())
        }

        const closingBracket = bracketsMap[refTag];
        if (line.includes(closingBracket)) {
            return this.extractBracketedReferences(line, refTag, closingBracket).references
        }

        return [];
    }

    handleRefTags(references, currentNodeTitle, nodes, lines) {
        const thisNodeWrapper = nodes[currentNodeTitle];
        if (!thisNodeWrapper || !thisNodeWrapper.nodeObject) return;

        const thisNode = thisNodeWrapper.nodeObject;

        // Get all nodes from all CodeMirror instances
        const allNodes = getAllInternalZettelkastenNodes();

        // Initialize set with UUIDs from current node references
        const allReferenceUUIDs = new Set(references.map(ref => allNodes[ref]?.nodeObject?.uuid).filter(uuid => uuid));

        // Check if connected nodes contain a reference to the current node in any CodeMirror instance
        const connectedNodes = getConnectedNodes(thisNode);
        connectedNodes.forEach(node => {
            const nodeInfo = getZetNodeCMInstance(node.getTitle());
            if (!nodeInfo) return;

            const { startLineNo, endLineNo } = nodeInfo.parser.getNodeSectionRange(node.getTitle());
            const nodeLines = nodeInfo.cm.getValue().split('\n');
            const nodeReferences = this.extractAllReferencesFromRange(startLineNo + 1, endLineNo, nodeLines);
            if (nodeReferences.includes(currentNodeTitle)) allReferenceUUIDs.add(node.uuid);
        });

        // Process edges
        const currentEdges = new Map(thisNode.edges.map(edge => {
            const otherNode = edge.pts.find(pt => pt.uuid !== thisNode.uuid);
            return otherNode ? [otherNode.uuid, edge] : [null, edge];
        }));

        // Remove edges not found in reference UUIDs and ensure both nodes are text nodes
        currentEdges.forEach((edge, uuid) => {
            if (allReferenceUUIDs.has(uuid)) return;

            const otherNode = edge.pts.find(pt => pt.uuid === uuid);
            if (thisNode.isTextNode && otherNode?.isTextNode) {
                // Check if there is a reference to the other node in any CodeMirror instance
                const otherNodeInfo = getZetNodeCMInstance(otherNode.getTitle());
                if (!otherNodeInfo) return;

                const { startLineNo, endLineNo } = otherNodeInfo.parser.getNodeSectionRange(otherNode.getTitle());
                const otherNodeLines = otherNodeInfo.cm.getValue().split('\n');
                const otherNodeReferences = this.extractAllReferencesFromRange(startLineNo + 1, endLineNo, otherNodeLines);

                if (!otherNodeReferences.includes(currentNodeTitle)) {
                    edge.remove();
                    currentEdges.delete(uuid);
                }
            }
        });

        thisNode.edges = Array.from(currentEdges.values());

        // Add new edges for references
        references.forEach(reference => {
            const refUUID = allNodes[reference]?.nodeObject?.uuid;
            if (!refUUID || currentEdges.has(refUUID)) return;

            const newEdge = connectDistance(thisNode, allNodes[reference].nodeObject);
            thisNode.edges.push(newEdge);
            currentEdges.set(refUUID, newEdge);
        });
    }

    extractBracketedReferences(line, openingBracket, closingBracket) {
        const references = [];
        let buffer = '';
        let insideBrackets = false;
        let residualLine = '';

        for (let i = 0; i < line.length; i++) {
            if (line.startsWith(openingBracket, i)) {
                if (!insideBrackets) {
                    insideBrackets = true;
                    buffer = '';
                    i += openingBracket.length - 1;  // Skip the bracket characters
                } else {
                    buffer += line[i];
                }
            } else if (line.startsWith(closingBracket, i) && insideBrackets) {
                insideBrackets = false;
                if (buffer.length > 0) {
                    references.push(buffer.trim());
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
        const node = nodes[currentNodeTitle];
        const textArea = (node.isLLM ? node.nodeObject.promptTextArea : node.nodeObject.textarea);

        node.plainText = (node.plainText ? node.plainText + '\n' + line : line);

        // getDebouncedTextareaUpdate(textArea)(node.plainText);
        callWithDelay(TextArea.update.bind(textArea, node.plainText), 20);
    }

    deleteInactiveNodes(nodes) {
        const dels = [];
        for (const k in nodes) {
            if (nodes[k].live) continue;

            nodes[k].nodeObject.remove();
            dels.push(k);
        }
        for (const k of dels) {
            delete nodes[k];
        }
    }

    deleteInactiveNodeLines(nodeLines) {
        const nodeLineDels = [];
        for (const k in nodeLines) {
            if (nodeLines[k].live) continue;

            nodeLines[k].nodeObject.remove();
            nodeLineDels.push(k);
        }
        for (const k of nodeLineDels) {
            delete nodeLines[k];
        }
    }

    handleLlmPromptLine(line, nodeTag, refTag, currentNodeTitle, nodes) {
        if (line.startsWith(nodeTag) || line.startsWith(refTag)) return '';

        // Check if the promptTextArea is empty. If not, prefix with newline
        const prefix = nodes[currentNodeTitle].nodeObject.promptTextArea.value ? '\n' : '';
        nodes[currentNodeTitle].nodeObject.promptTextArea.value += prefix + line.trim();
        return currentNodeTitle;
    }

    handleLLM(line, i, nodeLines, nodes, currentNodeTitle, addLLMNodeInputListener) {
        const llmNodeTitle = line.substr("LLM:".length).trim() || "Untitled";  // Default to "Untitled" if empty
        currentNodeTitle = llmNodeTitle;

        let llmNode = nodes[llmNodeTitle];

        if (!llmNode || llmNode.nodeObject.removed) {
            if (nodeLines[i] && !nodeLines[i].nodeObject.removed) {
                llmNode = nodes[llmNodeTitle] = nodeLines[i];
                delete nodes[llmNode.title];
                llmNode.title = llmNodeTitle;
                llmNode.live = true;
                llmNode.nodeObject.content.children[0].children[0].children[1].value = llmNodeTitle;
            } else {
                llmNode = nodeLines[i] = nodes[llmNodeTitle] = {
                    title: llmNodeTitle,
                    nodeObject: createLlmNode(llmNodeTitle, (Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8),
                    edges: new Map(),
                    lineNum: i,
                    live: true,
                    plainText: '',
                    isLLM: true,
                };
                addLLMNodeInputListener(llmNode, nodes);
            }
        } else {
            llmNode.live = true;
            llmNode.lineNum = i;
            delete nodeLines[llmNode.lineNum];
            nodeLines[i] = llmNode;
        }
        currentNodeTitle = llmNodeTitle;
        llmNode.nodeObject.promptTextArea.value = '';
        return currentNodeTitle;
    }

    addLLMNodeInputListener(node, nodes) {
        On.input(node.nodeObject.content.children[0].children[0].children[1], (e)=>{
            const oldName = node.title;
            let newName = e.target.value.trim().replace(',', '');
            if (newName === oldName) return;

            delete nodes[oldName];

            if (nodes[newName]) {
                newName = e.target.value = getUniqueNodeTitle(newName, nodes);
            }

            nodes[newName] = node;
            node.title = newName;

            const noteInput = this.noteInput;
            const f = renameNode(oldName, newName);
            noteInput.setValue(f(noteInput.getValue()));
            noteInput.refresh();
        });
    }
}

function getUniqueNodeTitle(baseTitle, nodes, removeExistingCount = false) {
    let newName = baseTitle.trim().replace(',', '');

    if (removeExistingCount) {
        newName = newName.replace(/\(\d+\)$/, '').trim();
    }

    if (!nodes[newName]) return newName;

    let count = 2;
    while (nodes[newName + '(' + count + ')']) {
        count += 1;
    }
    return newName + '(' + count + ')';
}
