function windowify(title, content, pos, scale, iscale, link) {
    let odiv = document.createElement('div');
    let div = document.createElement('div');
    let buttons = document.getElementById("elements").children[0];
    let dropdown = document.querySelector('.dropdown');
    let w = buttons.cloneNode(true);
    w.className = 'button-container';

    // Create a header container for buttons and title input
    let headerContainer = document.createElement('div');
    headerContainer.className = 'header-container';
    headerContainer.appendChild(w);

    div.appendChild(headerContainer);
    odiv.appendChild(div);

    let innerContent = document.createElement('div');
    innerContent.className = 'content';
    for (let c of content) {
        innerContent.appendChild(c);
    }
    div.appendChild(innerContent);


    odiv.setAttribute("data-init", "window");
    div.setAttribute("class", "window");

    // Add the title input to the header container
    let titleInput = document.createElement('input');
    titleInput.setAttribute('type', 'text');
    titleInput.setAttribute('value', title);
    titleInput.className = 'title-input';
    headerContainer.appendChild(titleInput);

    // Add resize container and handle
    let resizeContainer = document.createElement('div');
    resizeContainer.className = 'resize-container';
    div.appendChild(resizeContainer);

    let resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    resizeContainer.appendChild(resizeHandle);


    let node = new Node(pos, odiv, scale, iscale || new vec2(1, 1));

    div.win = node;
    return rewindowify(node);
}

function initWindow(node) {
    let headerContainer = node.content.querySelector('.header-container');
    node.headerContainer = headerContainer;

    let windowDiv = node.content.querySelector(".window")
    node.windowDiv = windowDiv;

    let innerContent = node.windowDiv.querySelector('.content');
    node.innerContent = innerContent;

    const dropdown = document.querySelector('.dropdown');
    node.dropdown = dropdown;

    const wrapperDivs = document.getElementsByClassName('wrapperDiv');
    node.wrapperDivs = wrapperDivs;

    let resizeHandle = node.content.querySelector('.resize-handle');
    setResizeEventListeners(resizeHandle, node);

    let titleInput = node.content.querySelector('.title-input');
    node.titleInput = titleInput;

    addWindowEventListeners(node)
}

function addWindowEventListeners(node) {
    setupHeaderContainerListeners(node.headerContainer);
    setupWindowDivListeners(node);
    setupTitleInputListeners(node.titleInput);
    setupResizeHandleListeners(node);
    observeContentResize(node.innerContent, node.windowDiv);
}

function setupHeaderContainerListeners(headerContainer) {
    headerContainer.onmousedown = function (event) {
        if (event.altKey) {
            cancel(event); // Prevent dragging if Alt key is pressed
        }
    };
}

function setupWindowDivListeners(node) {
    const windowDiv = node.windowDiv;
    const dropdown = node.dropdown;
    const wrapperDivs = node.wrapperDivs;

    let clickStartX, clickStartY;

    windowDiv.addEventListener('mousedown', (event) => {
        if (event.altKey) {
            // Record the starting position of the mouse only if the Alt key is held
            clickStartX = event.clientX;
            clickStartY = event.clientY;
        }
    });

    windowDiv.addEventListener('mouseup', (event) => {
        if (event.altKey) {
            const distanceMoved = Math.sqrt(Math.pow(event.clientX - clickStartX, 2) + Math.pow(event.clientY - clickStartY, 2));

            // Check if the mouse has moved more than a certain threshold
            const dragThreshold = 10; // pixels, adjust this value as needed
            if (distanceMoved < dragThreshold) {
                toggleNodeSelection(node);
            }
        }

        hideContextMenu();
    });

    windowDiv.addEventListener('mousedown', () => {
        autopilotSpeed = 0;
        dropdown.classList.add('no-select');
        Array.from(wrapperDivs).forEach(div => div.classList.add('no-select'));
    });

    windowDiv.addEventListener('mouseup', () => {
        dropdown.classList.remove('no-select');
        Array.from(wrapperDivs).forEach(div => div.classList.remove('no-select'));
    });

    window.addEventListener('mouseup', () => {
        dropdown.classList.remove('no-select');
        Array.from(wrapperDivs).forEach(div => div.classList.remove('no-select'));
    });
}

function setupTitleInputListeners(titleInput) {
    let isDragging = false;
    let isMouseDown = false;

    titleInput.addEventListener('paste', (event) => event.stopPropagation());

    titleInput.addEventListener('mousedown', () => { isMouseDown = true; });

    titleInput.addEventListener('mousemove', (event) => {
        if (isMouseDown) { isDragging = true; }
        if (isDragging && !altHeld) {
            titleInput.selectionStart = titleInput.selectionEnd; // Reset selection
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        isMouseDown = false;
    });

    titleInput.addEventListener('mouseleave', () => { isDragging = false; });
}

function setupResizeHandleListeners(node) {
    const resizeHandle = node.windowDiv.querySelector('.resize-handle');
    setResizeEventListeners(resizeHandle, node);
}




function rewindowify(node) {
    initWindow(node)

    node.push_extra("window");
    let w = node.content;

    let del = w.querySelector("#button-delete");
    del.classList.add('windowbutton');

    let fs = w.querySelector("#button-fullscreen");
    fs.classList.add('windowbutton');

    let col = w.querySelector("#button-collapse");
    col.classList.add('windowbutton');

    let titleInput = node.titleInput;

    function set(e, v, s = "fill") {
        e.children[0].setAttribute("fill", settings.buttonGraphics[v][0]);
        e.children[1].setAttribute(s, settings.buttonGraphics[v][1]);
    }

    function ui(e, cb = (() => { }), s = "fill") {
        e.onmouseenter = (ev) => {
            set(e, "hover", s);
        };
        e.onmouseleave = (ev) => {
            // Check if title input is focused and set the state accordingly
            if (titleInput.matches(':focus')) {
                set(e, "focus", s);  // Use the "focus" state when title input is focused
            } else {
                set(e, "initial", s); // Otherwise, use the "initial" state
            }
            e.ready = false;
        };
        e.onmousedown = (ev) => {
            set(e, "click", s);
            e.ready = true;
            cancel(ev);
        }
        e.onmouseup = (ev) => {
            set(e, "initial", s);
            cancel(ev);
            if (e.ready) {
                cb(ev);
            }
        }
        e.onmouseleave();
    }
    ui(del, () => {
        const title = node.getTitle();
        if (prevNode === node) {
            prevNode = undefined;
            mousePath = "";
            svg_mousePath.setAttribute("d", "");
        }
        node.remove();
        // Delete the node from CodeMirror

        if (node.isTextNode) {
           deleteNodeByTitle(title);
        }
    });
    ui(fs, (() => {
        node.zoom_to_fit();
        zoomTo = zoomTo.scale(1.0625);
        autopilotSpeed = settings.autopilotSpeed;
        scrollToTitle(node.getTitle(), noteInput); // Use the getTitle method
    }));

    ui(col, () => toggleNodeState(node, myCodeMirror, event), "stroke");

    // Add the "mouseup" event listener to the document
    document.addEventListener('mouseup', () => {
        if (node.followingMouse) {
            node.stopFollowingMouse();
        }
    });

    // Function to update SVG fill or stroke color based on focus
    function updateSvgStrokeColor(focused) {
        let fillColor = focused ? settings.buttonGraphics.focus[1] : settings.buttonGraphics.initial[1];
        let strokeColor = focused ? settings.buttonGraphics.focus[1] : settings.buttonGraphics.initial[1];

        let del = node.content.querySelector("#button-delete");
        let fs = node.content.querySelector("#button-fullscreen");
        let col = node.content.querySelector("#button-collapse");

        del.children[1].setAttribute('fill', fillColor);
        fs.children[1].setAttribute('fill', fillColor);
        col.children[1].setAttribute('stroke', strokeColor);
    }


    // Add focus and blur event listeners to the title input
    if (titleInput) {
        titleInput.addEventListener('focus', function () {
            updateSvgStrokeColor(true);
        });

        titleInput.addEventListener('blur', function () {
            updateSvgStrokeColor(false);
        });
    }


    return node;
}



function addNodeAtNaturalScale(title, content, scale = 1, nscale_mult = 1, window_it = true) {
    let node;
    if (window_it) {
        let pos = toZ(mousePos)
        if (!Array.isArray(content)) {
            content = [content];
        }
        node = windowify(title, content, pos, nscale_mult * (zoom.mag2() ** settings.zoomContentExp), scale);
        htmlnodes_parent.appendChild(node.content);
    } else {
        let div = document.createElement('div');
        node = new Node(toZ(mousePos), div, nscale_mult * (zoom.mag2() ** settings.zoomContentExp), scale);
        div.appendChild(content);
        htmlnodes_parent.appendChild(div);
    }
    registernode(node)
    return node;
}

function registernode(node) {
    let id = nodes.length;
    let div = node.content;
    /*div.setAttribute("onclick","(e)=>nodes["+id+"].onclick(e)");
    div.setAttribute("onmousedown","(e)=>nodes["+id+"].onmousedown(e)");
    div.setAttribute("onmouseup","(e)=>nodes["+id+"].onmouseup(e)");
    div.setAttribute("onmousemove","(e)=>nodes["+id+"].onmousemove(e)");*/
    nodes.push(node);
    nodeMap[node.uuid] = node;
}




function extractScalingFactors(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const width = parseFloat(style.width);
    const height = parseFloat(style.height);

    if (width === 0 || height === 0) {
        return {
            scaleX: 1,
            scaleY: 1
        };
    }

    const scaleX = rect.width / width;
    const scaleY = rect.height / height;

    return {
        scaleX,
        scaleY
    };
}

// impact on responsiveness?
//addEventListener("resize", (event) => { });

var isPanning = false;

function setResizeEventListeners(resizeHandle, node) {
    const inverse2DMatrix = (matrix) => {
        const det = matrix[0] * matrix[3] - matrix[1] * matrix[2];
        if (det === 0) {
            return null;
        }
        const invDet = 1 / det;
        return [
            matrix[3] * invDet,
            -matrix[1] * invDet,
            -matrix[2] * invDet,
            matrix[0] * invDet,
        ];
    };

    const getDivInverseTransformMatrix = (div) => {
        const transform = window.getComputedStyle(div).transform;
        if (transform === 'none') {
            return [1, 0, 0, 1];
        }
        const matrix = transform
            .split('(')[1]
            .split(')')[0]
            .split(',')
            .map(parseFloat)
            .slice(0, 4);
        return inverse2DMatrix(matrix);
    };

    let windowDiv = node.windowDiv;
    // Find these elements once and store them for later use.
    const editorWrapperDiv = windowDiv.querySelector('.editorWrapperDiv');
    const editorIframe = editorWrapperDiv ? editorWrapperDiv.querySelector('iframe') : null;


    let startX;
    let startY;
    let startWidth;
    let startHeight;

    let isMouseMoving = false;

    const handleMouseMove = (event) => {
        if (!event.buttons) {
            handleMouseUp();
            return;
        }
        isMouseMoving = true;

        // Extract scaling factors from the accumulated transform matrix
        const {
            scaleX,
            scaleY
        } = extractScalingFactors(windowDiv);

        // Calculate the change in position of the mouse considering the scaling factors
        const dx = 2 * (event.pageX - startX) / scaleX;
        const dy = 2 * (event.pageY - startY) / scaleY;

        const content = node.innerContent;
        const minWidth = content ? content.offsetWidth + 0 : 100;
        const minHeight = content ? content.offsetHeight + 35 : 100;
        const newWidth = Math.max(startWidth + dx, minWidth);
        const newHeight = Math.max(startHeight + dy, minHeight);
        windowDiv.style.maxWidth = `${newWidth}px`;
        windowDiv.style.width = `${newWidth}px`;
        windowDiv.style.height = `${newHeight}px`;

        const contentEditable = node.contentEditableDiv;
        if (contentEditable) {
            if (newHeight > 300) {
                contentEditable.style.maxHeight = `${newHeight}px`;
            } else {
                contentEditable.style.maxHeight = `300px`;
            }
            contentEditable.style.maxWidth = `${newWidth}px`
        }

        const htmlView = node.htmlView;
        if (htmlView) {
            htmlView.style.width = '100%';
            htmlView.style.height = '100%';
        }

        // Find the aiNodeWrapperDiv for this specific node. Use a more specific selector if needed.
        const aiNodeWrapperDiv = node.ainodewrapperDiv;

        // If aiNodeWrapperDiv exists, set its dimensions
        if (aiNodeWrapperDiv) {
            aiNodeWrapperDiv.style.width = `${newWidth}px`;
            aiNodeWrapperDiv.style.height = `${newHeight}px`;
        }


        if (editorWrapperDiv) {
            const newEditorWidth = Math.max(startWidth + dx, 350);  //350 min width
            const newEditorHeight = Math.max(startHeight + dy, 200);  //200 min height

            // Set the new dimensions for the editor wrapper div
            editorWrapperDiv.style.width = `${newEditorWidth}px`;
            editorWrapperDiv.style.height = `${newEditorHeight}px`;

            // Optional: You might want to update the iframe size here as well
            editorIframe.style.width = `${newEditorWidth}px`;
            editorIframe.style.height = `${newEditorHeight - 10}px`;
        }
    };

    const handleMouseUp = () => {
        isMouseMoving = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'auto'; // Reset the cursor style

        // Re-enable pointer events on iframe
        if (editorWrapperDiv) {
            if (editorIframe) {
                editorIframe.style.pointerEvents = 'auto';
            }
        }
    };

    resizeHandle.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        startX = event.pageX;
        startY = event.pageY;
        startWidth = parseInt(document.defaultView.getComputedStyle(windowDiv).width, 10);
        startHeight = parseInt(document.defaultView.getComputedStyle(windowDiv).height, 10);

        isMouseMoving = true; // Flag to indicate that a resize operation is in progress
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        // Disable pointer events on iframe
        if (editorWrapperDiv) {
            if (editorIframe) {
                editorIframe.style.pointerEvents = 'none';
            }
        }
    });
}

function resetWindowDivSize(windowDiv) {
    windowDiv.style.width = 'fit-content';
    windowDiv.style.height = 'fit-content';
    windowDiv.style.maxWidth = 'fit-content';
    windowDiv.style.maxHeight = 'fit-content';
}


function observeContentResize(windowDiv, iframeWrapper, displayWrapper) {
    const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
            const {
                width,
                height
            } = entry.contentRect;

            // Find the buttonsWrapper inside windowDiv
            const buttonsWrapper = windowDiv.querySelector(".buttons-wrapper");

            if (buttonsWrapper) {
                // Calculate the available height for the iframes
                let buttonsHeight = buttonsWrapper.offsetHeight || 0;
                let iframeHeight = Math.max(0, height - buttonsHeight - 50); // Subtract additional margin

                // Update the width and height of iframeWrapper and displayWrapper
                iframeWrapper.style.width = width + "px";
                iframeWrapper.style.height = iframeHeight + "px";
                displayWrapper.style.width = width + "px";
                displayWrapper.style.height = iframeHeight + "px";
            }
        }
    });

    resizeObserver.observe(windowDiv);
}

function observeParentResize(parentDiv, iframe, paddingWidth = 50, paddingHeight = 80) {
    const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
            const {
                width,
                height
            } = entry.contentRect;
            iframe.style.width = Math.max(0, width - paddingWidth) + "px";
            iframe.style.height = Math.max(0, height - paddingHeight) + "px";
        }
    });

    resizeObserver.observe(parentDiv);
    return resizeObserver;
}