myCodeMirror.on('beforeChange', function (cm, changeObj) {
    // Record change events fur custom undo/redo
    cm.changeGeneration(true);
});


// Call updateNodeTitleToLineMap whenever the CodeMirror content changes
myCodeMirror.on("change", function () {
    updateNodeTitleToLineMap();
    identifyNodeTitles();
    highlightNodeTitles()
});

myCodeMirror.on("focus", function () {
    // Enable text selection when the editor is focused
    myCodeMirror.getWrapperElement().style.userSelect = "text";
});

myCodeMirror.on("blur", function () {
    // Disable text selection when the editor loses focus
    myCodeMirror.getWrapperElement().style.userSelect = "none";
});



//sync codemirror and textarea

myCodeMirror.on("change", function (instance, changeObj) {
    ignoreTextAreaChanges = true; // Tell the MutationObserver to ignore changes
    textarea.value = instance.getValue();

    // Create a new 'input' event
    var event = new Event('input', {
        bubbles: true,
        cancelable: true,
    });

    // Dispatch the event
    textarea.dispatchEvent(event);

    ignoreTextAreaChanges = false; // Tell the MutationObserver to observe changes again
});

let userScrolledUp = false;

myCodeMirror.on("scroll", function () {
    var scrollInfo = myCodeMirror.getScrollInfo();
    var atBottom = scrollInfo.height - scrollInfo.top - scrollInfo.clientHeight < 1;
    if (!atBottom) {
        userScrolledUp = true;
    } else {
        userScrolledUp = false;
    }
});

// Helper function to determine if a CodeMirror position is within a marked range
function isWithinMarkedText(cm, pos, className) {
    var lineMarkers = cm.findMarksAt(pos);
    for (var i = 0; i < lineMarkers.length; i++) {
        if (lineMarkers[i].className === className) {
            return true;
        }
    }
    return false;
}


myCodeMirror.on("mousedown", function (cm, event) {
    var pos = cm.coordsChar({ left: event.clientX, top: event.clientY });
    const token = cm.getTokenAt(pos);
    //console.log(token.type);

    if (token.type && token.type.includes("node")) {
        const lineContent = cm.getLine(pos.line);
        const title = lineContent.split(nodeTag)[1].trim(); // Title is the rest of the text after the node tag
        if (title) toggleNodeState(title, cm, event); // Pass the event object here
        return; // Skip the rest of the handler if the click is on a node tag
    }

    var isWithin = isWithinMarkedText(cm, pos, 'node-title');

    if (isWithin) {
        const lineMarkers = cm.findMarksAt(pos);
        let titles = lineMarkers.filter(marker => marker.className === 'node-title')
            .map(marker => cm.getRange(marker.find().from, marker.find().to));

        if (titles.length > 0) {
            // Select the longest title
            const longestTitle = titles.reduce((a, b) => a.length > b.length ? a : b);
            const markerForLongestTitle = lineMarkers.find(marker => {
                const rangeText = cm.getRange(marker.find().from, marker.find().to);
                return rangeText === longestTitle;
            });

            if (markerForLongestTitle) {
                const from = markerForLongestTitle.find().from;
                const to = markerForLongestTitle.find().to;

                // Now using the longest title's from and to positions
                if (pos.ch === from.ch || pos.ch === to.ch) {
                    if (longestTitle.length === 1) {
                        handleTitleClick(longestTitle, cm);
                    } else {
                        cm.setCursor(pos);
                    }
                } else {
                    event.preventDefault();
                    handleTitleClick(longestTitle, cm);
                }
            }
        }
    } else {
        // If the click is not within the marked text, check if it's directly next to it
        const leftPos = CodeMirror.Pos(pos.line, pos.ch - 1);
        const rightPos = CodeMirror.Pos(pos.line, pos.ch + 1);
        const isLeftAdjacent = isWithinMarkedText(cm, leftPos, 'node-title');
        const isRightAdjacent = isWithinMarkedText(cm, rightPos, 'node-title');

        // Set cursor position if click is directly next to the marked text
        if (isLeftAdjacent || isRightAdjacent) {
            cm.setCursor(pos);
        }

        // Check if the click is on a line that starts with 'node:'
        const lineText = cm.getLine(pos.line);
        const nodeInputValue = nodeTag;
        if (lineText.startsWith(nodeInputValue)) {
            // If the click is on the 'node:' line but not within the marked text, set the cursor position
            cm.setCursor(pos);
        }
    }
});

myCodeMirror.on("cursorActivity", function (cm) {
    const cursorPos = cm.getCursor();
    const cursorLineNo = cursorPos.line;

    // Find the appropriate node section based on the cursor's position
    let currentNodeSectionTitle;
    for (const [title, lineNo] of Array.from(nodeTitleToLineMap).sort((a, b) => a[1] - b[1])) {
        if (lineNo <= cursorLineNo) {
            currentNodeSectionTitle = title;
        } else {
            break;
        }
    }

    // If the cursor is within a node section, highlight it, otherwise clear the highlighting
    if (currentNodeSectionTitle) {
        const { startLineNo, endLineNo } = getNodeSectionRange(currentNodeSectionTitle, cm);
        if (cursorLineNo >= startLineNo && cursorLineNo <= endLineNo) {
            highlightNodeSection(currentNodeSectionTitle, cm);
            return;
        }
    }

    // Clear any existing "current-node-section" marks if the cursor is not within any node section
    cm.getAllMarks().forEach(mark => {
        if (mark.className === 'current-node-section') mark.clear();
    });
});

myCodeMirror.display.wrapper.style.backgroundColor = '#222226';
myCodeMirror.display.wrapper.style.width = '265px';
myCodeMirror.display.wrapper.style.height = '49vh';
myCodeMirror.display.wrapper.style.borderStyle = 'inset';
myCodeMirror.display.wrapper.style.borderColor = '#8882';
myCodeMirror.display.wrapper.style.fontSize = '15px';
myCodeMirror.getWrapperElement().style.resize = "vertical";


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

function updateMode() {
    var node = nodeTag;
    var ref = refTag;
    myCodeMirror.setOption("mode", { name: "custom", node: node, ref: ref });
    myCodeMirror.refresh();
}

nodeTagInput.addEventListener('change', updateMode);
refTagInput.addEventListener('change', updateMode);
updateMode();

// Array to store node titles
let nodeTitles = [];

function identifyNodeTitles() {
    // Clear previous node titles
    nodeTitles = [];
    myCodeMirror.eachLine((line) => {
        if (line.text.startsWith(nodeTag)) {
            let title = line.text.split(nodeTag)[1].trim();
            // Remove comma if exists
            if (title.endsWith(',')) {
                title = title.slice(0, -1);
            }
            nodeTitles.push(title);
        }
    });
}

let nodeTitleToLineMap = new Map();

function updateNodeTitleToLineMap() {
    // Clear the map
    nodeTitleToLineMap = new Map();

    let currentNodeTitleLineNo = null;
    myCodeMirror.eachLine((line) => {
        if (line.text.startsWith(nodeTag)) {
            const title = line.text.split(nodeTag)[1].trim();
            currentNodeTitleLineNo = line.lineNo();  // Store the line number of the "node:" line
            nodeTitleToLineMap.set(title, currentNodeTitleLineNo);
        }
    });
}

function highlightNodeTitles() {
    // First clear all existing marks
    myCodeMirror.getAllMarks().forEach(mark => mark.clear());

    myCodeMirror.eachLine((line) => {
        nodeTitles.forEach((title) => {
            if (title.length > 0) {
                // Escape special regex characters
                const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escapedTitle, "ig"); // removed \\b word boundaries
                let match;
                while (match = regex.exec(line.text)) {
                    const idx = match.index;
                    if (idx !== -1) {
                        myCodeMirror.markText(
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



function getNodeSectionRange(title, cm) {
    const lowerCaseTitle = title.toLowerCase();
    let nodeLineNo;
    let nextNodeLineNo = cm.lineCount(); // End of the document

    let foundCurrentNode = false;

    for (const [mapTitle, mapLineNo] of Array.from(nodeTitleToLineMap).sort((a, b) => a[1] - b[1])) {
        if (mapTitle.toLowerCase() === lowerCaseTitle) {
            nodeLineNo = mapLineNo;
            foundCurrentNode = true;
            continue; // Skip the current node's line
        }
        if (foundCurrentNode) {
            nextNodeLineNo = mapLineNo;
            break;
        }
    }

    let startLineNo = nodeLineNo;
    let endLineNo;

    // Set endLineNo to the last line of the document if this node extends to the end
    if (nextNodeLineNo === cm.lineCount()) {
        endLineNo = cm.lineCount() - 1;
    } else {
        // Otherwise, the end line is the line just before the next node
        endLineNo = nextNodeLineNo - 1;
    }

    //console.log("Title:", title, "Start Line:", startLineNo, "End Line:", endLineNo);

    return { startLineNo, endLineNo };
}

function highlightNodeSection(title, cm) {
    // Clear any existing "current-node-section" marks
    cm.getAllMarks().forEach(mark => {
        if (mark.className === 'current-node-section') mark.clear();
    });

    const { startLineNo, endLineNo } = getNodeSectionRange(title, cm);

    if (startLineNo === undefined) {
        // If the start line number is undefined, it means the title does not exist in the CodeMirror.
        // In that case, simply return, leaving all section highlights cleared.
        return;
    }

    // Mark the section between the current title and the next title with a special class for styling
    cm.markText(
        CodeMirror.Pos(startLineNo, 0), // Start from the current title's line
        CodeMirror.Pos(endLineNo, cm.getLine(endLineNo).length),
        { className: 'current-node-section' }
    );
}

function scrollToLine(myCodeMirror, lineNumber) {
    // Scroll to the specified line
    myCodeMirror.scrollIntoView({ line: lineNumber, ch: 0 }, 30);
}

function scrollToTitle(title, cm, lineOffset = 0, chPosition = 0) {
    if (!title || !cm) return; // Check if title and CodeMirror instance are not null or undefined

    const lowerCaseTitle = title.toLowerCase();
    let nodeLineNo;
    for (const [mapTitle, mapLineNo] of nodeTitleToLineMap) {
        if (mapTitle.toLowerCase() === lowerCaseTitle) {
            nodeLineNo = mapLineNo;
            break;
        }
    }

    if (nodeLineNo === undefined) return; // Check if nodeLineNo is found

    // Modify the line number to account for the line offset
    nodeLineNo += lineOffset;

    // Calculate the position to scroll to
    const coords = cm.charCoords({ line: nodeLineNo, ch: chPosition }, "local"); // Use line and character position

    // Set the scroll position of the editor to scroll the target line to the top
    cm.scrollTo(null, coords.top);

    // Highlight the section of the current node
    highlightNodeSection(title, cm);

    // Get the node by the title
    const node = getNodeByTitle(title);
    if (!node) {
        return; // The node could not be found
    }
    return node; // Return the node object
}

function deleteNodeByTitle(title) {
    // Make sure to have the most recent map of node titles to line numbers
    updateNodeTitleToLineMap();

    // Get the start line for the node section
    const startLineNo = nodeTitleToLineMap.get(title);

    if (typeof startLineNo !== 'undefined') {
        let endLineNo = startLineNo;
        // Iterate from the start line until the next node tag is found
        for (let i = startLineNo + 1; i < myCodeMirror.lineCount(); i++) {
            const lineText = myCodeMirror.getLine(i);
            if (lineText.startsWith(nodeTag)) {
                endLineNo = i - 1; // Set the end line to the line before the next node tag
                break;
            }
            endLineNo = i; // Extend the end line to include this line
        }

        // Remove the lines corresponding to the node
        myCodeMirror.replaceRange("", { line: startLineNo, ch: 0 }, { line: endLineNo + 1, ch: 0 });

        myCodeMirror.refresh();
    }
}

function getNodeTitleLine(title, cm) {
    const lowerCaseTitle = title.toLowerCase();
    for (const [mapTitle, mapLineNo] of Array.from(nodeTitleToLineMap).sort((a, b) => a[1] - b[1])) {
        if (mapTitle.toLowerCase() === lowerCaseTitle) {
            return mapLineNo;
        }
    }
    return null;
}

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeEdgeFromZettelkasten(title1, title2, removeOnlyFromTitle1 = false) {
    if (!title1 || !title2) {
        console.error("One or both titles are empty or undefined.");
        return;
    }
    const lineCount = myCodeMirror.lineCount();
    const closingBracket = bracketsMap[refTag];

    const titlesToProcess = removeOnlyFromTitle1 ? [title1] : [title1, title2];

    titlesToProcess.forEach((title) => {
    const nodeLine = getNodeTitleLine(title, myCodeMirror);
    if (nodeLine !== null) {
        for (let j = nodeLine + 1; j < lineCount; j++) {
            let nextLine = myCodeMirror.getLine(j);
            if (nextLine.startsWith(nodeTag)) break;

            let escapedRefTag = escapeRegExp(refTag);
            let lineHasRefTag = new RegExp(escapedRefTag).test(nextLine);

            if (lineHasRefTag) {
                let targetTitle;
                if (removeOnlyFromTitle1) {
                    targetTitle = title2;
                } else {
                    // When not removing only from title1, we need to look for each title in the other's references
                    targetTitle = title === title1 ? title2 : title1;
                }
                let escapedTargetTitle = escapeRegExp(targetTitle);

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

                    // Remove trailing commas and spaces
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

                    myCodeMirror.replaceRange(nextLine, { line: j, ch: 0 }, { line: j, ch: myCodeMirror.getLine(j).length });
                }
            }
        }
    });

    myCodeMirror.refresh();
}

// Flag to control recursion
let isEdgeBeingAdded = false;

function addEdgeToZettelkasten(fromTitle, toTitle, cm) {
    if (!fromTitle || !toTitle) {
        console.error("One or both titles are empty or undefined.");
        return;
    }
    // Prevent recursive addition of edges
    if (isEdgeBeingAdded) {
        return;
    }

    isEdgeBeingAdded = true;

    const appendOrCreateTag = (range, tagLineStart, newTag, tagPrefix = "", useCSV = false) => {
        const getTrailingWhitespace = range => {
            let count = 0;
            for (let i = range.endLineNo; i >= range.startLineNo; i--) {
                if (cm.getLine(i).trim() === "") {
                    count++;
                } else {
                    break;
                }
            }
            //console.log(`Found ${count} trailing whitespaces.`);
            return count;
        };
        // Above determines whitespace after content and below modifies line count such that the tag is always between new lines.
        // Adds to existing penultimate empty line if whitespace count is greater than 3 to avoid new line additions.
        const insertTagInWhitespace = (endLine, count, tag) => {
            let isEndOfDoc = (endLine === cm.lineCount() - 1); // Check if it's the last line of the document

            if (count === 0) {
                if (isEndOfDoc) {
                    cm.replaceRange(`\n\n${tag}\n`, { line: endLine + 1, ch: 0 });
                } else {
                    cm.replaceRange(`\n${tag}\n\n`, { line: endLine + 1, ch: 0 });
                }
            } else if (count === 1) {
                cm.replaceRange(`\n${tag}\n`, { line: endLine, ch: 0 });
            } else if (count === 2) {
                cm.replaceRange(`${tag}\n`, { line: endLine, ch: 0 });
            } else {
                cm.replaceRange(`${tag}`, { line: endLine - 1, ch: 0 });
            }
        };

        const whitespaceCount = getTrailingWhitespace(range);

        if (tagLineStart !== null) {
            const oldLine = cm.getLine(tagLineStart);
            if (!oldLine.includes(newTag)) {
                const separator = useCSV ? ', ' : ' ';
                cm.replaceRange(`${oldLine}${separator}${newTag}`, { line: tagLineStart, ch: 0 }, { line: tagLineStart, ch: oldLine.length });
            }
        } else {
            insertTagInWhitespace(range.endLineNo, whitespaceCount, `${tagPrefix}${newTag}`);
        }
    };

    const fromRange = getNodeSectionRange(fromTitle, cm);
    const refTag = document.getElementById('ref-tag').value;
    let tagLineStart = null;

    for (let i = fromRange.startLineNo; i <= fromRange.endLineNo; i++) {
        const lineText = cm.getLine(i);
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
    isEdgeBeingAdded = false;
}


function handleTitleClick(title, cm) {
    if (!title) {
        return; // title could not be extracted
    }

    // Scroll to the title
    const node = scrollToTitle(title, cm);
    if (node) {
        let bb = node.content.getBoundingClientRect();

        // Check if the bounding rectangle exists
        if (bb && bb.width > 0 && bb.height > 0) {
            // Zoom to fit the node if the bounding rectangle exists
            node.zoom_to_fit();
            zoomTo = zoomTo.scale(1.5);
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

function showNodeText(title, cm) {
    const { startLineNo, endLineNo } = getNodeSectionRange(title, cm);
    for (let i = startLineNo + 1; i <= endLineNo; i++) {
        cm.removeLineClass(i, 'text', 'hidden-text');
    }
}

// Call initially
identifyNodeTitles();
highlightNodeTitles();