Menu.Suggestions = class {
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
        On.wheel(this.container, e => {
            e.stopPropagation();
        }, true);
    
        On.contextmenu(this.container, e => {
            e.preventDefault();
            e.stopPropagation();
        }, true);
    
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
    addSuggestion(text, onSelect, onPin, isPinned){
        const item = new MenuItem.Suggestion(text, onSelect, onPin, isPinned);
        item.init();
        this.container.appendChild(item.divItem);
    }
    repositionIfDisplayed(x, y){
        if (this.container.style.display === 'block') this.position(x, y)
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

Manager.RecentSuggestions = class {
    constructor(storageId, max = 6) { // Keep only the 6 most recent suggestions
        this.storageId = storageId;
        this.max = max;
        this.items = this.loadFromLocalStorage();
    }

    loadFromLocalStorage() {
        const storedCalls = localStorage.getItem(this.storageId);
        return storedCalls ? JSON.parse(storedCalls) : [];
    }

    saveToLocalStorage() {
        localStorage.setItem(this.storageId, JSON.stringify(this.items))
    }

    add(suggestion){
        this.items = this.items.reduce( (newItems, item)=>{
            if (newItems.length < this.max
                && item !== suggestion) newItems.push(item);
            return newItems;
        }, [suggestion]);
        this.saveToLocalStorage();
    }

    get(){ return this.items.toReversed() }
}

Manager.PinnedItems = class {
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

Menu.Context.prototype.pinSuggestion = function(id){
    if (this.itemById(id)) return;

    const { displayText, executeAction } = getDynamicActionDetails(id, this.targetModel);
    const menuItem = App.menuContext.option(displayText, executeAction, false);
    menuItem.dataset.id = id;
    On.click(menuItem, (e)=>{
        App.menuSuggestions.hide();
        App.recentSuggestions.add(id);
    });

    this.menu.appendChild(menuItem);
    App.pinnedItems.addItem(id);
}

function getDynamicActionDetails(uniqueIdentifier, node) {
    const nodeActions = NodeActions.forNode(node);
    return {
        displayText: uniqueIdentifier,
        executeAction: () => nodeActions[uniqueIdentifier] ? nodeActions[uniqueIdentifier]() : Logger.err("Invalid action")
    };
}

Menu.Context.prototype.loadPinnedItems = function(){
    const nodeActions = NodeActions.forNode(this.targetModel);
    App.pinnedItems.forEach(
        (id)=>{ if (id in nodeActions) this.pinSuggestion(id) }
    );
}

Menu.Context.prototype.setupSuggestions = function(pageX, pageY){
    const inputField = this.inputField;
    const node = this.targetModel;

    On.input(inputField, (e)=>displaySuggestions(e.target.value) );

    On.focus(inputField, (e)=>{
        if (inputField.value === '') displaySuggestions('');
    });

    On.keypress(inputField, (e)=>{
        if (e.key === 'Enter') {
            App.menuSuggestions.hide();
            executeNodeMethod(NodeActions.forNode(node), e.target.value);
            e.target.value = '';
            App.menuSuggestions.hide();
        }
    });

    function displaySuggestions(value) {
        const menu = App.menuSuggestions;
        menu.clear();
        menu.position(pageX, pageY);

        const nodeActions = NodeActions.forNode(node);
        getNodeMethodSuggestions(value, node).forEach( (suggestion)=>{
            menu.addSuggestion(
                getDynamicActionDetails(suggestion, node).displayText,
                Function.nop,
                (executeAction, pinState) => {
                    const funcName = (pinState ? 'pinSuggestion' : 'unpinSuggestion');
                    App.menuContext[funcName](executeAction);
                },
                App.pinnedItems.isItemPinned(suggestion)
            );
        });

        menu.scrollToBottom();
    }
    requestAnimationFrame(() => {
        const items = [...this.menu.children];
        const actionItems = items.filter(li => !li.classList.contains('input-item'));
        if (actionItems.length === 0) displaySuggestions('');
    });
}

Menu.Context.prototype.unpinSuggestion = function(id){
    const action = this.itemById(id);
    if (action) this.menu.removeChild(action);
    App.pinnedItems.removeItem(id);
}

Menu.Context.prototype.itemById = function(id){
    return Elem.findChild(this.menu, Elem.hasDatasetIdThis, id)
}
