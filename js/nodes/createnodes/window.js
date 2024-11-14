class NodeView {
    funcPopulate = 'populateForNode';
    originalSizes = null;
    constructor(node){
        this.id = node.uuid;
        this.model = node;
    }
    static byId(id){ return Graph.nodeViews[id] }

    static windowify(title, content, pos, scale, iscale, link){
        const odiv = Html.new.div();
        const div = Html.make.div('window');
        const svg = Elem.byId('elements').children[0].cloneNode(true);
        svg.setAttribute('class', 'button-container');

        const headerContainer = Html.make.div('header-container');
        headerContainer.appendChild(svg);

        div.appendChild(headerContainer);
        odiv.appendChild(div);

        const innerContent = Html.make.div('content');
        innerContent.append(...content);
        div.appendChild(innerContent);

        odiv.setAttribute('data-init', 'window');

        const titleInput = Html.make.input('title-input');
        titleInput.setAttribute('type', 'text');
        titleInput.setAttribute('value', title);
        headerContainer.appendChild(titleInput);

        const resizeContainer = Html.make.div('resize-container');
        div.appendChild(resizeContainer);

        const resizeHandle = Html.make.div('resize-handle');
        resizeContainer.appendChild(resizeHandle);

        const node = new Node(pos, odiv, scale, iscale || new vec2(1, 1));
        odiv.dataset.viewType = 'nodeViews';
        odiv.dataset.viewId = node.uuid;

        const view = node.view = new NodeView(node);
        view.buttons = svg;
        view.headerContainer = headerContainer;
        view.innerContent = innerContent;
        view.resizeHandle = resizeHandle;
        view.titleInput = titleInput;
        view.div = div;
        view.rewindowify();
        return view;
    }

    init(){
        this.model.dropdown = document.querySelector('.dropdown');
        this.model.wrapperDivs = document.getElementsByClassName('wrapperDiv');

        On.mousedown(this.headerContainer, NodeView.onHeaderContainerMouseDown);
        this.setWindowDivListeners();
        this.setTitleInputListeners();
        this.setResizeEventListeners();
        this.observeContentResize(); // unknown wrappers
    }

    static onHeaderContainerMouseDown(e){
        if (e.getModifierState(controls.altKey.value)) {
            e.stopPropagation() // Prevent dragging if Alt key is pressed
        }
    }

    setWindowDivListeners(){
        const node = this.model;
        const windowDiv = this.div;
        const dropdown = node.dropdown;
        const wrapperDivs = node.wrapperDivs;

        let clickStartX, clickStartY;

        On.mousedown(windowDiv, (e)=>{
            if (e.getModifierState(controls.altKey.value)) {
                // Record the starting position of the mouse only if the Alt key is held
                clickStartX = e.clientX;
                clickStartY = e.clientY;
            }
        });

        On.mouseup(windowDiv, (e)=>{
            if (e.getModifierState(controls.altKey.value)) {
                const distanceMoved = Math.sqrt(Math.pow(e.clientX - clickStartX, 2) + Math.pow(e.clientY - clickStartY, 2));
                // Check if the mouse has moved more than a certain threshold
                const dragThreshold = 10; // pixels
                if (distanceMoved < dragThreshold) SelectedNodes.toggleNode(node);
            }

            if (e.button !== 2) ContextMenu.hide(); // not right mouse button
        });

        On.mousedown(windowDiv, (e)=>{
            autopilotSpeed = 0;
            dropdown.classList.add('no-select');
            Array.from(wrapperDivs).forEach(div => div.classList.add('no-select'));
        });

        On.mouseup(windowDiv, (e)=>{
            dropdown.classList.remove('no-select');
            Array.from(wrapperDivs).forEach(div => div.classList.remove('no-select'));
        });

        On.mouseup(window, (e)=>{
            dropdown.classList.remove('no-select');
            Array.from(wrapperDivs).forEach(div => div.classList.remove('no-select'));
        });
    }

    setTitleInputListeners(){
        const titleInput = this.titleInput;
        let isDragging = false;
        let isMouseDown = false;

        On.paste(titleInput, Event.stopPropagation);

        On.mousedown(titleInput, (e)=>{ isMouseDown = true } );

        On.mousemove(titleInput, (e)=>{
            if (isMouseDown) { isDragging = true; }
            if (isDragging && !e.getModifierState(controls.altKey.value)) {
                titleInput.selectionStart = titleInput.selectionEnd; // Reset selection
            }
        });

        On.mouseup(document, (e)=>{
            isDragging = false;
            isMouseDown = false;
        });

        On.mouseleave(titleInput, (e)=>{ isDragging = false } );
    }

    rewindowify(){
        const node = this.model;
        this.init();

        node.push_extra("window");
        const buttons = this.buttons;

        const btnDel = buttons.querySelector('#button-delete');
        btnDel.classList.add('windowbutton');

        const btnFs = buttons.querySelector('#button-fullscreen');
        btnFs.classList.add('windowbutton');

        const btnCol = buttons.querySelector('#button-collapse');
        btnCol.classList.add('windowbutton');

        const titleInput = this.titleInput;

        function set(btn, v, s = "fill") {
            btn.children[0].setAttribute('fill', settings.buttonGraphics[v][0]);
            btn.children[1].setAttribute(s, settings.buttonGraphics[v][1]);
        }

        function ui(btn, cb = ()=>{}, s = "fill") {
            function onMouseLeave(){
                const state = (titleInput.matches(':focus') ? 'focus' : 'initial');
                set(btn, state, s);
                btn.ready = false;
            }

            On.mouseenter(btn, (e)=>set(btn, "hover", s) );
            On.mouseleave(btn, onMouseLeave);
            On.mousedown(btn, (e)=>{
                set(btn, "click", s);
                btn.ready = true;
                e.stopPropagation();
            });
            On.mouseup(btn, (e)=>{
                set(btn, "initial", s);
                e.stopPropagation();
                if (btn.ready) cb(e);
            });

            onMouseLeave();
        }

        ui(btnDel, () => {
            const title = node.getTitle();
            if (Node.prev === node) {
                Node.prev = null;
                nodeSimulation.mousePath = [];
                nodeSimulation.svg_mousePath.setAttribute('d', '');
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

        ui(btnCol, this.toggleCollapse.bind(this), "stroke");

        On.mouseup(document,
            (e)=>{ if (node.followingMouse) node.stopFollowingMouse() }
        );

        function updateSvgStrokeColor(focused) {
            const fillColor = settings.buttonGraphics[focused ? 'focus' : 'initial'][1];
            const strokeColor = settings.buttonGraphics[focused ? 'focus' : 'initial'][1];

            btnDel.children[1].setAttribute('fill', fillColor);
            btnFs.children[1].setAttribute('fill', fillColor);
            btnCol.children[1].setAttribute('stroke', strokeColor);
        }

        if (titleInput) {
            On.focus(titleInput, updateSvgStrokeColor.bind(null, true));
            On.blur(titleInput, updateSvgStrokeColor.bind(null, false));
        }
    }

    static addAtNaturalScale(title, content, iscale = 1, nscale_mult = 0.5, window_it = true) {
        const scale = nscale_mult * (zoom.mag2() ** settings.zoomContentExp);
        let node;
        if (window_it) {
            const pos = toZ(mousePos);
            if (!Array.isArray(content)) content = [content];
            node = NodeView.windowify(title, content, pos, scale, iscale).model;
        } else {
            const div = Html.new.div();
            node = new Node(toZ(mousePos), div, scale, iscale);
            div.appendChild(content);
        }
        Graph.appendNode(node);
        Graph.addNode(node);
        return node;
    }

    // impact on responsiveness?
    // On.resize(window, (e)=>{ } );

    setResizeEventListeners(){
        const node = this.model;
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

        let windowDiv = this.div;

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

            const content = this.innerContent;
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
            Off.mousemove(document, handleMouseMove);
            Off.mouseup(document, handleMouseUp);
            document.body.style.cursor = 'auto';
            node.enableIframePointerEvents();
        };
        On.mousedown(this.resizeHandle, (e)=>{
            e.preventDefault();
            e.stopPropagation();
            startX = e.pageX;
            startY = e.pageY;
            startWidth = parseInt(document.defaultView.getComputedStyle(windowDiv).width, 10);
            startHeight = parseInt(document.defaultView.getComputedStyle(windowDiv).height, 10);
            isMouseMoving = true; // Flag to indicate that a resize operation is in progress
            On.mousemove(document, handleMouseMove);
            On.mouseup(document, handleMouseUp);
            node.disableIframePointerEvents();
        });
    }

    resetWindowDivSize(){
        const style = this.div.style;
        style.width = 'fit-content';
        style.height = 'fit-content';
        style.maxWidth = 'fit-content';
        style.maxHeight = 'fit-content';
    }
    
    observeContentResize(iframeWrapper, displayWrapper){
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
    
                const buttonsWrapper = this.div.querySelector(".buttons-wrapper");
                if (!buttonsWrapper) continue;
    
                const buttonsHeight = buttonsWrapper.offsetHeight || 0;
                const iframeHeight = Math.max(0, height - buttonsHeight - 50); // Subtract additional margin
    
                iframeWrapper.style.width = width + 'px';
                iframeWrapper.style.height = iframeHeight + 'px';
                displayWrapper.style.width = width + 'px';
                displayWrapper.style.height = iframeHeight + 'px';
            }
        });
    
        resizeObserver.observe(this.div);
    }

    toggleSelected(value){ this.div.classList.toggle('selected', value) }
    static toggleSelectedToThis(nodeView){ nodeView.toggleSelected(this) }
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
