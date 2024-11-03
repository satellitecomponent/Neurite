function createSyntaxTextarea() {
    const editorWrapper = Html.make.div('editor-wrapper');

    const className = 'editable-div custom-scrollbar textarea-override';
    const textarea = Html.make.textarea(className);

    // Create the overlay div for syntax highlighting
    const displayDiv = Html.make.div('syntax-display-div custom-scrollbar');

    editorWrapper.append(displayDiv, textarea);

    function updateEditorHeight() {
        const wrapperHeight = editorWrapper.offsetHeight;
        const wrapperStyle = window.getComputedStyle(editorWrapper);
        const maxHeight = 300;
        if (wrapperStyle.height === '100%' || wrapperHeight >= maxHeight) return;

        const wrapperRect = editorWrapper.getBoundingClientRect();
        const bottomOffset = 20; // Space to leave at the bottom of the screen
        if (wrapperRect.bottom + bottomOffset < window.innerHeight) { // above the bottom
            editorWrapper.style.height = textarea.scrollHeight + 'px';
        }
    }

    On.input(textarea, updateEditorHeight);

    return editorWrapper;
}

function addEventsToUserInputTextarea(userInputTextarea, textarea, node, displayDiv) {
    syncInputTextareaWithHiddenTextarea(userInputTextarea, textarea);
    ZetSyntaxDisplay.syncAndHighlight(displayDiv, userInputTextarea);

    On.input(userInputTextarea, (e)=>{
        if (isEditableDivProgrammaticChange) return;

        syncHiddenTextareaWithInputTextarea(textarea, userInputTextarea);
        if (displayDiv) {
            ZetSyntaxDisplay.syncAndHighlight(displayDiv, userInputTextarea);
        }
    });

    On.change(textarea, (e)=>{
        if (isEditableDivProgrammaticChange) return;

        syncInputTextareaWithHiddenTextarea(userInputTextarea, textarea);
        if (displayDiv) {
            ZetSyntaxDisplay.syncAndHighlight(displayDiv, userInputTextarea);
        }
        highlightWithDelay();
    });

    function syncScroll(){
        displayDiv.scrollTop = userInputTextarea.scrollTop;
        displayDiv.scrollLeft = userInputTextarea.scrollLeft;
    }
    On.scroll(userInputTextarea, syncScroll);
    On.scroll(displayDiv, syncScroll);

    const highlightWithDelay = debounce(() => {
        if (displayDiv) {
            ZetSyntaxDisplay.syncAndHighlight(displayDiv, userInputTextarea);
        }
    }, 3000);

    // Highlight Codemirror text on focus of contenteditable div
    On.focus(userInputTextarea, syncScroll);

    On.mousedown(userInputTextarea, (e)=>{
        if (userInputTextarea.contains(e.target) && !e.getModifierState(controls.altKey.value)) {
            e.stopPropagation();
            // We still allow default behavior, so the contenteditable div remains interactable.
        }
    }, true); // Use capture phase to catch the event early

    On.keydown(document, (e)=>{
        if (!e.getModifierState(controls.altKey.value) ||
            document.activeElement !== userInputTextarea) return;

        userInputTextarea.style.userSelect = 'none';
        userInputTextarea.style.pointerEvents = 'none';
    });

    On.keyup(document, (e)=>{
        if (e.getModifierState(controls.altKey.value)) return;

        userInputTextarea.style.userSelect = 'auto';
        userInputTextarea.style.pointerEvents = 'auto';
    });

    On.visibilitychange(document, (e)=>{
        if (document.visibilityState !== 'visible') return;

        userInputTextarea.style.userSelect = 'auto';
        userInputTextarea.style.pointerEvents = 'auto';
    });

    On.paste(userInputTextarea, Event.stopPropagation);
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

        Logger.debug("Synced input textarea:", userInputTextarea.value);
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

        Logger.debug("Synced hidden textarea:", textarea.value);
        isHiddenTextareaProgrammaticChange = false;
    }
}
