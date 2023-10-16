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

    // Modify the onmousedown function to check for the Alt key
    headerContainer.onmousedown = function (event) {
        if (event.altKey) {
            cancel(event);  // Prevent dragging if Alt key is pressed
        }
    };

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

    div.addEventListener('click', (event) => {
        event.stopPropagation();
        if (event.ctrlKey && nodeMode === 1) {
            div.classList.toggle('selected');
        }
    });

    div.addEventListener('mousedown', function () {
        autopilotSpeed = 0;
        dropdown.classList.add('no-select');

        let allWrapperDivs = document.getElementsByClassName('wrapperDiv');
        for (let i = 0; i < allWrapperDivs.length; i++) {
            allWrapperDivs[i].classList.add('no-select');
        }
    });

    div.addEventListener('mouseup', function () {
        dropdown.classList.remove('no-select');

        let allWrapperDivs = document.getElementsByClassName('wrapperDiv');
        for (let i = 0; i < allWrapperDivs.length; i++) {
            allWrapperDivs[i].classList.remove('no-select');
        }
    });

    window.addEventListener('mouseup', function () {
        dropdown.classList.remove('no-select');

        let allWrapperDivs = document.getElementsByClassName('wrapperDiv');
        for (let i = 0; i < allWrapperDivs.length; i++) {
            allWrapperDivs[i].classList.remove('no-select');
        }
    });

    // Calculate the width of buttons
    let buttonsWidth = w.offsetWidth;

    // Add the title input to the header container
    let titleInput = document.createElement('input');
    titleInput.setAttribute('type', 'text');
    titleInput.setAttribute('value', title);
    titleInput.className = 'title-input';
    headerContainer.appendChild(titleInput);

    titleInput.addEventListener('paste', function (event) {
        event.stopPropagation();
    });

    let isDragging = false;
    let isMouseDown = false;

    titleInput.addEventListener('mousedown', function (event) {
        isMouseDown = true;
    });

    titleInput.addEventListener('mousemove', function (event) {
        if (isMouseDown) {
            isDragging = true;
        }
        if (isDragging && !altHeld) {
            titleInput.selectionStart = titleInput.selectionEnd;  // Reset the selection
        }
    });

    document.addEventListener('mouseup', function (event) {
        isDragging = false;
        isMouseDown = false;
    });

    titleInput.addEventListener('mouseleave', function (event) {
        isDragging = false;
    });

    // Add resize container and handle
    let resizeContainer = document.createElement('div');
    resizeContainer.className = 'resize-container';
    div.appendChild(resizeContainer);

    let resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    resizeContainer.appendChild(resizeHandle);


    let node = new Node(pos, odiv, scale, iscale || new vec2(1, 1));
    setResizeEventListeners(resizeHandle, node);
    observeContentResize(innerContent, div);
    div.win = node;
    return rewindowify(node);
}

function rewindowify(node) {
    node.push_extra("window");
    let w = node.content;

    let del = w.querySelector("#button-delete");
    del.classList.add('windowbutton');

    let fs = w.querySelector("#button-fullscreen");
    fs.classList.add('windowbutton');

    let col = w.querySelector("#button-collapse");
    col.classList.add('windowbutton');

    function set(e, v, s = "fill") {
        e.children[0].setAttribute("fill", settings.buttonGraphics[v][0]);
        e.children[1].setAttribute(s, settings.buttonGraphics[v][1]);
    }

    function ui(e, cb = (() => { }), s = "fill") {
        e.onmouseenter = (ev) => {
            set(e, "hover", s);
        }
        e.onmouseleave = (ev) => {
            set(e, "initial", s);
            e.ready = false;
        }
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
        deleteNodeByTitle(title);
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

    let windowDiv = resizeHandle.parentElement.parentElement;
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

        const content = windowDiv.querySelector('.content');
        const minWidth = content ? content.offsetWidth + 0 : 100;
        const minHeight = content ? content.offsetHeight + 35 : 100;
        const newWidth = Math.max(startWidth + dx, minWidth);
        const newHeight = Math.max(startHeight + dy, minHeight);
        windowDiv.style.maxWidth = `${newWidth}px`;
        windowDiv.style.width = `${newWidth}px`;
        windowDiv.style.height = `${newHeight}px`;

        const contentEditable = windowDiv.querySelector("[contentEditable='true']");
        if (contentEditable) {
            if (newHeight > 300) {
                contentEditable.style.maxHeight = `${newHeight}px`;
            } else {
                contentEditable.style.maxHeight = `300px`;
            }
            contentEditable.style.maxWidth = `${newWidth}px`
        }
    };

    const handleMouseUp = () => {
        isMouseMoving = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'auto'; // Reset the cursor style
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
    });
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

/*// Set the textarea's height according to its scrollHeight and maxHeight
function setTextAreaHeight(textarea, maxHeight) {
    // Calculate the bottom position of the textarea within the viewport
    const textareaBottom = textarea.getBoundingClientRect().bottom;
    const viewportHeight = window.innerHeight;

    // Define a margin from the bottom (e.g., 30 pixels)
    const bottomMargin = 30;

    // If the bottom of the textarea (including the margin) is beyond the viewport
    if (textareaBottom + bottomMargin > viewportHeight) {
        return;
    }

    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${Math.max(newHeight, 60)}px`;

    if (newHeight >= maxHeight) {
        textarea.style.overflowY = 'auto';
    } else {
        textarea.style.overflowY = 'hidden';
    }
}

/**
 * Event handlers for mouse down and up to set resizing state
 */
/*function attachMouseEvents(node, element) {
    element.addEventListener('mousedown', () => {
        node.isResizing = true;
    });

    element.addEventListener('mouseup', () => {
        node.isResizing = false;
        const newMaxHeight = element.clientHeight;
        element.setAttribute('data-max-height', newMaxHeight);
    });
}

/**
 * Function used for programmatic interaction in zettelkasten.js
 */
/*function adjustTextareaHeight(textarea) {
    const maxHeight = textarea.getAttribute('data-max-height') || 300;
    const epsilon = 50; // Tolerance in pixels

    requestAnimationFrame(() => {
        // Record the current scroll position
        const previousScrollHeight = textarea.scrollHeight;
        const previousScrollTop = textarea.scrollTop;

        // Adjust textarea height
        setTextAreaHeight(textarea, maxHeight);

        // Calculate the new scroll position
        const newScrollHeight = textarea.scrollHeight;
        const dScroll = newScrollHeight - previousScrollHeight;

        // Update the scrollTop only if we are close to the bottom
        if (Math.abs(previousScrollTop - (previousScrollHeight - textarea.clientHeight)) < epsilon) {
            textarea.scrollTop = newScrollHeight - textarea.clientHeight;
        } else {
            // Preserve the scrollTop to keep the view stable
            textarea.scrollTop = previousScrollTop + dScroll;
        }
    });
}


 * Function used for user interaction in create text node

function adjustTextareaElement(node, element) {
    const adjustHeight = () => {
        if (!node.isResizing) {
            const maxHeight = element.getAttribute('data-max-height') || 300;
            setTextAreaHeight(element, maxHeight);
        }
    };

    attachMouseEvents(node, element);

    adjustHeight();

    node.isResizing = false;

    node.observer = new ResizeObserver(adjustHeight);
    node.observer.observe(element);

    const mutationObserver = new MutationObserver(adjustHeight);
    mutationObserver.observe(element, {
        childList: true,
        subtree: true,
        characterData: true
    });
} */

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


function put(e, p, s = 1) {
    let svgbb = svg.getBoundingClientRect();
    e.style.position = "absolute";
    e.style.transform = "scale(" + s + "," + s + ")";
    p = fromZtoUV(p);
    if (p.minus(new vec2(0.5, 0.5)).mag2() > 16) {
        e.style.display = "none";
    } else {
        e.style.display = "initial";
    }
    let w = Math.min(svgbb.width, svgbb.height);
    let off = svgbb.width < svgbb.height ? svgbb.right : svgbb.bottom;
    p.x = w * p.x - (off - svgbb.right) / 2;
    p.y = w * p.y - (off - svgbb.bottom) / 2;
    let bb = e.getBoundingClientRect();
    p = p.minus(new vec2(bb.width, bb.height).scale(0.5 / s));
    e.style.left = p.x + "px";
    e.style.top = p.y + "px";


    //e.style['margin-top'] = "-"+(e.offsetHeight/2)+"px";//"-50%";
    //e.style['margin-left'] = "-"+(e.offsetWidth/2)+"px";//"-50%";
    //e.style['vertical-align']= 'middle';
    //e.style['text-align']= 'center';

}

const NodeExtensions = {
    "window": (node, a) => {
        rewindowify(node);
    },
    "textarea": (node, o) => {
        let e = node.content;
        for (let w of o.p) {
            e = e.children[w];
        }
        let p = o.p;
        e.value = o.v;
        node.push_extra_cb((n) => {
            return {
                f: "textarea",
                a: {
                    p: p,
                    v: e.value
                }
            };
        });
    },
}