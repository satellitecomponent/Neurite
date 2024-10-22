// Event listener to open the modal
Elem.byId('controls-button').addEventListener('click', openControlsModal);

// Load controls from local storage or set to default values
function loadControls() {
    const storedControls = localStorage.getItem('controls');
    if (!storedControls) return;

    const parsedControls = JSON.parse(storedControls);
    // Merge stored controls with defaults
    for (const key in controls) {
        if (parsedControls[key]) {
            controls[key].value = parsedControls[key].value;
        }
    }
}

function saveControls() {
    localStorage.setItem('controls', JSON.stringify(controls));
}

function updateMouseButtons() {
    mousePanButton = settings.panClick;
    mouseZoomButton = settings.zoomClick;
}

function openControlsModal() {
    Modal.open('controls-modal');
    initializeKeyInputs();

    const altKeyChange = prepareForKeyChange.bind(null, 'altKey');
    Elem.byId('altKeyInput').addEventListener('click', altKeyChange);

    const shiftKeyChange = prepareForKeyChange.bind(null, 'shiftKey');
    Elem.byId('shiftKeyInput').addEventListener('click', shiftKeyChange);

    CustomDropdown.setup(Elem.byId('zoomClickSelect'));
    CustomDropdown.setup(Elem.byId('panClickSelect'));
    CustomDropdown.setup(Elem.byId('contextMenuButtonSelect'));

    Elem.byId('zoomClickSelect').addEventListener('change', function () {
        controls.zoomClick.value = this.value === "scroll" ? "scroll" : parseInt(this.value);
        updateSettingsFromControls();
    });

    Elem.byId('panClickSelect').addEventListener('change', function () {
        controls.panClick.value = parseInt(this.value);
        updateSettingsFromControls();
    });

    Elem.byId('contextMenuButtonSelect').addEventListener('change', function () {
        controls.contextMenuButton.value = parseInt(this.value);
        updateSettingsFromControls();
    });

    setupExplanationButtons();
}
function setupExplanationButtons() { // within the modal
    Modal.div.querySelectorAll('.question-button').forEach(button => {
        button.addEventListener('click', onExplanationButtonClicked)
    });
}
function onExplanationButtonClicked(e){
    const explanationId = this.getAttribute('data-explanation-id');
    Modal.openOverlay(explanationId);
    // Update the placeholders with current settings
    populateControlsExplanationPlaceholders(explanationId);
}

function initializeKeyInputs() {
    Elem.byId('altKeyInput').innerText = controls.altKey.value || controls.altKey.default;
    Elem.byId('shiftKeyInput').innerText = controls.shiftKey.value || controls.shiftKey.default;

    Elem.byId('zoomClickSelect').value = controls.zoomClick.value;
    Elem.byId('panClickSelect').value = controls.panClick.value;
    Elem.byId('contextMenuButtonSelect').value = controls.contextMenuButton.value;
}

function updateSettingsFromControls() {
    settings.nodeModeKey = controls.shiftKey.value;
    settings.rotateModifier = controls.altKey.value;
    settings.zoomClick = controls.zoomClick.value;
    settings.panClick = controls.panClick.value;
    settings.contextKey = controls.contextMenuButton.value; // Add this line
    updateMouseButtons(); // Update event listener variables
    saveControls();
}

document.addEventListener('DOMContentLoaded', function () {
    loadControls();
    updateSettingsFromControls();
});

function prepareForKeyChange(key) {
    // Clear the current key display when the user clicks to change the key
    Elem.byId(key + 'Input').innerText = "Press a key...";

    // Listen for the next key press
    setNewKey(key);
}
function setNewKey(key) {
    function handler(e) {
        controls[key].value = e.key;
        Elem.byId(key + 'Input').innerText = e.key;

        updateSettingsFromControls();
        document.removeEventListener('keydown', handler);
    }
    document.addEventListener('keydown', handler);
}

function populateControlsExplanationPlaceholders() {
    const explanationContent = Modal.overlayBody.innerHTML;

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

        return control.value || control.default;
    });

    Modal.overlayBody.innerHTML = updatedContent;
}

function getMouseButtonName(value) {
    if (value === undefined || value === null) return 'Unknown';
    return Mouse.buttonNameFromValue[value.toString()] ?? 'Unknown';
}

function getZoomSettingName(value) {
    return (value === 'scroll' ? 'Scroll Wheel' : getMouseButtonName(value))
}
