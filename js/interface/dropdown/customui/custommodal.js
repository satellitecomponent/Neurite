const Modals = {
    aiModal: new Modal('aiModal', "Experimental Ai Controls"),
    apiConfigModalContent: new Modal('apiConfigModalContent', "Custom Endpoint"),
    "controls-modal": new Modal('controls-modal'),
    fileTreeModal: new Modal('fileTreeModal'),
    importLinkModalContent: new Modal('importLinkModalContent', "Import"),
    nodeConnectionModal: new Modal('nodeConnectionModal', "Connect Notes"),
    noteModal: new Modal('noteModal', "Zettelkasten Settings", Tag.initializeInputs),
    ollamaManagerModal: new Modal('ollamaManagerModal', "Ollama Library"),
    promptLibraryModalContent: new Modal('promptLibraryModalContent', "Prompt Library"),
    vectorDbImportConfirmModal: new Modal('vectorDbImportConfirmModal', "Confirm Vector DB Import"), // , setupVectorDbImportConfirmModal
    vectorDbModal: new Modal('vectorDbModal', "Vector Database"),
    vectorDbSearchModal: new Modal('vectorDbSearchModal', "Search Vector-DB"),
    zetSearchModal: new Modal('zetSearchModal', "Search Notes")
}

Modal.btnClose = Modal.div.querySelector('.close');
Modal.content = Modal.div.querySelector('.modal-content');
Modal.overlay = Modal.div.querySelector('.modal-overlay');
Modal.overlayCloseBtn = Modal.div.querySelector('.modal-overlay-close');
Modal.overlayBody = Modal.div.querySelector('.modal-overlay-body');

Modal.storeInputValue = debounce(function (input, contentId) {
    Modal.inputValues[input.id] = (input.type === 'checkbox' ? input.checked : input.value);
    localStorage.setItem('modalInputValues', JSON.stringify(Modal.inputValues));

    // modal-specific actions
    if (contentId === 'noteModal') updatePathOptions();
}, 100);

Modal.open = function(contentId){
    ContextMenu.hide();
    Logger.debug("Opened Modal:", contentId);

    // Clear filepath input from header.
    const existingInput = document.querySelector('.modal-filepath-input');
    if (existingInput) existingInput.remove();

    const content = Elem.byId(contentId);
    if (!content) {
        Logger.err("No content found for ID:", contentId);
        return;
    }

    const modalBody = Modal.div.querySelector('.modal-body');
    if (!modalBody) {
        Logger.err("Modal body element is missing");
        return;
    }

    modalBody.innerHTML = content.innerHTML;

    const modal = Modals[contentId];
    const modalTitle = Modal.div.querySelector('.modal-title');
    modalTitle.textContent = modal?.title || '';
    if (modal.init) modal.init();

    Modal.current = modal;
    Modal.div.style.display = 'flex';

    const storeInputValue = Modal.storeInputValue;

    modalBody.querySelectorAll('select.custom-select').forEach(select => {
        CustomDropdown.setupModelSelect(select);

        const stored = Modal.inputValues[select.id];
        if (stored !== undefined) select.value = stored;

        On.change(select, storeInputValue.bind(null, select, contentId));
    });

    const modalSliders = modalBody.querySelectorAll('input[type=range]');
    modalSliders.forEach(Modal.setupSlider, modal);

    const modalInputs = modalBody.querySelectorAll('input:not([type=range]), textarea');
    modalInputs.forEach(Modal.setupInput, modal);
}
Modal.setupSlider = function(slider){
    const stored = Modal.inputValues[slider.id];
    if (stored !== undefined) slider.value = stored;

    setSliderBackground(slider);
    On.input(slider, Modal.onSliderInput.bind(this, slider));
}
Modal.onSliderInput = function(slider, e){
    setSliderBackground(slider);
    Modal.storeInputValue(slider, this.id);
}
Modal.setupInput = function(input){
    if (input.type === 'file') return;

    const stored = Modal.inputValues[input.id];
    if (stored !== undefined) {
        const attr = (input.type === 'checkbox' ? 'checked' : 'value');
        input[attr] = stored;
    }

    On.input(input, Modal.storeInputValue.bind(null, input, this.id));
}

Modal.getInputValue = function(modalId, itemId, defaultValue = true) {
    return Modal.inputValues[itemId] ?? defaultValue;
}
Modal.getAiInputValue = Modal.getInputValue.bind(Modal, 'aiModal');

Modal.close = function(){
    switch (Modal.current.id) {
        case 'zetSearchModal':
        case 'nodeConnectionModal':
            Graph.nodes.forEach(clearSearchHighlight);
            break;
        case 'vectorDbImportConfirmModal':
            if (window.currentVectorDbImportReject) {
                window.currentVectorDbImportReject(new Error("User cancelled the operation"));
                window.currentVectorDbImportReject = null;
            }
            break;
        default:
            break;
    }
    Modal.div.style.display = 'none';
    Modal.current = null;
}

On.click(Modal.btnClose, Modal.close);

Modal.openOverlay = function(explanationId){
    const explanationContent = Elem.byId(explanationId);
    if (!explanationContent) {
        Logger.err("No explanation found for ID:", explanationId);
        return;
    }

    Modal.overlayBody.innerHTML = explanationContent.innerHTML;
    Modal.overlay.style.display = 'block';
}

Modal.closeOverlay = function(){
    Modal.overlay.style.display = 'none';
    Modal.overlayBody.innerHTML = '';
}
On.click(Modal.overlayCloseBtn, Modal.closeOverlay);



[
    'click', 'dblclick', 'mousedown', 'touchstart',
    'touchend', 'wheel', 'dragstart', 'drag', 'drop'
].forEach(Event.stopPropagationByNameForThis, Modal.content);

Modal.startDragging = function(e){
    if (isInputElement(e.target)) return;

    Modal.isDragging = true;
    Modal.mouseOffsetX = e.clientX - Modal.div.offsetLeft;
    Modal.mouseOffsetY = e.clientY - Modal.div.offsetTop;
}
function isInputElement(element) {
    const inputTypes = ['input', 'select', 'textarea', 'button'];
    return inputTypes.includes(element.tagName.toLowerCase()) ||
        element.classList.contains('custom-select') ||
        element.closest('.vdb-search-result') ||
        element.closest('#modal-file-tree-container'); // Added condition
}

Modal.dragContent = function(e){
    if (!Modal.isDragging) return;

    e.preventDefault();
    Modal.div.style.left = (e.clientX - Modal.mouseOffsetX) + 'px';
    Modal.div.style.top = (e.clientY - Modal.mouseOffsetY) + 'px';
}
Modal.stopDragging = function(){
    Modal.isDragging = false;
}

On.mousedown(Modal.content, Modal.startDragging);
On.mousemove(document, Modal.dragContent);
On.mouseup(document, Modal.stopDragging);
