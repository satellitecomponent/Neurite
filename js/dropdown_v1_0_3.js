const PROMPT_IDENTIFIER = "Prompt:";

var textarea = document.getElementById('note-input');
var myCodeMirror = CodeMirror.fromTextArea(textarea, {
    lineWrapping: true,
    scrollbarStyle: 'simple',
    // Other options
});

myCodeMirror.on("focus", function () {
    // Enable text selection when the editor is focused
    myCodeMirror.getWrapperElement().style.userSelect = "text";
});

myCodeMirror.on("blur", function () {
    // Disable text selection when the editor loses focus
    myCodeMirror.getWrapperElement().style.userSelect = "none";
});
myCodeMirror.display.wrapper.style.backgroundColor = '#222226';
myCodeMirror.display.wrapper.style.width = '265px';
myCodeMirror.display.wrapper.style.height = '250px';
myCodeMirror.display.wrapper.style.borderStyle = 'inset';
myCodeMirror.display.wrapper.style.borderColor = '#8882';
myCodeMirror.display.wrapper.style.fontSize = '15px';
myCodeMirror.getWrapperElement().style.resize = "vertical";
var nodeInput = document.getElementById('node-tag');
var refInput = document.getElementById('ref-tag');

setTimeout(function () {
    myCodeMirror.refresh();
}, 1);

function updateMode() {
    CodeMirror.defineMode("custom", function () {
        var node = nodeInput.value;
        var ref = refInput.value;
        const Prompt = `${PROMPT_IDENTIFIER}`;
        return {
            token: function (stream) {
                if (stream.match(node)) {
                    return "node";
                }
                if (stream.match(ref)) {
                    return "ref";
                }
                if (stream.match(Prompt)) {
                    return "Prompt";
                }
                while (stream.next() != null) {
                    if (stream.eol()) {
                        return null;
                    }
                }
            }
        };
    });

    myCodeMirror.setOption("mode", "custom");
    myCodeMirror.refresh();  // To apply the new mode immediately
}

nodeInput.addEventListener('change', updateMode);
refInput.addEventListener('change', updateMode);
updateMode();  // To set the initial mode

let userScrolledUp = false;

myCodeMirror.on("scroll", function () {
    var scrollInfo = myCodeMirror.getScrollInfo();
    var atBottom = scrollInfo.height - scrollInfo.top - scrollInfo.clientHeight < 1;
    if (!atBottom) {
        userScrolledUp = true;
    } else {
        userScrolledUp = false;
    }
});

// Helper function to determine if a CodeMirror position is within a marked range
function isWithinMarkedText(cm, pos, className) {
    var lineMarkers = cm.findMarksAt(pos);
    for (var i = 0; i < lineMarkers.length; i++) {
        if (lineMarkers[i].className === className) {
            return true;
        }
    }
    return false;
}

// Array to store node titles
let nodeTitles = [];

function identifyNodeTitles() {
    // Clear previous node titles
    nodeTitles = [];
    myCodeMirror.eachLine((line) => {
        if (line.text.startsWith(nodeInput.value)) {
            let title = line.text.split(nodeInput.value)[1].trim();
            // Remove comma if exists
            if (title.endsWith(',')) {
                title = title.slice(0, -1);
            }
            nodeTitles.push(title);
        }
    });
}

function highlightNodeTitles() {
    // First clear all existing marks
    myCodeMirror.getAllMarks().forEach(mark => mark.clear());

    myCodeMirror.eachLine((line) => {
        nodeTitles.forEach((title) => {
            if (title.length > 0) {
                // Escape special regex characters
                const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escapedTitle, "ig"); // removed \\b word boundaries
                let match;
                while (match = regex.exec(line.text)) {
                    const idx = match.index;
                    if (idx !== -1) {
                        myCodeMirror.markText(
                            CodeMirror.Pos(line.lineNo(), idx),
                            CodeMirror.Pos(line.lineNo(), idx + title.length),
                            {
                                className: 'node-title',
                                handleMouseEvents: true
                            }
                        );
                    }
                }
            }
        });
    });
}


let nodeTitleToLineMap = new Map();

function updateNodeTitleToLineMap() {
    // Clear the map
    nodeTitleToLineMap = new Map();

    let currentNodeTitleLineNo = null;
    myCodeMirror.eachLine((line) => {
        if (line.text.startsWith(nodeInput.value)) {
            const title = line.text.split(nodeInput.value)[1].trim();
            currentNodeTitleLineNo = line.lineNo();  // Store the line number of the "node:" line
            nodeTitleToLineMap.set(title, currentNodeTitleLineNo);
        }
    });
}

// Call updateNodeTitleToLineMap whenever the CodeMirror content changes
myCodeMirror.on("change", function () {
    updateNodeTitleToLineMap();
    identifyNodeTitles();
    highlightNodeTitles();
});

myCodeMirror.on("change", function (instance, changeObj) {
    ignoreTextAreaChanges = true; // Tell the MutationObserver to ignore changes
    textarea.value = instance.getValue();

    // Create a new 'input' event
    var event = new Event('input', {
        bubbles: true,
        cancelable: true,
    });

    // Dispatch the event
    textarea.dispatchEvent(event);

    ignoreTextAreaChanges = false; // Tell the MutationObserver to observe changes again
});


// Update the "mousedown" event handler
myCodeMirror.on("mousedown", function (cm, event) {
    var pos = cm.coordsChar({ left: event.clientX, top: event.clientY });
    var isWithin = isWithinMarkedText(cm, pos, 'node-title');

    if (isWithin) {
        const lineMarkers = cm.findMarksAt(pos);
        for (var i = 0; i < lineMarkers.length; i++) {
            if (lineMarkers[i].className === 'node-title') {
                const from = lineMarkers[i].find().from;
                const to = lineMarkers[i].find().to;

                // Check if click is at the start or end of the marked text
                if (pos.ch === from.ch || pos.ch === to.ch) {
                    // If click is at the start or end, just place the cursor
                    cm.setCursor(pos);
                    return; // prevent default navigation
                }

                // prevent default click event
                event.preventDefault();

                const title = cm.getRange(from, to);
                //console.log('Clicked title:', title);
                if (!title) {
                    return; // title could not be extracted
                }

                // Get the line number of the "node:" line from the map
                const lowerCaseTitle = title.toLowerCase();
                let nodeLineNo;
                for (const [mapTitle, mapLineNo] of nodeTitleToLineMap) {
                    if (mapTitle.toLowerCase() === lowerCaseTitle) {
                        nodeLineNo = mapLineNo;
                        break;
                    }
                }
                if (typeof nodeLineNo !== "number") {
                    return; // the line number could not be found
                }

                // Calculate the position to scroll to
                const scrollInfo = cm.getScrollInfo();
                const halfHeight = scrollInfo.clientHeight / 2;
                const coords = cm.charCoords({ line: nodeLineNo, ch: 0 }, "local");

                // Set the scroll position of the editor
                cm.scrollTo(null, coords.top - halfHeight);

                // Get the node by the title
                const node = getNodeByTitle(title);
                //console.log('Returned node:', node);
                if (!node) {
                    return; // the node could not be found
                }

                // Zoom to the node
                node.zoom_to(.5);
                autopilotSpeed = settings.autopilotSpeed;

                break; // Exit the loop once a title is found
            }
        }
    } else {
        // If the click is not within the marked text, check if it's directly next to it
        const leftPos = CodeMirror.Pos(pos.line, pos.ch - 1);
        const rightPos = CodeMirror.Pos(pos.line, pos.ch + 1);
        const isLeftAdjacent = isWithinMarkedText(cm, leftPos, 'node-title');
        const isRightAdjacent = isWithinMarkedText(cm, rightPos, 'node-title');

        // Set cursor position if click is directly next to the marked text
        if (isLeftAdjacent || isRightAdjacent) {
            cm.setCursor(pos);
        }

        // Check if the click is on a line that starts with 'node:'
        const lineText = cm.getLine(pos.line);
        const nodeInputValue = nodeInput.value;  // add ':' at the end
        if (lineText.startsWith(nodeInputValue)) {
            // If the click is on the 'node:' line but not within the marked text, set the cursor position
            cm.setCursor(pos);
        }
    }
});



// Call initially
identifyNodeTitles();
highlightNodeTitles();

function getNodeByTitle(title) {
    const lowerCaseTitle = title.toLowerCase();
    for (let n of nodes) {
        let nodeTitle = n.content.getAttribute('data-title');
        if (nodeTitle && nodeTitle.toLowerCase() === lowerCaseTitle) {
            return n;
        }
    }
    return null;
}

//END OF CODEMIRROR




document.getElementById("clearLocalStorage").onclick = function () {
    localStorage.clear();
    alert('Local storage has been cleared.');
}

document.querySelectorAll('input[type=range]').forEach(function (slider) {
    function setSliderBackground(slider) {
        const min = slider.min ? parseFloat(slider.min) : 0;
        const max = slider.max ? parseFloat(slider.max) : 100;
        const value = slider.value ? parseFloat(slider.value) : 0;
        const percentage = (value - min) / (max - min) * 100;
        slider.style.background = `linear-gradient(to right, #006BB6 0%, #006BB6 ${percentage}%, #18181c ${percentage}%, #18181c 100%)`;
    }

    // Set the background color split initially
    setSliderBackground(slider);

    // Update background color split when the slider value changes
    slider.addEventListener('input', function () {
        setSliderBackground(slider);
    });
});


document.getElementById('model-temperature').addEventListener('input', updateLabel);

function updateLabel() {
    const temperature = document.getElementById('model-temperature').value;
    document.getElementById('model-temperature-label').innerText = 'Temperature:\n ' + temperature;
}
        // Load any saved keys from local storage
        document.getElementById('googleApiKey').value = localStorage.getItem('googleApiKey') || '';
        document.getElementById('googleSearchEngineId').value = localStorage.getItem('googleSearchEngineId') || '';
        document.getElementById('api-key-input').value = localStorage.getItem('openaiApiKey') || '';
        document.getElementById('wolframApiKey').value = localStorage.getItem('wolframApiKey') || '';

        function saveKeys() {
            // Save keys to local storage
            localStorage.setItem('googleApiKey', document.getElementById('googleApiKey').value);
            localStorage.setItem('googleSearchEngineId', document.getElementById('googleSearchEngineId').value);
            localStorage.setItem('openaiApiKey', document.getElementById('api-key-input').value);
            localStorage.setItem('wolframApiKey', document.getElementById('wolframApiKey').value);
        }

        function clearKeys() {
            // Clear keys from local storage
            localStorage.removeItem('googleApiKey');
            localStorage.removeItem('googleSearchEngineId');
            localStorage.removeItem('openaiApiKey');
            localStorage.removeItem('wolframApiKey');

            // Clear input fields
            document.getElementById('googleApiKey').value = '';
            document.getElementById('googleSearchEngineId').value = '';
            document.getElementById('api-key-input').value = '';
            document.getElementById('wolframApiKey').value = '';
        }

function handleKeyDown(event) {
    if (event.key === 'Enter') {
        const localLLMCheckbox = document.getElementById("localLLM");

        if (event.shiftKey) {
            // Shift + Enter was pressed, insert a newline
            event.preventDefault();
            // insert a newline at the cursor
            const cursorPosition = event.target.selectionStart;
            event.target.value = event.target.value.substring(0, cursorPosition) + "\n" + event.target.value.substring(cursorPosition);
            // position the cursor after the newline
            event.target.selectionStart = cursorPosition + 1;
            event.target.selectionEnd = cursorPosition + 1;
            // force the textarea to resize
            autoGrow(event);
        } else {
            // Enter was pressed without Shift
            event.preventDefault();

            // If localLLM checkbox is enabled, submit the form (which triggers LLM code).
            if (localLLMCheckbox.checked) {
                document.getElementById('prompt-form').dispatchEvent(new Event('submit'));
            } else {
                // Otherwise, call sendMessage function
                sendMessage(event);
            }
        }
    }
    return true;
}

        function autoGrow(event) {
            const textarea = event.target;
            // Temporarily make the height 'auto' so the scrollHeight is not affected by the current height
            textarea.style.height = 'auto';
            let maxHeight = 200;
            if (textarea.scrollHeight < maxHeight) {
                textarea.style.height = textarea.scrollHeight + 'px';
                textarea.style.overflowY = 'hidden';
            } else {
                textarea.style.height = maxHeight + 'px';
                textarea.style.overflowY = 'auto';
            }
        }



        //disable ctl +/- zoom on browser
        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey && (event.key === '+' || event.key === '-' || event.key === '=')) {
                event.preventDefault();
            }
        });

        document.addEventListener('wheel', (event) => {
            if (event.ctrlKey) {
                event.preventDefault();
            }
        }, {
            passive: false
        });

        document.body.style.transform = "scale(1)";
        document.body.style.transformOrigin = "0 0";

function openTab(tabId, element) {
    var i, tabcontent, tablinks;

    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    tablinks = document.getElementsByClassName("tablink");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("activeTab"); // We use classList.remove to remove the class
    }

    document.getElementById(tabId).style.display = "block";
    element.classList.add("activeTab"); // We use classList.add to add the class
}
        // Get the menu button and dropdown content elements
        const menuButton = document.querySelector(".menu-button");
        const dropdownContent = document.querySelector(".dropdown-content");

        // Get the first tabcontent element
        const firstTab = document.querySelector(".tabcontent");

        dropdownContent.addEventListener("paste", function (e) {
            cancel(e);
        });
        dropdownContent.addEventListener("wheel", function (e) {
            cancel(e);
        });
        dropdownContent.addEventListener("dblclick", function (e) {
            cancel(e);
        });

        // Add an event listener to the menu button
        menuButton.addEventListener("click", function (event) {
            // Prevent the click event from propagating
            event.stopPropagation();

            // Toggle the "open" class on the menu button and dropdown content
            menuButton.classList.toggle("open");
            dropdownContent.classList.toggle("open");

            // If the dropdown is opened, manually set the first tab to active and display its content
            if (dropdownContent.classList.contains("open")) {
                var tablinks = document.getElementsByClassName("tablink");
                var tabcontent = document.getElementsByClassName("tabcontent");

                // Remove active class from all tablinks and hide all tabcontent
                for (var i = 0; i < tablinks.length; i++) {
                    tablinks[i].classList.remove("active");
                    tabcontent[i].style.display = "none";
                }

                // Open the first tab
                openTab('tab1', tablinks[0]);

                // If there's any selected text, deselect it
                if (window.getSelection) {
                    window.getSelection().removeAllRanges();
                } else if (document.selection) {
                    document.selection.empty();
                }
            }
        });


        dropdownContent.addEventListener("mousedown", (e) => {
            cancel(e);
        });

document.getElementById("save-button").addEventListener("click", function () {
    nodes.map((n) => n.updateEdgeData());
    let s = document.getElementById("nodes").innerHTML;
    let title = prompt("Enter a title for this save:");

    if (title) {
        let saves = JSON.parse(localStorage.getItem("saves") || "[]");
        saves.push({ title: title, data: s });

        try {
            localStorage.setItem("saves", JSON.stringify(saves));
            updateSavedNetworks();
        } catch (e) {
            // localStorage quota exceeded
            if (confirm("Local storage is full, download the data as a .txt file?")) {
                downloadData(title, s);
            }
        }
    }
});

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

function updateSavedNetworks() {
    let saves = JSON.parse(localStorage.getItem("saves") || "[]");
    let container = document.getElementById("saved-networks-container");
    container.innerHTML = '';

    for (let [index, save] of saves.entries()) {
        let div = document.createElement("div");
        let titleInput = document.createElement("input");
        let data = document.createElement("span");
        let loadButton = document.createElement("button");
        let deleteButton = document.createElement("button");
        let downloadButton = document.createElement("button");

        titleInput.type = "text";
        titleInput.value = save.title;
        titleInput.style.border = "none"
        titleInput.style.width = "134px"
        titleInput.addEventListener('change', function () {
            save.title = titleInput.value;
            localStorage.setItem("saves", JSON.stringify(saves));
        });

        data.textContent = save.data;
        data.style.display = "none";

        loadButton.textContent = "Load";
        loadButton.className = 'linkbuttons';
        loadButton.addEventListener('click', function () {
            document.getElementById("save-or-load").value = data.textContent;
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

document.getElementById("load-button").addEventListener("click", function () {
    loadnet(document.getElementById("save-or-load").value, true);
});

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
container.addEventListener('drop', handleDrop, false);

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

function handleDrop(e) {
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


        // Get all the menu items
        const menuItems = document.querySelectorAll(".menu-item");

        // Add a click event listener to each menu item
        menuItems.forEach(function (item) {
            item.addEventListener("click", function () {
                // Remove the "selected" class from all the menu items
                // menuItems.forEach(function(item) {
                //   item.classList.remove("selected");
                // });

                // Add the "selected" class to the clicked menu item
                item.classList.add("selected");
            });
        });
        document.getElementById("clear-button").addEventListener("click", function () {
            document.getElementById("clear-sure").setAttribute("style", "display:block");
            document.getElementById("clear-button").text = "Are you sure?";
        });
        document.getElementById("clear-unsure-button").addEventListener("click", function () {
            document.getElementById("clear-sure").setAttribute("style", "display:none");
            document.getElementById("clear-button").text = "clear";
        });
        document.getElementById("clear-sure-button").addEventListener("click", function () {
            clearnet();
            document.getElementById("clear-sure").setAttribute("style", "display:none");
            document.getElementById("clear-button").text = "clear";
        });

var settings = {
    zoomSpeed: 0.0005,
    panSpeed: 1,
    zoomContentExp: 0.5,
    gestureZoomSpeed: 0.001,
    gestureRotateSpeed: Math.PI / 180,
    scroll: ('GestureEvent' in window) ? "pan" : "zoom",
    nodeModeKey: "Shift", //"CapsLock",
    nodeModeTrigger: "down", //"toggle"

    //slider adjustment
    maxLines: 48,
    renderWidthMult: 0.3, //1,
    regenDebtAdjustmentFactor: 0.05,

    renderStepSize: 0.1, //0.25,
    renderSteps: 16, //64,
    renderDChar: "L",
    opacity: 1,


    rotateModifier: "Alt",
    rotateModifierSpeed: Math.PI / 180 / 36,

    iterations: 256,

    //autopilotRF_Pscale:1,
    autopilotRF_Iscale: 0.5,
    //autopilotRF_Dscale:0.1,
    autopilotSpeed: 0.1,
    autopilotMaxSpeed: 0.1,

    buttonGraphics: {
        hover: ["RGB(100,100,100)", "RGB(200,200,255)"],
        click: ["RGB(70,70,70)", "RGB(100,100,100)"],
        initial: ["none", "RGB(170,170,170)"]
    },

    maxDist: 4,
    orbitStepRate: 2,

    innerOpacity: 1,
    outerOpacity: 1
}

let innerOpacitySlider = document.getElementById('inner_opacity');
innerOpacitySlider.addEventListener('input', function () {
    settings.innerOpacity = innerOpacitySlider.value / 100;
});

let outerOpacitySlider = document.getElementById('outer_opacity');
outerOpacitySlider.addEventListener('input', function () {
    settings.outerOpacity = outerOpacitySlider.value / 100;
});

// Initialize the slider with the settings.renderWidthMult value
let renderWidthMultSlider = document.getElementById("renderWidthMultSlider");
renderWidthMultSlider.value = settings.renderWidthMult;
renderWidthMultSlider.dispatchEvent(new Event('input'));

// Initialize the slider with the settings.maxLines value
let maxLinesSlider = document.getElementById("maxLinesSlider");
maxLinesSlider.value = settings.maxLines;
maxLinesSlider.dispatchEvent(new Event('input'));

// Initialize the slider with the settings.regenDebtAdjustmentFactor value
let regenDebtSlider = document.getElementById("regenDebtSlider");
regenDebtSlider.value = settings.regenDebtAdjustmentFactor;
regenDebtSlider.dispatchEvent(new Event('input'));

function getLength() {
    let v = document.getElementById("length").value / 100;
    return 2 ** (v * 8);
}
document.getElementById("length").addEventListener("input", (e) => {
    let v = getLength();
    setRenderLength(v);
    document.getElementById("length_value").textContent = (Math.round(v * 100) / 100);
});

function getRegenDebtAdjustmentFactor() {
    let v = document.getElementById("regenDebtSlider").value;
    return v;
}
document.getElementById("regenDebtSlider").addEventListener("input", (e) => {
    let v = getRegenDebtAdjustmentFactor();
    settings.regenDebtAdjustmentFactor = v;
    document.getElementById("regenDebtValue").textContent = v;
});

function setRenderWidthMult(v) {
    settings.renderWidthMult = v;
}

function setRenderLength(l) {
    let f = settings.renderStepSize * settings.renderSteps / l;
    //settings.renderStepSize /= f;
    //settings.renderWidthMult *= f;
    settings.renderSteps /= f;
}
setRenderLength(getLength());


function getMaxLines() {
    let v = parseInt(document.getElementById("maxLinesSlider").value);
    return v;
}
document.getElementById("maxLinesSlider").addEventListener("input", (e) => {
    let v = getMaxLines();
    settings.maxLines = v;
    document.getElementById("maxLinesValue").textContent = + v;
});

function getRenderWidthMult() {
    let v = document.getElementById("renderWidthMultSlider").value;
    return v;
}
document.getElementById("renderWidthMultSlider").addEventListener("input", (e) => {
    let v = getRenderWidthMult();
    setRenderWidthMult(v);
    document.getElementById("renderWidthMultValue").textContent = v;
});

function setRenderQuality(n) {
    let q = 1 / n;
    let f = settings.renderStepSize / q;
    settings.renderStepSize = q;
    settings.renderWidthMult *= f;
    settings.renderSteps *= f;
}
setRenderQuality(getQuality());

        function getQuality() {
            let v = document.getElementById("quality").value / 100;
            return 2 ** (v * 4);
        }
        document.getElementById("quality").addEventListener("input", (e) => {
            let v = getQuality();
            setRenderQuality(v);
            document.getElementById("quality_value").textContent = "Quality:" + (Math.round(v * 100) / 100);
        });


        document.getElementById("exponent").addEventListener("input", (e) => {
            let v = e.target.value * 1;
            mand_step = (z, c) => {
                return z.ipow(v).cadd(c);
            }
            document.getElementById("exponent_value").textContent = v;
        })
        const submenuBtn = document.querySelector('.submenu-btn');

document.getElementById('node-count-slider').addEventListener('input', function () {
    document.getElementById('node-slider-label').innerText = 'Top ' + this.value + '\nnodes';
});

let colorPicker = document.getElementById("colorPicker");

colorPicker.addEventListener("input", function () {
    document.body.style.backgroundColor = this.value;
}, false);

// Manually dispatch the input event
colorPicker.dispatchEvent(new Event("input"));