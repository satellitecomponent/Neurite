function createUserInputTextarea() {
    let editableDiv = document.createElement('textarea');
    editableDiv.classList.add('editable-div', 'custom-scrollbar', 'textarea-override'); // Add the override class
    return editableDiv;
}

function createSyntaxTextarea() {
    // Create the editor wrapper
    let editorWrapper = document.createElement('div');
    editorWrapper.classList.add('editor-wrapper');

    // Create the contentEditable input div using the existing function
    let inputDiv = createUserInputTextarea();

    // Create the overlay div for syntax highlighting
    let displayDiv = document.createElement('div');
    displayDiv.classList.add('syntax-display-div', 'custom-scrollbar'); // Use the class for styling

    // Append both divs to the wrapper
    editorWrapper.appendChild(displayDiv);
    editorWrapper.appendChild(inputDiv);

    // Function to update the height of the editor wrapper
    function updateEditorHeight() {
        // Get the current height and styles of the editor wrapper
        const wrapperHeight = editorWrapper.offsetHeight;
        const wrapperStyle = window.getComputedStyle(editorWrapper);
        const maxHeight = 300; // Maximum height allowed for the wrapper

        // Early exit if the height is set to '100%' or exceeds the maximum allowed height
        if (wrapperStyle.height === '100%' || wrapperHeight >= maxHeight) {
            return;
        }

        // Try to get the bounding rectangle of the editor wrapper
        const wrapperRect = editorWrapper.getBoundingClientRect();
        const screenHeight = window.innerHeight;
        const bottomOffset = 20; // Space to leave at the bottom of the screen

        // Check if the bounding rectangle is visible and below the bottom of the screen
        if (wrapperRect.bottom + bottomOffset < screenHeight) {
            // If visible and within the screen, adjust height based on the inputDiv's scrollHeight
            editorWrapper.style.height = 'auto';
            editorWrapper.style.height = inputDiv.scrollHeight + 'px';
        } else if (!wrapperRect) {
            editorWrapper.style.height = 'auto';
            editorWrapper.style.height = inputDiv.scrollHeight + 'px';
        }
    }

    // Add event listeners to the textarea
    inputDiv.addEventListener('input', updateEditorHeight);

    // Return the wrapper containing both the editable and the display div
    return editorWrapper;
}



function syncDisplayFromInputTextareaScroll(userInputTextarea, displayDiv) {
    displayDiv.scrollTop = userInputTextarea.scrollTop;
    displayDiv.scrollLeft = userInputTextarea.scrollLeft;
}

function addEventsToUserInputTextarea(userInputTextarea, textarea, node, displayDiv) {
    syncInputTextareaWithHiddenTextarea(userInputTextarea, textarea);
    ZetSyntaxDisplay.syncAndHighlight(displayDiv, userInputTextarea);

    userInputTextarea.addEventListener('input', function (event) {
        if (!isEditableDivProgrammaticChange) {
            syncHiddenTextareaWithInputTextarea(textarea, userInputTextarea);
            if (displayDiv) {
                ZetSyntaxDisplay.syncAndHighlight(displayDiv, userInputTextarea);
            }
        }
    });

    textarea.addEventListener('change', function (event) {
        if (!isEditableDivProgrammaticChange) {
            syncInputTextareaWithHiddenTextarea(userInputTextarea, textarea);
            if (displayDiv) {
                ZetSyntaxDisplay.syncAndHighlight(displayDiv, userInputTextarea);
            }
            highlightWithDelay();
        }
    });

    userInputTextarea.addEventListener('scroll', function (event) {
        syncDisplayFromInputTextareaScroll(userInputTextarea, displayDiv);
    });

    displayDiv.addEventListener('scroll', function (event) {
        syncDisplayFromInputTextareaScroll(userInputTextarea, displayDiv);
    });

    const highlightWithDelay = debounce(() => {
        if (displayDiv) {
            ZetSyntaxDisplay.syncAndHighlight(displayDiv, userInputTextarea);
        }
    }, 3000);


    // Highlight Codemirror text on focus of contenteditable div
    userInputTextarea.onfocus = function () {
        syncDisplayFromInputTextareaScroll(this, displayDiv);
    };

    userInputTextarea.addEventListener('mousedown', function (event) {
        if (isEventInsideElement(event, userInputTextarea) && !event.getModifierState(controls.altKey.value)) {
            event.stopPropagation();
            // We still allow default behavior, so the contenteditable div remains interactable.
        }
    }, true); // Use capture phase to catch the event early

    document.addEventListener('keydown', function (event) {
        if (event.getModifierState(controls.altKey.value) && document.activeElement === userInputTextarea) {
            userInputTextarea.style.userSelect = 'none';
            userInputTextarea.style.pointerEvents = 'none';
        }
    });

    document.addEventListener('keyup', function (event) {
        if (!event.getModifierState(controls.altKey.value)) {
            userInputTextarea.style.userSelect = 'auto';
            userInputTextarea.style.pointerEvents = 'auto';
        }
    });

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
            userInputTextarea.style.userSelect = 'auto';
            userInputTextarea.style.pointerEvents = 'auto';
        }
    });


    userInputTextarea.addEventListener('paste', function (event) {
        event.stopPropagation();
    });

}

let isEditableDivProgrammaticChange = false;
let isHiddenTextareaProgrammaticChange = false;

function syncInputTextareaWithHiddenTextarea(userInputTextarea, textarea) {
    if (!isHiddenTextareaProgrammaticChange) {
        isEditableDivProgrammaticChange = true;
        let previousContent = userInputTextarea.value;
        const currentContent = textarea.value;

        if (previousContent !== currentContent) {
            const selectionStart = userInputTextarea.selectionStart;
            const selectionEnd = userInputTextarea.selectionEnd;
            userInputTextarea.value = currentContent;
            userInputTextarea.setSelectionRange(selectionStart, selectionEnd);
            userInputTextarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        }

        //console.log(`Synced input textarea: ${userInputTextarea.value}`);
        isEditableDivProgrammaticChange = false;
    }
}

function syncHiddenTextareaWithInputTextarea(textarea, contentEditable) {
    if (!isEditableDivProgrammaticChange) {
        isHiddenTextareaProgrammaticChange = true;

        const contentEditableValue = contentEditable.value;
        const textareaValue = textarea.value;

        // Count leading empty lines in the textarea
        const leadingEmptyLines = (textareaValue.match(/^(\n*)/) || [''])[0];
        
        // Combine leading empty lines with the content editable value
        const newValue = leadingEmptyLines + contentEditableValue.trimStart();

        if (textareaValue !== newValue) {
            textarea.value = newValue;
            textarea.dispatchEvent(new Event('input'));
        }

        //console.log(`Synced hidden textarea: ${textarea.value}`);
        isHiddenTextareaProgrammaticChange = false;
    }
}

function isEventInsideElement(event, element) {
    return element.contains(event.target);
}