function handleKeyDown(event) {
    if (event.key === 'Enter') {
        if (event.shiftKey) {
            // Shift + Enter was pressed, insert a newline
            event.preventDefault();
            // insert a newline at the cursor
            const cursorPosition = event.target.selectionStart;
            event.target.value = event.target.value.substring(0, cursorPosition) + '\n' + event.target.value.substring(cursorPosition);
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


const promptInput = Elem.byId('prompt');
if (promptInput) On.keydown(promptInput, handleKeyDown);


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

let maxWidth, maxHeight;

function updateMaxDimensions() {
    maxWidth = window.innerWidth * 0.9;
    maxHeight = window.innerHeight * 0.7;
}

updateMaxDimensions();
On.resize(window, updateMaxDimensions);

// Horizontal drag handle
let zetHorizDragHandle = Elem.byId('zetHorizDragHandle');
let zetIsHorizResizing = false;
let initialX;
let initialWidth;

On.mousedown(zetHorizDragHandle, (e)=>{
    updateMaxDimensions(); // Update dimensions at the start of each drag
    zetIsHorizResizing = true;
    initialX = e.clientX;
    initialWidth = zetPanes.container.offsetWidth;

    // Prevent text selection while resizing
    document.body.style.userSelect = 'none';
    On.mousemove(document, zetHandleHorizMouseMove);
    On.mouseup(document, (e)=>{
        zetIsHorizResizing = false;
        // Enable text selection again after resizing
        document.body.style.userSelect = '';
        Off.mousemove(document, zetHandleHorizMouseMove);
    });
});

function zetHandleHorizMouseMove(event) {
    if (zetIsHorizResizing) {
        requestAnimationFrame(() => {
            // Calculate the difference in the x position
            const dx = event.clientX - initialX;
            const newWidth = initialWidth - dx;

            // Update the width if within the boundaries
            if (newWidth > 50 && newWidth <= maxWidth) {
                zetPanes.container.style.width = newWidth + 'px';
            }
        });
    }
}

// Vertical drag handle
let zetVertDragHandle = Elem.byId('zetVertDragHandle');
let zetIsVertResizing = false;
let initialY;
let initialHeight;

On.mousedown(zetVertDragHandle, (e)=>{
    updateMaxDimensions(); // Update dimensions at the start of each drag
    zetIsVertResizing = true;
    initialY = e.clientY;
    initialHeight = zetPanes.container.offsetHeight;

    // Prevent text selection while resizing
    document.body.style.userSelect = 'none';
    On.mousemove(document, zetHandleVertMouseMove);
    On.mouseup(document, (e)=>{
        zetIsVertResizing = false;
        // Enable text selection again after resizing
        document.body.style.userSelect = '';
        Off.mousemove(document, zetHandleVertMouseMove);
    });
});

function zetHandleVertMouseMove(event) {
    if (zetIsVertResizing) {
        requestAnimationFrame(() => {
            // Calculate the difference in the y position
            const dy = event.clientY - initialY;
            const newHeight = initialHeight + dy;

            // Update the height if within the boundaries
            if (newHeight > 50 && newHeight <= maxHeight) {
                zetPanes.container.style.height = newHeight + 'px';
            }
        });
    }
}

window.codeMirrorInstances = window.codeMirrorInstances || [];
window.zettelkastenParsers = window.zettelkastenParsers || [];
window.zettelkastenUIs = window.zettelkastenUIs || [];
window.zettelkastenProcessors = window.zettelkastenProcessors || [];
window.currentActiveZettelkastenMirror = null;

class ZetPanes {
    constructor(container) {
        this.container = container;
        this.paneDropdown = container.querySelector('#zetPaneDropdown');
        this.paneContent = document.querySelector('.zet-pane-content');
        this.addPaneButton = container.querySelector('.zet-add-pane-button');
        this.deletePaneButton = container.querySelector('.zet-delete-pane-button');
        this.paneCounter = 1;

        CustomDropdown.setupHtmlOptions(this.paneDropdown, createZetContainerDropdown, false);

        // + and X buttons
        On.click(this.addPaneButton, this.addPane.bind(this));
        On.click(this.deletePaneButton, this.removeSelectedPane.bind(this));

        On.change(this.paneDropdown, () => this.switchPane(this.paneDropdown.value));

        this.searchButton = container.querySelector('#notesSearchButton');
        On.click(this.searchButton, this.openSearchModal.bind(this));

        this.addPane();
    }

    addPane() {
        const paneId = 'zet-pane-' + this.paneCounter;
        const paneName = 'Archive ' + this.paneCounter;
        const pane = this.createPane(paneId, paneName);

        CustomDropdown.addHtmlOption(this.paneDropdown, { text: paneName, value: paneId }, createZetContainerDropdown);
        this.paneContent.appendChild(pane);
        this.switchPane(paneId);

        this.paneCounter += 1;
    }

    createPane(paneId, paneName) {
        const pane = Html.make.div('zet-pane');
        pane.id = paneId;
        pane.setAttribute('data-pane-name', paneName);

        const textarea = Html.make.textarea('zet-zettelkasten');
        textarea.id = 'zet-note-input-' + this.paneCounter;
        textarea.rows = 10;
        textarea.cols = 50;
        pane.appendChild(textarea);

        const cm = CodeMirror.fromTextArea(textarea, {
            lineWrapping: true,
            scrollbarStyle: 'simple',
            theme: 'default',
            mode: 'custom',
            virtualRendering: true,
        });

        const zettelkastenParser = new ZettelkastenParser(cm);
        zettelkastenParser.updateMode(); // Update the mode

        const zettelkastenUI = new ZettelkastenUI(cm, textarea, zettelkastenParser);

        const zettelkastenProcessor = new ZettelkastenProcessor(cm, zettelkastenParser);
        updatePathOptions(zettelkastenProcessor); // Update the placement path only for the new processor

        window.codeMirrorInstances.push(cm);
        window.zettelkastenParsers.push(zettelkastenParser);
        window.zettelkastenUIs.push(zettelkastenUI);
        window.zettelkastenProcessors.push(zettelkastenProcessor);

        return pane;
    }

    switchPane(paneId) {
        const panes = this.paneContent.querySelectorAll('.zet-pane');

        panes.forEach(pane => {
            if (pane.id === paneId) {
                pane.classList.add('active');
                const textareaId = pane.querySelector('.zet-zettelkasten').id;
                const cm = window.codeMirrorInstances.find(
                    (instance)=>(instance.getTextArea().id === textareaId)
                );

                window.currentActiveZettelkastenMirror = cm;

                if (cm) {
                    cm.refresh();
                } else {
                    Logger.err("CodeMirror instance not found for the active pane.")
                }

                this.paneDropdown.value = paneId;
                Select.updateSelectedOption(this.paneDropdown);
            } else {
                pane.classList.remove('active');
            }
        });
    }

    removeSelectedPane() {
        const selectedPaneId = this.paneDropdown.value;
        if (selectedPaneId) {
            const selectedPaneName = this.getPaneName(selectedPaneId);
            if (this.paneDropdown.options.length === 1) {
                return;
            } else {
                window.confirm(`Delete the slip-box "${selectedPaneName}"?`)
                    .then((confirmDelete) => {
                        if (confirmDelete) {
                            this.removePane(selectedPaneId);
                        }
                    })
                    .catch((error) => {
                        console.error("Confirmation failed:", error);
                    });
            }
        }
    }

    getPaneName(paneId) {
        const pane = this.paneContent.querySelector('#' + paneId);
        return (pane) ? pane.getAttribute('data-pane-name') : '';
    }

    removePane(paneId) {
        const pane = this.paneContent.querySelector('#' + paneId);
        if (!pane) return;

        const id = 'zet-note-input-' + paneId.replace('zet-pane-', '');
        const cm = window.codeMirrorInstances.find(
            (instance)=>(instance.getTextArea().id === id)
        );

        if (cm) {
            cm.setValue('');
            cm.clearHistory();
            // Remove the CodeMirror instance from the array
            window.codeMirrorInstances = window.codeMirrorInstances.filter(instance => instance !== cm);
        }

        pane.remove();

        const paneDropdown = this.paneDropdown;
        const option = paneDropdown.querySelector(`option[value="${paneId}"]`);
        if (option) {
            const currentIndex = Array.from(paneDropdown.options).indexOf(option);
            option.remove();
            refreshHtmlDropdownDisplay(paneDropdown, createZetContainerDropdown);

            if (paneDropdown.options.length > 0) {
                const newIndex = (currentIndex >= paneDropdown.options.length ? currentIndex - 1 : currentIndex);
                const newPaneId = paneDropdown.options[newIndex].value;
                this.switchPane(newPaneId);
            }
        }
    }

    resetAllPanes() {
        // Remove all panes
        this.paneContent.querySelectorAll('.zet-pane').forEach(pane => {
            this.removePane(pane.id)
        });
        this.paneCounter = 1; // Reset pane counter
    }

    restorePane(paneName, paneContent) {
        const paneId = `zet-pane-${this.paneCounter}`;
        const pane = this.createPane(paneId, paneName);

        CustomDropdown.addHtmlOption(this.paneDropdown, { text: paneName, value: paneId }, createZetContainerDropdown);
        this.paneContent.appendChild(pane);
        this.switchPane(paneId);

        processAll = true;
        restoreZettelkastenEvent = true;

        window.codeMirrorInstances[window.codeMirrorInstances.length - 1].setValue(paneContent);

        this.paneCounter += 1;
    }

    getActiveTextarea() {
        const activeCodeMirror = window.currentActiveZettelkastenMirror;
        if (!activeCodeMirror) return;

        const textareas = this.paneContent.querySelectorAll('textarea');
        for (const textarea of textareas) {
            if (activeCodeMirror.getTextArea() === textarea) return textarea;
        }
    }

    openSearchModal() {
        Modal.open('zetSearchModal');
        setupZettelkastenSearchBar();
        performZettelkastenSearch(Elem.byId('Searchbar').value);
    }
}

const zetPanes = new ZetPanes(Elem.byId('zetPaneContainer'));
