function createContentEditableDiv() {
    let editableDiv = document.createElement('div');
    editableDiv.contentEditable = "true";
    editableDiv.classList.add('editable-div', 'custom-scrollbar');
    return editableDiv;
}

function isEventInsideElement(event, element) {
    return element.contains(event.target);
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
        //highlightNodeTitlesInContentEditable(editableDiv);
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
        //highlightNodeTitlesInContentEditable(editableDiv);
    });

    // Highlight Codemirror text on focus of contenteditable div
    editableDiv.onfocus = function () {
        const title = node.getTitle();
        highlightNodeSection(title, myCodeMirror);
        //highlightNodeTitlesInContentEditable(editableDiv);
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

    // Call the highlighting function initially
    //highlightNodeTitlesInContentEditable(editableDiv);
}


function highlightNodeTitlesInContentEditable(editableDiv) {
    const textNodes = getContentEditableTextNodes(editableDiv);
    textNodes.forEach(node => {
        const text = node.nodeValue;
        nodeTitles.forEach(title => {
            if (title.length > 0) {
                const regex = new RegExp(`\\b${title}\\b`, 'g');
                let match;
                let lastIndex = 0;
                const docFragment = document.createDocumentFragment();

                while (match = regex.exec(text)) {
                    const beforeText = text.slice(lastIndex, match.index);
                    lastIndex = match.index + match[0].length;

                    docFragment.appendChild(document.createTextNode(beforeText));
                    const highlightSpan = document.createElement('span');
                    highlightSpan.classList.add('node-title');
                    highlightSpan.textContent = match[0];
                    docFragment.appendChild(highlightSpan);
                }

                if (lastIndex < text.length) {
                    docFragment.appendChild(document.createTextNode(text.slice(lastIndex)));
                }

                // Replace old node with new content, ensuring the node is still part of the DOM
                console.log("Before replacing child, ParentNode:", node.parentNode, "Node:", node);
                if (node.parentNode) {
                    node.parentNode.replaceChild(docFragment, node);
                    console.log("Replacement successful for node:", node);
                } else {
                    console.error("Cannot replace child, node is not in the DOM:", node);
                }
            }
        });
    });
}

// Helper function to get all text nodes within an element
function getContentEditableTextNodes(element) {
    console.log("Getting text nodes for:", element);
    if (!element || !(element instanceof HTMLElement)) {
        console.error("Invalid element provided for getTextNodes:", element);
        return [];
    }

    const textNodes = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
        textNodes.push(node);
    }
    return textNodes;
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