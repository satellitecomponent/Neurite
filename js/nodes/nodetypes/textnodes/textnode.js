function createTextNode(name = '', text = '', sx = undefined, sy = undefined, x = undefined, y = undefined) {
    let n = document.createElement("textarea");
    n.classList.add('custom-scrollbar', 'node-textarea');
    n.onmousedown = cancel;

    let node = addNodeAtNaturalScale(name, [n]); // Just add the textarea for now

    let windowDiv = node.windowDiv;  // Find the window div
    let editorWrapper = createSyntaxTextarea();  // Now this includes both the input and display div
    editorWrapper.id = 'text-syntax-wrapper';

    let htmlView = document.createElement("iframe");
    htmlView.id = 'html-iframe';
    htmlView.classList.add('html-iframe', 'hidden');

    let pythonView = document.createElement("div");
    pythonView.id = 'python-frame';
    pythonView.classList.add('python-frame', 'hidden');

    windowDiv.appendChild(htmlView);
    windowDiv.appendChild(pythonView);
    windowDiv.appendChild(editorWrapper);  // Append the editor wrapper to window div

    // Handle position and scale if necessary
    if (sx !== undefined) {
        x = (new vec2(sx, sy)).cmult(zoom).plus(pan);
        y = x.y;
        x = x.x;
    }

    if (x !== undefined) {
        node.pos.x = x;
    }

    if (y !== undefined) {
        node.pos.y = y;
    }

    node.push_extra_cb((node) => {
        return {
            f: "textarea",
            a: {
                p: [0, 0, 1],
                v: node.titleInput.value
            }
        };
    });

    node.push_extra_cb((node) => {
        return {
            f: "textarea",
            a: {
                p: [0, 1, 0],
                v: n.value
            }
        };
    });

    node.isTextNode = true;
    node.codeEditingState = 'edit';

    initTextNode(node);

    return node;
}

function initTextNode(node) {
    let textNodeSyntaxWrapper = node.content.querySelector('#text-syntax-wrapper');
    node.textNodeSyntaxWrapper = textNodeSyntaxWrapper;

    //No longer a contentEditableDiv, returned to textarea
    let contentEditableDiv = node.content.querySelector('.editable-div');
    node.contentEditableDiv = contentEditableDiv;

    let displayDiv = node.content.querySelector('.syntax-display-div');;
    node.displayDiv = displayDiv;

    let textarea = node.content.querySelector('textarea');
    node.textarea = textarea;
   
    let htmlView = node.content.querySelector('#html-iframe');
    node.htmlView = htmlView;

    let pythonView = node.content.querySelector('#python-frame');
    node.pythonView = pythonView

    addEventListenersToTextNode(node)
}

function addEventListenersToTextNode(node) {
    // Attach events for contentEditable and textarea
    addEventsToUserInputTextarea(node.contentEditableDiv, node.textarea, node, node.displayDiv);
}