const Menu = View.List = {};
const MenuItem = View.Item = {};

Menu.Context = class {
    menu = Elem.byId('customContextMenu');
    targetModel = null;
    constructor(){
        this.fileInput = this.makeFileInput();

        ['click', 'mousedown', 'mouseup']
        .forEach(Event.stopPropagationByNameForThis, this.menu);
        On.mousedown(document, this.onMousedown);
    }

    position(x, y){
        const menu = this.menu;

        // offset slightly from the cursor
        const offsetX = 5;
        const offsetY = -10;

        const menuWidth = menu.offsetWidth;
        if (x + menuWidth + offsetX > window.innerWidth) { // off the right side
            x -= menuWidth + offsetX;
        } else {
            x += offsetX;
        }

        const menuHeight = menu.offsetHeight;
        if (y + menuHeight + offsetY > window.innerHeight) { // off the bottom
            y -= menuHeight + offsetY;
        } else {
            y += offsetY;
        }

        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.style.display = 'block';
    }
    open(x, y, target){
        this.position(x, y);
        App.menuSuggestions.repositionIfDisplayed(x, y);
        this.menu.innerHTML = ''; // clear options
        const view = Graph.viewForElem(target);
        if (!view) return this.populateForGeneric(target);

        this.targetModel = view.model;
        this[view.funcPopulate](x, y);
    }
    option(text, onClick, closing = true){
        const handler = (!closing) ? onClick
                    : async ()=>{ await onClick(); this.hide() } ;
        return Html.make.li(text, 'dynamic-option', handler);
    }
    removeMenuItem(text){
        const item = Elem.findChild(this.menu, Elem.hasTextContentThis, text);
        if (item) this.menu.removeChild(item);
    }

    makeInputField(){
        const input = Html.make.input('dynamic-input custom-node-method-input');
        input.type = 'text';
        input.placeholder = "Enter method";
        return input;
    }
    populateForNode(x, y){
        this.inputField = this.makeInputField();
        this.menu.append(Html.make.li(this.inputField, 'input-item'));
        this.setupSuggestions(x, y);
        this.loadPinnedItems();
    }
    populateForEdge(x, y){
        const edge = this.targetModel;
        const onDirection = edge.toggleDirection.bind(edge);
        const onDelete = edge.removeInstance.bind(edge);
        this.menu.append(
            this.option("toggle direction", onDirection, false),
            this.option("delete", onDelete)
        );
    }
    populateForBackground(x, y){
        this.menu.append(
            // Option to create a Text Node (without calling draw)
            this.option("+ Note", createNodeFromWindow),
            this.option("+ Ai", createAndDrawLlmNode),
            // Option to create a Link Node or Search Google
            this.option("+ Link", returnLinkNodes),
            this.option("+ File", this.fileInput.click.bind(this.fileInput)),
            this.option("Paste", this.onPasteOption.bind(null, this.targetModel))
        )
    }
    populateForGeneric(target){ // non-SVG targets
        const onClick = Logger.info.bind(Logger, "Generic action for:");
        this.menu.append(this.option("Generic Action", onClick, false));
    }

    makeFileInput(){
        const input = Html.new.input();
        input.type = 'file';
        On.change(input, this.onFileInputChange);
        return input;
    }
    onFileInputChange(e){
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        On.load(reader, (e)=>{
            const data = e.target.result;
            const customEvent = {
                preventDefault: Function.nop,
                dataTransfer: {
                    getData: ()=>data ,
                    files: [file],
                    items: [{
                        kind: 'file',
                        getAsFile: ()=>file
                    }]
                }
            };
            dropHandlerInstance.handleDrop(customEvent);
        });
        reader.readAsText(file);
    }

    hide(){
        Elem.hide(this.menu);
        Elem.hideById('suggestions-container');
        this.targetModel = null;
    }

    onMousedown = (e)=>{
        const clickedInsideMenu = this.menu.contains(e.target);
        if (clickedInsideMenu) return;

        const suggestionsContainer = Elem.byId('suggestions-container');
        const clickedInsideSuggestions = suggestionsContainer && suggestionsContainer.contains(e.target);
        if (!clickedInsideSuggestions) this.hide();
    }
    async onPasteOption(target){
        try {
            const pastedData = await navigator.clipboard.readText();
            handlePasteData(pastedData, target);
        } catch (err) {
            Logger.err("In reading from clipboard:", err);
        }
    }

    addCopyOptionIfTextSelected(){
        if (window.getSelection().isCollapsed) return;

        this.menu.append(this.option("Copy", this.copySelectedText));
    }
    copySelectedText(){
        const selection = window.getSelection();
        if (!selection.isCollapsed) { // There is text selection
            return navigator.clipboard.writeText(selection.toString())
                .catch(Logger.err.bind(Logger, "Failed to copy text:"))
        }

        Logger.info("No text selected");
    }
}
