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
            const insideBrackets = s.substring(index + open.length, closeIndex);
            if (insideBrackets.trim() === from.trim()) {
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

class NodeWrap {
    edges = new Map();
    live = true;
    plainText = '';
    ref = '';
    constructor(node, title, lineNum = null){
        this.lineNum = lineNum;
        this.node = node;
        this.title = title;
    }
}
TextArea.ofNode = function(node){
    return (node.isLLM ? node.promptTextArea : node.textarea)
}

class ZettelkastenProcessor {
    noteInputLines = [];
    placementStrategy = new NodePlacementStrategy([], {});
    prevNoteInputLines = [];
    wrapPerLine = {};
    wrapPerTitle = {};
    constructor(codeMirrorInstance, parser){
        this.noteInput = codeMirrorInstance;
        this.parser = parser;

        this.noteInput.on('change', this.processInput);
    }

    static updateForThisPath(processor){
        const strategy = processor.placementStrategy;
        if (strategy) strategy.updatePath(this.valueOf());
    }

    spawnNodeFromZettelkasten(currentNodeTitle){
        App.processedNodes.update();
        this.placementStrategy.nodeObjects = App.processedNodes.map;
        return this.placementStrategy.calculatePositionAndScale(currentNodeTitle);
    }

    findFirstChangedLine(lines){
        const prevLines = this.prevNoteInputLines;
        return lines.findIndex( (line, i)=>(line !== prevLines[i]) )
            || Math.min(prevLines.length, lines.length);
    }
    findChangedNode(lines){
        for (let i = this.findFirstChangedLine(lines); i >= 0; i--) {
            if (lines[i] === undefined) break;

            const match = lines[i].match(ZettelkastenParser.regexpNodeTitle);
            if (match) return Node.byTitle(match[1].trim());
        }
    }

    forEachNodeWrap(cb, ct){
        const wrapPerTitle = this.wrapPerTitle;
        for (const title in wrapPerTitle) cb.call(ct, wrapPerTitle[title]);
    }
    initializeNodeWrap(wrap){
        if (wrap.node.removed) return delete this.wrapPerTitle[wrap.title];

        wrap.plainText = '';
        wrap.ref = '';
        wrap.live = false;
    }

    processInput = ()=>{
        if (bypassZettelkasten) {
            bypassZettelkasten = false;
            return;
        }

        this.forEachNodeWrap(this.initializeNodeWrap, this);
        this.noteInputLines = this.noteInput.getValue().split('\n');
        let currentNodeTitle = '';

        this.noteInputLines.forEach((line, index) => {
            currentNodeTitle = this.processLine(line, index, currentNodeTitle)
        });

        if (!processAll) this.processChangedNode(this.noteInputLines);

        this.deleteInactiveNodesFromDict(this.wrapPerTitle);
        this.deleteInactiveNodesFromDict(this.wrapPerLine);

        this.prevNoteInputLines = this.noteInputLines;
        this.noteInputLines = [];
        processAll = false;
        restoreZettelkastenEvent = false;
    }

    processLine(line, index, currentNodeTitle){
        if (line.startsWith(Tag.node)) {
            return this.handleNode(line, index, currentNodeTitle)
        }
        delete this.wrapPerLine[index];

        if (line.startsWith(LLM_TAG)) {
            return this.handleLLM(line, index, currentNodeTitle)
        }

        if (this.wrapPerTitle[currentNodeTitle]?.node.isLLM) {
            return this.handleLlmPromptLine(line, currentNodeTitle)
        }

        if (processAll) { // Removed check for restoreZettelkastenEvent to ensure node body text updates for all nodes when processAll is true.
            // Call without the start and end lines
            this.handlePlainTextAndReferences(line, currentNodeTitle)
        }

        return currentNodeTitle;
    }

    handlePlainTextAndReferences(line, currentNodeTitle, startLine = null, endLine = null, partial){
        //this.removeStaleReferences(currentNodeTitle, this.wrapPerTitle);

        if (line.includes(Tag.ref)) {
            // If startLine and endLine are null, handleReferenceLine will use its default behavior
            this.handleReferenceLine(line, currentNodeTitle, this.noteInputLines, true, startLine, endLine);
        } else {
            const wrap = this.wrapPerTitle[currentNodeTitle];
            if (wrap) this.handleLineWithoutTags(wrap, line, partial);
        }
    }

    // Updated to handle processChangedNode
    processChangedNode(lines){
        const changedNode = this.findChangedNode(lines);
        if (!changedNode) return;

        const changedNodeTitle = changedNode.getTitle();
        const range = this.parser.getNodeSectionRange(changedNodeTitle);
        const { startLineNo, endLineNo } = range;

        let nodeContainsReferences = false;
        let nodeReferencesCleared = false;
        for (let i = startLineNo + 1; i <= endLineNo && i < lines.length; i++) {
            // Process each line and update the nodeContainsReferences flag
            this.handlePlainTextAndReferences(lines[i], changedNodeTitle, startLineNo, endLineNo, true);
            if (lines[i].includes(Tag.ref)) {
                nodeContainsReferences = true;
                nodeReferencesCleared = false;
            }
        }
        if (lines.length && startLineNo < endLineNo) {
            const textArea = TextArea.ofNode(changedNode);
            const text = this.wrapPerTitle[changedNodeTitle].plainText;
            TextArea.update.call(textArea, text);
        }

        // Clear references if no references are found and they haven't been cleared already
        if (!nodeContainsReferences && !nodeReferencesCleared) {
            this.handleRefTags([], changedNodeTitle);
            nodeReferencesCleared = true;
            Logger.debug("References cleared for node:", changedNodeTitle);
        }
    }

    handleNode(line, i, currentNodeTitle){
        const wrapPerLine = this.wrapPerLine;
        const wrapPerTitle = this.wrapPerTitle;
        currentNodeTitle = line.substr(Tag.node.length).trim();

        if (restoreZettelkastenEvent) {
            const savedNode = Node.byTitle(currentNodeTitle);
            if (savedNode) {
                const wrap = this.makeZetWrap(savedNode, currentNodeTitle);
                wrapPerLine[i] = wrapPerTitle[currentNodeTitle] = wrap;
                return currentNodeTitle;
            }

            Logger.info("No existing node found for title:", currentNodeTitle);
        }

        const wrap = wrapPerTitle[currentNodeTitle];
        if (!wrap || wrap.node.removed) {
            if (wrapPerLine[i] && !wrapPerLine[i].node.removed) {
                const wrap = wrapPerTitle[currentNodeTitle] = wrapPerLine[i];
                const title = wrap.title;
                if (wrapPerTitle[title] === wrap) delete wrapPerTitle[title];
                wrap.title = currentNodeTitle;
                wrap.live = true;
                wrap.node.view.titleInput.value = currentNodeTitle;
            } else {
                const node = (nodefromWindow) ? TextNode.create(currentNodeTitle)
                           : this.spawnNodeFromZettelkasten(currentNodeTitle);
                if (nodefromWindow) {
                    nodefromWindow = false;
                    if (followMouseFromWindow) {
                        node.followingMouse = 1;
                        followMouseFromWindow = false;
                    }
                }

                const wrap = this.makeZetWrap(node, currentNodeTitle);
                wrapPerLine[i] = wrap;
                wrapPerTitle[currentNodeTitle] = wrap;
            }
        } else {
            wrap.plainText = '';
            wrap.node.textarea.value = wrap.plainText;
            const lineNum = wrap.lineNum;
            if (wrapPerLine[lineNum] === wrap) delete wrapPerLine[lineNum];
            wrap.live = true;
            wrap.lineNum = i;
            wrapPerLine[i] = wrap;
        }
        return currentNodeTitle;
    }

    makeZetWrap(node, title){
        const wrap = new NodeWrap(node, title);
        this.initZetWrap(wrap);
        return wrap;
    }

    initZetWrap(wrap){
        const node = wrap.node;
        On.input(node.view.titleInput, this.onTitleInput.bind(this, wrap));
        On.input(TextArea.ofNode(node), this.onNodeBodyInput.bind(this, wrap));
    }

    //Syncs node titles and Zettelkasten
    onTitleInput(wrap, e){
        const titleInput = e.currentTarget;
        if (e.target !== titleInput) return;

        let newName = titleInput.value.trim().replace(',', '');
        // If a count was previously added, attempt to remove it
        if (wrap.countAdded) {
            const updatedTitle = newName.replace(/\(\d+\)$/, '').trim();
            if (updatedTitle !== newName) {
                newName = updatedTitle;
                titleInput.value = newName;
                wrap.countAdded = false;
            }
        }
        const name = wrap.title;
        if (newName === name) return;

        const wrapPerTitle = this.wrapPerTitle;
        delete wrapPerTitle[name];
        const countAdded = wrap.countAdded = Boolean(wrapPerTitle[newName]);
        if (countAdded) {
            titleInput.value = newName = this.getUniqueNodeName(newName);
        }
        wrapPerTitle[newName] = wrap;
        wrap.title = newName;
        // Set cursor position to before the count if a count was added
        if (countAdded) {
            const cursorPosition = newName.indexOf('(');
            titleInput.setSelectionRange(cursorPosition, cursorPosition);
        }

        // Collect the relevant CodeMirror instances to update
        const cmInstancesToUpdate = new Set();

        // Get the CodeMirror instance for the current node
        const currentNodeInstance = getZetNodeCMInstance(name);
        const currentCm = currentNodeInstance?.cm;
        if (currentCm) cmInstancesToUpdate.add(currentCm);

        // Process the nodes connected by edges
        for (const edge of wrap.node.edges) {
            // Find the connected node that is not the current node
            const connectedNode = edge.pts.find(pt => pt !== wrap.node);

            if (connectedNode?.isTextNode) {
                const connectedTitle = connectedNode.getTitle();
                const connectedCm = getZetNodeCMInstance(connectedTitle)?.cm;
                if (connectedCm) cmInstancesToUpdate.add(connectedCm);
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

        App.zetPanes.switchPane(currentNodeInstance.paneId);
        currentNodeInstance.ui.scrollToTitle(wrap.title);
    }

    //Syncs node text and Zettelkasten
    onNodeBodyInput(node, e){
        const textArea = e.currentTarget;
        if (e.target !== textArea) return;

        const body = textArea.value;
        const name = node.title;
        const { startLineNo, endLineNo } = this.parser.getNodeSectionRange(name);
        const lines = this.noteInput.getValue().split('\n');

        // Create the updated content
        let updatedContent = lines[startLineNo] + '\n'; // Node title line
        updatedContent += body;

        // Replace the node's content using replaceRange
        const from = { ch: 0, line: startLineNo };
        const ch = (lines[endLineNo] || '').length;
        const to = { ch, line: Math.max(startLineNo, endLineNo) };

        this.noteInput.operation(() => {
            this.noteInput.replaceRange(updatedContent, from, to);

            // Handle references
            const bodyLines = body.split('\n');
            bodyLines.forEach( (line, index)=>{
                if (line.startsWith(Tag.ref)) {
                    const lineIndex = startLineNo + 1 + index;
                    this.handleReferenceLine(line, node.title, bodyLines, false, lineIndex, lineIndex);
                }
            });
        });
    }

    forEachReferenceInRange(startLine, endLine, lines, cb, ct){
        for (let i = startLine; i <= endLine; i++) {
            const res = this.forEachReferenceInLine(lines[i], cb, ct);
            if (res) return res;
        }
    }

    // Modified handleReferenceLine to use optional given range or generate one if not provided
    handleReferenceLine(line, currentNodeTitle, lines, shouldAppend = true,
                        startLineIndex = null, endLineIndex = null){
        const wrap = this.wrapPerTitle[currentNodeTitle];
        if (!wrap) return;

        // Check if the startLineIndex and endLineIndex are provided and within the bounds of the lines array
        if (startLineIndex === null || endLineIndex === null || startLineIndex < 0 || endLineIndex >= lines.length) {
            const range = this.parser.getNodeSectionRange(currentNodeTitle);
            startLineIndex = range.startLineNo + 1; // +1 to skip the title
            endLineIndex = range.endLineNo;
        }
        const allReferences = [];
        this.forEachReferenceInRange(startLineIndex, endLineIndex, lines, allReferences.push, allReferences);
        this.handleRefTags(allReferences, currentNodeTitle);

        // Build plain text for node after tags
        if (shouldAppend) {
            const linesToAdd = [wrap.plainText, line].filter(Boolean);
            wrap.plainText = linesToAdd.join('\n');

            const targetTextarea = wrap.node.content.children[0].children[1].children[0];
            targetTextarea.value = wrap.plainText;
        }
    }

    forEachReferenceInLine(line, cb, ct){
        const refTag = Tag.ref;
        if (!line || !line.includes(refTag)) return;

        if (sortedBrackets.includes(refTag)) {
            return this.forEachBracketedReferenceInLine(refTag, line, cb, ct)
        }

        for (const ref of line.substr(refTag.length).split(',')) {
            const res = cb.call(ct, ref.trim());
            if (res) return res;
        }
    }

    handleRefTags(references, currentNodeTitle){
        const wrap = this.wrapPerTitle[currentNodeTitle];
        if (!wrap?.node) return;

        const currentNodeIsRef = (ref)=>(ref === currentNodeTitle) ;
        const thisNode = wrap.node;

        // Get all nodes from all CodeMirror instances
        const wrapPerTitle = getAllInternalZetNodeWraps();

        // Initialize set with UUIDs from current node references
        const uuidOfRef = (ref)=>Node.byTitle(ref)?.uuid ;
        const allReferenceUUIDs = new Set(references.map(uuidOfRef).filter(uuid => uuid));

        // Check if connected nodes contain a reference to the current node in any CodeMirror instance
        thisNode.forEachConnectedNode( (node)=>{
            const nodeInfo = getZetNodeCMInstance(node.getTitle());
            if (!nodeInfo) return;

            const { startLineNo, endLineNo } = nodeInfo.parser.getNodeSectionRange(node.getTitle());
            const nodeLines = nodeInfo.cm.getValue().split('\n');
            const isRef = this.forEachReferenceInRange(startLineNo + 1, endLineNo, nodeLines, currentNodeIsRef);
            if (isRef) allReferenceUUIDs.add(node.uuid);
        });

        // Process edges
        function hasUuidThis(pt){ return pt.uuid === this.valueOf() }
        function hasUuidNotThis(pt){ return pt.uuid !== this.valueOf() }
        const currentEdges = new Map(thisNode.edges.map(edge => {
            const otherNode = edge.pts.find(hasUuidNotThis, thisNode.uuid);
            return otherNode ? [otherNode.uuid, edge] : [null, edge];
        }));

        // Remove edges not found in reference UUIDs and ensure both nodes are text nodes
        currentEdges.forEach((edge, uuid) => {
            if (allReferenceUUIDs.has(uuid)) return;

            const otherNode = edge.pts.find(hasUuidThis, uuid);
            if (!thisNode.isTextNode || !otherNode?.isTextNode) return;

            // Check if there is a reference to the other node in any CodeMirror instance
            const otherTitle = otherNode.getTitle();
            const otherNodeInfo = getZetNodeCMInstance(otherTitle);
            if (!otherNodeInfo) return;

            const { startLineNo, endLineNo } = otherNodeInfo.parser.getNodeSectionRange(otherTitle);
            const otherNodeLines = otherNodeInfo.cm.getValue().split('\n');
            const isRef = this.forEachReferenceInRange(startLineNo + 1, endLineNo, otherNodeLines, currentNodeIsRef);
            if (isRef) return;

            edge.remove();
            currentEdges.delete(uuid);
        });

        thisNode.edges = Array.from(currentEdges.values());

        // Add new edges for references
        references.forEach(reference => {
            const refUUID = wrapPerTitle[reference]?.node?.uuid;
            if (!refUUID || currentEdges.has(refUUID)) return;

            const otherNode = wrapPerTitle[reference].node;
            const newEdge = connectDistance(thisNode, otherNode);
            thisNode.edges.push(newEdge);
            currentEdges.set(refUUID, newEdge);
        });
    }

    forEachBracketedReferenceInLine(openingBracket, line, cb, ct){
        const closingBracket = bracketsMap[openingBracket];
        if (!line.includes(closingBracket)) return;

        const buffer = [];
        let insideBrackets = false;
        for (let i = 0; i < line.length; i++) {
            if (!insideBrackets) {
                if (line.startsWith(openingBracket, i)) {
                    insideBrackets = true;
                    buffer.length = 0;
                    i += openingBracket.length - 1;  // Skip the bracket characters
                }
            } else if (line.startsWith(closingBracket, i)) {
                insideBrackets = false;
                if (buffer.length > 0) {
                    const res = cb.call(ct, buffer.join('').trim());
                    if (res) return res;
                }
                i += closingBracket.length - 1;  // Skip the bracket characters
            } else {
                buffer.push(line[i]);
            }
        }
    }

    handleLineWithoutTags(wrap, line, partial){
        wrap.plainText += (wrap.plainText ? '\n' : '') + line;
        if (partial) return;

        const textArea = TextArea.ofNode(wrap.node);

        // getDebouncedTextareaUpdate(textArea)(wrap.plainText);
        Promise.delay(20).then(TextArea.update.bind(textArea, wrap.plainText));
    }

    deleteInactiveNodesFromDict(dict){
        const dels = [];
        for (const k in dict) {
            if (dict[k].live) continue;

            dict[k].node.remove();
            dels.push(k);
        }
        for (const k of dels) delete dict[k];
    }

    handleLlmPromptLine(line, currentNodeTitle){
        if (line.startsWith(Tag.node) || line.startsWith(Tag.ref)) return '';

        const wrap = this.wrapPerTitle[currentNodeTitle];
        const textArea = TextArea.ofNode(wrap.node);
        textArea.value += (textArea.value ? '\n' : '') + line.trim();
        return currentNodeTitle;
    }

    handleLLM(line, i, currentNodeTitle){
        const wrapPerLine = this.wrapPerLine;
        const wrapPerTitle = this.wrapPerTitle;
        const nodeTitle = line.substr("LLM:".length).trim() || "Untitled";
        currentNodeTitle = nodeTitle;

        let wrap = wrapPerTitle[nodeTitle];

        if (!wrap || wrap.node.removed) {
            if (wrapPerLine[i] && !wrapPerLine[i].node.removed) {
                wrap = wrapPerTitle[nodeTitle] = wrapPerLine[i];
                delete wrapPerTitle[wrap.title];
                wrap.title = nodeTitle;
                wrap.live = true;
                wrap.node.content.children[0].children[0].children[1].value = nodeTitle;
            } else {
                const sx = (Math.random() - 0.5) * 1.8;
                const sy = (Math.random() - 0.5) * 1.8;
                const node = createLlmNode(nodeTitle, sx, sy);
                wrap = new NodeWrap(node, nodeTitle, i);
                wrapPerLine[i] = wrapPerTitle[nodeTitle] = wrap;
                this.initLlmWrap(wrap);
            }
        } else {
            wrap.live = true;
            wrap.lineNum = i;
            // delete wrapPerLine[wrap.lineNum]; // compare to handleNode
            wrapPerLine[i] = wrap;
        }
        currentNodeTitle = nodeTitle;
        TextArea.ofNode(wrap.node).value = '';
        return currentNodeTitle;
    }

    initLlmWrap(wrap){
        On.input(wrap.node.content.children[0].children[0].children[1], (e)=>{
            const oldName = wrap.title;
            let newName = e.target.value.trim().replace(',', '');
            if (newName === oldName) return;

            const wrapPerTitle = this.wrapPerTitle;
            delete wrapPerTitle[oldName];

            if (wrapPerTitle[newName]) {
                newName = e.target.value = this.getUniqueNodeTitle(newName);
            }

            wrapPerTitle[newName] = wrap;
            wrap.title = newName;

            const noteInput = this.noteInput;
            const f = renameNode(oldName, newName);
            noteInput.setValue(f(noteInput.getValue()));
            noteInput.refresh();
        });
    }

    getUniqueNodeTitle(baseTitle, removeExistingCount = false){
        let newName = baseTitle.trim().replace(',', '');

        if (removeExistingCount) {
            newName = newName.replace(/\(\d+\)$/, '').trim();
        }

        return (!this.wrapPerTitle[newName]) ? newName
             : this.getUniqueNodeName(newName);
    }

    getUniqueNodeName(name){
        const arr = [name, '(', 2, ')'];
        const wrapPerTitle = this.wrapPerTitle;
        while (wrapPerTitle[arr.join('')]) arr[2] += 1;
        return arr.join('');
    }
}
