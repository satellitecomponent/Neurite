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
    //console.log("Opened Modal:", contentId);

    // Clear filepath input from header.
    const existingInput = document.querySelector('.modal-filepath-input');
    if (existingInput) existingInput.remove();

    const content = Elem.byId(contentId);
    if (!content) {
        console.error("No content found for ID:", contentId);
        return;
    }

    const modalBody = Modal.div.querySelector('.modal-body');
    if (!modalBody) {
        console.error("Modal body element is missing");
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

        const onChange = storeInputValue.bind(null, select, contentId);
        select.addEventListener('change', onChange);
    });

    const modalSliders = modalBody.querySelectorAll('input[type=range]');
    modalSliders.forEach(Modal.setupSlider, modal);

    const modalInputs = modalBody.querySelectorAll('input:not([type=range]), textarea');
    modalInputs.forEach(Modal.setupInput, modal);
}
Modal.setupSlider = function(slider){
    setSliderBackground(slider);

    const stored = Modal.inputValues[slider.id];
    if (stored !== undefined) {
        slider.value = stored;
        setSliderBackground(slider);
    }

    slider.addEventListener('input', Modal.onSliderInput.bind(this, slider));
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

    const onInput = Modal.storeInputValue.bind(null, input, this.id);
    input.addEventListener('input', onInput);
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
                window.currentVectorDbImportReject(new Error('User cancelled the operation'));
                window.currentVectorDbImportReject = null;
            }
            break;
        default:
            break;
    }
    Modal.div.style.display = 'none';
    Modal.current = null;
}

Modal.btnClose.addEventListener('click', Modal.close);

Modal.openOverlay = function(explanationId){
    const explanationContent = Elem.byId(explanationId);
    if (!explanationContent) {
        console.error("No explanation found for ID:", explanationId);
        return;
    }

    Modal.overlayBody.innerHTML = explanationContent.innerHTML;
    Modal.overlay.style.display = 'block';
}

Modal.closeOverlay = function(){
    Modal.overlay.style.display = 'none';
    Modal.overlayBody.innerHTML = '';
}
Modal.overlayCloseBtn.addEventListener('click', Modal.closeOverlay);



Modal.massAddHandler = function(div, handler){
    div.addEventListener('click', handler);
    div.addEventListener('dblclick', handler);
    div.addEventListener('mousedown', handler);
    div.addEventListener('touchstart', handler);
    div.addEventListener('touchend', handler);
    div.addEventListener('wheel', handler);
    div.addEventListener('dragstart', handler);
    div.addEventListener('drag', handler);
    div.addEventListener('drop', handler);
}
// prevent all events from passing through the modal content
Modal.massAddHandler(Modal.content, stopEventPropagation);

function stopEventPropagation(event){
    event.stopPropagation()
}

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

Modal.content.addEventListener('mousedown', Modal.startDragging);
document.addEventListener('mousemove', Modal.dragContent);
document.addEventListener('mouseup', Modal.stopDragging);
