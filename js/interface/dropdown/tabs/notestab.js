
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


function captureDocumentUndoRedoEventsAndApplyToCodeMirror(codeMirrorInstance) {
    document.addEventListener('keydown', function (event) {
        if (event.ctrlKey || event.metaKey) {  // Works for both Ctrl (Windows/Linux) and Cmd (macOS)
            let didOperation = false;

            if (event.key === 'z') {
                if (event.shiftKey) {
                    // Redo for Ctrl+Shift+Z or Cmd+Shift+Z
                    codeMirrorInstance.redo();
                    didOperation = true;
                } else {
                    // Undo for Ctrl+Z or Cmd+Z
                    codeMirrorInstance.undo();
                    didOperation = true;
                }
            } else if (event.key === 'y') {
                // Redo for Ctrl+Y or Cmd+Y
                codeMirrorInstance.redo();
                didOperation = true;
            }

            if (didOperation && (event.target.closest('.CodeMirror') || event.target.tagName.toLowerCase() !== 'textarea' && event.target.tagName.toLowerCase() !== 'input')) {
                event.preventDefault();  // Prevent the default undo/redo behavior in the document or CodeMirror
                setTimeout(() => codeMirrorInstance.refresh(), 0);  // Refresh the CodeMirror instance
            }
        }
    });
}

// Override default CodeMirror undo/redo handlers
myCodeMirror.setOption('extraKeys', {
    'Ctrl-Z': (cm) => { /* Do nothing */ },
    'Cmd-Z': (cm) => { /* Do nothing */ },
    'Ctrl-Y': (cm) => { /* Do nothing */ },
    'Cmd-Y': (cm) => { /* Do nothing */ },
    'Shift-Ctrl-Z': (cm) => { /* Do nothing */ },
    'Shift-Cmd-Z': (cm) => { /* Do nothing */ }
});

captureDocumentUndoRedoEventsAndApplyToCodeMirror(myCodeMirror);

// Get the viewport dimensions
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
    let cmElement = myCodeMirror.getWrapperElement();
    initialWidth = cmElement.offsetWidth;

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
            let cmElement = myCodeMirror.getWrapperElement();
            let newWidth = initialWidth - dx;

            // Update the width if within the boundaries
            if (newWidth > 50 && newWidth <= maxWidth) {
                cmElement.style.width = newWidth + "px";
                document.getElementById('prompt').style.width = newWidth + 'px';
                myCodeMirror.refresh();
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
    let cmElement = myCodeMirror.getWrapperElement();
    initialHeight = cmElement.offsetHeight;

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
            let cmElement = myCodeMirror.getWrapperElement();
            let newHeight = initialHeight + dy;

            // Update the height if within the boundaries
            if (newHeight > 50 && newHeight <= maxHeight) {
                cmElement.style.height = newHeight + "px";
                myCodeMirror.refresh();
            }
        });
    }
}

// Add this event listener to handle window resizing
window.addEventListener("resize", function () {
    maxWidth = window.innerWidth * 0.9;
    maxHeight = window.innerHeight * 0.9;

    let cmElement = myCodeMirror.getWrapperElement();

    if (cmElement.offsetHeight > maxHeight) {
        cmElement.style.height = maxHeight + "px";
    }

    if (cmElement.offsetWidth > maxWidth) {
        cmElement.style.width = maxWidth + "px";
    }

    myCodeMirror.refresh();
});