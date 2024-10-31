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
        let L = cuList.join('');
        // 7. Return L.
        return L;
    };
}



class Modal {
    static current = null;
    static div = Elem.byId('customModal');
    static inputValues = {};
    static isDragging = false;
    static mouseOffsetX = 0;
    static mouseOffsetY = 0;

    constructor(id, title, funcInit){
        this.id = id;
        this.title = title;
        this.init = funcInit;
    }
    static loadInputValues(){
        const storedValues = localStorage.getItem('modalInputValues');
        if (storedValues) Modal.inputValues = JSON.parse(storedValues);
    }
}
Modal.loadInputValues();



var controls = {
    altKey: {
        default: "Alt",
        value: "Alt"
    },
    shiftKey: {
        default: "Shift",
        value: "Shift"
    },
    controlKey: {
        default: "Control",
        value: "Control"
    },
    scrollMode: {
        default: ('GestureEvent' in window) ? "pan" : "zoom",
        value: ('GestureEvent' in window) ? "pan" : "zoom"
    },
    zoomClick: {
        default: "scroll", // Default to Scroll Wheel
        value: "scroll"
    },
    panClick: {
        default: 0, // Default to Left Click
        value: 0
    },
    contextMenuButton: {
        default: 2, // Default to Right Click
        value: 2
    }
};

var settings = {
    zoomSpeed: 0.001,
    dragZoomSpeed: 0.005,
    panSpeed: 1,
    zoomContentExp: 0.5,
    gestureZoomSpeed: 0.001,
    gestureRotateSpeed: Math.PI / 180,

    nodeModeKey: controls.shiftKey.value, //"CapsLock",
    nodeModeTrigger: "down", //"toggle"

    scroll: controls.scrollMode.value,
    zoomClick: controls.zoomClick.value,
    panClick: controls.panClick.value,
    rotateModifier: controls.altKey.value,
    contextKey: controls.contextMenuButton.value,

    rotateModifierSpeed: Math.PI / 180 / 36,
    dragRotateSpeed: 0.01,

    //slider adjustment
    maxLines: 128,
    renderWidthMult: 0.3, //1,
    regenDebtAdjustmentFactor: 1,

    renderStepSize: 0.1, //0.25,
    renderSteps: 16, //64,
    renderDChar: "L",
    opacity: 1,

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
        focus: ["none", "RGB(200,200,255)"]
    },

    maxDist: 4,
    orbitStepRate: 2,

    innerOpacity: 1,
    outerOpacity: 1
}

var flashlight_stdev = 0.25; // this is the radius of the flashlight
var flashlight_fraction = 0.73; // this is what fraction of samples are diverted to the flashlight



class Interface {
    overlays = [];
    altHeld = false;
    constructor(){
        On.keydown(document, this.altKeyDown);
        On.keyup(document, this.altKeyUp);
        On.message(window, this.onMessage);
    }

    autoToggleAllOverlays(){
        const condition = (this.altHeld || NodeMode.val === 1);
        for (const overlay of this.overlays) {
            overlay.style.display = (condition ? 'block' : 'none');
        }
    }
    altKeyDown = (e)=>{
        if (e.altKey) {
            this.altHeld = true;
            this.autoToggleAllOverlays();
            e.preventDefault(); // e.g. focusing on the iframe
        }
    }
    altKeyUp = (e)=>{
        if (!e.altKey) {
            this.altHeld = false;
            this.autoToggleAllOverlays();
        }
    }
    onMessage = (e)=>{
        const data = e.data;
        if (data.altHeld !== undefined) {
            this.altHeld = data.altHeld;
            this.autoToggleAllOverlays();
        }
        NodeMode.val = data.nodeMode ?? 0;
    }
}
Interface = new Interface();

const Graph = {
    nodes: [],
    edges: []
};

var movingNode = undefined;
var NodeUUID = 0;



var nodeMap = {};

const ProcessedNodes = {
    map: {}
};
ProcessedNodes.update = function(){
    const existingUUIDs = new Set(ProcessedNodes.getUuids());
    const tempProcessedNodeMap = {};

    for (const uuid in nodeMap) {
        const node = nodeMap[uuid];
        ProcessedNodes.addNodeToMap(node, tempProcessedNodeMap);
        existingUUIDs.delete(uuid); // Remove from set to track as 'still exists'
    }

    // Remove any nodes that weren't in the updated nodeMap (stale nodes)
    existingUUIDs.forEach(ProcessedNodes.removeById);
    ProcessedNodes.map = tempProcessedNodeMap;
}
ProcessedNodes.addNodeToMap = function(node, processedMap){
    const edgesUUIDs = (node.edges || []).map(edge => edge.pts.map(pt => pt.uuid)).flat();

    processedMap[node.uuid] = {
        uuid: node.uuid,
        type: Node.getType(node),
        pos: node.pos,
        scale: node.scale,
        sensor: node.sensor,
        state: node.state,
        actions: NodeActions.forNode(node),
        edges: edgesUUIDs
    };
}
ProcessedNodes.filter = function(cb, ct){
    const foundNodes = [];
    ProcessedNodes.forEach( (node)=>{
        if (cb.call(ct, node)) foundNodes.push(node)
    });
    return foundNodes;
}
ProcessedNodes.forEach = function(cb, ct){
    const map = ProcessedNodes.map;
    for (const uuid in map) cb.call(ct, map[uuid]);
}
ProcessedNodes.getById = function(nodeUuid){
    return ProcessedNodes.map[nodeUuid]
}
ProcessedNodes.getByNode = function(node){
    return ProcessedNodes.getById(node.uuid)
}
ProcessedNodes.getUuids = function(){
    return Object.keys(ProcessedNodes.map)
}
ProcessedNodes.removeById = function(nodeUuid){
    const map = ProcessedNodes.map;

    // remove the node's UUID from the edges of all other nodes
    for (const uuid in map) {
        const node = map[uuid];
        node.edges = node.edges.filter(edgeUuid => edgeUuid !== nodeUuid);
    }

    delete map[nodeUuid];
}



var draggedNode = null;
var mousedownNode = undefined;

let htmlnodes_parent = Elem.byId('nodes');
let htmlnodes = htmlnodes_parent.children;
let htmledges = Elem.byId('edges');

//Zettelkasten

let processAll = false;//set to true until made more robust.

let restoreZettelkastenEvent = false;

let bypassZettelkasten = false;

const Tag = {
    node: Modal.inputValues['node-tag'] || "##",
    ref: Modal.inputValues['ref-tag'] || "[["
}
Tag.initializeInputs = function(){
    const nodeTagInput = Elem.byId('node-tag');
    const refTagInput = Elem.byId('ref-tag');
    if (!nodeTagInput || !refTagInput) return;

    nodeTagInput.value = Tag.node;
    refTagInput.value = Tag.ref;
    On.input(nodeTagInput, (e)=>{
        const nodeTag = nodeTagInput.value.trim();
        Tag.node = (nodeTag === '' ? ' ' : nodeTag);

        updateNodeTitleRegex();  // Update the regex with the new nodeTag
        updateAllZetMirrorModes();
        updateAllZettelkastenProcessors();
    });
    On.input(refTagInput, (e)=>{
        const refTag = refTagInput.value.trim();
        Tag.ref = (refTag === '' ? ' ' : refTag);

        updateAllZetMirrorModes();
        updateAllZettelkastenProcessors();
    });
}

let nodeTitleRegexGlobal = new RegExp(`^${RegExp.escape(Tag.node)}\\s*(.*)$`);

function updateNodeTitleRegex() {
    nodeTitleRegexGlobal = new RegExp(`^${RegExp.escape(Tag.node)}\\s*(.*)$`);
}

const bracketsMap = {
    '(': ')',
    '[': ']',
    '{': '}',
    '<': '>',
    '((': '))',
    '[[': ']]',
    '{{': '}}',
    '<<': '>>',
    '�': '�',      // Guillemet
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
    return Object.keys(bracketsMap).includes(tagValues.refTag);
}

const tagValues = {
    get nodeTag() {
        return Tag.node;
    },
    get refTag() {
        const refValue = Tag.ref;
        isBracketLinks = Object.keys(bracketsMap).includes(refValue);
        return refValue;
    }
};

const Keys = {};

const LLM_TAG = "AI:";

Promise.delay = (msecs)=>( new Promise( (resolve)=>setTimeout(resolve, msecs) ) );

const PROMPT_IDENTIFIER = "Prompt:";

const SVG = {
    needsRecalc: false,
    oldRotation: 0,
    oldZoom: 8192,
    recenterThreshold: 0.01,
    rezoomFactor: 8192,
    rezoomThreshold: 0.1,
    zoom: 8192,
    refresh: '<svg width="24" height="24"><use xlink:href="#refresh-icon"></use></svg>',
    use: {
        pause: '<use xlink:href="#pause-icon"></use>',
        play: '<use xlink:href="#play-icon"></use>'
    }
};
SVG.pause = `<svg width="24" height="24">${SVG.use.pause}</svg>`;
SVG.play = `<svg width="24" height="24">${SVG.use.play}</use></svg>`;
SVG.updatePan = function(newPan){
    this.oldPan = this.pan;
    this.pan = newPan;
    this.needsRecalc = true;
}
SVG.updateZoom = function(newZoom){
    this.oldZoom = this.zoom;
    this.zoom = newZoom;
    this.needsRecalc = true;
}
SVG.create = document.createElementNS.bind(document, 'http://www.w3.org/2000/svg');
SVG.create.circle = SVG.create.bind(Elem, 'circle');
SVG.create.path = SVG.create.bind(Elem, 'path');
SVG.create.svg = SVG.create.bind(Elem, 'svg');
SVG.create.use = SVG.create.bind(Elem, 'use');

//ai.js

// nodedef.js ainodemessage.js
const AiNode = {
    count: 0
};

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

//filepath.js

let currentPath = '/'; // Default path

    const storedPath = localStorage.getItem('currentPath');
    if (storedPath) {
        currentPath = storedPath;
    } else {
        localStorage.setItem('currentPath', currentPath);
    }

    //togglenodestate.js
let isDraggingDragBox = false;
//editornode.js

//interface.js

String.isJson = function(str){
    try {
        JSON.parse(str);
        return true;
    } catch(err){}
    return false;
}
String.isUrl = function(str){
    if (!URL.canParse(str)) return false;

    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
}
String.isIframe = function(str){
    try {
        const doc = new DOMParser().parseFromString(str, "text/html");
        return doc.body.childNodes[0] && doc.body.childNodes[0].nodeName.toLowerCase() === 'iframe';
    } catch(err){}
    return false;
}

function getIframeUrl(iframeContent) {
    // Function to extract URL from the iframe content
    // Using a simple regex to get the 'src' attribute value
    const match = iframeContent.match(/src\s*=\s*"([^"]+)"/);
    return match ? match[1] : null; // Return URL or null if not found
}

Event.preventDefault = function(e){ e.preventDefault() }
Event.stopPropagation = function(e){ e.stopPropagation() }
Event.stopPropagationByNameForThis = function(eName){
    On[eName](this, Event.stopPropagation)
}

function triggerInputEvent(elementId) {
    Elem.byId(elementId).dispatchEvent(new Event('input'))
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

function callWithDelay(func, delay){
    return new Promise( (resolve)=>{
        setTimeout( ()=>{
            func();
            resolve();
        }, delay)
    })
}
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        function later(){
            clearTimeout(timeout);
            func(...args);
        }
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const TextArea = {
    debouncedUpdates: new Map()
};
TextArea.append = function(text){
    this.value += text;
    this.dispatchEvent(new Event('input'));
}
TextArea.update = function(text) {
    this.value = text;
    this.dispatchEvent(new Event('change'));
    Logger.debug("Event triggered");
}

function getDebouncedTextareaUpdate(textarea) {
    const debouncedUpdates = TextArea.debouncedUpdates;
    if (!debouncedUpdates.has(textarea)) {
        debouncedUpdates.set(textarea, debounce(TextArea.update.bind(textarea), 20));
    }
    return debouncedUpdates.get(textarea);
}
