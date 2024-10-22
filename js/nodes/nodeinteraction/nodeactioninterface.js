const NodeActions = {};

NodeActions.forNode = function(node){
    return new NodeActions[Node.getType(node)](node)
}

function addToRecentSuggestions(methodName) {
    nodeMethodManager.addSuggestion(methodName); // Update recent calls
}

// Define action parameter types
const actionParameterTypes = {
    'moveNode': ['float', 'float'] // Assumes moveNode expects two floats: angle, forceMagnitude
};

function executeNodeMethod(nodeActions, methodName) {
    console.log("Executing node method:", methodName);
    const methodPattern = /(\w+)(\(.*\))?/;
    const match = methodName.match(methodPattern);
    if (!match) {
        console.error('Invalid method format:', methodName);
        return;
    }

    const actionName = match[1];
    const rawParams = match[2] ? match[2].slice(1, -1).split(',') : [];
    let params = rawParams;

    // Convert parameters based on their expected types
    if (actionParameterTypes[actionName]) {
        params = rawParams.map((param, index) => {
            const type = actionParameterTypes[actionName][index];
            if (type === 'float') return parseFloat(param);
            if (type === 'int') return parseInt(param, 10);
            return param; // string
        });
    }

    if (typeof nodeActions[actionName] === 'function') {
        nodeActions[actionName](...params);
        addToRecentSuggestions(methodName); // Update recent calls
    } else {
        console.error('Invalid method for node:', actionName);
    }
}

function getSuggestionsFromMethods(input, methodsWithKeywords) {
    const lowerCaseInput = input.toLowerCase();
    const matches = [];

    // Iterate over each action and its keywords
    for (const [method, keywords] of Object.entries(methodsWithKeywords)) {
        if (method.toLowerCase().includes(lowerCaseInput) || keywords.some(keyword => keyword.toLowerCase().includes(lowerCaseInput))) {
            matches.push(method);
        }
    }

    // Sort matches by relevance (exact matches first)
    matches.sort((a, b) => {
        const aExactMatch = a.toLowerCase().startsWith(lowerCaseInput);
        const bExactMatch = b.toLowerCase().startsWith(lowerCaseInput);
        return bExactMatch - aExactMatch;
    });

    return matches;
}

function getNodeMethodSuggestions(value, node) {
    const validActionsWithKeywords = NodeActions.forNode(node).getActions();

    if (value.trim() !== '') {
        return getSuggestionsFromMethods(value, validActionsWithKeywords);
    }

    // show recent suggestions and all valid actions
    const recentSuggestions = nodeMethodManager.getRecentSuggestions();
    const allValidActions = Object.keys(validActionsWithKeywords);
    const allValidActionsExcludingRecent = allValidActions.filter(action => !recentSuggestions.includes(action));
    return [...recentSuggestions, ...allValidActionsExcludingRecent];
}

// Utility function
function applyActionToSelectedNodes(action, node = '') {
    const selectedUuids = SelectedNodes.uuids;
    if (selectedUuids.size > 1 && selectedUuids.has(node.uuid)) {
        selectedUuids.forEach(uuid => {
            const selectedNode = findNodeByUUID(uuid);
            if (selectedNode) action(selectedNode);
        });
    } else {
        action(node);
    }
}

NodeActions.base = class BaseNodeActions {
    constructor(node) {
        this.node = node;
    }

    getActions() {
        return {
            //'updateSensor': ["refresh", "renew", "sensor update"],
            'zoomTo': ["focus on", "center on", "highlight", "zoom in", "go to"],
            'follow': ["focus on", "center on", "highlight", "zoom in", "go to", "track"],
            'delete': ["remove", "erase", "discard", "delete node"],
            'toggleSelect': ["select", "choose", "highlight", "deselect"],
            'toggleCollapse': ["collapse", "fold", "minimize", "expand", "unfold", "maximize"],
            'toggleAutomata': ["automata"],
            'spawnNode': ["automata", "birth", "create"],
            'connect': ["edge", "link"],
            //'moveNode': ["move", "shift", "translate"],
            //'moveTo': ["move", "shift", "translate"]
        };
    }

    getSelectActionName() {
        return (SelectedNodes.uuids.has(this.node.uuid) ? 'deselect' : 'select')
    }

    getCollapseActionName() {
        return (this.node.windowDiv.collapsed ? 'expand' : 'collapse')
    }

    // Common methods for all nodes
    updateSensor() { this.node.updateSensor(); }
    zoomTo() { neuriteZoomToNodeTitle(this.node); }
    follow() {
        autopilotSpeed = settings.autopilotSpeed;
        autopilotReferenceFrame = this.node;
        ContextMenu.hide();
    }
    connect() {
        Modal.Connect.setup(this.node);
        ContextMenu.hide();
    }
    toggleSelect() {
        applyActionToSelectedNodes(SelectedNodes.toggleNode, this.node)
    }

    toggleCollapse() {
        applyActionToSelectedNodes(toggleNodeState, this.node)
    }
    toggleAutomata() {
        updateNodeStartAutomataAction(); // This will now handle the automata start logic
    }
    delete() {
        applyActionToSelectedNodes( (node)=>node.remove() , this.node);
        ContextMenu.hide();
    }
    spawnNode() {
        spawnZettelkastenNode(this.node);
    }
    moveNode(directionOrAngle, forceMagnitude = 0.01) {
        // Ensure this.node is the node class instance with the updated moveNode method
        this.node.moveNode(directionOrAngle, forceMagnitude);
    }
    moveTo(x, y, tolerance = null, onComplete = () => { }) {
        this.node.moveTo(x, y, tolerance, onComplete);
    }
}

NodeActions.text = class TextNodeActions extends NodeActions.base {
    getActions() {
        return {
            ...super.getActions(),
            'toggleCode': ["show code", "hide code", "run code", "toggle script", "show text", "display text", "display code", "view text"],
            //'testNodeText': ["test text", "check text", "text testing"]
        };
    }

    toggleCode() {
        const node = this.node;
        handleCodeExecution(node.textarea, node.htmlView, node.pythonView, node);
    }
    testNodeText() {
        testNodeText(this.node.getTitle());
    }
    delete() {
        applyActionToSelectedNodes((node) => {
            const nodeTitle = node.getTitle();

            const zetNodeCMInstance = getZetNodeCMInstance(nodeTitle);
            if (zetNodeCMInstance) {
                zetNodeCMInstance.parser.deleteNodeByTitle(nodeTitle);
            }
        }, this.node);

        ContextMenu.hide();
    }
}

NodeActions.llm = class LLMNodeActions extends NodeActions.base {
    getActions() {
        return {
            ...super.getActions(),
            'sendMessage': ["send", "transmit", "dispatch", "send message"],
            'settings': ["preferences", "options", "configuration", "setup"],
            'halt': ["stop", "pause", "interrupt", "cease"],
            'refreshResponse': ["update response", "reload", "refresh"]
        }
    }

    sendMessage() {
        const promptTextarea = this.node.promptTextArea;
        // Check if the prompt textarea is empty
        if (!promptTextarea.value.trim()) {
            const userInput = window.prompt("Please enter your prompt:");
            if (userInput === null || userInput.trim() === '') {
                console.log("No prompt entered");
                return;
            }

            promptTextarea.value = userInput;
        }

        this.simulateClick(this.node.sendButton, "Send");
    }
    halt(){
        this.simulateClick(this.node.regenerateButton, "Halt")
    }
    refreshResponse(){
        this.simulateClick(this.node.regenerateButton, "Regenerate")
    }
    settings(){
        const settingsButton = this.node.content.querySelector('#aiNodeSettingsButton');
        this.simulateClick(settingsButton, "Settings");
    }
    simulateClick(button, name){
        if (button instanceof HTMLElement) {
            button.click()
        } else {
            console.error(name, "button not found or is not a valid element")
        }
    }
}

NodeActions.link = class LinkNodeActions extends NodeActions.base {
    getActions() {
        return {
            ...super.getActions(),
            'displayIframe': ["show iframe", "iframe view", "embed", "display frame"],
            'extractText': ["get text", "copy text", "text extraction", "extract webpage", "scrape webpage"],
            'toggleProxy': ["webpage text", "proxy"],
            'importText': ["webpage text", "import", "text"]

        };
    }

    displayIframe() {
        const node = this.node;
        handleLinkNodeIframe(node.iframeWrapper, node.linkWrapper, node.linkUrl);
    }
    displayWebpage() {
        this.toggleProxy();
    }
    toggleProxy() {
        LinkNode.handleProxyDisplay(this.node)
    }
    extractText() {
        extractAndStoreLinkContent(this.node.linkUrl, this.node.titleInput.value);
    }
    importText() {
        importLinkNodeTextToZettelkasten(this.node.linkUrl);
        ContextMenu.hide();
    }
}
