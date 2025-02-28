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
    altHeld = false;
    nodeMode = new NodeMode(this.autoToggleAllOverlays.bind(this));
    overlays = [];
    constructor(){
        On.keydown(document, this.altKeyDown);
        On.keyup(document, this.altKeyUp);
        On.message(window, this.onMessage);
    }

    autoToggleAllOverlays(){
        const condition = (this.altHeld || this.nodeMode.val === 1);
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
        this.nodeMode.val = data.nodeMode ?? 0;
    }
}



class ProcessedNodes {
    map = {};

    addNodeToMap(node, processedMap){
        const neighborsUuids = [];
        node.forEachConnectedNode( (node)=>neighborsUuids.push(node.uuid) );

        processedMap[node.uuid] = {
            uuid: node.uuid,
            type: Node.getType(node),
            isMoving: false,
            pos: node.pos,
            scale: node.scale,
            sensor: node.sensor,
            state: node.state,
            actions: NodeActions.forNode(node),
            neighborsUuids
        };
    }
    filter(cb, ct){
        const found = [];
        this.forEach( (node)=>{ if (cb.call(ct, node)) found.push(node) });
        return found;
    }
    forEach(cb, ct){
        const map = this.map;
        for (const uuid in map) cb.call(ct, map[uuid]);
    }
    getUuids(){ return Object.keys(this.map) }

    static removeThisUuidFromEdgesOfNode(node){
        node.neighborsUuids = node.neighborsUuids.filter(Object.isntThis, this.valueOf())
    }
    removeById(nodeUuid){
        this.forEach(ProcessedNodes.removeThisUuidFromEdgesOfNode, nodeUuid);
        delete this.map[nodeUuid];
    }
    update(){
        const existingUUIDs = new Set(this.getUuids());
        const tempProcessedNodeMap = {};

        const nodes = Graph.nodes;
        for (const uuid in nodes) {
            const node = nodes[uuid];
            this.addNodeToMap(node, tempProcessedNodeMap);
            existingUUIDs.delete(uuid); // Remove from set to track as 'still exists'
        }

        // Remove any nodes that weren't in the updated nodes (stale nodes)
        existingUUIDs.forEach(this.removeById, this);
        this.map = tempProcessedNodeMap;
    }
}



//Zettelkasten

let processAll = false;//set to true until made more robust.

let restoreZettelkastenEvent = false;

let bypassZettelkasten = false;

class Tag {
    static init(){
        Tag.node = Modal.inputValues['node-tag'] || "##";
        Tag.ref = Modal.inputValues['ref-tag'] || "[[";
        ZettelkastenParser.regexpNodeTitle = RegExp.forNodeTitle(Tag.node);
    }
    static initializeInputs(){
        const inputNodeTag = Elem.byId('node-tag');
        const inputRefTag = Elem.byId('ref-tag');
        if (!inputNodeTag || !inputRefTag) return;

        inputNodeTag.value = Tag.node;
        inputRefTag.value = Tag.ref;
        On.input(inputNodeTag, Tag.#onTagInput);
        On.input(inputRefTag, Tag.#onTagInput);
    }
    static #onTagInput(e){
        const input = e.currentTarget;
        const tag = input.value.trim();
        Tag[input.dataset.key] = (tag === '' ? ' ' : tag);
        
        ZettelkastenParser.regexpNodeTitle = RegExp.forNodeTitle(Tag.node);
        updateAllZetMirrorModes();
        updateAllZettelkastenProcessors();
        updateAllCodeMirrorPlaceholders();
    }
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
const PROMPT_END = ":End Prompt"

class Html {
    static create = document.createElement.bind(document);
    static make = {
        a(href, className){
            const a = Html.new.a();
            if (href !== undefined) a.href = href;
            if (className !== undefined) a.setAttribute('class', className);
            return a;
        },
        button(className, textContent){
            const button = Html.new.button();
            if (className !== undefined) button.setAttribute('class', className);
            if (textContent !== undefined) button.textContent = textContent;
            return button;
        },
        li(content, className, onClick){
            const li = Html.new.li();
            if (content !== undefined) li.append(content);
            if (className !== undefined) li.setAttribute('class', className);
            if (onClick !== undefined) On.click(li, onClick);
            return li;
        }
    };
    static makeWithClass(tagName, className){
        const elem = Html.new[tagName]();
        if (className !== undefined) elem.setAttribute('class', className);
        return elem;
    }
    static new = {};
}
[
    'code', 'div', 'iframe', 'input',
    'pre', 'select', 'span', 'textarea'
].forEach( (name)=>{ Html.make[name] = Html.makeWithClass.bind(Elem, name) } );
[
    'a', 'audio', 'button', 'code', 'canvas',
    'div', 'iframe', 'img', 'input', 'label', 'li',
    'p', 'pre', 'select', 'script', 'span',
    'table', 'td', 'textarea', 'tr', 'video'
].forEach( (name)=>{ Html.new[name] = Html.create.bind(Elem, name) } );

class Svg {
    static needsRecalc = false;
    static oldRotation = 0;
    static oldZoom = 8192;
    static recenterThreshold = 0.01;
    static rezoomFactor = 8192;
    static rezoomThreshold = 0.1;
    static zoom = 8192;
    static refresh = '<svg width="24" height="24"><use xlink:href="#refresh-icon"></use></svg>';
    static use = {
        pause: '<use xlink:href="#pause-icon"></use>',
        play: '<use xlink:href="#play-icon"></use>'
    };
    static pause = `<svg width="24" height="24">${Svg.use.pause}</svg>`;
    static play = `<svg width="24" height="24">${Svg.use.play}</use></svg>`;
    static updatePan(newPan){
        this.oldPan = this.pan;
        this.pan = newPan;
        this.needsRecalc = true;
    }
    static updateZoom(newZoom){
        this.oldZoom = this.zoom;
        this.zoom = newZoom;
        this.needsRecalc = true;
    }
    static create = document.createElementNS.bind(document, 'http://www.w3.org/2000/svg');
    static new = {};
}
['circle', 'path', 'svg', 'use']
.forEach( (name)=>{ Svg.new[name] = Svg.create.bind(Elem, name) } );

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
    const txt = Html.new.textarea();
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
String.trim = function(str){ return str.trim() }
String.uuidOf = function(obj){ return obj.uuid }

function getIframeUrl(iframeContent) {
    // Function to extract URL from the iframe content
    // Using a simple regex to get the 'src' attribute value
    const match = iframeContent.match(/src\s*=\s*"([^"]+)"/);
    return match ? match[1] : null; // Return URL or null if not found
}

Event.dataIndex = function(e){ return Number(e.currentTarget.dataset.index) }
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
