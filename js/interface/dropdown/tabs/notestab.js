
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
    let zetPaneContainer = document.getElementById("zetPaneContainer");
    initialWidth = zetPaneContainer.offsetWidth;

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
            let zetPaneContainer = document.getElementById("zetPaneContainer");
            let newWidth = initialWidth - dx;

            // Update the width if within the boundaries
            if (newWidth > 50 && newWidth <= maxWidth) {
                zetPaneContainer.style.width = newWidth + "px";
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
    let zetPaneContainer = document.getElementById("zetPaneContainer");
    initialHeight = zetPaneContainer.offsetHeight;

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
            let zetPaneContainer = document.getElementById("zetPaneContainer");
            let newHeight = initialHeight + dy;

            // Update the height if within the boundaries
            if (newHeight > 50 && newHeight <= maxHeight) {
                zetPaneContainer.style.height = newHeight + "px";
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
        this.paneDropdown = this.container.querySelector('#zetPaneDropdown');
        this.paneContent = document.querySelector('.zet-pane-content');
        this.addPaneButton = this.container.querySelector('.zet-add-pane-button');
        this.deletePaneButton = this.container.querySelector('.zet-delete-pane-button');
        this.paneCounter = 1;

        setupHtmlOptionsCustomDropdown(this.paneDropdown, createZetContainerDropdown, false);

        // + and X buttons
        this.addPaneButton.addEventListener('click', () => this.addPane());
        this.deletePaneButton.addEventListener('click', () => this.removeSelectedPane());

        this.paneDropdown.addEventListener('change', () => this.switchPane(this.paneDropdown.value));

        // Add event listener for the search button
        this.searchButton = this.container.querySelector('#notesSearchButton');
        this.searchButton.addEventListener('click', () => this.openSearchModal());

        this.addPane();
    }

    addPane() {
        const paneId = `zet-pane-${this.paneCounter}`;
        const paneName = `Archive ${this.paneCounter}`;
        const pane = this.createPane(paneId, paneName);

        addHtmlOptionToCustomDropdown(this.paneDropdown, { text: paneName, value: paneId }, createZetContainerDropdown);
        this.paneContent.appendChild(pane);
        this.switchPane(paneId);

        this.paneCounter++;
    }


    createPane(paneId, paneName) {
        const pane = document.createElement('div');
        pane.id = paneId;
        pane.classList.add('zet-pane');
        pane.setAttribute('data-pane-name', paneName);

        const textareaId = `zet-note-input-${this.paneCounter}`;
        const textareaClass = 'zet-zettelkasten';
        const textarea = document.createElement('textarea');
        textarea.id = textareaId;
        textarea.classList.add(textareaClass);
        textarea.rows = 10;
        textarea.cols = 50;
        pane.appendChild(textarea);

        // Create CodeMirror instance
        const cmInstance = CodeMirror.fromTextArea(textarea, {
            lineWrapping: true,
            scrollbarStyle: 'simple',
            theme: 'default',
            mode: 'custom', // Set the mode to 'custom'
            virtualRendering: true, // Enable virtual rendering
        });

        // Create ZettelkastenParser instance
        const zettelkastenParser = new ZettelkastenParser(cmInstance);
        zettelkastenParser.updateMode(); // Update the mode

        // Create ZettelkastenUI instance
        const zettelkastenUI = new ZettelkastenUI(cmInstance, textarea, zettelkastenParser);

        // Create ZettelkastenProcessor instance
        const zettelkastenProcessor = new ZettelkastenProcessor(cmInstance, zettelkastenParser);
        updatePathOptions(zettelkastenProcessor); // Update the placement path only for the new processor

        // Add instances to global arrays
        window.codeMirrorInstances.push({ textarea, cmInstance });
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
                const codeMirrorInstance = window.codeMirrorInstances.find(
                    instance => instance.textarea.id === textareaId
                ).cmInstance;

                // Ensure the newly active pane's CodeMirror instance is set as the current active instance
                window.currentActiveZettelkastenMirror = codeMirrorInstance;

                // Refresh the CodeMirror instance to ensure proper display and functionality
                if (codeMirrorInstance) {
                    codeMirrorInstance.refresh(); // This is the refresh call
                } else {
                    console.error('Error: CodeMirror instance not found for the active pane.');
                }

                this.paneDropdown.value = paneId;
                updateSelectedOptionDisplay(this.paneDropdown);
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
                const confirmDelete = confirm(`Delete the slip-box "${selectedPaneName}"?`); if (confirmDelete) {
                    this.removePane(selectedPaneId);
                }
            }
        }
    }

    getPaneName(paneId) {
        const pane = this.paneContent.querySelector(`#${paneId}`);
        if (pane) {
            return pane.getAttribute('data-pane-name');
        }
        return '';
    }

    removePane(paneId) {
        const pane = this.paneContent.querySelector(`#${paneId}`);
        if (pane) {
            // Find the corresponding CodeMirror instance
            const cmInstance = window.codeMirrorInstances.find(instance => instance.cmInstance.getTextArea().id === `zet-note-input-${paneId.replace('zet-pane-', '')}`);

            if (cmInstance) {
                // Clear the CodeMirror instance
                cmInstance.cmInstance.setValue('');
                cmInstance.cmInstance.clearHistory();

                // Remove the CodeMirror instance from the array
                window.codeMirrorInstances = window.codeMirrorInstances.filter(instance => instance !== cmInstance);
            }

            pane.remove();

            const option = this.paneDropdown.querySelector(`option[value="${paneId}"]`);
            if (option) {
                const currentIndex = Array.from(this.paneDropdown.options).indexOf(option);
                option.remove();
                refreshHtmlDropdownDisplay(this.paneDropdown, createZetContainerDropdown);

                if (this.paneDropdown.options.length > 0) {
                    const newIndex = currentIndex >= this.paneDropdown.options.length ? currentIndex - 1 : currentIndex;
                    const newPaneId = this.paneDropdown.options[newIndex].value;
                    this.switchPane(newPaneId);
                }
            }
        }
    }

    resetAllPanes() {
        // Remove all panes
        this.paneContent.querySelectorAll('.zet-pane').forEach(pane => {
            const paneId = pane.id;
            this.removePane(paneId);
        });
        this.paneCounter = 1; // Reset pane counter
    }

    restorePane(paneName, paneContent) {
        const paneId = `zet-pane-${this.paneCounter}`;
        const pane = this.createPane(paneId, paneName);

        addHtmlOptionToCustomDropdown(this.paneDropdown, { text: paneName, value: paneId }, createZetContainerDropdown);
        this.paneContent.appendChild(pane);
        this.switchPane(paneId);

        processAll = true;
        restoreZettelkastenEvent = true;

        // Set the content of the CodeMirror instance
        const codeMirrorInstance = window.codeMirrorInstances[window.codeMirrorInstances.length - 1].cmInstance;
        codeMirrorInstance.setValue(paneContent);

        this.paneCounter++;
    }

    getActiveTextareaId() {
        const activeCodeMirror = window.currentActiveZettelkastenMirror;
        if (activeCodeMirror) {
            const textareas = this.paneContent.querySelectorAll('textarea');
            for (const textarea of textareas) {
                if (activeCodeMirror.getTextArea() === textarea) {
                    return textarea.id;
                }
            }
        }
        return null;
    }

    openSearchModal() {
        openModal('zetSearchModal');
        setupZettelkastenSearchBar();
        let inp = document.getElementById("Searchbar");
        performZettelkastenSearch(inp.value);
    }
}

// Usage
const zetPaneContainer = document.getElementById('zetPaneContainer');
const zetPanes = new ZetPanes(zetPaneContainer);