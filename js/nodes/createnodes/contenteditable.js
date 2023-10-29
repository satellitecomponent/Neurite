function createContentEditableDiv() {
    let editableDiv = document.createElement('div');
    editableDiv.contentEditable = "true";
    editableDiv.classList.add('editable-div', 'custom-scrollbar');
    return editableDiv;
}

function isEventInsideElement(event, element) {
    return element.contains(event.target);
}

let userHasScrolledManually = false;

function handleUserScroll(event) {
    const contentEditable = event.target;
    const threshold = 30;
    const isNearBottom = contentEditable.scrollHeight - contentEditable.clientHeight - contentEditable.scrollTop < threshold;

    if (isNearBottom) {
        userHasScrolledManually = false;
    } else {
        userHasScrolledManually = true;
    }
}

function scrollContentEditableToBottom(contentEditable) {
    contentEditable.scrollTop = contentEditable.scrollHeight;
}

function getLineNumberWithinContentEditable(editableDiv) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return 0;

    let lineCount = 0;
    let found = false;

    // Set of block elements to consider as line breaks
    const blockElements = new Set(['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE']);

    // Recursive function to traverse through child nodes
    function traverseNodes(node) {
        if (found) return;
        if (node === selection.anchorNode) {
            found = true;
            return;
        }
        if (node.nodeName === "BR" || blockElements.has(node.nodeName)) {
            lineCount++;
        }
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== "") {
            lineCount++;
        }
        for (let i = 0; i < node.childNodes.length && !found; i++) {
            traverseNodes(node.childNodes[i]);
        }
    }

    traverseNodes(editableDiv);

    // Subtract 1 because we don't want to count the initial line
    return lineCount - 1;
}

function watchTextareaAndSyncWithContentEditable(textarea, editableDiv) {
    const mutationObserver = new MutationObserver(() => {
        syncContentEditableWithTextarea(editableDiv, textarea);
    });

    mutationObserver.observe(textarea, {
        attributes: true,
        attributeFilter: ['value']
    });
}



function syncContentEditableWithTextarea(editableDiv, textarea) {
    editableDiv.innerText = textarea.value;  // Update the content

    if (!userHasScrolledManually) {
        scrollContentEditableToBottom(editableDiv);
    }
}

let isProgrammaticChange = false;

function syncTextareaWithContentEditable(textarea, contentEditable) {
    isProgrammaticChange = true;  // Avoid recursive updates
    textarea.value = contentEditable.innerText;  // Update the textarea
    textarea.dispatchEvent(new Event('input'));  // Trigger any associated event listeners
    isProgrammaticChange = false;
}


function addEventsToContentEditable(editableDiv, textarea, node) {
    editableDiv.addEventListener('input', function () {
        syncTextareaWithContentEditable(textarea, editableDiv);

        const LineNumber = getLineNumberWithinContentEditable(editableDiv);
        const title = node.getTitle();
        scrollToTitle(title, noteInput, LineNumber);
    });

    editableDiv.addEventListener('click', function (event) {
        if (event.target.classList.contains('node-title')) {
            const title = event.target.textContent;
            handleTitleClick(title, myCodeMirror);
        }
    });

    editableDiv.addEventListener('scroll', handleUserScroll);

    textarea.addEventListener('change', () => {
        if (!isProgrammaticChange) {
            syncContentEditableWithTextarea(editableDiv, textarea);
        }
    });

    // Highlight Codemirror text on focus of contenteditable div
    editableDiv.onfocus = function () {
        const title = node.getTitle();
        highlightNodeSection(title, myCodeMirror);
    };

    document.addEventListener('keydown', function (event) {
        if (event.altKey) {
            editableDiv.style.userSelect = 'none';
            editableDiv.style.pointerEvents = 'none';
        }
    });

    document.addEventListener('keyup', function (event) {
        if (!event.altKey) {
            editableDiv.style.userSelect = 'auto';
            editableDiv.style.pointerEvents = 'auto';
        }
    });

    document.addEventListener('mousedown', function (event) {
        if (isEventInsideElement(event, editableDiv) && !event.altKey) {
            event.stopPropagation();
            // We still allow default behavior, so the contenteditable div remains interactable.
        }
    }, true); // Use capture phase to catch the event early


    editableDiv.addEventListener('paste', function (event) {
        event.stopPropagation();
    });
}

