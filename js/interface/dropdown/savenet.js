const LATEST_LOADED_INDEX_KEY = "latest-selected"
On.click(Elem.byId('new-save-button'), neuriteSaveEvent);

function downloadData(title, data) {
    const blob = new Blob([data], { type: 'text/plain' });
    const tempAnchor = Html.make.a(window.URL.createObjectURL(blob));
    tempAnchor.download = title + '.txt';
    tempAnchor.click();
    setTimeout(function () {
        window.URL.revokeObjectURL(tempAnchor.href);
    }, 1);
}

let selectedSaveTitle = null;
let selectedSaveIndex = null;

function updateSavedNetworks() {
    const saves = JSON.parse(localStorage.getItem("saves") || "[]");
    const container = Elem.byId('saved-networks-container');
    container.innerHTML = '';

    for (let [index, save] of saves.entries()) {
        const div = Html.new.div();

        if (index === selectedSaveIndex) {
            div.classList.add("selected-save");
        }

        const titleInput = Html.new.input();
        titleInput.type = "text";
        titleInput.value = save.title;
        titleInput.style.border = 'none';
        titleInput.style.width = '100px';
        On.change(titleInput, (e)=>{
            save.title = titleInput.value;
            localStorage.setItem("saves", JSON.stringify(saves));
        });

        const data = Html.new.span();
        data.textContent = save.data;
        data.style.display = 'none';

        const saveButton = Html.make.button('linkbuttons', "Save");
        On.click(saveButton, (e)=>{
            if (index !== selectedSaveIndex && !window.confirm(`This will overwrite ${save.title} with the currently selected save, ${selectedSaveTitle} Continue?`)) {
                return;
            }

            neuriteSaveEvent(existingTitle = save.title)
        });

        const loadButton = Html.make.button('linkbuttons', "Load");
        On.click(loadButton, (e)=>{
            function updateLoadState() {
                autosave()

                selectedSaveTitle = save.title;
                selectedSaveIndex = index;
                localStorage.setItem(LATEST_LOADED_INDEX_KEY, selectedSaveIndex);
            }

            if (data.textContent === '') {
                var isSure = window.confirm("Are you sure you want an empty save?");
                if (isSure) {
                    updateLoadState();
                    loadNet(data.textContent, true);
                }
            } else {
                updateLoadState();
                loadNet(data.textContent, true);
            }

            updateSavedNetworks();
        });

        const deleteButton = Html.make.button('linkbuttons', "X");
        On.click(deleteButton, (e)=>{
            // Remove the save from the array
            saves.splice(index, 1);

            if (selectedSaveIndex === index) {
                localStorage.removeItem(LATEST_LOADED_INDEX_KEY);
                selectedSaveIndex = null;
                selectedSaveTitle = null;
            } else {
                selectedSaveIndex = saves.findIndex(save => save.title === selectedSaveTitle) ?? null;
                if (selectedSaveIndex === null) selectedSaveTitle = null
            }

            localStorage.setItem("saves", JSON.stringify(saves));
            updateSavedNetworks();
        });

        const downloadButton = Html.make.button('linkbuttons', "↓");
        On.click(downloadButton, (e)=>{
            const blob = new Blob([save.data], { type: 'text/plain' });

            const tempAnchor = Html.make.a(URL.createObjectURL(blob));
            tempAnchor.download = save.title + '.txt';

            tempAnchor.click();
            setTimeout(URL.revokeObjectURL.bind(URL, tempAnchor.href), 1);
        });

        div.append(titleInput,
                   data,
                   saveButton,
                   loadButton,
                   downloadButton,
                   deleteButton);
        container.appendChild(div);
    }
}

let container = Elem.byId('saved-networks-container');

// Prevent default drag behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach( (eName)=>{
    On[eName](container, (e)=>{
        e.preventDefault();
        e.stopPropagation();
    })
});

// Highlight the drop area when item is dragged over it
['dragenter', 'dragover'].forEach(
    (eName)=>On[eName](container, highlight)
);

['dragleave', 'drop'].forEach(
    (eName)=>On[eName](container, unHighlight)
);

On.drop(container, handleSavedNetworksDrop);

function highlight() {
    container.classList.add('highlight');
}

function unHighlight() {
    container.classList.remove('highlight');
}

function handleSavedNetworksDrop(e) {
    const file = e.dataTransfer.files[0];
    if (!file || !file.name.endsWith('.txt')) {
        Logger.info("File must be a .txt file");
        return;
    }

    const reader = new FileReader();
    On.load(reader, (e)=>{
        const content = e.target.result;
        const title = file.name.replace('.txt', '');

        try {
            // Try saving the data to localStorage
            const saves = JSON.parse(localStorage.getItem("saves") || "[]");
            saves.push({ title, data: content });
            localStorage.setItem("saves", JSON.stringify(saves));
            updateSavedNetworks();
        } catch (err) {
            // Before loading, confirm with the user due to size limitations
            const isSure = window.confirm("The file is too large to store. Would you like to load it anyway?");
            if (isSure) {
                // Proceed with loading if the user confirms
                selectedSaveTitle = null;
                selectedSaveIndex = null;
                loadNet(content, true);
            }
        }
    });
    reader.readAsText(file);
}

On.click(Elem.byId('clear-button'), (e)=>{
    Elem.byId('clear-sure').setAttribute('style', "display:block");
    Elem.byId('clear-button').text = "Are you sure?";
});
On.click(Elem.byId('clear-unsure-button'), (e)=>{
    Elem.byId('clear-sure').setAttribute('style', "display:none");
    Elem.byId('clear-button').text = "Clear";
});
On.click(Elem.byId('clear-sure-button'), (e)=>{
    const createNewSave = confirm("Create a new save?");

    selectedSaveTitle = null;
    selectedSaveIndex = null;

    clearNet();
    zetPanes.addPane();

    if (createNewSave) neuriteSaveEvent();

    updateSavedNetworks();
    Elem.byId('clear-sure').setAttribute('style', "display:none");
    Elem.byId('clear-button').text = "Clear";
});

On.click(Elem.byId('clearLocalStorage'), (e)=>{
    localStorage.clear();
    alert("Local storage has been cleared.");
})

function handleSaveConfirmation(title, saveData, force = false) {
    let saves = JSON.parse(localStorage.getItem("saves") || "[]");
    const existingSaves = saves.filter(save => save.title === title);

    if (existingSaves.length > 0) {
        const confirmMessage = existingSaves.length === 1 ?
            `A save with the title "${title}" already exists. Click 'OK' to overwrite, or 'Cancel' to create a duplicate.` :
            `${existingSaves.length} saves with the title "${title}" already exist. Click 'OK' to overwrite all, or 'Cancel' to create a duplicate.`;

        if (force || confirm(confirmMessage)) {
            // Overwrite logic - update all saves with the matching title
            saves = saves.map(save => save.title === title ? { ...save, data: saveData } : save);
            Logger.info("Updated all saves with title:", title);
        } else {
            // Duplicate logic
            let newTitle = title;
            saves.push({ title: newTitle, data: saveData });
            Logger.info("Created duplicate save:", newTitle);
            title = newTitle; // Update title to reflect new save
        }
    } else {
        // Add new save
        saves.push({ title: title, data: saveData });
        Logger.info("Created new save:", title);
    }

    try {
        localStorage.setItem("saves", JSON.stringify(saves));
        updateSavedNetworks();
    } catch (e) {
        if (confirm("Local storage is full, download the data as a .txt file?")) {
            downloadData(title, JSON.stringify({ data: saveData }));
        }
    }
}

const NEWLINE_PLACEHOLDER = "__NEWLINEplh__";

function replaceNewLinesInLLMSaveData(nodeData) {
    const tempDiv = Html.new.div();
    tempDiv.innerHTML = nodeData;

    tempDiv.querySelectorAll('[data-node_json]').forEach(node => {
        try {
            const nodeJson = JSON.parse(node.getAttribute('data-node_json'));
            if (nodeJson.isLLM) {
                node.querySelectorAll('pre').forEach(pre => {
                    pre.innerHTML = pre.innerHTML.replace(/\n/g, NEWLINE_PLACEHOLDER);
                });
            }
        } catch (err) {
            Logger.warn("Error parsing node JSON:", err);
        }
    });

    return tempDiv.innerHTML;
}

function collectAdditionalSaveObjects() {
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

function restoreAdditionalSaveObjects(d) {

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

function neuriteSaveEvent(existingTitle = null) {
    //TEMP FIX: To-Do: Ensure processChangedNodes in zettelkasten.js does not cause other node textareas to have their values overwritten.
    window.zettelkastenProcessors.forEach((processor) => {
        processAll = true;
        processor.processInput();
    });

    Graph.forEachNode( (node)=>{
        node.updateEdgeData();
        node.updateNodeData();
    });

    // Clone the currently selected UUIDs before clearing
    const savedSelectedNodeUUIDs = new Set(SelectedNodes.uuids);
    SelectedNodes.clear();

    // Save the node data
    let nodeData = Elem.byId('nodes').innerHTML;

    savedSelectedNodeUUIDs.forEach(SelectedNodes.restoreNodeById);

    nodeData = replaceNewLinesInLLMSaveData(nodeData);

    const zettelkastenPanesSaveElements = [];
    window.codeMirrorInstances.forEach((instance, index) => {
        const content = instance.getValue();
        const name = zetPanes.getPaneName('zet-pane-' + (index + 1));
        const paneSaveElement = `<div id="zettelkasten-pane-${index}" data-pane-name="${encodeURIComponent(name)}" style="display:none;">${encodeURIComponent(content)}</div>`;
        zettelkastenPanesSaveElements.push(paneSaveElement);
    });

    const saveData = nodeData + zettelkastenPanesSaveElements.join('') + collectAdditionalSaveObjects();

    const title = existingTitle || prompt("Enter a title for this save:");

    const saves = JSON.parse(localStorage.getItem("saves") || "[]");
    if (title) {
        // Before saving, check if we're updating an existing save
        const indexToUpdate = saves.findIndex(save => save.title === title);

        if (indexToUpdate !== -1) {
            // If we're updating, set this save as the selected one
            selectedSaveIndex = indexToUpdate;
        } else {
            // If it's a new save, the new save will be the last in the array
            selectedSaveIndex = saves.length;
        }

        selectedSaveTitle = title;
        handleSaveConfirmation(title, saveData, title === existingTitle);
        // Update selectedSaveIndex and selectedSaveTitle accordingly
        localStorage.setItem(LATEST_LOADED_INDEX_KEY, selectedSaveIndex);
    }
}

for (const htmlnode of Graph.htmlNodes.children) {
    const node = new Node(htmlnode);
    Graph.addNode(node);
    node.init();
}

function clearNet() {
    Graph.clear();

    AiNode.count = 0;
    zetPanes.resetAllPanes();
}

function loadNet(text, clobber) {
    if (clobber) clearNet();

    const div = Html.new.div();
    div.innerHTML = text;

    // Check for the previous single-tab save object
    const zettelSaveElem = div.querySelector("#zettelkasten-save");
    if (zettelSaveElem) zettelSaveElem.remove();

    // Check for the new multi-pane save objects
    const zettelkastenPaneSaveElements = div.querySelectorAll("[id^='zettelkasten-pane-']");
    zettelkastenPaneSaveElements.forEach(Elem.remove);

    restoreAdditionalSaveObjects(div);

    const newNodes = [];
    for (const child of div.children) {
        const node = new Node(child);
        newNodes.push(node);
        Graph.addNode(node);
    }

    Elem.forEachChild(div, populateDirectionalityMap);

    for (const node of newNodes) {
        Graph.appendNode(node);
        node.init();
        reconstructSavedNode(node);
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
}

function populateDirectionalityMap(nodeElement) {
    const edges = nodeElement.getAttribute('data-edges');
    if (edges) JSON.parse(edges).forEach(Graph.setEdgeDirectionalityFromData);
}

function reconstructSavedNode(node) {
    if (node.isTextNode) TextNode.init(node);
    if (node.isLLM) AiNode.init(node, true); // restoreNewLines
    if (node.isLink) node.typeNode.init();
    if (node.isFileTree) FileTreeNode.init(node);
}

const autosaveEnabledCheckbox = Elem.byId('autosave-enabled');

function autosave() {
    if (selectedSaveTitle !== null && autosaveEnabledCheckbox.checked) {
        neuriteSaveEvent(selectedSaveTitle);
    }
}

function initializeSaveNetworks() {
    const urlParams = new URLSearchParams(window.location.search);
    const stateFromURL = urlParams.get('state');

    if (stateFromURL) {
        // Load state from a file in the /wiki/pages directory
        fetch(`/wiki/pages/neurite-wikis/${stateFromURL}.txt`)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Network response was not ok " + response.statusText);
                }
                return response.text();
            })
            .then(data => {
                loadNet(data, true);  // Load the network directly with the fetched text data
                selectedSaveTitle = null;
                selectedSaveIndex = null;
                updateSavedNetworks();
            })
            .catch(err => {
                Logger.err("Failed to load state from file:", err);
                displayErrorMessage("Failed to load the requested network state.");
            });
    } else {
        // Load from local storage if no state provided in URL
        const value = localStorage.getItem(LATEST_LOADED_INDEX_KEY) ?? null;
        selectedSaveIndex = value !== null ? parseInt(value) : null;

        if (selectedSaveIndex !== null) {
            const saves = JSON.parse(localStorage.getItem("saves") || "[]");
            const existingSaves = saves?.[selectedSaveIndex];
            if (existingSaves) {
                selectedSaveTitle = existingSaves.title;
                updateSavedNetworks();
                loadNet(existingSaves.data, true);
            } else {
                selectedSaveTitle = null;
                selectedSaveIndex = null;
                updateSavedNetworks();
            }
        }

        // Set the autosave checkbox state based on stored value
        const autosaveEnabled = localStorage.getItem("autosave-enabled");
        autosaveEnabledCheckbox.checked = autosaveEnabled === "true"; // Ensure it loads as a boolean

        // Save state when the checkbox is toggled
        On.change(autosaveEnabledCheckbox, (e)=>{
            localStorage.setItem("autosave-enabled", e.target.checked);
        });

        setInterval(autosave, 8000);
    }
}
