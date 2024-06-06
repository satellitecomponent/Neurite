
window.startedViaPlaywright = window.startedViaPlaywright || false;

//https://github.com/tc39/proposal-regex-escaping/blob/main/specInJs.js
// this is a direct translation to code of the spec
if (!RegExp.escape) {
    RegExp.escape = (S) => {
        // 1. let str be ToString(S).
        // 2. ReturnIfAbrupt(str).
        let str = String(S);
        // 3. Let cpList be a List containing in order the code
        // points as defined in 6.1.4 of str, starting at the first element of str.
        let cpList = Array.from(str[Symbol.iterator]());
        // 4. let cuList be a new List
        let cuList = [];
        // 5. For each code point c in cpList in List order, do:
        for (let c of cpList) {
            // i. If c is a SyntaxCharacter then do:
            if ("^$\\.*+?()[]{}|".indexOf(c) !== -1) {
                // a. Append "\" to cuList.
                cuList.push("\\");
            }
            // Append c to cpList.
            cuList.push(c);
        }
        //6. Let L be a String whose elements are, in order, the elements of cuList.
        let L = cuList.join("");
        // 7. Return L.
        return L;
    };
}
// Store the values of the input elements
let modalInputValues = {};

const storedInputValues = localStorage.getItem('modalInputValues');
    if (storedInputValues) {
        modalInputValues = JSON.parse(storedInputValues);
    }

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
    maxLines: 128,
    renderWidthMult: 0.3, //1,
    regenDebtAdjustmentFactor: 1,

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

    useFlowDirection: true,
    flowDirectionRotation: 0,
    flowDirectionRandomRange: Math.PI / 1.05,

    buttonGraphics: {
        hover: ["RGB(100,100,100)", "RGB(200,200,255)"],
        click: ["RGB(70,70,70)", "RGB(100,100,100)"],
        initial: ["none", "RGB(170,170,170)"],
        focus: ["none", "RGB(200,200,255)"] // Assuming this is your focus state
    },

    maxDist: 4,
    orbitStepRate: 2,

    innerOpacity: 1,
    outerOpacity: 1
}

var flashlight_stdev = 0.25; // this is the radius of the flashlight
var flashlight_fraction = 0.73; // this is what fraction of samples are diverted to the flashlight




//interface

const overlays = [];

const autoToggleAllOverlays = () => {
    for (const overlay of overlays) {
        if (altHeld || nodeMode === 1) {
            overlay.style.display = 'block';
        } else {
            overlay.style.display = 'none';
        }
    }
};

let altHeld = false;

// Global event listeners to set the altHeld flag
document.addEventListener('keydown', function (event) {
    if (event.altKey) {
        altHeld = true;
        autoToggleAllOverlays();
        event.preventDefault();  // Prevent default behavior like focusing on the iframe
    }
});

document.addEventListener('keyup', function (event) {
    if (!event.altKey) {
        altHeld = false;
        autoToggleAllOverlays();
    }
});

window.addEventListener('message', function (event) {
    if (typeof event.data.altHeld !== 'undefined') {
        altHeld = event.data.altHeld;
        autoToggleAllOverlays();
    }
    if (typeof event.data.nodeMode !== 'undefined') {
        nodeMode = event.data.nodeMode;
    } else {
        nodeMode = 0;
    }
});

var nodes = [];
var edges = [];
var nodeMode_v = 0;
var nodeMode = 0;

var movingNode = undefined;
var NodeUUID = 0;



var nodeMap = {};

// Global Processed Node Map
let globalProcessedNodeMap = {};

function updateGlobalProcessedNodeMap(nodeMap) {
    // Collect current UUIDs in globalProcessedNodeMap
    const existingUUIDs = new Set(Object.keys(globalProcessedNodeMap));

    // Reset globalProcessedNodeMap
    let tempProcessedNodeMap = {};

    // Use addNodeToGlobalProcessedMap function for each node, updating or adding new
    for (let key in nodeMap) {
        const node = nodeMap[key];
        addNodeToGlobalProcessedMap(node, tempProcessedNodeMap);
        existingUUIDs.delete(node.uuid); // Remove from set to track as 'still exists'
    }

    // Remove any nodes that weren't in the updated nodeMap (stale nodes)
    existingUUIDs.forEach(uuid => {
        removeNodeFromGlobalProcessedMap(uuid);
    });

    // Update globalProcessedNodeMap after all operations to minimize state inconsistencies
    globalProcessedNodeMap = tempProcessedNodeMap;

    // Log or perform additional operations as needed
    //console.log("Global Processed Node Map has been updated with removal of stale nodes.");
}

function addNodeToGlobalProcessedMap(node, processedMap) {
    const edgesUUIDs = (node.edges || []).map(edge => edge.pts.map(pt => pt.uuid)).flat();

    processedMap[node.uuid] = {
        uuid: node.uuid,
        type: getNodeType(node),
        pos: node.pos,
        scale: node.scale,
        sensor: node.sensor,
        state: node.state,
        actions: getNodeActions(node),
        edges: edgesUUIDs
    };
}

function removeNodeFromGlobalProcessedMap(nodeUuid) {
    // First, remove the node's UUID from the edges of all other nodes
    Object.values(globalProcessedNodeMap).forEach(node => {
        node.edges = node.edges.filter(edgeUuid => edgeUuid !== nodeUuid);
    });

    // Then, remove the node itself from the map
    delete globalProcessedNodeMap[nodeUuid];

    // Log or additional operations can be performed here
}


var draggedNode = null;
var mousedownNode = undefined;

let htmlnodes_parent = document.getElementById("nodes");
let htmlnodes = htmlnodes_parent.children;
let htmledges = document.getElementById("edges");

//Zettelkasten

let processAll = false;//set to true until made more robust.

let restoreZettelkastenEvent = false;

let bypassZettelkasten = false;

var nodeTagInput;
var refTagInput;

// Globally available variables for the tags
var nodeTag = modalInputValues['node-tag'] || "##";
var refTag = modalInputValues['ref-tag'] || "[[";

function initializeTagInputs() {
    var nodeTagInput = document.getElementById('node-tag');
    var refTagInput = document.getElementById('ref-tag');
    if (nodeTagInput && refTagInput) {
        nodeTagInput.value = nodeTag; // Set the current value
        refTagInput.value = refTag; // Set the current value
        nodeTagInput.addEventListener('input', function () {
            nodeTag = nodeTagInput.value.trim();
            if (nodeTag === '') {
                nodeTag = ' ';
            }
            updateNodeTitleRegex();  // Update the regex with the new nodeTag
            updateAllZetMirrorModes();
            updateAllZettelkastenProcessors();
        });
        refTagInput.addEventListener('input', function () {
            refTag = refTagInput.value.trim();
            if (refTag === '') {
                refTag = ' ';
            }
            updateAllZetMirrorModes();
            updateAllZettelkastenProcessors();
        });
    }
}

let nodeTitleRegexGlobal = new RegExp(`^${RegExp.escape(nodeTag)}\\s*(.*)$`);

function updateNodeTitleRegex() {
    nodeTitleRegexGlobal = new RegExp(`^${RegExp.escape(nodeTag)}\\s*(.*)$`);
}

const LLM_TAG = "AI:";

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

const getClosingBracket = (openingBracket) => {
    return bracketsMap[openingBracket];
};

let isBracketLinks = false;

const checkBracketsMap = () => {
    return Object.keys(bracketsMap).includes(`${tagValues.refTag}`);
}

const tagValues = {
    get nodeTag() {
        return nodeTag;
    },
    get refTag() {
        const refValue = refTag;
        isBracketLinks = Object.keys(bracketsMap).includes(refValue);
        return refValue;
    }
};

const PROMPT_IDENTIFIER = "Prompt:";

//ai.js


// nodedef.js ainodemessage.js
let llmNodeCount = 0;

//ai.js and interface.js
class LRUCache {
    constructor(maxSize) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    get(key) {
        const value = this.cache.get(key);
        if (value !== undefined) {
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }

    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(key, value);
    }
}

function encodeHTML(str) {
    return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function decodeHTML(html) {
    let txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
}

//editornode.js

//interface.js

// Check if a string is valid JSON
function isJSON(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}


// Check if the user's message is a URL
const isUrl = (text) => {
    try {
        const url = new URL(text);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

const isIframe = (text) => {
    try {
        const doc = new DOMParser().parseFromString(text, "text/html");
        return doc.body.childNodes[0] && doc.body.childNodes[0].nodeName.toLowerCase() === 'iframe';
    } catch (_) {
        return false;
    }
}

function getIframeUrl(iframeContent) {
    // Function to extract URL from the iframe content
    // Using a simple regex to get the 'src' attribute value
    const match = iframeContent.match(/src\s*=\s*"([^"]+)"/);
    return match ? match[1] : null; // Return URL or null if not found
}

function cancel(event) {
    if (event.stopPropagation) {
        event.stopPropagation(); // W3C model
    } else {
        event.cancelBubble = true; // IE model
    }
}

function triggerInputEvent(elementId) {
    document.getElementById(elementId).dispatchEvent(new Event('input'));
}

function clearTextSelections() {
    if (window.getSelection) {
        if (window.getSelection().empty) {
            // Chrome
            window.getSelection().empty();
        } else if (window.getSelection().removeAllRanges) {
            // Firefox, Safari, IE 11+, Edge
            window.getSelection().removeAllRanges();
        }
    } else if (document.selection) {
        // IE 10 and below
        document.selection.empty();
    }
}

//debounce

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const debouncedTextareaUpdates = new Map();

function updateTextareaAndDispatchEvent(targetTextarea, text) {
    targetTextarea.value = text;
    targetTextarea.dispatchEvent(new Event('change'));
    //console.log(`Event triggered`);
}

function getDebouncedTextareaUpdate(targetTextarea) {
    if (!debouncedTextareaUpdates.has(targetTextarea)) {
        const debouncedUpdate = debounce(updateTextareaAndDispatchEvent, 20);
        debouncedTextareaUpdates.set(targetTextarea, debouncedUpdate);
    }
    return debouncedTextareaUpdates.get(targetTextarea);
}