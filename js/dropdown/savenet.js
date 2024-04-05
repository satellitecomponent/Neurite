
function handleSaveConfirmation(title, saveData, existingTitle) {
    let saves = JSON.parse(localStorage.getItem("saves") || "[]");
    const existingSaves = saves.filter(save => save.title === title);

    if (existingSaves.length > 0 && !existingTitle) {
        let confirmMessage = existingSaves.length === 1 ?
            `A save with the title "${title}" already exists. Click 'OK' to overwrite, or 'Cancel' to create a duplicate.` :
            `${existingSaves.length} saves with the title "${title}" already exist. Click 'OK' to overwrite all, or 'Cancel' to create a duplicate.`;

        if (confirm(confirmMessage)) {
            // Overwrite logic - update all saves with the matching title
            saves = saves.map(save => save.title === title ? { ...save, data: saveData } : save);
            console.log(`Updated all saves with title: ${title}`);
        } else {
            // Duplicate logic
            let newTitle = title;
            saves.push({ title: newTitle, data: saveData });
            console.log(`Created duplicate save: ${newTitle}`);
            title = newTitle; // Update title to reflect new save
        }
    } else {
        // Add new save
        saves.push({ title: title, data: saveData });
        console.log(`Created new save: ${title}`);
    }

    try {
        localStorage.setItem("saves", JSON.stringify(saves));
        updateSavedNetworks();
    } catch (e) {
        if (confirm("Local storage is full, download the data as a .txt file?")) {
            downloadData(title, JSON.stringify({ data: saveData, zettelkastenSave: zettelkastenContent }));
        }
    }
}

function collectAdditionalSaveObjects() {
    // Collecting slider values
    const inputValues = localStorage.getItem('inputValues') || '{}';
    const savedInputValues = `<div id="saved-input-values" style="display:none;">${encodeURIComponent(inputValues)}</div>`;

    // Collecting saved views
    const savedViewsString = JSON.stringify(savedViews);
    const savedViewsElement = `<div id="saved-views" style="display:none;">${encodeURIComponent(savedViewsString)}</div>`;

    // Combine both slider values and saved views in one string
    return savedInputValues + savedViewsElement;
}

const NEWLINE_PLACEHOLDER = "__NEWLINEplh__";

function replaceNewLinesInLLMSaveData(nodeData) {
    let tempDiv = document.createElement('div');
    tempDiv.innerHTML = nodeData;

    tempDiv.querySelectorAll('[data-node_json]').forEach(node => {
        try {
            let nodeJson = JSON.parse(node.getAttribute('data-node_json'));
            if (nodeJson.isLLM) {
                node.querySelectorAll('pre').forEach(pre => {
                    pre.innerHTML = pre.innerHTML.replace(/\n/g, NEWLINE_PLACEHOLDER);
                });
            }
        } catch (error) {
            console.warn('Error parsing node JSON:', error);
        }
    });

    return tempDiv.innerHTML;
}

function restoreNewLinesInPreElements(nodeElement) {
    nodeElement.querySelectorAll('pre').forEach(pre => {
        pre.innerHTML = pre.innerHTML.split(NEWLINE_PLACEHOLDER).join('\n');
    });
}

function neuriteSaveEvent(existingTitle = null) {
    nodes.map((n) => n.updateEdgeData());
    clearNodeSelection();

    let nodeData = document.getElementById("nodes").innerHTML;

    // Replace new lines in nodeData for LLM nodes
    nodeData = replaceNewLinesInLLMSaveData(nodeData);

    let zettelkastenContent = window.myCodemirror.getValue();
    let zettelkastenSaveElement = `<div id="zettelkasten-save" style="display:none;">${encodeURIComponent(zettelkastenContent)}</div>`;

    let additionalSaveData = collectAdditionalSaveObjects();
    let saveData = nodeData + zettelkastenSaveElement + additionalSaveData;

    let title = existingTitle || prompt("Enter a title for this save:");
    if (title) {
        handleSaveConfirmation(title, saveData, existingTitle);
    }
}

// Attach the neuriteSaveEvent to the save button
document.getElementById("save-button").addEventListener("click", () => neuriteSaveEvent());


function downloadData(title, data) {
    var blob = new Blob([data], { type: 'text/plain' });
    var tempAnchor = document.createElement('a');
    tempAnchor.download = title + '.txt';
    tempAnchor.href = window.URL.createObjectURL(blob);
    tempAnchor.click();
    setTimeout(function () {
        window.URL.revokeObjectURL(tempAnchor.href);
    }, 1);
}

let selectedSaveIndex = null; // Global variable to track the selected save

function updateSavedNetworks() {
    let saves = JSON.parse(localStorage.getItem("saves") || "[]");
    let container = document.getElementById("saved-networks-container");
    container.innerHTML = '';

    for (let [index, save] of saves.entries()) {
        let div = document.createElement("div");

        // Add a class to the div if it's the selected save
        if (index === selectedSaveIndex) {
            div.classList.add("selected-save");
        }
        let titleInput = document.createElement("input");
        let data = document.createElement("span");
        let loadButton = document.createElement("button");
        let deleteButton = document.createElement("button");
        let downloadButton = document.createElement("button");

        titleInput.type = "text";
        titleInput.value = save.title;
        titleInput.style.border = "none"
        titleInput.style.width = "125px"
        titleInput.addEventListener('change', function () {
            save.title = titleInput.value;
            localStorage.setItem("saves", JSON.stringify(saves));
        });

        data.textContent = save.data;
        data.style.display = "none";

        loadButton.textContent = "Select";
        loadButton.className = 'linkbuttons';
        loadButton.addEventListener('click', function () {
            document.getElementById("save-or-load").value = data.textContent;
            selectedSaveIndex = index; // Update the selected save index
            updateSavedNetworks(); // Refresh the UI
        });


        deleteButton.textContent = "X";
        deleteButton.className = 'linkbuttons';
        deleteButton.addEventListener('click', function () {
            // Remove the save from the array
            saves.splice(index, 1);

            // Update local storage
            localStorage.setItem("saves", JSON.stringify(saves));

            // Update the saved networks container
            updateSavedNetworks();
        });

        downloadButton.textContent = "↓";
        downloadButton.className = 'linkbuttons';
        downloadButton.addEventListener('click', function () {
            // Create a blob from the data
            var blob = new Blob([save.data], { type: 'text/plain' });

            // Create a temporary anchor and URL
            var tempAnchor = document.createElement('a');
            tempAnchor.download = save.title + '.txt';
            tempAnchor.href = window.URL.createObjectURL(blob);

            // Simulate a click on the anchor
            tempAnchor.click();

            // Clean up by revoking the object URL
            setTimeout(function () {
                window.URL.revokeObjectURL(tempAnchor.href);
            }, 1);
        });

        div.appendChild(titleInput);
        div.appendChild(data);
        div.appendChild(loadButton);
        div.appendChild(downloadButton);
        div.appendChild(deleteButton);
        container.appendChild(div);
    }
}

// Call updateSavedNetworks on page load to display previously saved networks
updateSavedNetworks();

let container = document.getElementById("saved-networks-container");

// Prevent default drag behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    container.addEventListener(eventName, preventDefaults, false);
});

// Highlight the drop area when item is dragged over it
['dragenter', 'dragover'].forEach(eventName => {
    container.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    container.addEventListener(eventName, unhighlight, false);
});

// Handle the drop
container.addEventListener('drop', handleSavedNetworksDrop, false);

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight(e) {
    container.classList.add('highlight');
}

function unhighlight(e) {
    container.classList.remove('highlight');
}

function handleSavedNetworksDrop(e) {
    let dt = e.dataTransfer;
    let file = dt.files[0];

    if (file && file.name.endsWith('.txt')) {
        let reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function (e) {
            let content = e.target.result;
            let title = file.name.replace('.txt', '');

            try {
                // Try saving the data to localStorage
                let saves = JSON.parse(localStorage.getItem("saves") || "[]");
                saves.push({ title: title, data: content });
                localStorage.setItem("saves", JSON.stringify(saves));
                updateSavedNetworks();
            } catch (error) {
                // If local storage is full, update save-load input
                document.getElementById("save-or-load").value = content;
            }
        };
    } else {
        console.log('File must be a .txt file');
    }
}



document.getElementById("clear-button").addEventListener("click", function () {
    document.getElementById("clear-sure").setAttribute("style", "display:block");
    document.getElementById("clear-button").text = "Are you sure?";
});
document.getElementById("clear-unsure-button").addEventListener("click", function () {
    document.getElementById("clear-sure").setAttribute("style", "display:none");
    document.getElementById("clear-button").text = "Clear";
});
document.getElementById("clear-sure-button").addEventListener("click", function () {
    clearnet();
    document.getElementById("clear-sure").setAttribute("style", "display:none");
    document.getElementById("clear-button").text = "Clear";
});



document.getElementById("clearLocalStorage").onclick = function () {
    localStorage.clear();
    alert('Local storage has been cleared.');
}



for (let n of htmlnodes) {
    let node = new Node(undefined, n, true);  // Indicate edge creation with `true`
    registernode(node);
}
for (let n of nodes) {
    n.init(nodeMap);
}

function clearnet() {
    clearNodeSelection()

    // Remove all edges
    while (edges.length > 0) {
        edges[edges.length - 1].remove();
    }
    edgeDirectionalityMap.clear();

    // Remove all nodes
    while (nodes.length > 0) {
        nodes[nodes.length - 1].remove();
    }

    // Reset LLM node count
    llmNodeCount = 0;

    // Clear the CodeMirror content
    window.myCodemirror.setValue('');
}

function restoreAdditionalSaveObjects(d) {

    let savedViewsElement = d.querySelector("#saved-views");
    if (savedViewsElement) {
        let savedViewsContent = decodeURIComponent(savedViewsElement.innerHTML);
        savedViews = JSON.parse(savedViewsContent);
        if (savedViews) {
            // Update the cache
            updateSavedViewsCache();

            displaySavedCoordinates();
        }
        savedViewsElement.remove();
    }

    let sliderValuesElement = d.querySelector("#saved-input-values");
    if (sliderValuesElement) {
        const sliderValuesContent = decodeURIComponent(sliderValuesElement.innerHTML);
        localStorage.setItem('inputValues', sliderValuesContent);
        sliderValuesElement.remove();
    }

    // Restore sliders immediately after their values have been set
    restoreInputValues();
}

document.getElementById("load-button").addEventListener("click", function () {
    var inputValue = document.getElementById("save-or-load").value;
    if (inputValue === "") {
        // If the input is empty, ask for confirmation
        document.getElementById("load-sure").setAttribute("style", "display:block");
        document.getElementById("load-button").text = "Are you sure?";
    } else {
        // If the input is not empty, proceed with loading
        loadnet(inputValue, true);
    }
});

document.getElementById("load-unsure-button").addEventListener("click", function () {
    // Hide the confirmation dialog and reset the button text if user is not sure
    document.getElementById("load-sure").setAttribute("style", "display:none");
    document.getElementById("load-button").text = "Load";
});

document.getElementById("load-sure-button").addEventListener("click", function () {
    // Proceed with loading even if input is empty, as user confirmed
    loadnet(document.getElementById("save-or-load").value, true);
    document.getElementById("load-sure").setAttribute("style", "display:none");
    document.getElementById("load-button").text = "Load";
});

function loadnet(text, clobber, createEdges = true) {
    if (clobber) {
        clearnet();
    }

    let d = document.createElement("div");
    d.innerHTML = text;

    // Temporarily store Zettelkasten content but don't set it in myCodeMirror yet
    let zettelkastenSaveElement = d.querySelector("#zettelkasten-save");
    let zettelkastenContent;
    if (zettelkastenSaveElement) {
        zettelkastenContent = decodeURIComponent(zettelkastenSaveElement.innerHTML);
        //console.log("Zettelkasten Content:", zettelkastenContent);
        // Remove the Zettelkasten save element to process the rest of the nodes
        zettelkastenSaveElement.remove();
    }

    restoreAdditionalSaveObjects(d);

    let newNodes = [];
    for (let n of d.children) {
        let node = new Node(undefined, n, true, undefined, createEdges);
        newNodes.push(node);
        registernode(node);
    }

    populateDirectionalityMap(d, nodeMap);

    for (let n of newNodes) {
        htmlnodes_parent.appendChild(n.content);

        n.init(nodeMap); // Initialize the node

        reconstructSavedNode(n); // Reconstruct the saved node
    }

    if (zettelkastenContent) {
        processAll = true;
        restoreZettelkastenEvent = true;
        window.myCodemirror.setValue(zettelkastenContent);
    }
}

function populateDirectionalityMap(d, nodeMap) {
    const nodes = Array.from(d.children);
    nodes.forEach(nodeElement => {
        if (nodeElement.hasAttribute('data-edges')) {
            const edgesData = JSON.parse(nodeElement.getAttribute('data-edges'));
            edgesData.forEach(edgeData => {
                const edgeKey = edgeData.edgeKey;
                if (!edgeDirectionalityMap.has(edgeKey)) {
                    edgeDirectionalityMap.set(edgeKey, {
                        start: nodeMap[edgeData.directionality.start],
                        end: nodeMap[edgeData.directionality.end]
                    });
                }
            });
        }
    });
}

function reconstructSavedNode(node) {
    // Restore the title
    let titleInput = node.content.querySelector('.title-input');
    if (titleInput) {
        let savedTitle = node.content.getAttribute('data-title');
        if (savedTitle) {
            titleInput.value = savedTitle;
        }
    }

    if (node.isTextNode) {
        initTextNode(node)
    }

    if (node.isLLM) {
        initAiNode(node);
        restoreNewLinesInPreElements(node.aiResponseDiv);
    }

    if (node.isLink) {
        initLinkNode(node);
    }

    if (isEditorNode(node)) {
        initEditorNode(node)
    }
}