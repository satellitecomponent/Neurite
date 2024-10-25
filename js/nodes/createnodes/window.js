function windowify(title, content, pos, scale, iscale, link) {
    const odiv = document.createElement('div');
    const div = document.createElement('div');
    const w = Elem.byId('elements').children[0].cloneNode(true);
    w.className = 'button-container';

    const headerContainer = document.createElement('div');
    headerContainer.className = 'header-container';
    headerContainer.appendChild(w);

    div.appendChild(headerContainer);
    odiv.appendChild(div);

    const innerContent = document.createElement('div');
    innerContent.className = 'content';
    for (const c of content) {
        innerContent.appendChild(c);
    }
    div.appendChild(innerContent);

    odiv.setAttribute('data-init', 'window');
    div.setAttribute('class', 'window');

    const titleInput = document.createElement('input');
    titleInput.setAttribute('type', 'text');
    titleInput.setAttribute('value', title);
    titleInput.className = 'title-input';
    headerContainer.appendChild(titleInput);

    const resizeContainer = document.createElement('div');
    resizeContainer.className = 'resize-container';
    div.appendChild(resizeContainer);

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    resizeContainer.appendChild(resizeHandle);

    const node = new Node(pos, odiv, scale, iscale || new vec2(1, 1));
    div.win = node;
    return rewindowify(node);
}

function initWindow(node) {
    node.headerContainer = node.content.querySelector('.header-container');
    node.windowDiv = node.content.querySelector(".window");
    node.innerContent = node.windowDiv.querySelector('.content');
    node.dropdown = document.querySelector('.dropdown');
    node.wrapperDivs = document.getElementsByClassName('wrapperDiv');

    const resizeHandle = node.content.querySelector('.resize-handle');
    setResizeEventListeners(resizeHandle, node);

    node.titleInput = node.content.querySelector('.title-input');

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
    headerContainer.onmousedown = function (e) {
        if (e.getModifierState(controls.altKey.value)) {
            cancel(e); // Prevent dragging if Alt key is pressed
        }
    };
}

function setupWindowDivListeners(node) {
    const windowDiv = node.windowDiv;
    const dropdown = node.dropdown;
    const wrapperDivs = node.wrapperDivs;

    let clickStartX, clickStartY;

    windowDiv.addEventListener('mousedown', (e) => {
        if (e.getModifierState(controls.altKey.value)) {
            // Record the starting position of the mouse only if the Alt key is held
            clickStartX = e.clientX;
            clickStartY = e.clientY;
        }
    });

    windowDiv.addEventListener('mouseup', (e) => {
        if (e.getModifierState(controls.altKey.value)) {
            const distanceMoved = Math.sqrt(Math.pow(e.clientX - clickStartX, 2) + Math.pow(e.clientY - clickStartY, 2));
            // Check if the mouse has moved more than a certain threshold
            const dragThreshold = 10; // pixels
            if (distanceMoved < dragThreshold) SelectedNodes.toggleNode(node);
        }

        if (e.button !== 2) ContextMenu.hide(); // not right mouse button
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

    titleInput.addEventListener('paste', Elem.stopPropagationOfEvent);

    titleInput.addEventListener('mousedown', () => { isMouseDown = true; });

    titleInput.addEventListener('mousemove', (e) => {
        if (isMouseDown) { isDragging = true; }
        if (isDragging && !e.getModifierState(controls.altKey.value)) {
            titleInput.selectionStart = titleInput.selectionEnd; // Reset selection
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        isMouseDown = false;
    });

    titleInput.addEventListener('mouseleave', ()=>(isDragging = false) );
}

function setupResizeHandleListeners(node) {
    const resizeHandle = node.windowDiv.querySelector('.resize-handle');
    setResizeEventListeners(resizeHandle, node);
}

function rewindowify(node) {
    initWindow(node);

    node.push_extra("window");
    let w = node.content;

    const btnDel = w.querySelector("#button-delete");
    btnDel.classList.add('windowbutton');

    const btnFs = w.querySelector("#button-fullscreen");
    btnFs.classList.add('windowbutton');

    const btnCol = w.querySelector("#button-collapse");
    btnCol.classList.add('windowbutton');

    let titleInput = node.titleInput;

    function set(btn, v, s = "fill") {
        btn.children[0].setAttribute('fill', settings.buttonGraphics[v][0]);
        btn.children[1].setAttribute(s, settings.buttonGraphics[v][1]);
    }

    function ui(btn, cb = ()=>{}, s = "fill") {
        btn.onmouseenter = (e)=>set(btn, "hover", s);
        btn.onmouseleave = (e) => {
            const state = (titleInput.matches(':focus') ? 'focus' : 'initial');
            set(btn, state, s);
            btn.ready = false;
        };
        btn.onmousedown = (e) => {
            set(btn, "click", s);
            btn.ready = true;
            cancel(e);
        }
        btn.onmouseup = (e) => {
            set(btn, "initial", s);
            cancel(e);
            if (btn.ready) cb(e);
        }
        btn.onmouseleave();
    }

    ui(btnDel, () => {
        const title = node.getTitle();
        if (prevNode === node) {
            prevNode = undefined;
            mousePath = '';
            svg_mousePath.setAttribute('d', '');
        }
        node.remove();
        if (node.isTextNode) {
            nodeInfo = getZetNodeCMInstance(node)
            const parser = nodeInfo.parser;
            parser.deleteNodeByTitle(title);
        }
    });

    ui(btnFs, () => {
        node.zoom_to_fit();
        zoomTo = zoomTo.scale(1.2);
        autopilotSpeed = settings.autopilotSpeed;
        if (node.isTextNode) {
            nodeInfo = getZetNodeCMInstance(node);
            nodeInfo.ui.scrollToTitle(node.getTitle());
            zetPanes.switchPane(nodeInfo.paneId);
        }
    });

    ui(btnCol, ()=>toggleNodeState(node) , "stroke");

    document.addEventListener('mouseup',
        ()=>{ if (node.followingMouse) node.stopFollowingMouse() }
    );

    function updateSvgStrokeColor(focused) {
        const fillColor = settings.buttonGraphics[focused ? 'focus' : 'initial'][1];
        const strokeColor = settings.buttonGraphics[focused ? 'focus' : 'initial'][1];

        node.content.querySelector("#button-delete").children[1].setAttribute('fill', fillColor);
        node.content.querySelector("#button-fullscreen").children[1].setAttribute('fill', fillColor);
        node.content.querySelector("#button-collapse").children[1].setAttribute('stroke', strokeColor);
    }

    if (titleInput) {
        titleInput.addEventListener('focus', updateSvgStrokeColor.bind(null, true));
        titleInput.addEventListener('blur', updateSvgStrokeColor.bind(null, false));
    }

    return node;
}

function addNodeAtNaturalScale(title, content, scale = 1, nscale_mult = 0.5, window_it = true) {
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
    let id = Graph.nodes.length;
    let div = node.content;
    /*div.setAttribute("onclick","(e)=>nodes["+id+"].onclick(e)");
    div.setAttribute("onmousedown","(e)=>nodes["+id+"].onmousedown(e)");
    div.setAttribute("onmouseup","(e)=>nodes["+id+"].onmouseup(e)");
    div.setAttribute("onmousemove","(e)=>nodes["+id+"].onmousemove(e)");*/
    Graph.nodes.push(node);
    nodeMap[node.uuid] = node;
}

function scalingFactorsFromElem(element) {
    const style = window.getComputedStyle(element);
    const width = parseFloat(style.width);
    const height = parseFloat(style.height);
    const isZero = (width === 0 || height === 0);

    const rect = element.getBoundingClientRect();
    return {
        scaleX: (isZero ? 1 : rect.width / width),
        scaleY: (isZero ? 1 : rect.height / height)
    };
}

// impact on responsiveness?
//addEventListener('resize', (e) => { });

function setResizeEventListeners(resizeHandle, node) {
    const inverse2DMatrix = (matrix) => {
        const det = matrix[0] * matrix[3] - matrix[1] * matrix[2];
        if (det === 0) return null;

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
        if (transform === 'none') return [1, 0, 0, 1];

        const matrix = transform
            .split('(')[1]
            .split(')')[0]
            .split(',')
            .map(parseFloat)
            .slice(0, 4);
        return inverse2DMatrix(matrix);
    };

    let windowDiv = node.windowDiv;

    let startX;
    let startY;
    let startWidth;
    let startHeight;

    let isMouseMoving = false;

    const handleMouseMove = (e) => {
        if (!e.buttons) {
            handleMouseUp();
            return;
        }

        isMouseMoving = true;

        // Calculate the change in position of the mouse considering the accumulated transform matrix
        const scalingFactors = scalingFactorsFromElem(windowDiv);
        const dx = 2 * (e.pageX - startX) / scalingFactors.scaleX;
        const dy = 2 * (e.pageY - startY) / scalingFactors.scaleY;

        const content = node.innerContent;
        const minWidth = content ? content.offsetWidth + 0 : 100;
        const minHeight = content ? content.offsetHeight + 35 : 100;
        const newWidth = Math.max(startWidth + dx, minWidth);
        const newHeight = Math.max(startHeight + dy, minHeight);
        windowDiv.style.maxWidth = `${newWidth}px`;
        windowDiv.style.width = `${newWidth}px`;
        windowDiv.style.height = `${newHeight}px`;

        const style = node.textNodeSyntaxWrapper?.style;
        if (style) {
            style.flexGrow = '1';
            style.minHeight = `0px`;
            style.maxHeight = `100%`;
            style.width = `100%`;
        }

        const htmlView = node.htmlView;
        if (htmlView) {
            htmlView.style.width = '100%';
            htmlView.style.height = '100%';
        }

        const aiNodeWrapperDiv = node.ainodewrapperDiv;
        if (aiNodeWrapperDiv) {
            aiNodeWrapperDiv.style.flexGrow = '1';
            aiNodeWrapperDiv.style.width = '100%';
        }

        const fileTreeContainer = node.fileTreeContainer;
        if (fileTreeContainer) {
            fileTreeContainer.style.width = '100%';
        }
    };

    const handleMouseUp = () => {
        isMouseMoving = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'auto';
        node.enableIframePointerEvents();
    };
    resizeHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startX = e.pageX;
        startY = e.pageY;
        startWidth = parseInt(document.defaultView.getComputedStyle(windowDiv).width, 10);
        startHeight = parseInt(document.defaultView.getComputedStyle(windowDiv).height, 10);
        isMouseMoving = true; // Flag to indicate that a resize operation is in progress
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        node.disableIframePointerEvents();
    });

}

function resetWindowDivSize(windowDiv) {
    const style = windowDiv.style;
    style.width = 'fit-content';
    style.height = 'fit-content';
    style.maxWidth = 'fit-content';
    style.maxHeight = 'fit-content';
}

function observeContentResize(windowDiv, iframeWrapper, displayWrapper) {
    const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const { width, height } = entry.contentRect;

            const buttonsWrapper = windowDiv.querySelector(".buttons-wrapper");
            if (!buttonsWrapper) continue;

            const buttonsHeight = buttonsWrapper.offsetHeight || 0;
            const iframeHeight = Math.max(0, height - buttonsHeight - 50); // Subtract additional margin

            iframeWrapper.style.width = width + 'px';
            iframeWrapper.style.height = iframeHeight + 'px';
            displayWrapper.style.width = width + 'px';
            displayWrapper.style.height = iframeHeight + 'px';
        }
    });

    resizeObserver.observe(windowDiv);
}

function observeParentResize(parentDiv, iframe, paddingWidth = 50, paddingHeight = 80) {
    const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const rect = entry.contentRect;
            iframe.style.width = Math.max(0, rect.width - paddingWidth) + 'px';
            iframe.style.height = Math.max(0, rect.height - paddingHeight) + 'px';
        }
    });

    resizeObserver.observe(parentDiv);
    return resizeObserver;
}
