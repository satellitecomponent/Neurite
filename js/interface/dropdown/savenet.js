View.Graphs = class {
    #btnClear = Elem.byId('clear-button');
    #btnClearSure = Elem.byId('clear-sure-button');
    #btnClearUnsure = Elem.byId('clear-unsure-button');
    #chkboxAutosave = Elem.byId('autosave-enabled');
    #divClearSure = Elem.byId('clear-sure');
    #dropArea = Elem.byId('saved-networks-container');

    #selectedSaveIndex = -1;
    #selectedSaveTitle = null;
    #saves = [];

    #setSelectedSave(index, title){
        this.#selectedSaveIndex = index;
        this.#selectedSaveTitle = title;
        return this;
    }

    #getLocalLatestSelected(){
        const index = parseInt(localStorage.getItem('latest-selected'));
        return this.#selectedSaveIndex = (isNaN(index) ? -1 : index);
    }
    #setLocalLatestSelected(){
        localStorage.setItem('latest-selected', this.#selectedSaveIndex);
        return this;
    }

    #getLocalSaves(){
        const saves = JSON.parse(localStorage.getItem('saves'));
        return this.#saves = (Array.isArray(saves) ? saves : []);
    }
    #setLocalSaves(){
        localStorage.setItem('saves', JSON.stringify(this.#saves));
        return this;
    }

    #downloadData(title, data){
        const blob = new Blob([data], { type: 'text/plain' });
        const tempAnchor = Html.make.a(window.URL.createObjectURL(blob));
        tempAnchor.download = title + '.txt';
        tempAnchor.click();
        setTimeout( ()=>window.URL.revokeObjectURL(tempAnchor.href) , 1);
    }

    #updateSavedGraphs(){
        const dropArea = this.#dropArea;
        dropArea.innerHTML = '';
        for (const [index, save] of this.#saves.entries()) {
            dropArea.appendChild(this.#makeDivSave(index, save))
        }
    }

    #makeDivSave(index, save){
        const titleInput = this.#makeTitleInput(index, save.title);
        const btnSave = this.#makeLinkButton("Save", index);
        const btnLoad = this.#makeLinkButton("Load", index);
        const btnDownload = this.#makeLinkButton("↓", index);
        const btnDelete = this.#makeLinkButton("X", index);

        On.change(titleInput, this.#onTitleInputChanged);
        On.click(btnSave, this.#onBtnSaveClicked);
        On.click(btnLoad, this.#onBtnLoadClicked);
        On.click(btnDownload, this.#onBtnDownloadClicked);
        On.click(btnDelete, this.#onBtnDeleteClicked);

        const div = Html.new.div();
        if (index === this.#selectedSaveIndex) {
            div.classList.add("selected-save");
        }
        div.append(titleInput, btnSave, btnLoad, btnDownload, btnDelete);
        return div;
    }
    #makeLinkButton(text, index){
        const button = Html.make.button('linkbuttons', text);
        button.dataset.index = index;
        return button;
    }
    #makeTitleInput(index, title){
        const input = Html.new.input();
        input.dataset.index = index;
        input.style.border = 'none';
        input.style.width = '100px';
        input.type = "text";
        input.value = title;
        return input;
    }

    #onTitleInputChanged = (e)=>{
        this.#saves[Event.dataIndex(e)].title = e.target.value;
        this.#setLocalSaves();
    }
    #onBtnSaveClicked = (e) => {
        const index = Event.dataIndex(e);
        const title = this.#saves[index].title;

        if (index !== this.#selectedSaveIndex) {
            const msg = `This will overwrite ${title} with the currently selected save, ${this.#selectedSaveTitle}. Continue?`;

            window.confirm(msg).then(confirmed => {
                if (!confirmed) return;
                this.#save(title);
            });
        } else {
            this.#save(title);
        }
    }
    #onBtnLoadClicked = (e) => {
        const index = Event.dataIndex(e);
        const save = this.#saves[index];

        if (save.data === '') {
            window.confirm("Are you sure you want an empty save?").then(confirmed => {
                if (!confirmed) {
                    this.#updateSavedGraphs();
                    return;
                }
                this.#proceedWithLoad(index, save);
            });
        } else {
            this.#proceedWithLoad(index, save);
        }
    }

    // Helper method
    #proceedWithLoad(index, save) {
        this.#autosave();
        this.#setSelectedSave(index, save.title)
            .#setLocalLatestSelected()
            .#loadNet(save.data, true)
            .#updateSavedGraphs();
    }
    #onBtnDeleteClicked = (e)=>{
        const targetIndex = Event.dataIndex(e);
        this.#saves.splice(targetIndex, 1);

        let index = -1;
        let title = null;
        if (targetIndex === this.#selectedSaveIndex) {
            localStorage.removeItem('latest-selected');
        } else {
            const selectedTitle = this.#selectedSaveTitle;
            index = this.#saves.findIndex(Object.hasTitleThis, selectedTitle);
            if (index > -1) title = selectedTitle;
        }
        this.#setSelectedSave(index, title)
            .#setLocalSaves()
            .#updateSavedGraphs();
    }
    #onBtnDownloadClicked = (e)=>{
        const save = this.#saves[Event.dataIndex(e)];
        const blob = new Blob([save.data], { type: 'text/plain' });

        const tempAnchor = Html.make.a(URL.createObjectURL(blob));
        tempAnchor.download = save.title + '.txt';

        tempAnchor.click();
        setTimeout(URL.revokeObjectURL.bind(URL, tempAnchor.href), 1);
    }

    #addDragEvents(){
        const dropArea = this.#dropArea;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach( (eName)=>{
            On[eName](dropArea, (e)=>{
                e.preventDefault();
                e.stopPropagation();
            })
        });

        ['dragenter', 'dragover']
        .forEach( (eName)=>On[eName](dropArea, this.#highlight) );

        ['dragleave', 'drop']
        .forEach( (eName)=>On[eName](dropArea, this.#unhighlight) );

        On.drop(dropArea, this.#savedGraphsDrop);
    }
    #highlight(e){ e.currentTarget.classList.add('highlight') }
    #unhighlight(e){ e.currentTarget.classList.remove('highlight') }

    #savedGraphsDrop = (e)=>{
        const file = e.dataTransfer.files[0];
        if (!file || !file.name.endsWith('.txt')) {
            Logger.info("File must be a .txt file");
            return;
        }

        const reader = new FileReader();
        On.load(reader, this.#onFileLoaded.bind(this, file));
        reader.readAsText(file);
    }
    async #onFileLoaded(file, e) {
        const content = e.target.result;
        const title = file.name.replace('.txt', '');

        try {
            this.#saves.push({ title, data: content });
            this.#setLocalSaves().#updateSavedGraphs();
        } catch (err) {
            const loadAnyway = await window.confirm(
                "The file is too large to store. Would you like to load it anyway?"
            );
            if (!loadAnyway) return;
            this.#setSelectedSave(null, null).#loadNet(content, true);
        }
    }
    #onBtnClearClicked = (e)=>{
        this.#divClearSure.setAttribute('style', "display:block");
        this.#btnClear.text = "Are you sure?";
    }
    #onBtnClearUnsureClicked = (e)=>{
        Elem.hide(this.#divClearSure);
        this.#btnClear.text = "Clear";
    }
    #onBtnClearSureClicked = (e) => {
        window.confirm("Create a new save?").then(createNewSave => {
            this.#setSelectedSave(null, null).#clearNet();
            zetPanes.addPane();

            if (createNewSave) this.#save();

            this.#updateSavedGraphs();
            Elem.hide(this.#divClearSure);
            this.#btnClear.text = "Clear";
        });
    }
    #onBtnClearLocalClicked(e){
        localStorage.clear();
        alert("Local storage has been cleared.");
    }

    async #handleSaveConfirmation(title, saveData, force = false) {
        const existingSaves = this.#saves.filter(save => save.title === title);
        const len = existingSaves.length;

        if (len > 0) {
            if (!force) {
                // Use custom async confirm dialog
                force = await window.confirm(this.#getConfirmMessage(title, len));
            }

            if (force) {
                // Overwrite logic
                this.#saves.forEach(save => {
                    if (save.title === title) save.data = saveData;
                });
                Logger.info("Updated all saves of title:", title);
            } else {
                // Create duplicate save
                this.#saves.push({ title, data: saveData });
                Logger.info("Created duplicate save:", title);
            }
        } else {
            // Add new save
            this.#saves.push({ title, data: saveData });
            Logger.info("Created new save:", title);
        }

        try {
            this.#setLocalSaves().#updateSavedGraphs();
        } catch (e) {
            // Use custom async confirm dialog
            const shouldDownload = await window.confirm(
                "Local storage is full. Download the data as a .txt file?"
            );
            if (shouldDownload) {
                this.#downloadData(title, JSON.stringify({ data: saveData }));
            }
        }
    }
    #getConfirmMessage(title, len){
        return (len > 1 ? len : 'A') + " save" + (len > 1 ? 's' : '') +
            ' of title "' + title + '" already exist' + (len > 1 ? '' : 's') +
            ". Click 'OK' to overwrite" + (len > 1 ? " all" : '') +
            ", or 'Cancel' to create a duplicate."
    }

    #replaceNewLinesInLLMSaveData(nodeData){
        const tempDiv = Html.new.div();
        tempDiv.innerHTML = nodeData;

        tempDiv.querySelectorAll('[data-node_json]').forEach(node => {
            try {
                const nodeJson = JSON.parse(node.getAttribute('data-node_json'));
                if (nodeJson.isLLM) {
                    node.querySelectorAll('pre').forEach(pre => {
                        pre.innerHTML = pre.innerHTML.replace(/\n/g, App.NEWLINE_PLACEHOLDER);
                    });
                }
            } catch (err) {
                Logger.warn("Error parsing node JSON:", err);
            }
        });

        return tempDiv.innerHTML;
    }

    #collectAdditionalSaveObjects(){
        // Collecting slider values
        const inputValues = localStorage.getItem('inputValues') || '{}';
        const savedInputValues = `<div id="saved-input-values" style="display:none;">${encodeURIComponent(inputValues)}</div>`;

        // Collecting saved views
        const savedViewsString = JSON.stringify(savedViews);
        const savedViewsElement = `<div id="saved-views" style="display:none;">${encodeURIComponent(savedViewsString)}</div>`;

        // Get current Mandelbrot coords in a standard format
        const mandelbrotParams = neuriteGetMandelbrotCoords();
        const mandelbrotSaveElement = `<div id="mandelbrot-coords-params" style="display:none;">${encodeURIComponent(JSON.stringify(mandelbrotParams))}</div>`;

        // Get the selected fractal type from localStorage
        const selectedFractalType = localStorage.getItem('fractal-select');
        const fractalTypeSaveElement = `<div id="fractal-type" style="display:none;">${encodeURIComponent(JSON.stringify(selectedFractalType))}</div>`;

        // Combine both slider values and saved views in one string
        return savedInputValues + savedViewsElement + mandelbrotSaveElement + fractalTypeSaveElement;
    }
    #restoreAdditionalSaveObjects(d){
        const savedViewsElement = d.querySelector("#saved-views");
        if (savedViewsElement) {
            let savedViewsContent = decodeURIComponent(savedViewsElement.innerHTML);
            savedViews = JSON.parse(savedViewsContent);
            if (savedViews) {
                updateSavedViewsCache();
                displaySavedCoordinates();
            }
            savedViewsElement.remove();
        }

        const sliderValuesElement = d.querySelector("#saved-input-values");
        if (sliderValuesElement) {
            const sliderValuesContent = decodeURIComponent(sliderValuesElement.innerHTML);
            localStorage.setItem('inputValues', sliderValuesContent);
            sliderValuesElement.remove();
        }

        restoreInputValues();

        const mandelbrotSaveElement = d.querySelector("#mandelbrot-coords-params");
        if (mandelbrotSaveElement) {
            const mandelbrotParams = JSON.parse(decodeURIComponent(mandelbrotSaveElement.textContent));
            neuriteSetMandelbrotCoords(mandelbrotParams.zoom, mandelbrotParams.pan.split('+i')[0], mandelbrotParams.pan.split('+i')[1]); // Direct function call using parsed params
            mandelbrotSaveElement.remove();
        }

        const fractalTypeSaveElement = d.querySelector("#fractal-type");
        if (fractalTypeSaveElement) {
            const fractalSelectElement = Elem.byId('fractal-select');
            const fractalType = JSON.parse(decodeURIComponent(fractalTypeSaveElement.textContent));
            if (fractalType) {
                fractalSelectElement.value = fractalType;
                Select.updateSelectedOption(fractalSelectElement);
                updateJuliaDisplay(fractalType);
            }
            fractalTypeSaveElement.remove();
        }
    }

    #save(existingTitle){
        //TEMP FIX: To-Do: Ensure processChangedNodes in zettelkasten.js does not cause other node textareas to have their values overwritten.
        window.zettelkastenProcessors.forEach( (processor)=>{
            processAll = true;
            processor.processInput();
        });

        Graph.forEachNode( (node)=>{
            node.updateEdgeData();
            node.updateNodeData();
        });

        // Clone the currently selected UUIDs before clearing
        const selectedNodes = App.selectedNodes;
        const selectedNodesUuids = new Set(selectedNodes.uuids);
        selectedNodes.clear();

        // Save the node data
        let nodeData = Elem.byId('nodes').innerHTML;

        selectedNodesUuids.forEach(selectedNodes.restoreNodeById, selectedNodes);

        nodeData = this.#replaceNewLinesInLLMSaveData(nodeData);

        const zettelkastenPanesSaveElements = [];
        window.codeMirrorInstances.forEach( (instance, index)=>{
            const content = instance.getValue();
            const name = zetPanes.getPaneName('zet-pane-' + (index + 1));
            const paneSaveElement = `<div id="zettelkasten-pane-${index}" data-pane-name="${encodeURIComponent(name)}" style="display:none;">${encodeURIComponent(content)}</div>`;
            zettelkastenPanesSaveElements.push(paneSaveElement);
        });

        const saveData = nodeData + zettelkastenPanesSaveElements.join('') + this.#collectAdditionalSaveObjects();

        const handleSave = (title) => {
            if (!title) return;  // Exit if no title
            const saves = this.#saves;
            const indexToUpdate = saves.findIndex(Object.hasTitleThis, title);
            const index = (indexToUpdate > -1 ? indexToUpdate : saves.length);
            this.#setSelectedSave(index, title);
            this.#handleSaveConfirmation(title, saveData, title === existingTitle);
            this.#setLocalLatestSelected();
        };

        if (existingTitle) {
            handleSave(existingTitle);  // Sync path
        } else {
            // Async prompt handling without making #save async
            prompt("Enter a title for this save:").then((result) => {
                const title = (result ?? "").trim();
                if (!title) return;
                handleSave(title);
            }).catch(console.error);
        }
    }

    #clearNet(){
        Graph.clear();

        AiNode.count = 0;
        zetPanes.resetAllPanes();
    }
    #loadNet(text, clobber){
        if (clobber) this.#clearNet();

        const div = Html.new.div();
        div.innerHTML = text;

        // Check for the previous single-tab save object
        const zettelSaveElem = div.querySelector("#zettelkasten-save");
        if (zettelSaveElem) zettelSaveElem.remove();

        // Check for the new multi-pane save objects
        const zettelkastenPaneSaveElements = div.querySelectorAll("[id^='zettelkasten-pane-']");
        zettelkastenPaneSaveElements.forEach(Elem.remove);

        this.#restoreAdditionalSaveObjects(div);

        const newNodes = [];
        for (const child of div.children) {
            const node = new Node(child);
            newNodes.push(node);
            Graph.addNode(node);
        }

        Elem.forEachChild(div, this.#populateDirectionalityMap, this);

        for (const node of newNodes) {
            Graph.appendNode(node);
            node.init();
            this.#reconstructSavedNode(node);
            node.sensor = new NodeSensor(node, 3);
        }

        if (zettelSaveElem) {
            const zettelContent = decodeURIComponent(zettelSaveElem.innerHTML);
            zetPanes.restorePane("Zettelkasten Save", zettelContent);
        }

        zettelkastenPaneSaveElements.forEach((elem) => {
            const paneContent = decodeURIComponent(elem.innerHTML);
            const paneName = decodeURIComponent(elem.getAttribute('data-pane-name'));
            zetPanes.restorePane(paneName, paneContent);
        });

        return this;
    }

    #populateDirectionalityMap(nodeElement){
        const edges = nodeElement.getAttribute('data-edges');
        if (!edges) return;

        JSON.parse(edges).forEach(Graph.setEdgeDirectionalityFromData, Graph);
    }

    #reconstructSavedNode(node){
        if (node.isTextNode) TextNode.init(node);
        if (node.isLLM) AiNode.init(node, true); // restoreNewLines
        if (node.isLink) (new LinkNode).init(node);
        if (node.isFileTree) FileTreeNode.init(node);
    }

    #autosave = ()=>{
        if (!this.#selectedSaveTitle || !this.#chkboxAutosave.checked) return;

        this.#save(this.#selectedSaveTitle);
    }

    init(){
        this.#addDragEvents();

        On.click(this.#btnClear, this.#onBtnClearClicked);
        On.click(this.#btnClearSure, this.#onBtnClearSureClicked);
        On.click(this.#btnClearUnsure, this.#onBtnClearUnsureClicked);
        On.click(Elem.byId('clearLocalStorage'), this.#onBtnClearLocalClicked);
        On.click(Elem.byId('new-save-button'), (e)=>this.#save() );

        for (const htmlnode of Graph.htmlNodes.children) {
            const node = new Node(htmlnode);
            Graph.addNode(node);
            node.init();
        }

        this.#saves = this.#getLocalSaves();

        const urlParams = new URLSearchParams(window.location.search);
        const stateFromURL = urlParams.get('state');

        if (stateFromURL) this.#loadStateFromFile(stateFromURL);
        else this.#loadStateFromLocalStorage();
        this.#updateSavedGraphs();
    }

    #loadStateFromFile(stateFromURL){ // in the /wiki/pages directory
        fetch(`/wiki/pages/neurite-wikis/${stateFromURL}.txt`)
        .then(this.#onResponseFetched)
        .then(this.#onResponseText)
        .catch(this.#onResponseError)
    }
    #onResponseFetched = (res)=>{
        if (res.ok) return res.text();

        throw new Error("Network response was not ok " + res.statusText);
    }
    #onResponseText = (text)=>{
        this.#loadNet(text, true).#setSelectedSave(null, null)
    }
    #onResponseError = (err)=>{
        Logger.err("Failed to load state from file:", err);
        displayErrorMessage("Failed to load the requested graph state.");
    }

    #loadStateFromLocalStorage(){
        const selectedSaveIndex = this.#getLocalLatestSelected();
        if (selectedSaveIndex > -1) {
            const save = this.#saves[selectedSaveIndex];
            this.#setSelectedSave((save ? selectedSaveIndex : -1),
                                  save?.title ?? null);
            if (save) this.#loadNet(save.data, true);
        }

        const autosaveEnabled = localStorage.getItem("autosave-enabled");
        this.#chkboxAutosave.checked = (autosaveEnabled === "true");

        On.change(this.#chkboxAutosave, this.#onCheckboxToggled);

        setInterval(this.#autosave, 8000);
    }
    #onCheckboxToggled(e){
        localStorage.setItem("autosave-enabled", e.target.checked)
    }
}
