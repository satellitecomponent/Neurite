
function getAllInternalZettelkastenNodes() {
    const allNodes = {};
    window.zettelkastenProcessors.forEach(processor => {
        Object.assign(allNodes, processor.nodes);
    });
    return allNodes;
}


let nodeTitles = new Set(); // Use a Set for global titles to avoid duplicates

class ZettelkastenParser {
    constructor(codeMirrorInstance) {
        this.cm = codeMirrorInstance;
        this.nodeTitleToLineMap = new Map();
        this.internalParserInstanceTitles = new Set(); // Use a Set to manage instance-specific titles
        this.initializeParser();
    }

    initializeParser() {
        this.cm.on("change", () => {
            this.updateNodeTitleToLineMap();
            this.identifyNodeTitles();
        });
    }

    identifyNodeTitles() {
        const newTitles = new Set();
        this.cm.eachLine((line) => {
            const match = line.text.match(nodeTitleRegexGlobal);
            if (match) {
                let title = match[1].trim();
                if (title.endsWith(',')) {
                    title = title.slice(0, -1);
                }
                newTitles.add(title); // Add new title to local set
            }
        });

        this.updateGlobalTitles(newTitles);
    }

    updateGlobalTitles(newTitles) {
        // Remove old titles from the global set that are no longer present in the new set
        this.internalParserInstanceTitles.forEach(title => {
            if (!newTitles.has(title)) {
                nodeTitles.delete(title);
            }
        });

        // Add new titles to the global set
        newTitles.forEach(title => {
            if (!this.internalParserInstanceTitles.has(title)) {
                nodeTitles.add(title);
            }
        });

        // Update the internal set to the new set
        this.internalParserInstanceTitles = newTitles;
    }

    updateNodeTitleToLineMap() {
        this.nodeTitleToLineMap.clear();

        let currentNodeTitleLineNo = null;
        this.cm.eachLine((line) => {
            if (line.text.startsWith(nodeTag)) {
                const title = line.text.split(nodeTag)[1].trim();
                currentNodeTitleLineNo = line.lineNo();
                this.nodeTitleToLineMap.set(title, currentNodeTitleLineNo);
            }
        });
    }

    getNodeSectionRange(title) {
        const lowerCaseTitle = title.toLowerCase();
        let nodeLineNo;
        let nextNodeLineNo = this.cm.lineCount();

        let foundCurrentNode = false;

        for (const [mapTitle, mapLineNo] of Array.from(this.nodeTitleToLineMap).sort((a, b) => a[1] - b[1])) {
            if (mapTitle.toLowerCase() === lowerCaseTitle) {
                nodeLineNo = mapLineNo;
                foundCurrentNode = true;
                continue;
            }
            if (foundCurrentNode) {
                nextNodeLineNo = mapLineNo;
                break;
            }
        }

        let startLineNo = nodeLineNo;
        let endLineNo;

        if (nextNodeLineNo === this.cm.lineCount()) {
            endLineNo = this.cm.lineCount() - 1;
        } else {
            endLineNo = nextNodeLineNo - 1;
        }

        return { startLineNo, endLineNo };
    }

    retrieveNodeSectionText(title) {
        const { startLineNo, endLineNo } = this.getNodeSectionRange(title);
        let lines = [];
        for (let i = startLineNo; i <= endLineNo; i++) {
            lines.push(this.cm.getLine(i));
        }
        return lines.join("\n");
    }

    getNodeTitleLine(title) {
        const lowerCaseTitle = title.toLowerCase();
        for (const [mapTitle, mapLineNo] of Array.from(this.nodeTitleToLineMap).sort((a, b) => a[1] - b[1])) {
            if (mapTitle.toLowerCase() === lowerCaseTitle) {
                return mapLineNo;
            }
        }
        return null;
    }
    deleteNodeByTitle(title) {
        const startLineNo = this.nodeTitleToLineMap.get(title);

        if (typeof startLineNo !== 'undefined') {
            let endLineNo = startLineNo;
            for (let i = startLineNo + 1; i < this.cm.lineCount(); i++) {
                const lineText = this.cm.getLine(i);
                if (lineText.startsWith(nodeTag)) {
                    endLineNo = i - 1;
                    break;
                }
                endLineNo = i;
            }

            this.cm.replaceRange("", { line: startLineNo, ch: 0 }, { line: endLineNo + 1, ch: 0 });
            this.cm.refresh();
        }
    }
    updateMode() {
        const node = nodeTag;
        const ref = refTag;
        this.cm.setOption("mode", { name: "custom", node: node, ref: ref });
        this.cm.refresh();
    }
    addEdge(fromTitle, toTitle, cmInstance) {
        if (!fromTitle || !toTitle) {
            console.error("One or both titles are empty or undefined.");
            return;
        }

        const appendOrCreateTag = (range, tagLineStart, newTag, tagPrefix = "", useCSV = false) => {
            const getTrailingWhitespace = range => {
                let count = 0;
                for (let i = range.endLineNo; i >= range.startLineNo; i--) {
                    if (cmInstance.getLine(i).trim() === "") {
                        count++;
                    } else {
                        break;
                    }
                }
                return count;
            };

            const insertTagInWhitespace = (endLine, count, tag) => {
                let isEndOfDoc = (endLine === cmInstance.lineCount() - 1);

                if (count === 0) {
                    if (isEndOfDoc) {
                        cmInstance.replaceRange(`\n\n${tag}\n`, { line: endLine + 1, ch: 0 });
                    } else {
                        cmInstance.replaceRange(`\n${tag}\n\n`, { line: endLine + 1, ch: 0 });
                    }
                } else if (count === 1) {
                    cmInstance.replaceRange(`\n${tag}\n`, { line: endLine, ch: 0 });
                } else if (count === 2) {
                    cmInstance.replaceRange(`${tag}\n`, { line: endLine, ch: 0 });
                } else {
                    cmInstance.replaceRange(`${tag}`, { line: endLine - 1, ch: 0 });
                }
            };

            const whitespaceCount = getTrailingWhitespace(range);

            if (tagLineStart !== null) {
                const oldLine = cmInstance.getLine(tagLineStart);
                if (!oldLine.includes(newTag)) {
                    const separator = useCSV ? ', ' : ' ';
                    cmInstance.replaceRange(`${oldLine}${separator}${newTag}`, { line: tagLineStart, ch: 0 }, { line: tagLineStart, ch: oldLine.length });
                }
            } else {
                insertTagInWhitespace(range.endLineNo, whitespaceCount, `${tagPrefix}${newTag}`);
            }
        };

        const fromRange = this.getNodeSectionRange(fromTitle);
        const refTag = tagValues.refTag;
        let tagLineStart = null;

        for (let i = fromRange.startLineNo; i <= fromRange.endLineNo; i++) {
            const lineText = cmInstance.getLine(i);
            if (lineText.startsWith(refTag)) {
                tagLineStart = i;
                break;
            }
        }

        const closingBracket = bracketsMap[refTag];

        if (closingBracket) {
            appendOrCreateTag(fromRange, tagLineStart, `${refTag}${toTitle}${closingBracket}`);
        } else {
            appendOrCreateTag(fromRange, tagLineStart, toTitle, `${refTag} `, true);
        }
    }

    removeEdge(fromTitle, toTitle, cmInstance) {
        if (!fromTitle || !toTitle) {
            console.error("One or both titles are empty or undefined.");
            return;
        }

        const lineCount = cmInstance.lineCount();
        const closingBracket = bracketsMap[refTag];

        const nodeLine = this.getNodeTitleLine(fromTitle);
        if (nodeLine !== null) {
            for (let j = nodeLine + 1; j < lineCount; j++) {
                let nextLine = cmInstance.getLine(j);
                if (nextLine.startsWith(nodeTag)) break;

                let escapedRefTag = escapeRegExp(tagValues.refTag);
                let lineHasRefTag = new RegExp(escapedRefTag).test(nextLine);

                if (lineHasRefTag) {
                    let escapedTargetTitle = escapeRegExp(toTitle);

                    let regExp;
                    if (closingBracket) {
                        regExp = new RegExp(`(${escapedRefTag}\\s*${escapedTargetTitle}\\s*${escapeRegExp(closingBracket)})|(,?\\s*${escapedTargetTitle}\\s*,?)`, 'g');
                    } else {
                        regExp = new RegExp(`(${escapedRefTag}\\s*${escapedTargetTitle}\\s*${escapedRefTag})|(,?\\s*${escapedTargetTitle}\\s*,?)`, 'g');
                    }

                    nextLine = nextLine.replace(regExp, (match, p1, p2) => {
                        if (p1) {
                            return '';
                        } else if (p2) {
                            return p2.startsWith(',') ? ',' : '';
                        }
                    }).trim();

                    nextLine = nextLine.replace(/,\s*$/, '').trim();

                    if (closingBracket) {
                        let emptyBracketsRegExp = new RegExp(`${escapedRefTag}\\s*${escapeRegExp(closingBracket)}`, 'g');
                        if (emptyBracketsRegExp.test(nextLine)) {
                            nextLine = nextLine.replace(emptyBracketsRegExp, '');
                        }
                    } else {
                        let lonelyRefTag = new RegExp(`^${escapedRefTag}\\s*$`);
                        if (lonelyRefTag.test(nextLine)) {
                            nextLine = '';
                        }
                    }

                    cmInstance.replaceRange(nextLine, { line: j, ch: 0 }, { line: j, ch: cmInstance.getLine(j).length });
                }
            }
        }

        cmInstance.refresh();
    }
}

function updateAllZetMirrorModes() {
    if (window.zettelkastenParsers) {
        window.zettelkastenParsers.forEach(parser => {
            if (parser && typeof parser.updateMode === 'function') {
                parser.updateMode();
            }
        });
    }
}

function updateAllZettelkastenProcessors() {
    if (window.zettelkastenProcessors) {
        window.zettelkastenProcessors.forEach(processor => {
            if (processor && typeof processor.processInput === 'function') {
                processor.processInput();
            }
        });
    }
}


CodeMirror.defineMode("custom", function (config, parserConfig) {
    const Prompt = `${PROMPT_IDENTIFIER}`;
    var node = parserConfig.node || "";
    var ref = parserConfig.ref || "";

    const htmlMixedMode = CodeMirror.getMode(config, "htmlmixed");
    const cssMode = CodeMirror.getMode(config, "css");
    const jsMode = CodeMirror.getMode(config, "javascript");
    const pythonMode = CodeMirror.getMode(config, "python");

    return {
        startState: function () {
            return {
                inBlock: null,
                subState: null
            };
        },
        token: function (stream, state) {
            if (stream.sol()) {
                let match = stream.match(/```(html|css|(js|javascript)|python)/, false);
                if (match && match[1]) {
                    state.inBlock = match[1] === "javascript" ? "js" : match[1];
                    state.subState = CodeMirror.startState({ 'html': htmlMixedMode, 'css': cssMode, 'js': jsMode, 'python': pythonMode }[state.inBlock]);
                    stream.skipToEnd();
                    return "string";
                }

                match = stream.match(/```/, false);
                if (match) {
                    state.inBlock = null;
                    state.subState = null;
                    stream.skipToEnd();
                    return "string";
                }
            }

            if (state.inBlock) {
                return ({ 'html': htmlMixedMode, 'css': cssMode, 'js': jsMode, 'python': pythonMode }[state.inBlock]).token(stream, state.subState);
            }


            if (stream.match(Prompt)) {
                return "Prompt";
            }

            if (stream.match(node)) {
                return "node";
            }

            // Check the refTag in the bracketsMap
            if (bracketsMap[ref]) {
                if (stream.match(ref, false)) {  // Check for the opening bracket
                    stream.match(ref);  // Consume the opening bracket
                    return "ref";
                }

                const closingBracket = bracketsMap[ref];
                if (stream.match(closingBracket, false)) {  // Check for the corresponding closing bracket
                    stream.match(closingBracket);  // Consume the closing bracket
                    return "ref";
                }
            } else {
                // If refTag isn't in the bracketsMap, match it directly
                if (stream.match(ref)) {
                    return "ref";
                }
            }

            stream.next();
            return null;
        },
    };
});

function getActiveZetCMInstanceInfo() {
    const activeCodeMirror = window.currentActiveZettelkastenMirror;
    if (activeCodeMirror) {
        for (const ui of window.zettelkastenUIs) {
            if (ui.cm === activeCodeMirror) {
                const textarea = activeCodeMirror.getTextArea();
                const textareaId = activeCodeMirror.getTextArea().id;
                const paneId = textareaId.replace('zet-note-input-', 'zet-pane-');
                return {
                    ui,
                    parser: ui.parser,
                    cmInstance: activeCodeMirror,
                    textarea,
                    paneId
                };
            }
        }
    }
    return null;
}

function getZetNodeCMInstance(nodeOrTitle) {
    let title = typeof nodeOrTitle === 'string' ? nodeOrTitle : nodeOrTitle.getTitle();
    for (let i = 0; i < window.zettelkastenUIs.length; i++) {
        const ui = window.zettelkastenUIs[i];
        if (ui.parser.nodeTitleToLineMap.has(title)) {
            const lineNumber = ui.parser.nodeTitleToLineMap.get(title);
            const cmInstance = ui.cm;
            const textareaId = cmInstance.getTextArea().id;
            const paneId = textareaId.replace('zet-note-input-', 'zet-pane-');
            const zettelkastenProcessor = window.zettelkastenProcessors[i];
            return {
                ui,
                parser: ui.parser,
                cmInstance,
                lineNumber,
                paneId: paneId,
                zettelkastenProcessor
            };
        }
    }
    return null;
}


function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Flag to control recursion
let isEdgeBeingAdded = false;

function addEdgeToZettelkasten(title, linkedTitle) {
    if (!title || !linkedTitle) {
        console.error("One or both titles are empty or undefined.");
        return;
    }

    const nodeInfo = getZetNodeCMInstance(title);

    if (nodeInfo) {
        const { parser, cmInstance } = nodeInfo;
        parser.addEdge(title, linkedTitle, cmInstance);
    }
}

function removeEdgeFromZettelkasten(title, linkedTitle) {
    if (!title || !linkedTitle) {
        console.error("One or both titles are empty or undefined.");
        return;
    }

    const nodeInfo = getZetNodeCMInstance(title);

    if (nodeInfo) {
        const { parser, cmInstance } = nodeInfo;
        parser.removeEdge(title, linkedTitle, cmInstance);
    }
}

function getEdgeInfo(startTitle, endTitle) {
    const edgeInfo = {
        startNodeInfo: null,
        endNodeInfo: null
    };

    // Get the start and end node information from all instances
    edgeInfo.startNodeInfo = getZetNodeCMInstance(startTitle);
    edgeInfo.endNodeInfo = getZetNodeCMInstance(endTitle);

    return edgeInfo;
}

function removeEdgeFromAllInstances(startTitle, endTitle) {
    removeEdgeFromZettelkasten(startTitle, endTitle);
    removeEdgeFromZettelkasten(endTitle, startTitle);
}


class ZettelkastenUI {
    constructor(codeMirrorInstance, textarea, parser) {
        this.cm = codeMirrorInstance;
        this.parser = parser;
        this.initializeUI();

        this.textarea = textarea;

        this.cm.display.wrapper.style.backgroundColor = '#222226';
        this.cm.display.wrapper.style.width = 'auto';
        this.cm.display.wrapper.style.height = '100%';
        this.cm.display.wrapper.style.borderStyle = 'inset';
        this.cm.display.wrapper.style.borderColor = '#8882';
        this.cm.display.wrapper.style.fontSize = '16px';
        this.cm.display.wrapper.style.wordWrap = 'break-word';
        this.cm.getWrapperElement().style.resize = "vertical";

        this.ignoreTextAreaChanges = false;
        this.userScrolledUp = false;
    }

    initializeUI() {
        this.cm.on("mousedown", (cm, event) => {
            const pos = cm.coordsChar({ left: event.clientX, top: event.clientY });
            const token = cm.getTokenAt(pos);

            if (token.type && token.type.includes("node")) {
                const lineContent = cm.getLine(pos.line);
                const title = lineContent.split(nodeTag)[1].trim();
                if (title) toggleNodeState(title, event);
                return;
            }

            const isWithin = this.isWithinMarkedText(cm, pos, 'node-title');

            if (isWithin) {
                const lineMarkers = cm.findMarksAt(pos);
                let titles = lineMarkers.filter(marker => marker.className === 'node-title')
                    .map(marker => cm.getRange(marker.find().from, marker.find().to));

                if (titles.length > 0) {
                    const longestTitle = titles.reduce((a, b) => a.length > b.length ? a : b);
                    const markerForLongestTitle = lineMarkers.find(marker => {
                        const rangeText = cm.getRange(marker.find().from, marker.find().to);
                        return rangeText === longestTitle;
                    });

                    if (markerForLongestTitle) {
                        const from = markerForLongestTitle.find().from;
                        const to = markerForLongestTitle.find().to;

                        if (pos.ch === from.ch || pos.ch === to.ch) {
                            if (longestTitle.length === 1) {
                                handleTitleClick(longestTitle);
                            } else {
                                cm.setCursor(pos);
                            }
                        } else {
                            event.preventDefault();
                            handleTitleClick(longestTitle);
                        }
                    }
                }
            } else {
                const leftPos = CodeMirror.Pos(pos.line, pos.ch - 1);
                const rightPos = CodeMirror.Pos(pos.line, pos.ch + 1);
                const isLeftAdjacent = this.isWithinMarkedText(cm, leftPos, 'node-title');
                const isRightAdjacent = this.isWithinMarkedText(cm, rightPos, 'node-title');

                if (isLeftAdjacent || isRightAdjacent) {
                    cm.setCursor(pos);
                }

                const lineText = cm.getLine(pos.line);
                const nodeInputValue = nodeTag;
                if (lineText.startsWith(nodeInputValue)) {
                    cm.setCursor(pos);
                }
            }
        });

        this.cm.on("cursorActivity", (cm) => {
            const cursorPos = cm.getCursor();
            const cursorLineNo = cursorPos.line;

            let currentNodeSectionTitle;
            for (const [title, lineNo] of Array.from(this.parser.nodeTitleToLineMap).sort((a, b) => a[1] - b[1])) {
                if (lineNo <= cursorLineNo) {
                    currentNodeSectionTitle = title;
                } else {
                    break;
                }
            }

            if (currentNodeSectionTitle) {
                const { startLineNo, endLineNo } = this.parser.getNodeSectionRange(currentNodeSectionTitle);
                if (cursorLineNo >= startLineNo && cursorLineNo <= endLineNo) {
                    highlightNodeSection(this.cm, this.parser, currentNodeSectionTitle);
                    return;
                }
            }

            cm.getAllMarks().forEach(mark => {
                if (mark.className === 'current-node-section') mark.clear();
            });
        });

        this.cm.on("change", (instance, changeObj) => {
            this.ignoreTextAreaChanges = true;
            this.textarea.value = instance.getValue();

            var event = new Event('input', {
                bubbles: true,
                cancelable: true,
            });

            this.textarea.dispatchEvent(event);

            this.ignoreTextAreaChanges = false;

            // Update node titles and highlight them
            this.parser.identifyNodeTitles();
            this.highlightNodeTitles();
        });

        this.cm.on("scroll", () => {
            var scrollInfo = this.cm.getScrollInfo();
            var atBottom = scrollInfo.height - scrollInfo.top - scrollInfo.clientHeight < 1;
            if (!atBottom) {
                this.userScrolledUp = true;
            } else {
                this.userScrolledUp = false;
            }
        });
        
    }

    isWithinMarkedText(cm, pos, className) {
        const lineMarkers = cm.findMarksAt(pos);
        for (let i = 0; i < lineMarkers.length; i++) {
            if (lineMarkers[i].className === className) {
                return true;
            }
        }
        return false;
    }

    highlightNodeTitles() {
        this.cm.getAllMarks().forEach(mark => mark.clear());

        this.cm.eachLine((line) => {
            nodeTitles.forEach((title) => {
                if (title.length > 0) {
                    const escapedTitle = RegExp.escape(title);
                    const regex = new RegExp(escapedTitle, "ig");
                    let match;
                    while (match = regex.exec(line.text)) {
                        const idx = match.index;
                        if (idx !== -1) {
                            this.cm.markText(
                                CodeMirror.Pos(line.lineNo(), idx),
                                CodeMirror.Pos(line.lineNo(), idx + title.length),
                                {
                                    className: 'node-title',
                                    handleMouseEvents: true
                                }
                            );
                        }
                    }
                }
            });
        });
    }

    scrollToLine(cmInstance, lineNumber) {
        const lastLine = cmInstance.lastLine();
        const validLineNumber = Math.min(lineNumber, lastLine);
        cmInstance.scrollIntoView({ line: validLineNumber, ch: 0 }, 30);
    }

    scrollToTitle(title, lineOffset = 0, chPosition = 0) {
        if (!title || !this.cm) return;

        const lowerCaseTitle = title.toLowerCase();
        let nodeLineNo;
        for (const [mapTitle, mapLineNo] of this.parser.nodeTitleToLineMap) {
            if (mapTitle.toLowerCase() === lowerCaseTitle) {
                nodeLineNo = mapLineNo;
                break;
            }
        }

        if (nodeLineNo === undefined) return;

        nodeLineNo += lineOffset;

        const coords = this.cm.charCoords({ line: nodeLineNo, ch: chPosition }, "local");

        this.cm.scrollTo(null, coords.top);

        highlightNodeSection(this.cm, this.parser, title);

        const node = getNodeByTitle(title);
        if (!node) {
            return;
        }
        return node;
    }

    hideNodeText(title) {
        const { startLineNo, endLineNo } = this.parser.getNodeSectionRange(title);
        for (let i = startLineNo + 1; i <= endLineNo; i++) {
            this.cm.addLineClass(i, 'text', 'hidden-text');
        }
        this.cm.refresh();
    }

    showNodeText(title) {
        const { startLineNo, endLineNo } = this.parser.getNodeSectionRange(title);
        for (let i = startLineNo + 1; i <= endLineNo; i++) {
            this.cm.removeLineClass(i, 'text', 'hidden-text');
        }
        this.cm.refresh();
    }
}

function highlightNodeSection(cmInstance, parser, title) {
    cmInstance.getAllMarks().forEach(mark => {
        if (mark.className === 'current-node-section') mark.clear();
    });

    const { startLineNo, endLineNo } = parser.getNodeSectionRange(title);

    if (startLineNo === undefined) {
        return;
    }

    cmInstance.markText(
        CodeMirror.Pos(startLineNo, 0),
        CodeMirror.Pos(endLineNo, cmInstance.getLine(endLineNo).length),
        { className: 'current-node-section' }
    );
}

function handleTitleClick(title) {
    if (!title) {
        return; // title could not be extracted
    }

    // Scroll to the title
    //const node = scrollToTitle(title, cm);
    const node = getNodeByTitle(title);
    if (node) {
        let bb = node.content.getBoundingClientRect();

        // Check if the bounding rectangle exists
        if (bb && bb.width > 0 && bb.height > 0) {
            // Zoom to fit the node if the bounding rectangle exists
            node.zoom_to_fit();
            zoomTo = zoomTo.scale(2);
        } else {
            // Use alternative zoom method if the bounding rectangle does not exist (allows best of both options, i.e. zoomto with exact height calculations when available, and when not currently in the viewport, a set value.)
            node.zoom_to(.5);
        }
        autopilotSpeed = settings.autopilotSpeed;
    }
}

function hideNodeText(title, cm) {
    const { startLineNo, endLineNo } = getNodeSectionRange(title, cm);
    for (let i = startLineNo + 1; i <= endLineNo; i++) {
        cm.addLineClass(i, 'text', 'hidden-text');
    }
}
