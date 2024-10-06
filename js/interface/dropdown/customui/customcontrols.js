// Event listener to open the modal
document.getElementById("controls-button").addEventListener("click", openControlsModal);

// Load controls from local storage or set to default values
function loadControls() {
    const storedControls = localStorage.getItem('controls');
    if (storedControls) {
        const parsedControls = JSON.parse(storedControls);
        // Merge stored controls with defaults
        for (let key in controls) {
            if (parsedControls[key]) {
                controls[key].value = parsedControls[key].value;
            }
        }
    }
}

function saveControls() {
    localStorage.setItem('controls', JSON.stringify(controls));
}

// Function to update mouse button settings
function updateMouseButtons() {
    mousePanButton = settings.panClick;
    mouseZoomButton = settings.zoomClick;
}

// Function to open the controls modal
function openControlsModal() {
    // Ensure the modal is opened, then initialize the key inputs to reflect current controls
    openModal("controls-modal");

    // Initialize key inputs
    initializeKeyInputs();

    // Set up event listeners for key inputs
    document.getElementById('altKeyInput').addEventListener('click', function () {
        prepareForKeyChange('altKey');
    });

    document.getElementById('shiftKeyInput').addEventListener('click', function () {
        prepareForKeyChange('shiftKey');
    });

    // Set up custom dropdowns for zoom and pan controls
    setupCustomDropdown(document.getElementById('zoomClickSelect'));
    setupCustomDropdown(document.getElementById('panClickSelect'));
    setupCustomDropdown(document.getElementById('contextMenuButtonSelect'));

    // Set up change listeners for dropdown changes
    document.getElementById('zoomClickSelect').addEventListener('change', function () {
        controls.zoomClick.value = this.value === "scroll" ? "scroll" : parseInt(this.value);
        updateSettingsFromControls();
    });

    document.getElementById('panClickSelect').addEventListener('change', function () {
        controls.panClick.value = parseInt(this.value);
        updateSettingsFromControls();
    });

    document.getElementById('contextMenuButtonSelect').addEventListener('change', function () {
        controls.contextMenuButton.value = parseInt(this.value);
        updateSettingsFromControls();
    });

    // Set up event listeners for explanation buttons
    setupExplanationButtons();
}

// Function to set up explanation buttons within the modal
function setupExplanationButtons() {
    const explanationButtons = modal.querySelectorAll('.question-button');
    explanationButtons.forEach(button => {
        button.addEventListener('click', function () {
            const explanationId = this.getAttribute('data-explanation-id');
            openModalOverlay(explanationId);
            // Update the placeholders with current settings
            populateControlsExplanationPlaceholders(explanationId);
        });
    });
}

// Function to initialize key inputs
function initializeKeyInputs() {
    // Set the text of the buttons to the current key values from the controls object
    document.getElementById('altKeyInput').innerText = controls.altKey.value || controls.altKey.default;
    document.getElementById('shiftKeyInput').innerText = controls.shiftKey.value || controls.shiftKey.default;

    // Set the selected value of the custom dropdowns for zoom and pan click settings
    document.getElementById('zoomClickSelect').value = controls.zoomClick.value;
    document.getElementById('panClickSelect').value = controls.panClick.value;
    document.getElementById('contextMenuButtonSelect').value = controls.contextMenuButton.value;
}


// Function to update settings from controls
function updateSettingsFromControls() {
    settings.nodeModeKey = controls.shiftKey.value;
    settings.rotateModifier = controls.altKey.value;
    settings.zoomClick = controls.zoomClick.value;
    settings.panClick = controls.panClick.value;
    settings.contextKey = controls.contextMenuButton.value; // Add this line
    updateMouseButtons(); // Update event listener variables
    saveControls(); // Save updated controls to local storage
}

document.addEventListener('DOMContentLoaded', function () {
    // Load controls from local storage
    loadControls();
    updateSettingsFromControls();
});

// Function to handle key changes
function prepareForKeyChange(key) {
    // Clear the current key display when the user clicks to change the key
    document.getElementById(`${key}Input`).innerText = "Press a key...";

    // Listen for the next key press
    setNewKey(key);
}

function setNewKey(key) {
    function handler(e) {
        // Update the controls object with the new key
        controls[key].value = e.key;

        // Update the UI to show the new key value
        document.getElementById(`${key}Input`).innerText = e.key;

        // Update the settings object based on the new controls value
        updateSettingsFromControls();

        // Remove the keydown listener after setting the new key
        document.removeEventListener('keydown', handler);
    }

    document.addEventListener('keydown', handler);
}

function populateControlsExplanationPlaceholders() {
    const explanationContent = modalOverlayBody.innerHTML;

    // Replace any placeholders like {{shiftKey}}, {{altKey}}, etc. with current control values
    const updatedContent = explanationContent.replace(/{{(.*?)}}/g, (match, controlKey) => {
        const control = controls[controlKey.trim()];
        if (!control) return 'Unknown';

        // Check if the control value needs to be translated into mouse button names or zoom settings
        if (controlKey.trim() === 'panClick' || controlKey.trim() === 'contextMenuButton') {
            return getMouseButtonName(control.value || control.default);
        } else if (controlKey.trim() === 'zoomClick') {
            return getZoomSettingName(control.value || control.default);
        }

        // Return the control value or default for other keys
        return control.value || control.default;
    });

    // Set the updated content back into the modal body
    modalOverlayBody.innerHTML = updatedContent;
}

function getMouseButtonName(value) {
    if (value === undefined || value === null) {
        return 'Unknown'; // Handle missing or undefined values
    }

    switch (value.toString()) { // Convert to string to handle numeric and string cases
        case '0':
            return 'Left Click';
        case '1':
            return 'Middle Click';
        case '2':
            return 'Right Click';
        case 'scroll':
            return 'Scroll Wheel';
        default:
            return 'Unknown'; // Catch-all case for unrecognized values
    }
}

// Helper function to get zoom setting name based on value
function getZoomSettingName(value) {
    if (value === 'scroll') {
        return 'Scroll Wheel';
    } else {
        return getMouseButtonName(value);
    }
}