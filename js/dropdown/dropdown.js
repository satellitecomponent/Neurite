/* Function that listens for undo and redo key combinations on a textarea
function captureUndoRedoEvents(textarea, codeMirrorInstance) {
    textarea.addEventListener('keydown', function (event) {
        if (event.ctrlKey || event.metaKey) {
            if (event.key === 'z') {
                if (event.shiftKey) {
                    // Redo for Ctrl+Shift+Z
                    codeMirrorInstance.redo();
                } else {
                    // Undo for Ctrl+Z
                    codeMirrorInstance.undo();
                }
                event.preventDefault();  // Prevent the default undo/redo behavior in the textarea
            } else if (event.key === 'y') {
                // Redo for Ctrl+Y
                codeMirrorInstance.redo();
                event.preventDefault();  // Prevent the default redo behavior in the textarea
            }
        }
    });
}
*/

function captureDocumentUndoRedoEventsAndApplyToCodeMirror(codeMirrorInstance) {
    document.addEventListener('keydown', function (event) {
        if (event.ctrlKey || event.metaKey) {  // Works for both Ctrl (Windows/Linux) and Cmd (macOS)
            let didOperation = false;

            if (event.key === 'z') {
                if (event.shiftKey) {
                    // Redo for Ctrl+Shift+Z or Cmd+Shift+Z
                    codeMirrorInstance.redo();
                    didOperation = true;
                } else {
                    // Undo for Ctrl+Z or Cmd+Z
                    codeMirrorInstance.undo();
                    didOperation = true;
                }
            } else if (event.key === 'y') {
                // Redo for Ctrl+Y or Cmd+Y
                codeMirrorInstance.redo();
                didOperation = true;
            }

            if (didOperation && (event.target.closest('.CodeMirror') || event.target.tagName.toLowerCase() !== 'textarea' && event.target.tagName.toLowerCase() !== 'input')) {
                event.preventDefault();  // Prevent the default undo/redo behavior in the document or CodeMirror
                setTimeout(() => codeMirrorInstance.refresh(), 0);  // Refresh the CodeMirror instance
            }
        }
    });
}

// Override default CodeMirror undo/redo handlers
myCodeMirror.setOption('extraKeys', {
    'Ctrl-Z': (cm) => { /* Do nothing */ },
    'Cmd-Z': (cm) => { /* Do nothing */ },
    'Ctrl-Y': (cm) => { /* Do nothing */ },
    'Cmd-Y': (cm) => { /* Do nothing */ },
    'Shift-Ctrl-Z': (cm) => { /* Do nothing */ },
    'Shift-Cmd-Z': (cm) => { /* Do nothing */ }
});

captureDocumentUndoRedoEventsAndApplyToCodeMirror(myCodeMirror);

// Get the viewport dimensions
let maxWidth, maxHeight;

function updateMaxDimensions() {
    maxWidth = window.innerWidth * 0.9;
    maxHeight = window.innerHeight * 0.7;
}

// Update max dimensions initially and on window resize
updateMaxDimensions();
window.addEventListener("resize", updateMaxDimensions);

// Horizontal drag handle
let zetHorizDragHandle = document.getElementById("zetHorizDragHandle");
let zetIsHorizResizing = false;
let initialX;
let initialWidth;

zetHorizDragHandle.addEventListener("mousedown", function (event) {
    updateMaxDimensions(); // Update dimensions at the start of each drag
    zetIsHorizResizing = true;
    initialX = event.clientX;
    let cmElement = myCodeMirror.getWrapperElement();
    initialWidth = cmElement.offsetWidth;

    // Prevent text selection while resizing
    document.body.style.userSelect = 'none';

    document.addEventListener("mousemove", zetHandleHorizMouseMove);
    document.addEventListener("mouseup", function () {
        zetIsHorizResizing = false;

        // Enable text selection again after resizing
        document.body.style.userSelect = '';

        document.removeEventListener("mousemove", zetHandleHorizMouseMove);
    });
});

function zetHandleHorizMouseMove(event) {
    if (zetIsHorizResizing) {
        requestAnimationFrame(() => {
            // Calculate the difference in the x position
            let dx = event.clientX - initialX;
            let cmElement = myCodeMirror.getWrapperElement();
            let newWidth = initialWidth - dx;

            // Update the width if within the boundaries
            if (newWidth > 50 && newWidth <= maxWidth) {
                cmElement.style.width = newWidth + "px";
                document.getElementById('prompt').style.width = newWidth + 'px';
                myCodeMirror.refresh();
            }
        });
    }
}

// Vertical drag handle
let zetVertDragHandle = document.getElementById("zetVertDragHandle");
let zetIsVertResizing = false;
let initialY;
let initialHeight;

zetVertDragHandle.addEventListener("mousedown", function (event) {
    updateMaxDimensions(); // Update dimensions at the start of each drag
    zetIsVertResizing = true;
    initialY = event.clientY;
    let cmElement = myCodeMirror.getWrapperElement();
    initialHeight = cmElement.offsetHeight;

    // Prevent text selection while resizing
    document.body.style.userSelect = 'none';

    document.addEventListener("mousemove", zetHandleVertMouseMove);
    document.addEventListener("mouseup", function () {
        zetIsVertResizing = false;

        // Enable text selection again after resizing
        document.body.style.userSelect = '';

        document.removeEventListener("mousemove", zetHandleVertMouseMove);
    });
});

function zetHandleVertMouseMove(event) {
    if (zetIsVertResizing) {
        requestAnimationFrame(() => {
            // Calculate the difference in the y position
            let dy = event.clientY - initialY;
            let cmElement = myCodeMirror.getWrapperElement();
            let newHeight = initialHeight + dy;

            // Update the height if within the boundaries
            if (newHeight > 50 && newHeight <= maxHeight) {
                cmElement.style.height = newHeight + "px";
                myCodeMirror.refresh();
            }
        });
    }
}

// Add this event listener to handle window resizing
window.addEventListener("resize", function () {
    maxWidth = window.innerWidth * 0.9;
    maxHeight = window.innerHeight * 0.9;

    let cmElement = myCodeMirror.getWrapperElement();

    if (cmElement.offsetHeight > maxHeight) {
        cmElement.style.height = maxHeight + "px";
    }

    if (cmElement.offsetWidth > maxWidth) {
        cmElement.style.width = maxWidth + "px";
    }

    myCodeMirror.refresh();
});

function setupCustomDropdown(select, aiNode = false) {
    // Create the main custom dropdown container
    let selectReplacer = document.createElement('div');
    selectReplacer.className = 'select-replacer closed'; // add 'closed' class by default

    // Create the currently selected value container
    let selectedDiv = document.createElement('div');
    selectedDiv.innerText = select.options[select.selectedIndex].innerText;
    selectReplacer.appendChild(selectedDiv);

    // Create the dropdown options container
    let optionsReplacer = document.createElement('div');
    optionsReplacer.className = 'options-replacer';

    // Append the options container to the main dropdown container
    selectReplacer.appendChild(optionsReplacer);


    // Replace the original select with the custom dropdown
    let container = document.createElement('div');
    container.className = 'select-container';
    select.parentNode.insertBefore(container, select);
    container.appendChild(selectReplacer);
    container.appendChild(select);
    select.style.display = 'none'; // Hide the original select

    addEventListenersToCustomDropdown(select, aiNode);

}

function addEventListenersToCustomDropdown(select, aiNode) {
    let container = select.parentNode;
    let selectReplacer = container.querySelector('.select-replacer');
    let optionsReplacer = selectReplacer.querySelector('.options-replacer');
    let selectedDiv = selectReplacer.querySelector('div');

    // Toggle dropdown on click
    let isPendingFrame = false;

    // Create individual options
    Array.from(select.options).forEach((option, index) => {
        let optionDiv = document.createElement('div');
        optionDiv.innerText = option.innerText;
        optionDiv.setAttribute('data-value', option.value);

        // Highlight the selected option
        if (select.selectedIndex === index) {
            optionDiv.classList.add('selected');
        }

        optionDiv.addEventListener('click', function (event) {
            event.stopPropagation(); // Stops the event from bubbling up

            select.value = option.value;
            selectedDiv.innerText = option.innerText;

            // Remove `selected` class from previously selected option
            const previousSelected = optionsReplacer.querySelector('.selected');
            if (previousSelected) {
                previousSelected.classList.remove('selected');
            }
            // Add `selected` class to the new selected option
            optionDiv.classList.add('selected');

            // Trigger the original dropdown's change event
            let changeEvent = new Event('change', {
                'bubbles': true,
                'cancelable': true
            });
            select.dispatchEvent(changeEvent);
        });
        optionsReplacer.appendChild(optionDiv);
    });

    selectReplacer.addEventListener('click', function (event) {
        // Get all the select containers
        const selectContainers = document.querySelectorAll('.select-container');
        // Reset z-index for all
        selectContainers.forEach((el) => el.style.zIndex = "20");

        if (optionsReplacer.classList.contains('show')) {
            if (!event.target.closest('.options-replacer')) {
                // Dropdown is open and click was outside of the options, so close it
                window.requestAnimationFrame(() => {
                    optionsReplacer.classList.remove('show');
                    selectReplacer.classList.add('closed');
                    container.style.zIndex = "20"; // reset the z-index of the parent container
                    isPendingFrame = false;
                });
                isPendingFrame = true;
            }
        } else {
            // Dropdown is closed, so open it
            container.style.zIndex = "30"; // increase the z-index of the parent container
            if (!isPendingFrame) {
                window.requestAnimationFrame(() => {
                    optionsReplacer.classList.add('show');
                    selectReplacer.classList.remove('closed');
                    isPendingFrame = false;
                });
                isPendingFrame = true;
            }
        }
    });
}

function setupModelSelect(selectElement, isEmbeddingsSelect = false) {
    if (selectElement) {
        setupCustomDropdown(selectElement);

        // Restore selection from local storage
        const storedValue = localStorage.getItem(selectElement.id);
        if (storedValue) {
            selectElement.value = storedValue;
            updateSelectedOptionDisplay(selectElement);
            if (isEmbeddingsSelect) {
                checkLocalEmbeddingsCheckbox(selectElement);
            }
        }

        // Set change event listener for caching selected value and updating display
        selectElement.addEventListener('change', function () {
            localStorage.setItem(this.id, this.value);
            updateSelectedOptionDisplay(this);
            if (isEmbeddingsSelect) {
                checkLocalEmbeddingsCheckbox(this);
            }
        });
    }
}

function updateSelectedOptionDisplay(selectElement) {
  // Update the custom dropdown display to show the selected value
  let selectedDiv = selectElement.parentNode.querySelector('.select-replacer > div');
  if (selectedDiv) {
    let selectedOption = selectElement.options[selectElement.selectedIndex];
    if (selectedOption) {
      selectedDiv.innerText = selectedOption.innerText;
    }
  }

  // Update highlighting in the custom dropdown options
  let optionsReplacer = selectElement.parentNode.querySelector('.options-replacer');
  if (optionsReplacer) {
    let optionDivs = optionsReplacer.querySelectorAll('div');
    optionDivs.forEach(div => {
      if (div.getAttribute('data-value') === selectElement.value) {
        div.classList.add('selected');
      } else {
        div.classList.remove('selected');
      }
    });
  }
}

function checkLocalEmbeddingsCheckbox(selectElement) {
    const localEmbeddingsCheckbox = document.getElementById('local-embeddings-checkbox');

    localEmbeddingsCheckbox.checked = selectElement.value === 'local-embeddings';
}

function handleEmbeddingsSelection(selectElement) {
    const localEmbeddingsCheckbox = document.getElementById('local-embeddings-checkbox');

    if (selectElement.value === 'local-embeddings') {
        // Check the hidden checkbox when local embeddings is selected
        localEmbeddingsCheckbox.checked = true;
    } else {
        // Uncheck the hidden checkbox for other selections
        localEmbeddingsCheckbox.checked = false;
    }

    // Additional logic here if needed, e.g., saving the selection to localStorage
}

// Function for custom slider background
function setSliderBackground(slider) {
    const min = slider.min ? parseFloat(slider.min) : 0;
    const max = slider.max ? parseFloat(slider.max) : 100;
    const value = slider.value ? parseFloat(slider.value) : 0;
    const percentage = (value - min) / (max - min) * 100;
    slider.style.background = `linear-gradient(to right, #006BB6 0%, #006BB6 ${percentage}%, #18181c ${percentage}%, #18181c 100%)`;
}


document.addEventListener('DOMContentLoaded', function () {
    // Setup for all existing custom-selects, excluding those in the modal
    let selects = document.querySelectorAll('select.custom-select:not(#customModal select.custom-select)');
    selects.forEach(select => setupModelSelect(select, select.id === 'embeddingsModelSelect'));
});

document.querySelectorAll('input[type=range]:not(#customModal input[type=range])').forEach(function (slider) {
    setSliderBackground(slider);
    slider.addEventListener('input', function () {
        setSliderBackground(slider);
    });
});


// Function to save the value of a specific slider or color picker
function saveInputValue(input) {
    const savedValues = localStorage.getItem('inputValues');
    const inputValues = savedValues ? JSON.parse(savedValues) : {};

    inputValues[input.id] = input.value;
    localStorage.setItem('inputValues', JSON.stringify(inputValues));
}

const debouncedSaveInputValue = debounce(function (input) {
    saveInputValue(input);
    //console.log(`saved`);
}, 300);

document.querySelectorAll('#tab2 input[type="range"], .color-picker-container input[type="color"]').forEach(function (input) {
    input.addEventListener('input', function () {
        debouncedSaveInputValue(input);
    });
});

function restoreInputValues() {
    const savedValues = localStorage.getItem('inputValues');
    if (savedValues) {
        const inputValues = JSON.parse(savedValues);
        document.querySelectorAll('#tab2 input[type="range"], .color-picker-container input[type="color"]').forEach(input => {
            if (input.id in inputValues) {
                input.value = inputValues[input.id];
                // Trigger the input event for both sliders and color pickers
                setTimeout(() => {
                    input.dispatchEvent(new Event('input'));
                }, 100);
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', restoreInputValues);


document.getElementById('model-temperature').addEventListener('input', updateLabel);

function updateLabel() {
    const temperature = document.getElementById('model-temperature').value;
    document.getElementById('model-temperature-label').innerText = 'Temperature:\n ' + temperature;
}





function handleKeyDown(event) {
    if (event.key === 'Enter') {
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
            sendMessage(event);
        }
    }
    return true;
}

document.addEventListener('DOMContentLoaded', () => {
    const promptInput = document.getElementById('prompt');
    if (promptInput) {
        promptInput.addEventListener('keydown', handleKeyDown);
    }
});

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

    myCodeMirror.refresh();
}
        // Get the menu button and dropdown content elements
        const menuButton = document.querySelector(".menu-button");
        const dropdownContent = document.querySelector(".dropdown-content");
        const nodePanel = document.querySelector(".node-panel");


        // Get the first tabcontent element
        const firstTab = document.querySelector(".tabcontent");

        dropdownContent.addEventListener("paste", function (e) {
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
            nodePanel.classList.toggle("open");

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
            myCodeMirror.refresh();
        });


        dropdownContent.addEventListener("mousedown", (e) => {
            cancel(e);
        });

// Get all the menu items.
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

function getRenderWidthMult() {
    const sliderValue = parseFloat(document.getElementById("renderWidthMultSlider").value);

    let transformedValue;
    if (sliderValue <= 50) {
        // More granularity in lower range
        transformedValue = sliderValue / 5;
    } else {
        // Less granularity in higher range
        transformedValue = 10 + ((sliderValue - 50) * 2);
    }

    return transformedValue;
}
document.getElementById("renderWidthMultSlider").addEventListener("input", (e) => {
    let adjustedValue = getRenderWidthMult();
    setRenderWidthMult(adjustedValue);
    document.getElementById("renderWidthMultValue").textContent = adjustedValue.toFixed(2);
});

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
    let v = e.target.value * 1; // Convert to number
    mand_step = (z, c) => {
        return z.ipow(v).cadd(c);
    };
    document.getElementById("exponent_value").textContent = v;

    // Update maxDist based on exponent
    settings.maxDist = getMaxDistForExponent(v);
});


function getMaxDistForExponent(exponent) {
    const exponentToMaxDist = {
        1: 4,
        2: 4,
        3: 1.5,
        4: 1.25,
        5: 1,
        6: 1,
        7: 1,
        8: 1
    };

    return exponentToMaxDist[exponent] || 4; // default to 4 if no mapping found
}

document.addEventListener("DOMContentLoaded", function () {
    var inversionSlider = document.getElementById('inversion-slider');
    var hueRotationSlider = document.getElementById('hue-rotation-slider');
    var invertFilterDiv = document.getElementById('invert-filter');

    inversionSlider.addEventListener('input', function () {
        skipMidRangeInversion();
        updateFilters();
    });

    hueRotationSlider.addEventListener('input', function () {
        updateFilters();
    });

    function updateFilters() {
        var inversionValue = inversionSlider.value;
        var hueRotationValue = hueRotationSlider.value;
        var filterValue = `invert(${inversionValue}%) hue-rotate(${hueRotationValue}deg)`;

        // Check if both sliders are at zero
        if (inversionValue === "0" && hueRotationValue === "0") {
            invertFilterDiv.style.backdropFilter = ""; // Remove the filter
        } else {
            invertFilterDiv.style.backdropFilter = filterValue;
        }

        // Update all wrappers
        document.querySelectorAll('.image-video-wrapper').forEach(wrapper => {
            wrapper.style.backdropFilter = filterValue;
        });
    }

    function skipMidRangeInversion() {
        var value = parseInt(inversionSlider.value, 10);

        if (value === 50) {
            // Adjust this value to define how much to skip (e.g., 49 to 51)
            inversionSlider.value = inversionSlider.value > 49 ? 51 : 49;
        }
    }
});

// Function to update the flashlight strength and its display
function updateFlashlightStrength() {
    var strengthSlider = document.getElementById('flashlightStrength');
    flashlight_fraction = parseFloat(strengthSlider.value);
    document.getElementById('flashlightStrength_value').textContent = flashlight_fraction.toFixed(3);
}

// Function to update the flashlight radius and its display
function updateFlashlightRadius() {
    var radiusSlider = document.getElementById('flashlightRadius');
    flashlight_stdev = parseFloat(radiusSlider.value);
    document.getElementById('flashlightRadius_value').textContent = flashlight_stdev.toFixed(3);
}

// Adding event listeners to the sliders
document.getElementById('flashlightStrength').addEventListener('input', updateFlashlightStrength);
document.getElementById('flashlightRadius').addEventListener('input', updateFlashlightRadius);

// Function to trigger an input event on a slider
function triggerInputEvent(sliderId) {
    var event = new Event('input', {
        bubbles: true,
        cancelable: true,
    });
    var slider = document.getElementById(sliderId);
    slider.dispatchEvent(event);
}

// Setting the initial values of the sliders
document.getElementById('flashlightStrength').value = flashlight_fraction;
document.getElementById('flashlightRadius').value = flashlight_stdev;

// Triggering the input event to refresh the sliders and update the display
triggerInputEvent('flashlightStrength');
triggerInputEvent('flashlightRadius');

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

        //ai.js dropdown interaction
let MAX_CHUNK_SIZE = 400;

const maxChunkSizeSlider = document.getElementById('maxChunkSizeSlider');
const maxChunkSizeValue = document.getElementById('maxChunkSizeValue');

// Display the initial slider value
maxChunkSizeValue.textContent = maxChunkSizeSlider.value;

// Update the current slider value (each time you drag the slider handle)
maxChunkSizeSlider.oninput = function () {
    MAX_CHUNK_SIZE = this.value;
    maxChunkSizeValue.textContent = this.value;
}

let topN = 5;
const topNSlider = document.getElementById('topNSlider');
const topNValue = document.getElementById('topNValue');

topNSlider.addEventListener('input', function () {
    topN = this.value;
    topNValue.textContent = this.value;
});

function autoContextTokenSync(tokenSlider, contextSlider) {
    let lastUserSetRatio = parseInt(contextSlider.value, 10) / parseInt(contextSlider.max, 10);
    let isProgrammaticChange = false;

    // Listen to changes on tokenSlider
    tokenSlider.addEventListener('input', function () {
        const newMaxTokens = parseInt(this.value, 10);
        contextSlider.max = newMaxTokens;

        // Calculate the new value based on the last user-set ratio and the new max
        const newContextValue = Math.round(lastUserSetRatio * newMaxTokens);

        // Make the change and indicate that it's a programmatic change
        isProgrammaticChange = true;
        contextSlider.value = newContextValue;
        isProgrammaticChange = false;

        // Force a UI update for contextSlider
        contextSlider.dispatchEvent(new Event('input'));
    });

    // Listen to changes on contextSlider
    contextSlider.addEventListener('input', function () {
        // Update the last user-set ratio, but only if the change was not programmatic
        if (!isProgrammaticChange) {
            lastUserSetRatio = parseInt(this.value, 10) / parseInt(this.max, 10);
        }
    });
}

// Usage
const maxTokensSlider = document.getElementById('max-tokens-slider');
const maxContextSizeSlider = document.getElementById('max-context-size-slider');

autoContextTokenSync(maxTokensSlider, maxContextSizeSlider);

// UI updates for max tokens
const maxTokensDisplay = document.getElementById('max-tokens-display');
maxTokensSlider.addEventListener('input', function () {
    maxTokensDisplay.innerText = this.value;
});

// UI updates for max context size
const maxContextSizeDisplay = document.getElementById('max-context-size-display');
maxContextSizeSlider.addEventListener('input', function () {
    const maxContextValue = parseInt(this.value, 10);
    const maxContextMax = parseInt(this.max, 10);
    const ratio = Math.round((maxContextValue / maxContextMax) * 100);
    maxContextSizeDisplay.innerText = `Context: ${ratio}% \n(${maxContextValue} tokens)`;
});

maxContextSizeSlider.dispatchEvent(new Event('input'));

function updateLoadingIcon(percentage) {
    const loaderFills = document.querySelectorAll('.loader-fill');

    loaderFills.forEach(loaderFill => {
        // Set a timeout to remove the initial animation class after 8 seconds
        setTimeout(() => {
            loaderFill.classList.remove('initial-animation');
        }, 8000); // 8000 milliseconds = 8 seconds

        // Scale from 0 to 1 based on the percentage
        const scale = percentage / 100;
        loaderFill.style.transform = `translate(-50%, -50%) scale(${scale})`;
    });
}