const PROMPT_IDENTIFIER = "Prompt:";

var textarea = document.getElementById('note-input');
var myCodeMirror = CodeMirror.fromTextArea(textarea, {
    lineWrapping: true,
    scrollbarStyle: 'simple',
    theme: 'default',
});

function captureDocumentUndoRedoEventsAndApplyToCodeMirror(codeMirrorInstance) {
    document.addEventListener('keydown', function (event) {
        const targetTagName = event.target.tagName.toLowerCase();

        if (event.target.closest('.CodeMirror')) {
            return;  // Exit function if the event target is CodeMirror
        }

        if ((event.ctrlKey || event.metaKey) &&  // Works for both Ctrl (Windows/Linux) and Cmd (macOS)
            !event.target.closest('.dropdown') &&
            targetTagName !== 'textarea') {

            let didOperation = false;

            if (event.key === 'z') {
                if (event.shiftKey) {
                    // Redo for Ctrl+Shift+Z or Cmd+Shift+Z
                    codeMirrorInstance.redo();
                    didOperation = true;
                } else {
                    // Undo for Ctrl+Z or Cmd+Z
                    codeMirrorInstance.undo();
                    didOperation = true;
                }
            } else if (event.key === 'y') {
                // Redo for Ctrl+Y or Cmd+Y
                codeMirrorInstance.redo();
                didOperation = true;
            }

            if (didOperation) {
                event.preventDefault();  // Prevent the default undo/redo behavior in the document
                setTimeout(() => codeMirrorInstance.refresh(), 0);  // Refresh the CodeMirror instance
            }
        }
    });
}

captureDocumentUndoRedoEventsAndApplyToCodeMirror(myCodeMirror);

// Get the viewport dimensions
let maxWidth, maxHeight;

function updateMaxDimensions() {
    maxWidth = window.innerWidth * 0.9;
    maxHeight = window.innerHeight * 0.7;
}

// Update max dimensions initially and on window resize
updateMaxDimensions();
window.addEventListener("resize", updateMaxDimensions);

// Horizontal drag handle
let zetHorizDragHandle = document.getElementById("zetHorizDragHandle");
let zetIsHorizResizing = false;
let initialX;
let initialWidth;

zetHorizDragHandle.addEventListener("mousedown", function (event) {
    updateMaxDimensions(); // Update dimensions at the start of each drag
    zetIsHorizResizing = true;
    initialX = event.clientX;
    let cmElement = myCodeMirror.getWrapperElement();
    initialWidth = cmElement.offsetWidth;

    // Prevent text selection while resizing
    document.body.style.userSelect = 'none';

    document.addEventListener("mousemove", zetHandleHorizMouseMove);
    document.addEventListener("mouseup", function () {
        zetIsHorizResizing = false;

        // Enable text selection again after resizing
        document.body.style.userSelect = '';

        document.removeEventListener("mousemove", zetHandleHorizMouseMove);
    });
});

function zetHandleHorizMouseMove(event) {
    if (zetIsHorizResizing) {
        requestAnimationFrame(() => {
            // Calculate the difference in the x position
            let dx = event.clientX - initialX;
            let cmElement = myCodeMirror.getWrapperElement();
            let newWidth = initialWidth - dx;

            // Update the width if within the boundaries
            if (newWidth > 50 && newWidth <= maxWidth) {
                cmElement.style.width = newWidth + "px";
                document.getElementById('prompt').style.width = newWidth + 'px';
                myCodeMirror.refresh();
            }
        });
    }
}

// Vertical drag handle
let zetVertDragHandle = document.getElementById("zetVertDragHandle");
let zetIsVertResizing = false;
let initialY;
let initialHeight;

zetVertDragHandle.addEventListener("mousedown", function (event) {
    updateMaxDimensions(); // Update dimensions at the start of each drag
    zetIsVertResizing = true;
    initialY = event.clientY;
    let cmElement = myCodeMirror.getWrapperElement();
    initialHeight = cmElement.offsetHeight;

    // Prevent text selection while resizing
    document.body.style.userSelect = 'none';

    document.addEventListener("mousemove", zetHandleVertMouseMove);
    document.addEventListener("mouseup", function () {
        zetIsVertResizing = false;

        // Enable text selection again after resizing
        document.body.style.userSelect = '';

        document.removeEventListener("mousemove", zetHandleVertMouseMove);
    });
});

function zetHandleVertMouseMove(event) {
    if (zetIsVertResizing) {
        requestAnimationFrame(() => {
            // Calculate the difference in the y position
            let dy = event.clientY - initialY;
            let cmElement = myCodeMirror.getWrapperElement();
            let newHeight = initialHeight + dy;

            // Update the height if within the boundaries
            if (newHeight > 50 && newHeight <= maxHeight) {
                cmElement.style.height = newHeight + "px";
                myCodeMirror.refresh();
            }
        });
    }
}

// Add this event listener to handle window resizing
window.addEventListener("resize", function () {
    maxWidth = window.innerWidth * 0.9;
    maxHeight = window.innerHeight * 0.9;

    let cmElement = myCodeMirror.getWrapperElement();

    if (cmElement.offsetHeight > maxHeight) {
        cmElement.style.height = maxHeight + "px";
    }

    if (cmElement.offsetWidth > maxWidth) {
        cmElement.style.width = maxWidth + "px";
    }

    myCodeMirror.refresh();
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

myCodeMirror.display.wrapper.style.backgroundColor = '#222226';
myCodeMirror.display.wrapper.style.width = '265px';
myCodeMirror.display.wrapper.style.height = '45vh';
myCodeMirror.display.wrapper.style.borderStyle = 'inset';
myCodeMirror.display.wrapper.style.borderColor = '#8882';
myCodeMirror.display.wrapper.style.fontSize = '15px';
myCodeMirror.getWrapperElement().style.resize = "vertical";


const bracketsMap = {
    '(': ')',
    '[': ']',
    '{': '}',
    '<': '>',
    '((': '))',
    '[[': ']]',
    '{{': '}}',
    '<<': '>>',
    '«': '»',      // Guillemet
    '/*': '*/',
    '<!--': '-->',
    '#[': ']#',
    '<%': '%>',
    '(*': '*)',
    '`': '`',
    '```': '```',  
    '${': '}',
    '|': '|'
};

const sortedBrackets = Object.keys(bracketsMap).sort((a, b) => b.length - a.length);

var nodeInput = document.getElementById('node-tag');
var refInput = document.getElementById('ref-tag');

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
    var node = nodeInput.value;
    var ref = refInput.value;
    myCodeMirror.setOption("mode", { name: "custom", node: node, ref: ref });
    myCodeMirror.refresh();
}

nodeInput.addEventListener('change', updateMode);
refInput.addEventListener('change', updateMode);
updateMode();  // To set the initial mode

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

// Array to store node titles
let nodeTitles = [];

function identifyNodeTitles() {
    // Clear previous node titles
    nodeTitles = [];
    myCodeMirror.eachLine((line) => {
        if (line.text.startsWith(nodeInput.value)) {
            let title = line.text.split(nodeInput.value)[1].trim();
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
        if (line.text.startsWith(nodeInput.value)) {
            const title = line.text.split(nodeInput.value)[1].trim();
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
    let nextNodeLineNo = cm.lineCount(); // Defaults to the end of the document

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
    let endLineNo = nextNodeLineNo - 1; // Default end line is the line just before the next node

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
        // Iterate from the start line until the next node or reference tag is found
        for (let i = startLineNo + 1; i < myCodeMirror.lineCount(); i++) {
            const lineText = myCodeMirror.getLine(i);
            if (lineText.startsWith(nodeInput.value)) {
                break; // Found the next node tag, so stop here
            }
            if (lineText.startsWith(refInput.value)) {
                endLineNo = i; // Extend the end line to include the reference line
                break; // Found the reference tag, so stop here
            }
            endLineNo = i; // Extend the end line to include this line
        }

        // Remove the lines corresponding to the node, including the reference line if found
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

function removeEdgeFromZettelkasten(title1, title2) {
    if (!title1 || !title2) {
        console.error("One or both titles are empty or undefined.");
        return;
    }

    const refTag = refInput.value;
    const nodeTag = nodeInput.value;
    const lineCount = myCodeMirror.lineCount();
    const titles = [title1, title2];

    const closingBracket = bracketsMap[refTag];

    titles.forEach((title) => {
        const nodeLine = getNodeTitleLine(title, myCodeMirror);
        if (nodeLine !== null) {
            for (let j = nodeLine + 1; j < lineCount; j++) {
                let nextLine = myCodeMirror.getLine(j);
                if (nextLine.startsWith(nodeTag)) break;

                let escapedRefTag = escapeRegExp(refTag);
                let lineHasRefTag = new RegExp(escapedRefTag).test(nextLine);

                if (lineHasRefTag) {
                    titles.forEach((innerTitle) => {
                        if (title === innerTitle) {
                            return; // Skip if the title matches innerTitle
                        }
                        let escapedInnerTitle = escapeRegExp(innerTitle);

                        let regExp;
                        if (closingBracket) {
                            regExp = new RegExp(`(${escapedRefTag}\\s*${escapedInnerTitle}\\s*${escapeRegExp(closingBracket)})|(,?\\s*${escapedInnerTitle}\\s*,?)`, 'g');
                        } else {
                            regExp = new RegExp(`(${escapedRefTag}\\s*${escapedInnerTitle}\\s*${escapedRefTag})|(,?\\s*${escapedInnerTitle}\\s*,?)`, 'g');
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
                    });
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
        const lineToAppend = cm.getLine(range.endLineNo);
        const isEmptyLine = lineToAppend.trim() === "";

        if (tagLineStart !== null) {
            const oldLine = cm.getLine(tagLineStart);
            if (!oldLine.includes(newTag)) {
                const separator = useCSV ? ', ' : ' ';
                cm.replaceRange(`${oldLine}${separator}${newTag}`, { line: tagLineStart, ch: 0 }, { line: tagLineStart, ch: oldLine.length });
            }
        } else if (isEmptyLine) {
            cm.replaceRange(`\n${tagPrefix}${newTag}\n`, { line: range.endLineNo, ch: 0 });
        } else {
            cm.replaceRange(`\n${tagPrefix}${newTag}\n`, { line: range.endLineNo + 1, ch: 0 });
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

myCodeMirror.on("mousedown", function (cm, event) {
    var pos = cm.coordsChar({ left: event.clientX, top: event.clientY });
    const token = cm.getTokenAt(pos);
    //console.log(token.type);

    if (token.type && token.type.includes("node")) {
        const lineContent = cm.getLine(pos.line);
        const title = lineContent.split(nodeInput.value)[1].trim(); // Title is the rest of the text after the node tag
        if (title) toggleNodeState(title, cm, event); // Pass the event object here
        return; // Skip the rest of the handler if the click is on a node tag
    }

    var isWithin = isWithinMarkedText(cm, pos, 'node-title');

    if (isWithin) {
        const lineMarkers = cm.findMarksAt(pos);
        for (var i = 0; i < lineMarkers.length; i++) {
            if (lineMarkers[i].className === 'node-title') {
                const from = lineMarkers[i].find().from;
                const to = lineMarkers[i].find().to;
                const title = cm.getRange(from, to);

                // Check if click is at the start or end of the marked text
                if (pos.ch === from.ch || pos.ch === to.ch) {
                    if (title.length === 1) {
                        // If the title is one character long, perform click behavior
                        handleTitleClick(title, cm);
                    } else {
                        // If click is at the start or end of a title longer than one character, just place the cursor
                        cm.setCursor(pos);
                    }
                } else {
                    // prevent default click event
                    event.preventDefault();

                    // Scroll and zoom to the title
                    handleTitleClick(title, cm);
                }

                break; // Exit the loop once a title is found
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
        const nodeInputValue = nodeInput.value;  // add ':' at the end
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
            // Use alternative zoom method if the bounding rectangle does not exist (allows best of both options, i.e. zoomto with exact height calculations when available, and when not currenetly in the viewport, a set value.)
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

function getNodeByTitle(title) {
    const lowerCaseTitle = title.toLowerCase();
    for (let n of nodes) {
        let nodeTitle = n.getTitle(); // Use the new getTitle method
        if (nodeTitle && nodeTitle.toLowerCase() === lowerCaseTitle) {
            return n;
        }
    }
    return null;
}

//END OF CODEMIRROR

function setupCustomDropdown(select) {
    // Create the main custom dropdown container
    let selectReplacer = document.createElement('div');
    selectReplacer.className = 'select-replacer closed'; // add 'closed' class by default

    // Create the currently selected value container
    let selectedDiv = document.createElement('div');
    selectedDiv.innerText = select.options[select.selectedIndex].innerText;
    selectReplacer.appendChild(selectedDiv);

    // Create the dropdown options container
    let optionsReplacer = document.createElement('div');
    optionsReplacer.className = 'options-replacer';

    // Create individual options
    Array.from(select.options).forEach((option, index) => {
        let optionDiv = document.createElement('div');
        optionDiv.innerText = option.innerText;

        // Highlight the selected option
        if (select.selectedIndex === index) {
            optionDiv.classList.add('selected');
        }

        optionDiv.addEventListener('click', function (event) {
            event.stopPropagation(); // Stops the event from bubbling up

            select.value = option.value;
            selectedDiv.innerText = option.innerText;

            // Remove `selected` class from previously selected option
            const previousSelected = optionsReplacer.querySelector('.selected');
            if (previousSelected) {
                previousSelected.classList.remove('selected');
            }
            // Add `selected` class to the new selected option
            optionDiv.classList.add('selected');

            // Trigger the original dropdown's change event
            let changeEvent = new Event('change', {
                'bubbles': true,
                'cancelable': true
            });
            select.dispatchEvent(changeEvent);
        });
        optionsReplacer.appendChild(optionDiv);
    });

    // Append the options container to the main dropdown container
    selectReplacer.appendChild(optionsReplacer);

    // Toggle dropdown on click
    let isPendingFrame = false;

    selectReplacer.addEventListener('click', function (event) {
        // Get all the select containers
        const selectContainers = document.querySelectorAll('.select-container');
        // Reset z-index for all
        selectContainers.forEach((el) => el.style.zIndex = "20");

        if (optionsReplacer.classList.contains('show')) {
            if (!event.target.closest('.options-replacer')) {
                // Dropdown is open and click was outside of the options, so close it
                window.requestAnimationFrame(() => {
                    optionsReplacer.classList.remove('show');
                    selectReplacer.classList.add('closed');
                    container.style.zIndex = "20"; // reset the z-index of the parent container
                    isPendingFrame = false;
                });
                isPendingFrame = true;
            }
        } else {
            // Dropdown is closed, so open it
            container.style.zIndex = "30"; // increase the z-index of the parent container
            if (!isPendingFrame) {
                window.requestAnimationFrame(() => {
                    optionsReplacer.classList.add('show');
                    selectReplacer.classList.remove('closed');
                    isPendingFrame = false;
                });
                isPendingFrame = true;
            }
        }
    });

    // Replace the original select with the custom dropdown
    let container = document.createElement('div');
    container.className = 'select-container';
    select.parentNode.insertBefore(container, select);
    container.appendChild(selectReplacer);
    container.appendChild(select);
    select.style.display = 'none'; // Hide the original select
}

document.addEventListener('DOMContentLoaded', function () {
    let selects = document.querySelectorAll('select.custom-select');
    selects.forEach(setupCustomDropdown);

    // Close dropdowns if clicked outside
    window.addEventListener('click', function (event) {
        if (!event.target.matches('.select-replacer > div')) {
            let replacers = document.querySelectorAll('.options-replacer');
            replacers.forEach(replacer => {
                replacer.classList.remove('show');
                replacer.parentNode.classList.add('closed');
            });
        }
    });
});


document.getElementById("clearLocalStorage").onclick = function () {
    localStorage.clear();
    alert('Local storage has been cleared.');
}

document.querySelectorAll('input[type=range]').forEach(function (slider) {
    function setSliderBackground(slider) {
        const min = slider.min ? parseFloat(slider.min) : 0;
        const max = slider.max ? parseFloat(slider.max) : 100;
        const value = slider.value ? parseFloat(slider.value) : 0;
        const percentage = (value - min) / (max - min) * 100;
        slider.style.background = `linear-gradient(to right, #006BB6 0%, #006BB6 ${percentage}%, #18181c ${percentage}%, #18181c 100%)`;
    }

    // Set the background color split initially
    setSliderBackground(slider);

    // Update background color split when the slider value changes
    slider.addEventListener('input', function () {
        setSliderBackground(slider);
    });
});


document.getElementById('model-temperature').addEventListener('input', updateLabel);

function updateLabel() {
    const temperature = document.getElementById('model-temperature').value;
    document.getElementById('model-temperature-label').innerText = 'Temperature:\n ' + temperature;
}

//api keys

// Load any saved keys from local storage
document.getElementById('googleApiKey').value = localStorage.getItem('googleApiKey') || '';
document.getElementById('googleSearchEngineId').value = localStorage.getItem('googleSearchEngineId') || '';
document.getElementById('api-key-input').value = localStorage.getItem('openaiApiKey') || '';
document.getElementById('wolframApiKey').value = localStorage.getItem('wolframApiKey') || '';

function saveKeys() {
    // Save keys to local storage
    localStorage.setItem('googleApiKey', document.getElementById('googleApiKey').value);
    localStorage.setItem('googleSearchEngineId', document.getElementById('googleSearchEngineId').value);
    localStorage.setItem('openaiApiKey', document.getElementById('api-key-input').value);
    localStorage.setItem('wolframApiKey', document.getElementById('wolframApiKey').value);
}

async function saveKeysToFile() {
    // Gather the keys
    const keys = {
        googleApiKey: document.getElementById('googleApiKey').value || '',
        googleSearchEngineId: document.getElementById('googleSearchEngineId').value || '',
        openaiApiKey: document.getElementById('api-key-input').value || '',
        wolframApiKey: document.getElementById('wolframApiKey').value || '',
    };

    try {
        if ('showSaveFilePicker' in window) {
            const handle = await window.showSaveFilePicker({
                types: [
                    {
                        description: 'Text Files',
                        accept: {
                            'text/plain': ['.txt'],
                        },
                    },
                ],
            });
            const writable = await handle.createWritable();
            await writable.write(JSON.stringify(keys));
            await writable.close();
        } else {
            // Handle lack of support for showSaveFilePicker
            alert('Your browser does not support saving files.');
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            alert('An error occurred while saving: ' + error);
        }
    }
}

async function loadKeysFromFile() {
    try {
        if ('showOpenFilePicker' in window) {
            const [fileHandle] = await window.showOpenFilePicker();
            const file = await fileHandle.getFile();
            const contents = await file.text();

            const keys = JSON.parse(contents);
            document.getElementById('googleApiKey').value = keys.googleApiKey || '';
            document.getElementById('googleSearchEngineId').value = keys.googleSearchEngineId || '';
            document.getElementById('api-key-input').value = keys.openaiApiKey || '';
            document.getElementById('wolframApiKey').value = keys.wolframApiKey || '';
        } else {
            // Handle lack of support for showOpenFilePicker
            alert('Your browser does not support opening files.');
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            alert('An error occurred while loading: ' + error);
        }
    }
}

function clearKeys() {
    // Clear keys from local storage
    localStorage.removeItem('googleApiKey');
    localStorage.removeItem('googleSearchEngineId');
    localStorage.removeItem('openaiApiKey');
    localStorage.removeItem('wolframApiKey');

    // Clear input fields
    document.getElementById('googleApiKey').value = '';
    document.getElementById('googleSearchEngineId').value = '';
    document.getElementById('api-key-input').value = '';
    document.getElementById('wolframApiKey').value = '';
}



function handleKeyDown(event) {
    if (event.key === 'Enter') {
        const localLLMCheckbox = document.getElementById("localLLM");

        if (event.shiftKey) {
            // Shift + Enter was pressed, insert a newline
            event.preventDefault();
            // insert a newline at the cursor
            const cursorPosition = event.target.selectionStart;
            event.target.value = event.target.value.substring(0, cursorPosition) + "\n" + event.target.value.substring(cursorPosition);
            // position the cursor after the newline
            event.target.selectionStart = cursorPosition + 1;
            event.target.selectionEnd = cursorPosition + 1;
            // force the textarea to resize
            autoGrow(event);
        } else {
            // Enter was pressed without Shift
            event.preventDefault();

            // If localLLM checkbox is enabled, submit the form (which triggers LLM code).
            if (localLLMCheckbox.checked) {
                document.getElementById('prompt-form').dispatchEvent(new Event('submit'));
            } else {
                // Otherwise, call sendMessage function
                sendMessage(event);
            }
        }
    }
    return true;
}

        function autoGrow(event) {
            const textarea = event.target;
            // Temporarily make the height 'auto' so the scrollHeight is not affected by the current height
            textarea.style.height = 'auto';
            let maxHeight = 200;
            if (textarea.scrollHeight < maxHeight) {
                textarea.style.height = textarea.scrollHeight + 'px';
                textarea.style.overflowY = 'hidden';
            } else {
                textarea.style.height = maxHeight + 'px';
                textarea.style.overflowY = 'auto';
            }
        }

        //disable ctl +/- zoom on browser
        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey && (event.key === '+' || event.key === '-' || event.key === '=')) {
                event.preventDefault();
            }
        });

        document.addEventListener('wheel', (event) => {
            if (event.ctrlKey) {
                event.preventDefault();
            }
        }, {
            passive: false
        });

        document.body.style.transform = "scale(1)";
        document.body.style.transformOrigin = "0 0";



function openTab(tabId, element) {
    var i, tabcontent, tablinks;

    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    tablinks = document.getElementsByClassName("tablink");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("activeTab"); // We use classList.remove to remove the class
    }

    document.getElementById(tabId).style.display = "block";
    element.classList.add("activeTab"); // We use classList.add to add the class

    myCodeMirror.refresh();
}
        // Get the menu button and dropdown content elements
        const menuButton = document.querySelector(".menu-button");
        const dropdownContent = document.querySelector(".dropdown-content");
        const nodePanel = document.querySelector(".node-panel");


        // Get the first tabcontent element
        const firstTab = document.querySelector(".tabcontent");

        dropdownContent.addEventListener("paste", function (e) {
            cancel(e);
        });
        dropdownContent.addEventListener("wheel", function (e) {
            cancel(e);
        });
        dropdownContent.addEventListener("dblclick", function (e) {
            cancel(e);
        });

        // Add an event listener to the menu button
        menuButton.addEventListener("click", function (event) {
            // Prevent the click event from propagating
            event.stopPropagation();

            // Toggle the "open" class on the menu button and dropdown content
            menuButton.classList.toggle("open");
            dropdownContent.classList.toggle("open");
            nodePanel.classList.toggle("open");
            // If the dropdown is opened, manually set the first tab to active and display its content
            if (dropdownContent.classList.contains("open")) {
                var tablinks = document.getElementsByClassName("tablink");
                var tabcontent = document.getElementsByClassName("tabcontent");

                // Remove active class from all tablinks and hide all tabcontent
                for (var i = 0; i < tablinks.length; i++) {
                    tablinks[i].classList.remove("active");
                    tabcontent[i].style.display = "none";
                }

                // Open the first tab
                openTab('tab1', tablinks[0]);

                // If there's any selected text, deselect it
                if (window.getSelection) {
                    window.getSelection().removeAllRanges();
                } else if (document.selection) {
                    document.selection.empty();
                }
            }
            myCodeMirror.refresh();
        });


        dropdownContent.addEventListener("mousedown", (e) => {
            cancel(e);
        });




document.getElementById("save-button").addEventListener("click", function () {
    nodes.map((n) => n.updateEdgeData());
    let s = document.getElementById("nodes").innerHTML;
    let title = prompt("Enter a title for this save:");

    if (title) {
        let saves = JSON.parse(localStorage.getItem("saves") || "[]");
        saves.push({ title: title, data: s });

        try {
            localStorage.setItem("saves", JSON.stringify(saves));
            updateSavedNetworks();
        } catch (e) {
            // localStorage quota exceeded
            if (confirm("Local storage is full, download the data as a .txt file?")) {
                downloadData(title, s);
            }
        }
    }
});

function downloadData(title, data) {
    var blob = new Blob([data], { type: 'text/plain' });
    var tempAnchor = document.createElement('a');
    tempAnchor.download = title + '.txt';
    tempAnchor.href = window.URL.createObjectURL(blob);
    tempAnchor.click();
    setTimeout(function () {
        window.URL.revokeObjectURL(tempAnchor.href);
    }, 1);
}

function updateSavedNetworks() {
    let saves = JSON.parse(localStorage.getItem("saves") || "[]");
    let container = document.getElementById("saved-networks-container");
    container.innerHTML = '';

    for (let [index, save] of saves.entries()) {
        let div = document.createElement("div");
        let titleInput = document.createElement("input");
        let data = document.createElement("span");
        let loadButton = document.createElement("button");
        let deleteButton = document.createElement("button");
        let downloadButton = document.createElement("button");

        titleInput.type = "text";
        titleInput.value = save.title;
        titleInput.style.border = "none"
        titleInput.style.width = "134px"
        titleInput.addEventListener('change', function () {
            save.title = titleInput.value;
            localStorage.setItem("saves", JSON.stringify(saves));
        });

        data.textContent = save.data;
        data.style.display = "none";

        loadButton.textContent = "Load";
        loadButton.className = 'linkbuttons';
        loadButton.addEventListener('click', function () {
            document.getElementById("save-or-load").value = data.textContent;
        });

        deleteButton.textContent = "X";
        deleteButton.className = 'linkbuttons';
        deleteButton.addEventListener('click', function () {
            // Remove the save from the array
            saves.splice(index, 1);

            // Update local storage
            localStorage.setItem("saves", JSON.stringify(saves));

            // Update the saved networks container
            updateSavedNetworks();
        });

        downloadButton.textContent = "↓";
        downloadButton.className = 'linkbuttons';
        downloadButton.addEventListener('click', function () {
            // Create a blob from the data
            var blob = new Blob([save.data], { type: 'text/plain' });

            // Create a temporary anchor and URL
            var tempAnchor = document.createElement('a');
            tempAnchor.download = save.title + '.txt';
            tempAnchor.href = window.URL.createObjectURL(blob);

            // Simulate a click on the anchor
            tempAnchor.click();

            // Clean up by revoking the object URL
            setTimeout(function () {
                window.URL.revokeObjectURL(tempAnchor.href);
            }, 1);
        });

        div.appendChild(titleInput);
        div.appendChild(data);
        div.appendChild(loadButton);
        div.appendChild(downloadButton);
        div.appendChild(deleteButton);
        container.appendChild(div);
    }
}

// Call updateSavedNetworks on page load to display previously saved networks
updateSavedNetworks();

document.getElementById("load-button").addEventListener("click", function () {
    loadnet(document.getElementById("save-or-load").value, true);
});

let container = document.getElementById("saved-networks-container");

// Prevent default drag behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    container.addEventListener(eventName, preventDefaults, false);
});

// Highlight the drop area when item is dragged over it
['dragenter', 'dragover'].forEach(eventName => {
    container.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    container.addEventListener(eventName, unhighlight, false);
});

// Handle the drop
container.addEventListener('drop', handleDrop, false);

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight(e) {
    container.classList.add('highlight');
}

function unhighlight(e) {
    container.classList.remove('highlight');
}

function handleDrop(e) {
    let dt = e.dataTransfer;
    let file = dt.files[0];

    if (file && file.name.endsWith('.txt')) {
        let reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function (e) {
            let content = e.target.result;
            let title = file.name.replace('.txt', '');

            try {
                // Try saving the data to localStorage
                let saves = JSON.parse(localStorage.getItem("saves") || "[]");
                saves.push({ title: title, data: content });
                localStorage.setItem("saves", JSON.stringify(saves));
                updateSavedNetworks();
            } catch (error) {
                // If local storage is full, update save-load input
                document.getElementById("save-or-load").value = content;
            }
        };
    } else {
        console.log('File must be a .txt file');
    }
}


        // Get all the menu items
        const menuItems = document.querySelectorAll(".menu-item");

        // Add a click event listener to each menu item
        menuItems.forEach(function (item) {
            item.addEventListener("click", function () {
                // Remove the "selected" class from all the menu items
                // menuItems.forEach(function(item) {
                //   item.classList.remove("selected");
                // });

                // Add the "selected" class to the clicked menu item
                item.classList.add("selected");
            });
        });
        document.getElementById("clear-button").addEventListener("click", function () {
            document.getElementById("clear-sure").setAttribute("style", "display:block");
            document.getElementById("clear-button").text = "Are you sure?";
        });
        document.getElementById("clear-unsure-button").addEventListener("click", function () {
            document.getElementById("clear-sure").setAttribute("style", "display:none");
            document.getElementById("clear-button").text = "clear";
        });
        document.getElementById("clear-sure-button").addEventListener("click", function () {
            clearnet();
            document.getElementById("clear-sure").setAttribute("style", "display:none");
            document.getElementById("clear-button").text = "clear";
        });

var settings = {
    zoomSpeed: 0.0005,
    panSpeed: 1,
    zoomContentExp: 0.5,
    gestureZoomSpeed: 0.001,
    gestureRotateSpeed: Math.PI / 180,
    scroll: ('GestureEvent' in window) ? "pan" : "zoom",
    nodeModeKey: "Shift", //"CapsLock",
    nodeModeTrigger: "down", //"toggle"

    //slider adjustment
    maxLines: 36,
    renderWidthMult: 0.3, //1,
    regenDebtAdjustmentFactor: 0.37,

    renderStepSize: 0.1, //0.25,
    renderSteps: 16, //64,
    renderDChar: "L",
    opacity: 1,


    rotateModifier: "Alt",
    rotateModifierSpeed: Math.PI / 180 / 36,

    iterations: 256,

    //autopilotRF_Pscale:1,
    autopilotRF_Iscale: 0.5,
    //autopilotRF_Dscale:0.1,
    autopilotSpeed: 0.1,
    autopilotMaxSpeed: 0.1,

    buttonGraphics: {
        hover: ["RGB(100,100,100)", "RGB(200,200,255)"],
        click: ["RGB(70,70,70)", "RGB(100,100,100)"],
        initial: ["none", "RGB(170,170,170)"]
    },

    maxDist: 4,
    orbitStepRate: 2,

    innerOpacity: 1,
    outerOpacity: 1
}

let innerOpacitySlider = document.getElementById('inner_opacity');
innerOpacitySlider.addEventListener('input', function () {
    settings.innerOpacity = innerOpacitySlider.value / 100;
});

let outerOpacitySlider = document.getElementById('outer_opacity');
outerOpacitySlider.addEventListener('input', function () {
    settings.outerOpacity = outerOpacitySlider.value / 100;
});

// Initialize the slider with the settings.renderWidthMult value
let renderWidthMultSlider = document.getElementById("renderWidthMultSlider");
renderWidthMultSlider.value = settings.renderWidthMult;
renderWidthMultSlider.dispatchEvent(new Event('input'));

// Initialize the slider with the settings.maxLines value
let maxLinesSlider = document.getElementById("maxLinesSlider");
maxLinesSlider.value = settings.maxLines;
maxLinesSlider.dispatchEvent(new Event('input'));

// Initialize the slider with the settings.regenDebtAdjustmentFactor value
let regenDebtSlider = document.getElementById("regenDebtSlider");
regenDebtSlider.value = settings.regenDebtAdjustmentFactor;
regenDebtSlider.dispatchEvent(new Event('input'));

function getLength() {
    let v = document.getElementById("length").value / 100;
    return 2 ** (v * 8);
}
document.getElementById("length").addEventListener("input", (e) => {
    let v = getLength();
    setRenderLength(v);
    document.getElementById("length_value").textContent = (Math.round(v * 100) / 100);
});

function getRegenDebtAdjustmentFactor() {
    let v = document.getElementById("regenDebtSlider").value;
    return v;
}
document.getElementById("regenDebtSlider").addEventListener("input", (e) => {
    let v = getRegenDebtAdjustmentFactor();
    settings.regenDebtAdjustmentFactor = v;
    document.getElementById("regenDebtValue").textContent = v;
});

function setRenderWidthMult(v) {
    settings.renderWidthMult = v;
}

function setRenderLength(l) {
    let f = settings.renderStepSize * settings.renderSteps / l;
    //settings.renderStepSize /= f;
    //settings.renderWidthMult *= f;
    settings.renderSteps /= f;
}
setRenderLength(getLength());


function getMaxLines() {
    let v = parseInt(document.getElementById("maxLinesSlider").value);
    return v;
}
document.getElementById("maxLinesSlider").addEventListener("input", (e) => {
    let v = getMaxLines();
    settings.maxLines = v;
    document.getElementById("maxLinesValue").textContent = + v;
});

function getRenderWidthMult() {
    let v = document.getElementById("renderWidthMultSlider").value;
    return v;
}
document.getElementById("renderWidthMultSlider").addEventListener("input", (e) => {
    let v = getRenderWidthMult();
    setRenderWidthMult(v);
    document.getElementById("renderWidthMultValue").textContent = v;
});

function setRenderQuality(n) {
    let q = 1 / n;
    let f = settings.renderStepSize / q;
    settings.renderStepSize = q;
    settings.renderWidthMult *= f;
    settings.renderSteps *= f;
}
setRenderQuality(getQuality());

        function getQuality() {
            let v = document.getElementById("quality").value / 100;
            return 2 ** (v * 4);
        }
        document.getElementById("quality").addEventListener("input", (e) => {
            let v = getQuality();
            setRenderQuality(v);
            document.getElementById("quality_value").textContent = "Quality:" + (Math.round(v * 100) / 100);
        });


        document.getElementById("exponent").addEventListener("input", (e) => {
            let v = e.target.value * 1;
            mand_step = (z, c) => {
                return z.ipow(v).cadd(c);
            }
            document.getElementById("exponent_value").textContent = v;
        })
        const submenuBtn = document.querySelector('.submenu-btn');

document.getElementById('node-count-slider').addEventListener('input', function () {
    document.getElementById('node-slider-label').innerText = 'Top ' + this.value + '\nnodes';
});

let colorPicker = document.getElementById("colorPicker");

colorPicker.addEventListener("input", function () {
    document.body.style.backgroundColor = this.value;
}, false);

// Manually dispatch the input event
colorPicker.dispatchEvent(new Event("input"));

        //ai.js dropdown interaction
let MAX_CHUNK_SIZE = 400;

const maxChunkSizeSlider = document.getElementById('maxChunkSizeSlider');
const maxChunkSizeValue = document.getElementById('maxChunkSizeValue');

// Display the initial slider value
maxChunkSizeValue.textContent = maxChunkSizeSlider.value;

// Update the current slider value (each time you drag the slider handle)
maxChunkSizeSlider.oninput = function () {
    MAX_CHUNK_SIZE = this.value;
    maxChunkSizeValue.textContent = this.value;
}

let topN = 5;
const topNSlider = document.getElementById('topNSlider');
const topNValue = document.getElementById('topNValue');

topNSlider.addEventListener('input', function () {
    topN = this.value;
    topNValue.textContent = this.value;
});

function updateLoadingIcon(percentage) {
    const loaderFills = document.querySelectorAll('.loader-fill');

    loaderFills.forEach(loaderFill => {
        // Set a timeout to remove the initial animation class after 8 seconds
        setTimeout(() => {
            loaderFill.classList.remove('initial-animation');
        }, 8000); // 8000 milliseconds = 8 seconds

        // Scale from 0 to 1 based on the percentage
        const scale = percentage / 100;
        loaderFill.style.transform = `translate(-50%, -50%) scale(${scale})`;
    });
}