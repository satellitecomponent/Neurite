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

    // Return the wrapper containing both the editable and the display div
    return editorWrapper;
}



function syncDisplayFromInputTextareaScroll(userInputTextarea, displayDiv) {
    displayDiv.scrollTop = userInputTextarea.scrollTop;
    displayDiv.scrollLeft = userInputTextarea.scrollLeft;
}


function addEventsToUserInputTextarea(userInputTextarea, textarea, node, displayDiv) {
    syncInputTextareaWithHiddenTextarea(userInputTextarea, textarea);

    userInputTextarea.addEventListener('input', function () {
        syncHiddenTextareaWithInputTextarea(textarea, userInputTextarea);
        syncDisplayFromInputTextareaScroll(this, displayDiv);
        if (displayDiv) {
            ZetSyntaxDisplay.syncAndHighlight(displayDiv, userInputTextarea);
        }
        const lineNumber = getLineNumberWithinTextarea(userInputTextarea);
        const title = node.getTitle();
        scrollToTitle(title, noteInput, lineNumber);
    });

    if (displayDiv) {
        displayDiv.addEventListener('click', function (event) {
            if (event.target.classList.contains('node-title-sd')) {
                const title = event.target.textContent;
                handleTitleClick(title, myCodeMirror);
            }
        });


        // Add this event listener to the editable div
        userInputTextarea.addEventListener('scroll', function (event) {
            syncDisplayFromInputTextareaScroll(this, displayDiv);
        });
    }

    textarea.addEventListener('change', (event) => {
        if (!isProgrammaticChange) {
            syncInputTextareaWithHiddenTextarea(userInputTextarea, textarea);
        }
        if (displayDiv) {
            ZetSyntaxDisplay.syncAndHighlight(displayDiv, textarea);
        }
        let userHasScrolledManually = handleUserScroll(userInputTextarea);

        if (!userHasScrolledManually) {
            scrollToBottom(userInputTextarea, displayDiv);
        }
    });

    // Highlight Codemirror text on focus of contenteditable div
    userInputTextarea.onfocus = function () {
        const title = node.getTitle();
        highlightNodeSection(title, myCodeMirror);
    };

    document.addEventListener('keydown', function (event) {
        if (event.altKey) {
            userInputTextarea.style.userSelect = 'none';
            userInputTextarea.style.pointerEvents = 'none';
        }
    });

    document.addEventListener('keyup', function (event) {
        if (!event.altKey) {
            userInputTextarea.style.userSelect = 'auto';
            userInputTextarea.style.pointerEvents = 'auto';
        }
    });

    document.addEventListener('mousedown', function (event) {
        if (isEventInsideElement(event, userInputTextarea) && !event.altKey) {
            event.stopPropagation();
            // We still allow default behavior, so the contenteditable div remains interactable.
        }
    }, true); // Use capture phase to catch the event early

    userInputTextarea.addEventListener('paste', function (event) {
        event.stopPropagation();
    });

}

function handleUserScroll(userInputTextarea) {
    const contentEditable = userInputTextarea;
    const threshold = 50;
    const isNearBottom = contentEditable.scrollHeight - contentEditable.clientHeight - contentEditable.scrollTop < threshold;

    if (isNearBottom) {
        return false;
    } else {
        return true;
    }
}

function scrollToBottom(userInputTextarea, displayDiv) {
    userInputTextarea.scrollTop = userInputTextarea.scrollHeight;
    if (displayDiv) {
        displayDiv.scrollTop = displayDiv.scrollHeight;
    }
}


function isEventInsideElement(event, element) {
    return element.contains(event.target);
}

function watchHiddenTextareaAndSyncInputTextarea(textarea, editableDiv) {
    const mutationObserver = new MutationObserver(() => {
        syncInputTextareaWithHiddenTextarea(editableDiv, textarea);
    });

    mutationObserver.observe(textarea, {
        attributes: true,
        attributeFilter: ['value']
    });
}



function syncInputTextareaWithHiddenTextarea(editableDiv, textarea) {
    editableDiv.value = textarea.value;  // Update the content
}

let isProgrammaticChange = false;

function syncHiddenTextareaWithInputTextarea(textarea, contentEditable) {
    isProgrammaticChange = true;  // Avoid recursive updates
    textarea.value = contentEditable.value;  // Update the textarea
    textarea.dispatchEvent(new Event('input'));  // Trigger any associated event listeners
    isProgrammaticChange = false;
}

function getLineNumberWithinTextarea(textarea) {
    const textUpToCursor = textarea.value.substring(0, textarea.selectionStart);
    return textUpToCursor.split('\n').length; // Returns the current line number
}