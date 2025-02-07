// Event listener to open the modal
On.click(Elem.byId('controls-button'), openControlsModal);

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
    const modal = initializeKeyInputs();

    const altKeyChange = prepareForKeyChange.bind(null, 'altKey');
    On.click(Elem.byId('altKeyInput'), altKeyChange);

    const shiftKeyChange = prepareForKeyChange.bind(null, 'shiftKey');
    On.click(Elem.byId('shiftKeyInput'), shiftKeyChange);

    CustomDropdown.setup(modal.zoomClickSelect);
    CustomDropdown.setup(modal.panClickSelect);
    CustomDropdown.setup(modal.contextMenuButtonSelect);

    On.change(modal.zoomClickSelect, (e)=>{
        const value = modal.zoomClickSelect.value;
        controls.zoomClick.value = (value === "scroll" ? "scroll" : parseInt(value));
        updateSettingsFromControls();
    });

    On.change(modal.panClickSelect, (e)=>{
        controls.panClick.value = parseInt(modal.panClickSelect.value);
        updateSettingsFromControls();
    });

    On.change(modal.contextMenuButtonSelect, (e)=>{
        controls.contextMenuButton.value = parseInt(modal.contextMenuButtonSelect.value);
        updateSettingsFromControls();
    });

    setupExplanationButtons();
}
function setupExplanationButtons() { // within the modal
    Modal.div.querySelectorAll('.question-button').forEach(
        (button)=>On.click(button, onExplanationButtonClicked)
    );
}
function onExplanationButtonClicked(e){
    const explanationId = this.dataset.explanationId;
    Modal.openOverlay(explanationId);
    // Update the placeholders with current settings
    populateControlsExplanationPlaceholders(explanationId);
}

function initializeKeyInputs() {
    const modal = {
        altKeyInput: Elem.byId('altKeyInput'),
        shiftKeyInput: Elem.byId('shiftKeyInput'),
        zoomClickSelect: Elem.byId('zoomClickSelect'),
        panClickSelect: Elem.byId('panClickSelect'),
        contextMenuButtonSelect: Elem.byId('contextMenuButtonSelect')
    }

    modal.altKeyInput.innerText = controls.altKey.value || controls.altKey.default;
    modal.shiftKeyInput.innerText = controls.shiftKey.value || controls.shiftKey.default;

    modal.zoomClickSelect.value = controls.zoomClick.value;
    modal.panClickSelect.value = controls.panClick.value;
    modal.contextMenuButtonSelect.value = controls.contextMenuButton.value;

    return modal;
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

On.DOMContentLoaded(document, (e)=>{
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
    function handler(e){
        controls[key].value = e.key;
        Elem.byId(key + 'Input').innerText = e.key;

        updateSettingsFromControls();
        Off.keydown(document, handler);
    }
    On.keydown(document, handler);
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
