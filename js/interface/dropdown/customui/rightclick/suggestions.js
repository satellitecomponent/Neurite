const Suggestions = {
    global: null
};
Suggestions.Component = class {
    constructor() {
        this.container = this.makeDivContainer();
        this.init();
    }
    makeDivContainer() {
        const div = Html.make.div('suggestions-container');
        div.id = 'suggestions-container';
        return div;
    }
    init() {
        // Prevent [click (?) and] scroll events from propagating
        ['wheel'].forEach( (eName)=>{
            On[eName](this.container, Event.stopPropagation, true)
        });
        document.body.appendChild(this.container);
    }
    position(x, y) {
        const style = this.container.style;
        // keeps the bottom-right corner aligned
        style.transform = `translate(calc(${x}px - 100%  + 5px), calc(${y}px - 100% + 6px))`;
        style.display = 'block';
    }
    clear() {
        this.container.innerHTML = '';
    }
    addSuggestion(text, inputField, onSelect, onPin, isPinned){
        const item = new MenuItem.Suggestion(text, onSelect, onPin, isPinned);
        item.init();
        this.container.appendChild(item.divItem);
    }
    scrollToBottom() {
        // Scroll the container to its maximum scrollable height
        this.container.scrollTop = this.container.scrollHeight;
    }
    hide() {
        this.container.style.display = 'none';
    }
}
MenuItem.Suggestion = class {
    constructor(text, onSelect, onPin, isPinned){
        this.isPinned = isPinned;
        this.onSelect = onSelect;
        this.onPin = onPin;
        this.text = text;
        this.svgMinus = this.makeSvgIcon('minus');
        this.svgPlus = this.makeSvgIcon('plus');
        this.btnPin = this.makeBtnPin();
        this.spanText = this.makeSpanText();
        this.divItem = this.makeDivItem();
    }
    init(){
        this.updateSvgs();
        On.click(this.divItem, this.togglePin);
    }

    makeBtnPin(){
        const button = Html.make.button('pin-button');
        if (this.isPinned) button.classList.add('pinned');

        button.append(this.svgPlus, this.svgMinus);
        return button;
    }
    makeDivItem(){
        const div = Html.make.div('suggestion-item');
        div.append(this.spanText, this.btnPin);
        return div;
    }
    makeSpanText(){
        const span = Html.new.span();
        span.textContent = this.text;
        return span;
    }
    makeSvgIcon(key){
        const svg = Svg.new.svg();
        svg.setAttribute('class', 'icon icon-' + key);
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '1em');
        svg.setAttribute('height', '1em');
        const use = Svg.new.use();
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#icon-' + key);
        svg.appendChild(use);
        return svg;
    }

    togglePin = (e)=>{
        e.preventDefault();
        e.stopPropagation();

        this.isPinned = !this.isPinned;
        this.btnPin.classList.toggle('pinned', this.isPinned);
        this.updateSvgs();

        this.onPin(this.text, this.isPinned);
        this.onSelect();
    }
    updateSvgs(){
        this.svgPlus.style.display = (this.isPinned ? 'none' : 'inline');
        this.svgMinus.style.display = (this.isPinned ? 'inline' : 'none');
    }
}
Suggestions.global = new Suggestions.Component();

class RecentSuggestionsManager {
    constructor(storageId) {
        this.storageId = storageId;
        this.recentCalls = this.loadFromLocalStorage();
    }

    loadFromLocalStorage() {
        const storedCalls = localStorage.getItem(this.storageId);
        return storedCalls ? JSON.parse(storedCalls) : [];
    }

    saveToLocalStorage() {
        localStorage.setItem(this.storageId, JSON.stringify(this.recentCalls))
    }

    addSuggestion(suggestion) {
        // Remove the suggestion if it already exists to prevent duplicates
        this.recentCalls = this.recentCalls.filter(call => call !== suggestion);

        // Add the suggestion to the top of the list
        this.recentCalls.unshift(suggestion);

        // Keep only the 6 most recent suggestions
        this.recentCalls = this.recentCalls.slice(0, 6);

        // Save the updated list to local storage
        this.saveToLocalStorage();
    }

    getRecentSuggestions() {
        // Return a reversed copy of the recent calls array
        return [...this.recentCalls].reverse();
    }
}

const nodeMethodManager = new RecentSuggestionsManager('nodeMethodCalls');

class PinnedItemsManager {
    constructor(storageId) {
        this.storageId = storageId;
        this.items = this.loadFromLocalStorage();
    }

    loadFromLocalStorage() {
        const storedItems = localStorage.getItem(this.storageId);
        return (storedItems ? JSON.parse(storedItems) : []);
    }
    saveToLocalStorage() {
        localStorage.setItem(this.storageId, JSON.stringify(this.items));
    }

    addItem(item) {
        if (this.isItemPinned(item)) return;

        this.items.push(item);
        this.saveToLocalStorage();
    }
    removeItem(item) {
        this.items = this.items.filter(pinnedItem => pinnedItem !== item);
        this.saveToLocalStorage();
    }

    forEach(cb, ct){ return this.items.forEach(cb, ct) }
    isItemPinned(item){ return this.items.includes(item) }
}

const pinnedItemsManager = new PinnedItemsManager('pinnedContextMenuItems');

ContextMenu.prototype.pinSuggestion = function(id){
    if (this.itemById(id)) return;

    const { displayText, executeAction } = getDynamicActionDetails(id, this.targetModel);
    const menuItem = ContextMenu.option(displayText, executeAction);
    On.click(menuItem, (e)=>{
        Suggestions.global.hide();
        addToRecentSuggestions(id); // Update recent calls without executing again
    });

    this.menu.appendChild(menuItem);
    pinnedItemsManager.addItem(id);
}

function getDynamicActionDetails(uniqueIdentifier, node) {
    const nodeActions = NodeActions.forNode(node);
    return {
        displayText: uniqueIdentifier,
        executeAction: () => nodeActions[uniqueIdentifier] ? nodeActions[uniqueIdentifier]() : Logger.err("Invalid action")
    };
}

ContextMenu.prototype.loadPinnedItems = function(){
    const nodeActions = NodeActions.forNode(this.targetModel);
    pinnedItemsManager.forEach(
        (id)=>{ if (id in nodeActions) this.pinSuggestion(id) }
    );
}

ContextMenu.prototype.setupSuggestions = function(pageX, pageY){
    const inputField = this.inputField;
    const node = this.targetModel;

    On.input(inputField, (e)=>displaySuggestions(e.target.value) );

    On.focus(inputField, (e)=>{
        if (inputField.value === '') displaySuggestions('');
    });

    On.keypress(inputField, (e)=>{
        if (e.key === 'Enter') {
            Suggestions.global.hide();
            executeNodeMethod(NodeActions.forNode(node), e.target.value);
            e.target.value = '';
            Suggestions.global.hide();
        }
    });

    function displaySuggestions(value) {
        const component = Suggestions.global;
        component.clear();
        component.position(pageX, pageY);

        const nodeActions = NodeActions.forNode(node);
        getNodeMethodSuggestions(value, node).forEach( (suggestion)=>{
            component.addSuggestion(
                getDynamicActionDetails(suggestion, node).displayText,
                inputField,
                Function.nop,
                (executeAction, pinState) => {
                    const funcName = (pinState ? 'pinSuggestion' : 'unpinSuggestion');
                    ContextMenu[funcName](executeAction);
                },
                pinnedItemsManager.isItemPinned(suggestion)
            );
        });

        component.scrollToBottom();
    }
}

ContextMenu.prototype.unpinSuggestion = function(id){
    const action = this.itemById(id);
    if (action) this.menu.removeChild(action);
    pinnedItemsManager.removeItem(id);
}

ContextMenu.prototype.itemById = function(id){
    return Elem.findChild(this.menu, Elem.hasDatasetIdThis, id)
}
