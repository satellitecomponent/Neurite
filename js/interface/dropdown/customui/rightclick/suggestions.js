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
        const item = new Suggestions.Item(text, onSelect, onPin, isPinned);
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
Suggestions.Item = class {
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
        On.click(this.btnPin, this.togglePin);
        On.click(this.spanText, this.togglePin);
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

        const isPinned = this.isPinned = !this.isPinned;
        this.btnPin.classList.toggle('pinned', isPinned);
        this.updateSvgs();

        this.onPin(this.text, isPinned);
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
        this.pinnedItems = this.loadFromLocalStorage();
    }

    loadFromLocalStorage() {
        const storedItems = localStorage.getItem(this.storageId);
        return storedItems ? JSON.parse(storedItems) : [];
    }

    saveToLocalStorage() {
        localStorage.setItem(this.storageId, JSON.stringify(this.pinnedItems));
    }

    addPinnedItem(item) {
        if (this.pinnedItems.includes(item)) return;

        this.pinnedItems.push(item);
        this.saveToLocalStorage();
    }

    getPinnedItems() {
        return this.pinnedItems;
    }

    removePinnedItem(item) {
        this.pinnedItems = this.pinnedItems.filter(pinnedItem => pinnedItem !== item);
        this.saveToLocalStorage();
    }

    isItemPinned(item) {
        return this.pinnedItems.includes(item);
    }
}

const pinnedItemsManager = new PinnedItemsManager('pinnedContextMenuItems');

function pinSuggestionToContextMenu(uniqueIdentifier, menu, node, isAlreadyPinned = false) {
    const { displayText, executeAction } = getDynamicActionDetails(uniqueIdentifier, node);
    const menuItem = Array.from(menu.children).find(item => item.dataset.identifier === uniqueIdentifier);

    if (!menuItem) {
        const menuItem = ContextMenu.createMenuItem(displayText, uniqueIdentifier, executeAction);
        On.click(menuItem, (e)=>{
            Suggestions.global.hide();
            addToRecentSuggestions(uniqueIdentifier); // Update recent calls without executing again
        });
        // Insert new menu item at the end, but before the input field if it exists.
        const inputFieldLi = menu.querySelector('.input-item');
        if (inputFieldLi) {
            menu.appendChild(menuItem, inputFieldLi);
        } else {
            menu.appendChild(menuItem);
        }
        if (!isAlreadyPinned) {
            pinnedItemsManager.addPinnedItem(uniqueIdentifier);
        }
    } else {
        menuItem.textContent = displayText;
        menuItem.dataset.identifier = uniqueIdentifier;
        On.click(menuItem, (e)=>{
            executeAction;
            addToRecentSuggestions(uniqueIdentifier); // Update recent calls without executing again
        });
    }
}

function getDynamicActionDetails(uniqueIdentifier, node) {
    const nodeActions = NodeActions.forNode(node);
    return {
        displayText: uniqueIdentifier,
        executeAction: () => nodeActions[uniqueIdentifier] ? nodeActions[uniqueIdentifier]() : Logger.err("Invalid action")
    };
}

function loadPinnedItemsToContextMenu(menu, node) {
    const nodeActions = NodeActions.forNode(node);
    const pinnedItems = pinnedItemsManager.getPinnedItems();

    // Filter pinned items to include only those that have corresponding actions in the current node's action set
    const relevantPinnedItems = pinnedItems.filter(uniqueIdentifier => uniqueIdentifier in nodeActions);

    relevantPinnedItems.forEach(uniqueIdentifier => {
        const currentDetails = getDynamicActionDetails(uniqueIdentifier, node); // Fetch current details
        pinSuggestionToContextMenu(uniqueIdentifier, menu, node, true, currentDetails.displayText); // Pass current display text
    });
}

function setupSuggestionsForInput(menu, inputField, node, fetchSuggestions, pageX, pageY) {
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
        const suggestions = fetchSuggestions(value, node);
        suggestions.forEach(suggestion => {
            component.addSuggestion(
                getDynamicActionDetails(suggestion, node).displayText,
                inputField,
                () => { return; },
                (executeAction, pinState) => {
                    if (pinState) {
                        // Pinning the item
                        pinSuggestionToContextMenu(executeAction, menu, node);
                    } else {
                        // Unpinning the item
                        unpinSuggestionFromContextMenu(executeAction, menu);
                    }
                },
                pinnedItemsManager.isItemPinned(suggestion)
            );
        });

        component.scrollToBottom();
    }
}

function unpinSuggestionFromContextMenu(identifier, menu) {
    const action = Array.from(menu.children).find(
        (item)=>(item.dataset.identifier === identifier)
    );
    if (action) menu.removeChild(action);
    pinnedItemsManager.removePinnedItem(identifier);
}
