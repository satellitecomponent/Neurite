Blob.forJson = function(json){
    return new Blob([json], {type: 'application/json'})
}

class GraphsKeeper {
    #blobData = new Stored('blobs', 'blob-data');
    #blobMeta = new Stored('graphs', 'blob-meta');
    #data = new Stored('graphs', 'graph-data');
    #meta = new Stored('graphs', 'graph-meta');

    blobForBlobId(blobId){ return this.#blobData.load(blobId) }
    blobMetaForGraphId(graphId){ return this.#blobMeta.load(graphId) }
    dataForMeta(meta){ return this.#data.load(meta.graphId) }

    deleteBlob(blobId){ return this.#blobData.delete(blobId) }
    deleteBlobMeta(graphId){ return this.#blobMeta.delete(graphId) }
    #deleteBlobs = (dictMeta)=>{
        for (const blobId in dictMeta) this.deleteBlob(blobId)
    }
    deleteForMeta(meta){
        const graphId = meta.graphId;
        this.#blobMeta.load(graphId).then(this.#deleteBlobs);
        this.#blobMeta.delete(graphId);
        this.#data.delete(graphId);
        return this.#meta.delete(graphId);
    }
    drop(){
        Stored.drop('blobs');
        return Stored.drop('graphs');
    }

    forEachBlobMetaAndGraphId(cb){ return this.#blobMeta.table.iterate(cb) }
    forEachMetaAndGraphId(cb){ return this.#meta.table.iterate(cb) }

    saveBlobData(blobId, blob){ return this.#blobData.save(blobId, blob) }
    saveBlobMeta(graphId, dictMeta){
        return this.#blobMeta.save(graphId, dictMeta)
    }
    saveMetaAndData(meta, data){
        meta.lastUpdated = new Date().toLocaleString();
        meta.revisions += 1;
        meta.size = new Blob([data]).size;
        this.#data.save(meta.graphId, data);
        return this.saveMeta(meta);
    }
    saveMeta(meta){ return this.#meta.save(meta.graphId, meta) }
}

class GraphExporter {
    #out = {
        data: '',
        blobMeta: {},
        offsets: {}
    };
    constructor(meta, stored){
        this.meta = meta;
        this.stored = stored;
    }
    export(){
        return this.#gatherData()
            .then(this.#gatherBlobMeta)
            .then(this.#gatherBlobs)
            .then(this.#gatherOutput)
    }
    #gatherData = ()=>{
        return this.stored.dataForMeta(this.meta)
    }
    #gatherBlobMeta = (data)=>{
        this.#out.data = data;
        return this.stored.blobMetaForGraphId(this.meta.graphId);
    }
    #gatherBlobs = (dictMeta)=>{
        this.#out.blobMeta = dictMeta;
        const proms = [];
        for (const blobId in dictMeta) {
            proms.push(this.stored.blobForBlobId(blobId))
        }
        return Promise.all(proms);
    }
    #gatherOutput = (arrBlobs)=>{
        let i = 0;
        let o = 0;
        for (const blobId in this.#out.blobMeta) {
            this.#out.offsets[blobId] = o;
            o += arrBlobs[i].size;
            i += 1;
        }
        return new Blob([JSON.stringify(this.#out), '\x00', ...arrBlobs]);
    }
}

class GraphImporter {
    #base = 0;
    #blobMeta = {};
    #buffer = null;
    #offsets = {};

    data = '';
    saveNodeItsBlob = null;
    blobForNode(node){
        const blobId = node.blob;
        const meta = this.#blobMeta[blobId];
        const options = {type: meta.type};
        const o = this.#base + this.#offsets[blobId];
        const buffer = this.#buffer.slice(o, o + meta.size);
        const blob = new Blob([buffer], options);
        this.saveNodeItsBlob(node, blob);
        this.data = this.data.replace(
            "&quot;blob&quot;:&quot;" + blobId + "&quot;",
            "&quot;BLOB&quot;:&quot;" + node.blob + "&quot;"
        );
        return blob;
    }
    get finalData(){
        return this.data.replaceAll(
            "&quot;BLOB&quot;:&quot;", "&quot;blob&quot;:&quot;"
        )
    }

    import(file){
        return file.arrayBuffer()
            .then(this.#handleBuffer)
            .then(this.#handleJson)
    }
    #handleBuffer = (buffer)=>{
        this.#buffer = buffer;
        let i = 0;

        const dv = new DataView(buffer);
        const len = dv.byteLength;
        while (i < len && dv.getInt8(i += 1));

        this.#base = i + 1;
        return Blob.forJson(buffer.slice(0, i)).text();
    }
    #handleJson = (json)=>{
        let input = '';
        try {
            input = JSON.parse(json)
        } catch(err) {
            return Promise.resolve()
        }

        this.#blobMeta = input.blobMeta;
        this.data = input.data;
        this.#offsets = input.offsets;
    }
}

View.Graphs = class {
    #btnClear = Elem.byId('clear-button');
    #btnClearSure = Elem.byId('clear-sure-button');
    #btnClearUnsure = Elem.byId('clear-unsure-button');
    #chkboxAutosave = Elem.byId('autosave-enabled');
    #divClearSure = Elem.byId('clear-sure');
    #dropArea = Elem.byId('saved-networks-container');

    #blobs = {};
    #graphs = [];
    #maxBlobId = 0;
    #maxGraphId = 0;
    #saver = new View.Graphs.Saver(this);
    #selectedGraph = null;
    #state = new Stored('state', 'GraphsView');
    #stored = new GraphsKeeper();

    #setSelectedGraph(meta){
        this.#selectedGraph = meta;
        this.#state.save('latest-selected', meta?.graphId);
        return this;
    }

    #downloadTitledBlob(title, blob){
        const tempAnchor = Html.make.a(URL.createObjectURL(blob));
        tempAnchor.download = title + '.txt';
        tempAnchor.click();
        Promise.delay(1).then(URL.revokeObjectURL.bind(URL, tempAnchor.href));
    }

    #updateGraphs = ()=>{
        this.#blobs = {};
        this.#graphs = [];
        if (this.#selectedGraph) this.#selectedGraph.title = ''; // for autosave
        this.#dropArea.innerHTML = '';
        return this.#stored.forEachMetaAndGraphId(this.#appendMeta);
    }
    #appendMeta = (meta, graphId)=>{
        this.#graphs.push(meta);
        const isSelected = (graphId === this.#selectedGraph?.graphId);
        if (isSelected) this.#selectedGraph = meta;
        const viewMeta = new View.Graphs.MetaView(this, meta, isSelected);
        this.#dropArea.appendChild(viewMeta.div);
        viewMeta.updateForBlob();
    }

    #makeMetaForBlobOfTitle(blob, title){
        return {
            added: new Date().toLocaleString(),
            blobId: String(this.#maxBlobId += 1) + '.blob',
            size: blob.size,
            title,
            type: blob.type
        }
    }
    #makeMetaForTitle(title){
        const strDate = new Date().toLocaleString();
        return {
            added: strDate,
            graphId: String(this.#maxGraphId += 1) + '.graph',
            lastUpdated: strDate,
            revisions: 0,
            size: 0,
            title
        };
    }

    #metaByGraphId(graphId){
        return this.#graphs.find(this.#hasGraphIdThis, graphId || '')
    }
    #hasGraphIdThis(obj){ return obj.graphId === this.valueOf() }

    static MetaView = class {
        constructor(mom, meta, isSelected){
            this.meta = meta;
            this.mom = mom;
            this.div = this.#makeDiv(meta, isSelected);
        }

        #makeDiv(meta, isSelected){
            const inputTitle = this.#makeTitleInput(meta.title);
            const btnSave = this.#makeLinkButton("Save");
            const btnLoad = this.#makeLinkButton("Load");
            const btnDownload = this.#makeLinkButton("↓");
            const btnDelete = this.#makeLinkButton("X");

            On.change(inputTitle, this.#onTitleInputChanged);
            On.click(btnSave, this.#onBtnSaveClicked);
            On.click(btnLoad, this.#onBtnLoadClicked);
            On.click(btnDownload, this.#onBtnDownloadClicked);
            On.click(btnDelete, this.#onBtnDeleteClicked);

            const div = Html.new.div();
            if (isSelected) div.classList.add("selected-save");
            div.append(inputTitle, btnSave, btnLoad, btnDownload, btnDelete);
            div.title = "added on: " + meta.added + "\n"
                    + "revisions: " + meta.revisions + "\n"
                    + "last: " + meta.lastUpdated + "\n"
                    + "└ size: " + meta.size + " bytes";
            return div;
        }
        #makeLinkButton(text){
            return Html.make.button('linkbuttons', text)
        }
        #makeTitleInput(title){
            const input = Html.new.input();
            input.style.border = 'none';
            input.style.width = '100px';
            input.type = "text";
            input.value = title;
            return input;
        }

        #onTitleInputChanged = (e)=>{
            this.meta.title = e.target.value;
            this.mom.#stored.saveMeta(this.meta);
        }
        #onBtnSaveClicked = (e)=>{
            const title = this.meta.title;
            const selected = this.mom.#selectedGraph;
            if (this.meta === selected) {
                return this.mom.#saver.saveWithTitle(title)
            }

            const msg = "This will overwrite " + title
                    + " with the currently selected save, " + selected.title
                    + ". Continue?"
            window.confirm(msg).then(this.#handleConfirmOverwrite);
        }
        #handleConfirmOverwrite = (confirmed)=>{
            if (confirmed) this.mom.#saver.saveWithTitle(this.meta.title)
        }

        #onBtnLoadClicked = (e)=>{
            if (this.meta.size > 0) return this.#proceedWithLoad();

            const msg = "Are you sure you want an empty save?";
            window.confirm(msg).then(this.#handleConfirmEmptySave);
        }
        #handleConfirmEmptySave = (confirmed)=>{
            if (confirmed) this.#proceedWithLoad()
        }
        #proceedWithLoad(){
            this.mom.#autosave();
            this.mom.#stored.dataForMeta(this.meta).then(this.#loadData);
        }
        #loadData = (data)=>{
            this.mom.#setSelectedGraph(this.meta)
                .#loadGraph(data)
                .#updateGraphs()
        }

        #onBtnDeleteClicked = (e)=>{
            const meta = this.meta;
            const mom = this.mom;
            const graphIndex = mom.#graphs.findIndex(Object.isThis, meta);
            mom.#graphs.splice(graphIndex, 1);
            const isSelected = (meta === mom.#selectedGraph);
            if (isSelected) mom.#state.delete('latest-selected');
            mom.#stored.deleteForMeta(meta).then(mom.#updateGraphs);
        }

        #onBtnDownloadClicked = (e)=>{
            (new GraphExporter(this.meta, this.mom.#stored)).export()
                .then(this.#downloadBlob)
        }
        #downloadBlob = (blob)=>{
            this.mom.#downloadTitledBlob(this.meta.title, blob)
        }

        updateForBlob(){
            this.mom.#stored.blobMetaForGraphId(this.meta.graphId)
                .then(this.#handleBlobMeta)
        }
        #handleBlobMeta = (dictMeta)=>{
            if (!dictMeta) return;

            this.mom.#blobs[this.meta.graphId] = dictMeta;
            let counter = 0
            let size = 0;
            for (const blobId in dictMeta) {
                counter += 1;
                size += dictMeta[blobId].size;
            }
            this.div.title += "\nassets: " + counter + "\n"
                            + "└ size: " + size + " bytes";
        }
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

        On.drop(dropArea, this.#onSavedGraphsDrop);
    }
    #highlight(e){ e.currentTarget.classList.add('highlight') }
    #unhighlight(e){ e.currentTarget.classList.remove('highlight') }

    #onSavedGraphsDrop = (e)=>{
        const file = e.dataTransfer.files[0];
        if (!file) return Logger.info("Missing file");

        this.#saveSelected().then(this.#import.bind(this, file));
    }
    #saveSelected = ()=>{
        const title = this.#selectedGraph?.title;
        return (title ? this.#saver.saveWithTitle(title) : Promise.resolve());
    }
    #import(file){
        const importer = new GraphImporter();
        const afterImport = this.#afterImport.bind(this, importer, file);
        importer.import(file).then(afterImport);
    }
    #afterImport(importer, file){
        const name = file.name;
        const index = name.lastIndexOf('.');
        const title = (index > -1 ? name.slice(0, index) : name);

        if (!importer.data) {
            const reader = new FileReader();
            On.load(reader, this.#onFileLoaded.bind(this, title));
            return reader.readAsText(file);
        }

        this.#loadAndSave(importer, title).then(this.#updateGraphs);
    }
    #loadAndSave(importer, title){
        const meta = this.#makeMetaForTitle(title);
        this.#graphs.push(meta);

        const blobSaver = new View.Graphs.BlobSaver(this, meta.graphId);
        importer.saveNodeItsBlob = blobSaver.saveNodeItsBlob.bind(blobSaver);

        this.#setSelectedGraph(meta).#loadGraph(importer.data, importer);
        return this.#stored.saveMetaAndData(meta, importer.finalData);
    }
    async #onFileLoaded(title, e) {
        const content = e.target.result;

        try {
            this.#saver.addSave('dropped', title, content)
                .then(this.#updateGraphs)
        } catch (err) {
            const loadAnyway = await window.confirm(
                "The file is too large to store. Would you like to load it anyway?"
            );
            if (!loadAnyway) return;
            this.#setSelectedGraph(null).#loadGraph(content);
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

    #onBtnClearSureClicked = (e)=>{
        window.confirm("Create a new save?")
            .then(this.#handleConfirmNewSave)
            .then(this.#afterNewSave)
    }
    #handleConfirmNewSave = (createNewSave)=>{
        this.#setSelectedGraph(null).#clearGraph();
        App.zetPanes.addPane();
        if (createNewSave) return this.#saver.save();
    }
    #afterNewSave = ()=>{
        this.#updateGraphs();
        Elem.hide(this.#divClearSure);
        this.#btnClear.text = "Clear";
    }

    #onBtnResetSettingsClicked(e){
        settings.clear();
        settings.init();
        App.tabEdit.init();
    }
    #onBtnClearLocalClicked = (e)=>{
        localStorage.clear();
        Stored.drop('Neurite');
        Stored.drop('state');
        this.#stored.drop()
            .then(this.#updateGraphs)
            .then(alert.bind(null, "Local storage has been cleared."));
    }

    static CoreSaver = class {
        #type = '';
        constructor(mom, title, dataMaker){
            this.makeData = dataMaker;
            this.mom = mom;
            this.title = title;
        }

        handleConfirmation(force = false){
            const len = this.mom.#graphs
                        .filter(Object.hasTitleThis, this.title).length;
            return (len < 1) ? this.addSaveAndSelectIt("new")
                 : (force) ? this.#handleForce(force)
                 : window.confirm(this.#getMsgConfirmForce(len))
                    .then(this.#handleForce);
        }
        #handleForce = (force)=>{
            return (force) ? this.#overwrite()
                 : this.addSaveAndSelectIt("duplicate")
        }

        #overwrite(){
            return this.mom.#graphs
                .reduce(this.#overwriteGraphByProm, Promise.resolve())
                .then(this.#afterOverwrite)
        }
        #overwriteGraphByProm = (prom, meta)=>{
            if (meta.title !== this.title) return prom;

            Logger.debug("Overwrite graph", meta.graphId);
            return this.#makeAndStoreDataForMeta(meta);
        }
        #afterOverwrite = ()=>{ Logger.info(this.#msgOverwrite, this.title) }
        #msgOverwrite = "Updated all saves of title:";

        #makeAndStoreDataForMeta(meta){
            const stored = this.mom.#stored;
            return this.makeData(meta)
                .then(stored.saveMetaAndData.bind(stored, meta));
        }

        addSaveAndSelectIt(type){ return this.addSave(type, 'select') }
        addSave(type, option){
            this.#type = type;
            const meta = this.mom.#makeMetaForTitle(this.title);
            if (option === 'select') this.mom.#setSelectedGraph(meta);
            return this.#makeAndStoreDataForMeta(meta)
                .then(this.#afterAddSave, this.#onSaveError);
        }
        #afterAddSave = ()=>{
            Logger.info("Added", this.#type, "save:", this.title)
        }
        #onSaveError = (err)=>{
            Logger.err("Failed to save in local storage:", err);
            return window.confirm(this.#msgFull)
                .then(this.#handleConfirmDownload);
        }
        #msgFull = "Local storage is full. Download the data as a .txt file?";
        #handleConfirmDownload = (shouldDownload)=>{
            return shouldDownload && this.makeData().then(this.#downloadData)
        }
        #downloadData = (data)=>{
            const blob = new Blob([data], { type: 'text/plain' });
            this.mom.#downloadTitledBlob(this.title, blob);
        }

        #getMsgConfirmForce(len){
            return (len > 1 ? len : 'A')
                + " save" + (len > 1 ? 's' : '')
                + ' of title "' + this.title + '"'
                + " already exist" + (len > 1 ? '' : 's')
                + ". Click 'Yes' to overwrite" + (len > 1 ? " all" : '')
                + ", or 'No' to create a duplicate."
        }
    }

    static Saver = class {
        constructor(mom){ this.mom = mom }
        addSave(type, title, content, option){
            const dataMaker = ()=>Promise.resolve(content) ;
            return (new View.Graphs.CoreSaver(this.mom, title, dataMaker))
                .addSave(type, option);
        }

        #replaceNewLinesInLLMSaveData(nodeData){
            const div = Html.new.div();
            div.innerHTML = nodeData;
            div.querySelectorAll('[data-node_json]')
                .forEach(this.#handleNodeWithJson, this);
            return div.innerHTML;
        }
        #handleNodeWithJson(node){
            try {
                if (!JSON.parse(node.dataset.node_json).isLLM) return
            } catch (err) {
                Logger.warn("Error parsing node JSON:", err);
                return;
            }
            node.querySelectorAll('pre').forEach(this.#handlePre);
        }
        #handlePre(pre){
            pre.innerHTML = pre.innerHTML.replace(/\n/g, App.NEWLINE_PLACEHOLDER)
        }

        #collectAdditionalSaveObjects(){
            const inputValues = App.tabEdit.getDictValues();
            const locations = App.viewLocations.model.get('');
            const coords = Graph.getCoords();
            const obj = { inputValues, locations, coords } ;
            const str = encodeURIComponent(JSON.stringify(obj));
            return `<div id="additional-save-objs" style="display:none">${str}</div>` ;
        }
        restoreAdditionalSaveObjects(d){
            const elem = d.querySelector("#additional-save-objs");
            if (!elem) return this.#restoreAdditionalSaveObjectsOld(d);

            const obj = JSON.parse(decodeURIComponent(elem.innerHTML));
            App.viewLocations.setDict(obj.locations);

            const inputValues = obj.inputValues;
            App.tabEdit.forEachModel( (model)=>{
                const key = model.key;
                const val = inputValues[key] ?? Settings.default[key];
                settings.set(key, val);
            });
            App.tabEdit.init();

            Animation.goToLocation(obj.coords);

            elem.remove();
        }
        #restoreAdditionalSaveObjectsOld(d){ // DEPRECATED
            const savedViewsElement = d.querySelector("#saved-views");
            if (savedViewsElement) {
                const savedViewsContent = decodeURIComponent(savedViewsElement.innerHTML);
                const savedViews = JSON.parse(savedViewsContent);
                if (savedViews) {
                    for (const key in savedViews) {
                        savedViews[key] = savedViews[key].map( (location)=>{
                            if (!location.standardCoords) return location;

                            const title = location.title;
                            const newTitle = (title.startsWith('// ') ? title.slice(3) : title);
                            const scs = location.standardCoords;
                            return Location.byPan(newTitle, scs.zoom, scs.pan);
                        })
                    }

                    App.viewLocations.setDict(savedViews);
                }
                savedViewsElement.remove();
            }

            const sliderValuesElement = d.querySelector("#saved-input-values");
            if (sliderValuesElement) {
                const sliderValuesContent = decodeURIComponent(sliderValuesElement.innerHTML);
                const inputValues = JSON.parse(sliderValuesContent);

                App.tabEdit.forEachModel( (model)=>{
                    const key = model.key;
                    const val = inputValues[key] ?? Settings.default[key];
                    settings.set(key, val);
                });

                for (const key in inputValues) {
                    const input = Elem.byId(key);
                    if (input) {
                        input.value = inputValues[key];
                        // Trigger the input event for both sliders and color pickers
                        const cb = input.dispatchEvent.bind(input, new Event('input'));
                        Promise.delay(100).then(cb);
                    }
                }

                sliderValuesElement.remove();
            }

            App.tabEdit.init();

            const mandelbrotSaveElement = d.querySelector("#mandelbrot-coords-params");
            if (mandelbrotSaveElement) {
                const mandelbrotParams = JSON.parse(decodeURIComponent(mandelbrotSaveElement.textContent));
                const pan = mandelbrotParams.pan.split('+i');
                Animation.goToCoords(mandelbrotParams.zoom, pan[0], pan[1]); // Direct function call using parsed params
                mandelbrotSaveElement.remove();
            }

            const fractalTypeSaveElement = d.querySelector("#fractal-type");
            if (fractalTypeSaveElement) {
                const fractalSelectElement = Elem.byId('fractal-select');
                const fractalType = JSON.parse(decodeURIComponent(fractalTypeSaveElement.textContent));
                if (fractalType) {
                    settings.set('fractal', fractalType);
                    fractalSelectElement.value = fractalType;
                    Select.updateSelectedOption(fractalSelectElement);
                    Fractal.updateJuliaDisplay(fractalType);
                }
                fractalTypeSaveElement.remove();
            }
        }

        #makeSaveData = (meta)=>{
            //TEMP FIX: To-Do: Ensure processChangedNodes in zettelkasten.js does not cause other node textareas to have their values overwritten.
            window.zettelkastenProcessors.forEach(this.#handleProcessor);

            return Promise.resolve(meta.graphId)
                .then(this.#saveBlobsForGraphId)
                .then(this.#updateTheNodes)
                .then(this.#getSaveData);
        }
        #handleProcessor(processor){
            processAll = true;
            processor.processInput();
        }
        #saveBlobsForGraphId = (graphId)=>{
            return graphId
                && (new View.Graphs.BlobSaver(this.mom, graphId)).save()
        }
        #updateTheNodes = ()=>{ Graph.forEachNode(this.#updateNode) }
        #updateNode(node){
            node.updateEdgeData();
            node.updateNodeData();
        }
        #getSaveData = ()=>{
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
                const name = App.zetPanes.getPaneName('zet-pane-' + (index + 1));
                const paneSaveElement = `<div id="zettelkasten-pane-${index}" data-pane-name="${encodeURIComponent(name)}" style="display:none;">${encodeURIComponent(content)}</div>`;
                zettelkastenPanesSaveElements.push(paneSaveElement);
            });

            return nodeData + zettelkastenPanesSaveElements.join('') + this.#collectAdditionalSaveObjects();
        }

        #handleTitle(title, isExisting){
            const mom = this.mom;
            const meta = mom.#graphs.find(Object.hasTitleThis, title);
            if (meta) mom.#setSelectedGraph(meta);

            return (new View.Graphs.CoreSaver(mom, title, this.#makeSaveData))
                .handleConfirmation(isExisting)
                .then(mom.#updateGraphs);
        }
        saveWithTitle(title){ return this.#handleTitle(title, true) }
        save(){
            return prompt("Enter a title for this save:").then( (input)=>{
                const title = (input ?? "").trim();
                if (title) return this.#handleTitle(title);
            })
        }
    }

    static BlobSaver = class {
        #prevBlobs = {};
        #proms = [];
        #dictMeta = null;
        constructor(mom, graphId){
            this.graphId = graphId;
            this.mom = mom;
        }

        save(){
            this.#prevBlobs = {...this.mom.#blobs[this.graphId]};
            Graph.forEachNode(this.#pushPromSaveBlobForNode, this);
            return Promise.all(this.#proms).then(this.#cleanStored);
        }
        #cleanStored = ()=>{
            const dictMeta = this.#dictMeta;
            if (!dictMeta) return;

            const stored = this.mom.#stored;

            const orphans = this.#prevBlobs;
            for (const blobId in orphans) {
                delete dictMeta[blobId];
                stored.deleteBlob(blobId);
                Logger.info("Deleted blob:", orphans[blobId].title);
            }

            if (Object.keys(dictMeta).length < 1) {
                stored.deleteBlobMeta(this.graphId)
            }
            return stored.saveBlobMeta(this.graphId, dictMeta);
        }
        #pushPromSaveBlobForNode(node){
            if (!node.blob) return;

            if (this.#dictMeta && this.#dictMeta[node.blob]) {
                delete this.#prevBlobs[node.blob];
                return;
            }

            this.#proms.push(this.#saveBlobForNode(node));
        }
        #saveBlobForNode(node){
            return fetch(node.view.innerContent.firstChild.src)
                .then( (res)=>res.blob() )
                .then(this.saveNodeItsBlob.bind(this, node))
                .catch(Logger.err.bind(Logger, "Failed to save blob:"))
        }

        saveNodeItsBlob(node, blob){
            const mom = this.mom;
            const meta = mom.#makeMetaForBlobOfTitle(blob, node.getTitle());

            if (!this.#dictMeta) {
                this.#dictMeta = mom.#blobs[this.graphId] ||= {}
            }
            const blobs = this.#dictMeta;
            const blobId = node.blob = meta.blobId;
            blobs[blobId] = meta;

            const stored = mom.#stored;
            stored.saveBlobMeta(this.graphId, blobs);
            return stored.saveBlobData(blobId, blob);
        }
    }

    #clearGraph(){
        Graph.clear();

        AiNode.count = 0;
        App.zetPanes.resetAllPanes();
    }

    #loadGraph(text, importer){
        this.#clearGraph();

        const div = Html.new.div();
        div.innerHTML = text.replaceAll(/src=\"blob:[^\"]*\"/g, 'src=""');

        // Check for the previous single-tab save object
        const zettelSaveElem = div.querySelector("#zettelkasten-save");
        if (zettelSaveElem) zettelSaveElem.remove();

        // Check for the new multi-pane save objects
        const zettelkastenPaneSaveElements = div.querySelectorAll("[id^='zettelkasten-pane-']");
        zettelkastenPaneSaveElements.forEach(Elem.remove);

        this.#saver.restoreAdditionalSaveObjects(div);

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
            this.#reconstructSavedNode(node, importer);
            node.sensor = new NodeSensor(node, 3);
        }

        if (zettelSaveElem) {
            const zettelContent = decodeURIComponent(zettelSaveElem.innerHTML);
            App.zetPanes.restorePane("Zettelkasten Save", zettelContent);
        }

        zettelkastenPaneSaveElements.forEach((elem) => {
            const paneContent = decodeURIComponent(elem.innerHTML);
            const paneName = decodeURIComponent(elem.dataset.paneName);
            App.zetPanes.restorePane(paneName, paneContent);
        });

        return this;
    }

    #populateDirectionalityMap(nodeElement){
        const edges = nodeElement.dataset.edges;
        if (!edges) return;

        JSON.parse(edges).forEach(Graph.setEdgeDirectionalityFromData, Graph);
    }

    #reconstructSavedNode(node, importer){
        if (node.isTextNode) TextNode.init(node);
        if (node.isLLM) AiNode.init(node, true); // restoreNewLines
        if (node.isLink) (new LinkNode).init(node);
        if (node.isFileTree) FileTreeNode.init(node);
        if (node.blob) {
            const prom = (!importer) ? this.#stored.blobForBlobId(node.blob)
                       : Promise.resolve(importer.blobForNode(node));
            prom.then(this.#applyBlobToNode.bind(this, node));
        }
    }
    #applyBlobToNode(node, blob){
        if (!blob) {
            return Logger.warn("Missing", node.blob, "in local storage.")
        }

        const img = node.view.innerContent.firstChild;
        URL.revokeObjectURL(img.src);
        img.src = URL.createObjectURL(blob);
    }

    #autosave = ()=>{
        const title = this.#selectedGraph?.title;
        if (!title || !this.#chkboxAutosave.checked) return;

        this.#saver.saveWithTitle(title);
    }

    init(){
        this.#addDragEvents();

        On.click(this.#btnClear, this.#onBtnClearClicked);
        On.click(this.#btnClearSure, this.#onBtnClearSureClicked);
        On.click(this.#btnClearUnsure, this.#onBtnClearUnsureClicked);
        On.click(Elem.byId('resetSettings'), this.#onBtnResetSettingsClicked);
        On.click(Elem.byId('clearLocalStorage'), this.#onBtnClearLocalClicked);
        On.click(Elem.byId('new-save-button'), (e)=>this.#saver.save() );

        for (const htmlnode of Graph.htmlNodes.children) {
            const node = new Node(htmlnode);
            Graph.addNode(node);
            node.init();
        }

        const stored = this.#stored;
        return stored.forEachMetaAndGraphId(this.#processMeta)
            .then(stored.forEachBlobMetaAndGraphId
                    .bind(stored, this.#processBlobMeta))
            .then(this.#loadState.bind(this));
    }
    #processMeta = (meta, graphId)=>{
        if (meta.graphId !== graphId){
            meta.graphId = graphId;
            this.#stored.saveMeta(meta);
        }
        this.#graphs.push(meta);

        const num = parseInt(graphId) || 0;
        if (num > this.#maxGraphId) this.#maxGraphId = num;
    }
    #processBlobMeta = (dictMeta, graphId)=>{
        const meta = this.#metaByGraphId(graphId);
        if (!meta) return Logger.warn("Orphan blobs", dictMeta);

        this.#blobs[graphId] = dictMeta;
        for (const blobId in dictMeta) {
            const num = parseInt(blobId) || 0;
            if (num > this.#maxBlobId) this.#maxBlobId = num;
        }
    }
    #loadState(){
        const urlParams = new URLSearchParams(window.location.search);
        const stateFromURL = urlParams.get('state');

        const classLoader = (stateFromURL) ? View.Graphs.FileStateLoader
                          : View.Graphs.LocalStorageStateLoader;
        return (new classLoader(this)).load(stateFromURL)
            .then(this.#updateGraphs);
    }

    static FileStateLoader = class {
        constructor(mom){ this.mom = mom }
        load(stateFromURL){ // in the /wiki/pages directory
            return fetch(`/wiki/pages/neurite-wikis/${stateFromURL}.txt`)
                .then(this.#extractTextFromResponse)
                .then(this.#handleResponseText)
                .catch(this.#onResponseError)
        }

        #extractTextFromResponse = (res)=>{
            if (res.ok) return res.text();

            throw new Error("Network response was not ok " + res.statusText);
        }
        #handleResponseText = (text)=>{
            this.mom.#setSelectedGraph(null).#loadGraph(text)
        }
        #onResponseError = (err)=>{
            Logger.err("Failed to load state from file:", err);
            displayErrorMessage("Failed to load the requested graph state.");
        }
    }

    static LocalStorageStateLoader = class {
        constructor(mom){ this.mom = mom }
        load(){
            const stored = this.mom.#state;
            return stored.load('latest-selected')
                .then(this.#handleLatestSelected)
                .then(stored.load.bind(stored, 'autosave-enabled'))
                .then(this.#handleAutosaveEnabled);
        }

        #handleLatestSelected = (graphId)=>{
            const mom = this.mom;
            const meta = mom.#metaByGraphId(graphId);
            if (!meta) return;

            mom.#setSelectedGraph(meta);
            mom.#stored.dataForMeta(meta).then(mom.#loadGraph.bind(mom));
        }

        #handleAutosaveEnabled = (autosaveEnabled)=>{
            const mom = this.mom;
            mom.#chkboxAutosave.checked = (autosaveEnabled === "true");
            On.change(mom.#chkboxAutosave, this.#onCheckboxToggled);
            setInterval(mom.#autosave, 8000);
        }
        #onCheckboxToggled = (e)=>{
            this.mom.#state.save('autosave-enabled', e.target.checked)
        }
    }
}
