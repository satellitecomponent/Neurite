
let nodefromWindow = false;
let followMouseFromWindow = false;


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
        const open = refTag;
        const close = getClosingBracket(refTag);

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
        const nodeRE = "(" + RegExp.escape(nodeTag) + ")[\\t ]*" + fe + "[\\t ]*";
        const refRE = "(" + RegExp.escape(refTag) + ")([^,\\n]+,)*[\\t ]*" + fe + "[\\t ]*(,[^,\\n]+)*";
        const tag = "((" + nodeRE + ")|(" + refRE + "))";
        const re = new RegExp("(\n|^)" + tag + "(?=(\n|$))", "g");
        const replacer = (match, p1, p2, p3, p4, p5, p6, p7, p8, p9, offset, string, groups) => {
            return p1 + (p4 ? p4 + " " : "") + (p6 ? p6 + " " : "") + (p7 || "") + to + (p8 || "");
        }
        return (s) => replaceInBrackets(s.replace(re, replacer), from, to);
    }

    class ZettelkastenProcessor {
        constructor(codeMirrorInstance, parser) {
            this.noteInput = codeMirrorInstance;
            this.parser = parser;
            this.prevNoteInputLines = [];
            this.placementStrategy = new NodePlacementStrategy([], {});
            this.nodes = {}; // Add instance-specific nodes object
            this.nodeLines = {}; // Add instance-specific nodeLines object

            this.noteInput.on('change', () => this.processInput());
        }

        updatePlacementPath(pathObject) {
            if (this.placementStrategy) {
                this.placementStrategy.updatePath(pathObject);
            }
        }

        spawnNodeFromZettelkasten(currentNodeTitle) {
            updateGlobalProcessedNodeMap(nodeMap);
            this.placementStrategy.nodeObjects = globalProcessedNodeMap;
            const nodeObject = this.placementStrategy.calculatePositionAndScale(currentNodeTitle);
            return nodeObject;
        }

        findFirstChangedLine(lines) {
            return lines.findIndex((line, i) => line !== this.prevNoteInputLines[i]) || Math.min(this.prevNoteInputLines.length, lines.length);
        }

        findChangedNode(lines) {
            const firstChangedLine = this.findFirstChangedLine(lines);

            const nodeTitleRegex = nodeTitleRegexGlobal;

            for (let i = firstChangedLine; i >= 0; i--) {
                if (typeof lines[i] === 'undefined') {
                    break;  // Exit loop if the line is undefined
                }

                const match = lines[i].match(nodeTitleRegex);
                if (match) {
                    return getNodeByTitle(match[1].trim());  // Return the node object
                }
            }
            return null;  // If no matching node is found, return null or another default value
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

        processInput() {
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
            if (line.startsWith(nodeTag)) {
                return this.handleNode(line, index, this.nodeLines, nodes, currentNodeTitle);
            }

            if (line.startsWith(LLM_TAG)) {
                return this.handleLLM(line, index, this.nodeLines, nodes, currentNodeTitle, this.addLLMNodeInputListener);
            }

            if (currentNode && currentNode.isLLM) {
                return this.handleLLMPromptLine(line, nodeTag, refTag, currentNodeTitle, nodes);
            }

            if (processAll && restoreZettelkastenEvent) {
                // Call handlePlainTextAndReferences without the start and end lines
                this.handlePlainTextAndReferences(line, currentNodeTitle, nodes, null, null, lines);
            }

            return currentNodeTitle;
        }

        handlePlainTextAndReferences(line, currentNodeTitle, nodes, startLine = null, endLine = null, lines = null) {
            //this.removeStaleReferences(currentNodeTitle, nodes);

            if (line.includes(refTag)) {
                // If startLine and endLine are null, handleReferenceLine will use its default behavior
                this.handleReferenceLine(line, currentNodeTitle, nodes, lines, true, startLine, endLine);
            } else if (nodes[currentNodeTitle]) {
                this.handleTextWithoutTags(line, currentNodeTitle, nodes);
            }
        }

        // Updated to handle processChangedNode
        processChangedNode(lines, nodes) {
            const changedNode = this.findChangedNode(lines);
            if (changedNode) {
                const changedNodeTitle = changedNode.getTitle();
                const { startLineNo, endLineNo } = this.parser.getNodeSectionRange(changedNodeTitle);

                let nodeContainsReferences = false;
                let nodeReferencesCleared = false;
                for (let i = startLineNo + 1; i <= endLineNo && i < lines.length; i++) {
                    // Process each line and update the nodeContainsReferences flag
                    this.handlePlainTextAndReferences(lines[i], changedNodeTitle, nodes, startLineNo, endLineNo, lines);
                    if (lines[i].includes(refTag)) {
                        nodeContainsReferences = true;
                        nodeReferencesCleared = false;
                    }
                }

                // Clear references if no references are found and they haven't been cleared already
                if (!nodeContainsReferences && !nodeReferencesCleared) {
                    this.handleRefTags([], changedNodeTitle, nodes, lines);
                    nodeReferencesCleared = true; // Indicate that references have been cleared
                    //console.log(`References cleared for node: ${changedNodeTitle}`);
                }
            }
        }

        cleanupNodes(nodes, nodeLines) {
            this.deleteInactiveNodes(nodes);
            this.deleteInactiveNodeLines(nodeLines);
        }

        handleNode(line, i, nodeLines, nodes, currentNodeTitle) {
            currentNodeTitle = line.substr(nodeTag.length).trim();

            if (restoreZettelkastenEvent) {
                let savedNode = getNodeByTitle(currentNodeTitle);

                if (savedNode) {
                    const node = this.establishZettelkastenNode(savedNode, currentNodeTitle, nodeLines, nodes);
                    nodeLines[i] = node;
                    nodes[currentNodeTitle] = node;
                    return currentNodeTitle;
                } else {
                    console.log("No existing node found for title:", currentNodeTitle);
                }
            }

            if (!nodes[currentNodeTitle] || nodes[currentNodeTitle].nodeObject.removed) {
                if (nodeLines[i] && !nodeLines[i].nodeObject.removed) {
                    const node = nodes[currentNodeTitle] = nodeLines[i];
                    if (nodes[node.title] === node) {
                        delete nodes[node.title];
                    }
                    node.title = currentNodeTitle;
                    node.live = true;
                    node.nodeObject.titleInput.value = currentNodeTitle;
                } else {
                    let nodeObject;
                    if (nodefromWindow) {
                        nodeObject = createTextNode(currentNodeTitle, '', undefined, undefined, undefined, undefined);
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
                nodes[currentNodeTitle].plainText = "";
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
                console.warn('DOM node is undefined, cannot establish Zettelkasten node.');
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
            const inputElement = node.nodeObject.titleInput;
            const titleInputEventHandler = this.createTitleInputEventHandler(node, nodes, nodeLines, inputElement);
            inputElement.addEventListener('input', titleInputEventHandler);

            const textarea = node.nodeObject.textarea;
            const bodyHandler = this.getHandleNodeBodyInputEvent(node, textarea);
            textarea.addEventListener('input', bodyHandler);
        }


        //Syncs node titles and Zettelkasten
        createTitleInputEventHandler(node, nodes, nodeLines, inputElement) {
            return (e) => {
                if (e.target !== inputElement) {
                    return;
                }
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

                // Collect the relevant CodeMirror instances to update
                const cmInstancesToUpdate = new Set();

                // Get the CodeMirror instance for the current node
                const currentNodeInstance = getZetNodeCMInstance(name);
                if (currentNodeInstance) {
                    cmInstancesToUpdate.add(currentNodeInstance.cmInstance);
                }

                // Process the nodes connected by edges
                for (const edge of node.nodeObject.edges) {
                    // Find the connected node that is not the current node
                    const connectedNode = edge.pts.find(pt => pt !== node.nodeObject);

                    if (connectedNode && connectedNode.isTextNode) {
                        const connectedNodeInstance = getZetNodeCMInstance(connectedNode.getTitle());
                        if (connectedNodeInstance && connectedNodeInstance.cmInstance !== currentNodeInstance.cmInstance) {
                            cmInstancesToUpdate.add(connectedNodeInstance.cmInstance);
                        }
                    }
                }

                // Update the collected CodeMirror instances
                const renameNodeInInstance = renameNode(name, newName);
                for (const cmInstance of cmInstancesToUpdate) {
                    processAll = true;
                    const updatedValue = renameNodeInInstance(cmInstance.getValue());
                    cmInstance.setValue(updatedValue);
                    cmInstance.refresh();
                }

                zetPanes.switchPane(currentNodeInstance.paneId);
                currentNodeInstance.ui.scrollToTitle(node.title);
            };
        }


        //Syncs node text and Zettelkasten
        getHandleNodeBodyInputEvent(node, textarea) {
            return (e) => {
                if (e.target !== textarea) {
                    return;
                }

                const body = textarea.value;
                const name = node.title;
                const { startLineNo, endLineNo } = this.parser.getNodeSectionRange(name);
                let originalValue = this.noteInput.getValue();
                const lines = originalValue.split('\n');

                // Construct the updated content with the new body text
                const updatedContent = [lines[startLineNo], ...body.split('\n')].join('\n');

                // Replace the node's content using replaceRange
                const from = { line: startLineNo, ch: 0 };
                const to = { line: endLineNo, ch: lines[endLineNo].length };

                this.noteInput.operation(() => {
                    this.noteInput.replaceRange(updatedContent, from, to);

                    // Save and restore the scroll position
                    const scrollInfo = this.noteInput.getScrollInfo();
                    this.noteInput.refresh();
                    this.noteInput.scrollTo(scrollInfo.left, scrollInfo.top);

                    // Explicitly update the edges (references)
                    body.split('\n').forEach((line, index) => {
                        if (line.startsWith(refTag)) {
                            // Handle references
                            this.handleReferenceLine(line, node.title, this.nodes, lines, false, startLineNo + index, startLineNo + index);
                        }
                    });
                });

                // Update the textarea value AFTER handling the references to prevent recursive updates
                textarea.value = body;
            };
        }

        extractAllReferencesFromRange(startLine, endLine, lines) {
            let allReferences = [];
            for (let i = startLine; i <= endLine; i++) {
                const line = lines[i];
                // Only proceed if line is defined
                if (line && line.includes(refTag)) {
                    const extractedRefs = this.extractReferencesFromLine(line);
                    allReferences.push(...extractedRefs);
                }
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
            let references = [];

            if (sortedBrackets.includes(refTag)) {
                const closingBracket = bracketsMap[refTag];
                if (line.includes(closingBracket)) {
                    const extracted = this.extractBracketedReferences(line, refTag, closingBracket);
                    references = extracted.references;
                }
            } else {
                references = line.substr(refTag.length).split(',').map(ref => ref.trim());
            }

            return references;
        }

        handleRefTags(references, currentNodeTitle, nodes, lines) {
            const thisNodeWrapper = nodes[currentNodeTitle];
            if (!thisNodeWrapper || !thisNodeWrapper.nodeObject) {
                return;
            }

            const thisNode = thisNodeWrapper.nodeObject;

            // Get all nodes from all CodeMirror instances
            const allNodes = getAllInternalZettelkastenNodes();

            // Initialize set with UUIDs from current node references
            let allReferenceUUIDs = new Set(references.map(ref => allNodes[ref]?.nodeObject?.uuid).filter(uuid => uuid));

            // Check if connected nodes contain a reference to the current node in any CodeMirror instance
            const connectedNodes = getConnectedNodes(thisNode);
            connectedNodes.forEach(node => {
                const nodeInfo = getZetNodeCMInstance(node.getTitle());
                if (nodeInfo) {
                    const { parser, cmInstance } = nodeInfo;
                    const { startLineNo, endLineNo } = parser.getNodeSectionRange(node.getTitle());
                    const nodeLines = cmInstance.getValue().split('\n');
                    const nodeReferences = this.extractAllReferencesFromRange(startLineNo + 1, endLineNo, nodeLines);

                    if (nodeReferences.includes(currentNodeTitle)) {
                        const nodeUUID = node.uuid;
                        allReferenceUUIDs.add(nodeUUID);
                    }
                }
            });

            // Process edges
            const currentEdges = new Map(thisNode.edges.map(edge => {
                const otherNode = edge.pts.find(pt => pt.uuid !== thisNode.uuid);
                return otherNode ? [otherNode.uuid, edge] : [null, edge];
            }));

            // Remove edges not found in reference UUIDs and ensure both nodes are text nodes
            currentEdges.forEach((edge, uuid) => {
                if (!allReferenceUUIDs.has(uuid)) {
                    const otherNode = edge.pts.find(pt => pt.uuid === uuid);
                    if (thisNode.isTextNode && otherNode?.isTextNode) {
                        // Check if there is a reference to the other node in any CodeMirror instance
                        const otherNodeInfo = getZetNodeCMInstance(otherNode.getTitle());
                        if (otherNodeInfo) {
                            const { parser, cmInstance } = otherNodeInfo;
                            const { startLineNo, endLineNo } = parser.getNodeSectionRange(otherNode.getTitle());
                            const otherNodeLines = cmInstance.getValue().split('\n');
                            const otherNodeReferences = this.extractAllReferencesFromRange(startLineNo + 1, endLineNo, otherNodeLines);

                            // Remove the edge only if there are no references to the current node in the other node
                            if (!otherNodeReferences.includes(currentNodeTitle)) {
                                edge.remove();
                                currentEdges.delete(uuid);
                            }
                        }
                    }
                }
            });

            // Update the node's edges array
            thisNode.edges = Array.from(currentEdges.values());

            // Add new edges for references
            references.forEach(reference => {
                const refUUID = allNodes[reference]?.nodeObject?.uuid;
                if (refUUID && !currentEdges.has(refUUID)) {
                    const newEdge = connectDistance(thisNode, allNodes[reference].nodeObject);
                    thisNode.edges.push(newEdge);
                    currentEdges.set(refUUID, newEdge);
                }
            });
        }


        extractBracketedReferences(line, openingBracket, closingBracket) {
            const references = [];
            let buffer = "";
            let insideBrackets = false;
            let residualLine = "";

            for (let i = 0; i < line.length; i++) {
                if (line.startsWith(openingBracket, i)) {
                    if (!insideBrackets) {
                        insideBrackets = true;
                        buffer = "";  // Clear the buffer
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
            let node = nodes[currentNodeTitle];
            let targetTextarea;
            if (node.isLLM) {
                targetTextarea = node.nodeObject.promptTextArea;
            } else {
                targetTextarea = node.nodeObject.textarea;
            }
            if (node.plainText !== '') {
                node.plainText += '\n';
            }
            node.plainText += line;
            // Get the debounced function for the specific textarea
            const debouncedTextareaUpdate = getDebouncedTextareaUpdate(targetTextarea);
            // Use the debounced function to update value and dispatch change event
            debouncedTextareaUpdate(targetTextarea, node.plainText);
            node.skipNewLine = false;
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
                    addLLMNodeInputListener(LLMNode, nodes);
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

        addLLMNodeInputListener(node, nodes) {
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
                this.noteInput.setValue(f(this.noteInput.getValue()));
                this.noteInput.refresh();
            });
        }
    }


function getUniqueNodeTitle(baseTitle, nodes, removeExistingCount = false) {
    let newName = baseTitle.trim().replace(",", "");

    // Remove existing count if needed
    if (removeExistingCount) {
        newName = newName.replace(/\(\d+\)$/, '').trim();
    }

    if (!nodes[newName]) {
        return newName;
    }

    let counter = 2;
    while (nodes[`${newName}(${counter})`]) {
        counter++;
    }
    return `${newName}(${counter})`;
}