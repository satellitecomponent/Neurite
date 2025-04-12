class NodeView {
    btnExpand = null;
    circleCollapsed = null;
    funcPopulate = 'populateForNode';
    constructor(node){
        this.id = node.uuid;
        this.model = node;
    }
    static byId(id){ return Graph.nodeViews[id] }

    static windowify(title, content, node, nscale_mult = 1, intrinsicScale = 1){
        const odiv = node.content;
        const div = Html.make.div('window');
        const svg = Elem.deepClone(Elem.byId('elements').children[0]);
        svg.setAttribute('class', 'button-container');

        const headerContainer = Html.make.div('header-container');
        headerContainer.appendChild(svg);

        div.appendChild(headerContainer);
        odiv.appendChild(div);

        const innerContent = Html.make.div('content');
        innerContent.append(...content);
        div.appendChild(innerContent);

        odiv.dataset.init = 'window';

        const inputWrapper = Html.make.div('title-input-wrapper');

        const titleInput = Html.make.input('title-input');
        titleInput.setAttribute('type', 'text');
        titleInput.setAttribute('value', title);

        const copyBtn = Html.make.div('copy-button');
        copyBtn.setAttribute('title', 'Copy title');
        const copyIcon = Elem.deepClone(Elem.byId('copy-icon-template'));
        copyIcon.style.display = ''; // unhide
        copyIcon.setAttribute('class', 'copy-icon'); // ✅ set the class here
        copyBtn.appendChild(copyIcon);

        inputWrapper.appendChild(titleInput);
        inputWrapper.appendChild(copyBtn);
        headerContainer.appendChild(inputWrapper);

        const resizeContainer = Html.make.div('resize-container');
        div.appendChild(resizeContainer);

        const resizeHandle = Html.make.div('resize-handle');
        resizeContainer.appendChild(resizeHandle);

        odiv.dataset.viewType = 'nodeViews';
        odiv.dataset.viewId = node.uuid;

        node.scale = nscale_mult * (Graph.zoom.mag2() ** settings.zoomContentExp);
        node.intrinsicScale = intrinsicScale;
        const view = node.view = new NodeView(node);
        view.div = div;
        view.rewindowify();
        return view;
    }

    init(){
        this.bindDOMRefs();
        this.initCollapsed();
        this.model.dropdown = document.querySelector('.dropdown');
        this.model.wrapperDivs = document.getElementsByClassName('wrapperDiv');

        On.mousedown(this.headerContainer, NodeView.onHeaderContainerMouseDown);
        this.setWindowDivListeners();
        this.setTitleInputListeners();
        this.setResizeEventListeners();
        this.observeContentResize(); // unknown wrappers
    }

    bindDOMRefs() {
        const div = this.div;

        this.headerContainer = div?.querySelector('.header-container') || null;
        this.titleInputWrapper = this.headerContainer?.querySelector('.title-input-wrapper') || null;
        this.titleInput = this.titleInputWrapper?.querySelector('.title-input') || null;
        this.copyBtn = this.titleInputWrapper?.querySelector('.copy-button') || null;
        this.innerContent = div?.querySelector('.content') || null;
        this.resizeHandle = div?.querySelector('.resize-handle') || null;
        this.buttons = this.headerContainer?.querySelector('.button-container') || null;
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
            if (e.getModifierState(controls.controlKey.value)) {
                // Record the starting position of the mouse only if the Alt key is held
                clickStartX = e.clientX;
                clickStartY = e.clientY;
            }
        });

        On.mouseup(windowDiv, (e) => {
            if (e.getModifierState(controls.controlKey.value) && e.button !== 2) {
                const distanceMoved = Math.sqrt(
                    Math.pow(e.clientX - clickStartX, 2) + Math.pow(e.clientY - clickStartY, 2)
                );
                const dragThreshold = 10; // pixels
                if (distanceMoved < dragThreshold) App.selectedNodes.toggleNode(node);
            }

            if (e.button !== 2) App.menuContext.hide(); // not right mouse button
        });

        On.mousedown(windowDiv, (e)=>{
            Autopilot.stop();
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

        On.dblclick(windowDiv, (e) => {
            const isTextArea = e.target.tagName === 'TEXTAREA';
            const isContentEditable = e.target.closest('[contenteditable="true"]');

            const isTextInteraction = isTextArea || isContentEditable;
            const altHeld = e.getModifierState(controls.altKey.value);

            if (isTextInteraction && !altHeld) {
                return; // Don’t toggle anchoring if inside text and Alt is not held
            }

            node.anchor = node.pos;
            node.anchorForce = 1 - node.anchorForce;
            node.toggleWindowAnchored(node.anchorForce === 1);
            e.stopPropagation();
        });
    }

    setTitleInputListeners(){
        const titleInput = this.titleInput;
        const copyBtn = this.copyBtn;
        const container = this.headerContainer;

        if (copyBtn && container) {
            container.addEventListener('mouseenter', () => {
                copyBtn.style.visibility = 'visible';
            });
            container.addEventListener('mouseleave', () => {
                copyBtn.style.visibility = 'hidden';
            });

            On.click(copyBtn, async () => {
                try {
                    titleInput.select();
                    await navigator.clipboard.writeText(titleInput.value);
                    copyBtn.classList.add('copied');
                    setTimeout(() => copyBtn.classList.remove('copied'), 600);
                } catch (err) {
                    console.error("Clipboard copy failed:", err);
                }
            });
        }

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

    rewindowify() {
        const node = this.model;
        this.init();

        node.push_extra("window");
        const buttons = this.buttons || this.headerContainer;

        const btnDel = buttons.querySelector('#button-delete');
        const btnFs = buttons.querySelector('#button-fullscreen');
        const btnCol = buttons.querySelector('#button-collapse');

        btnDel.classList.add('windowbutton');
        btnFs.classList.add('windowbutton');
        btnCol.classList.add('windowbutton');

        // Track buttons with their style mode
        this.svgButtons = [];

        this.svgButtons.push([btnDel, "fill"]);
        this.applySvgButtonUI(btnDel, () => {
            const title = node.getTitle();
            if (Node.prev === node) {
                Node.prev = null;
                App.nodeSimulation.mousePath = [];
                App.nodeSimulation.svg_mousePath.setAttribute('d', '');
            }
            node.remove();
            if (node.isTextNode) {
                const nodeInfo = getZetNodeCMInstance(node);
                nodeInfo.parser.deleteNodeByTitle(title);
            }
        });

        this.svgButtons.push([btnFs, "fill"]);
        this.applySvgButtonUI(btnFs, () => {
            Autopilot.zoomToFitFrame(node).targetZoom_scaleBy(1.2).start();
            if (node.isTextNode) {
                const nodeInfo = getZetNodeCMInstance(node);
                nodeInfo.ui.scrollToTitle(node.getTitle());
                App.zetPanes.switchPane(nodeInfo.paneId);
            }
        });

        this.svgButtons.push([btnCol, "stroke"]);
        this.applySvgButtonUI(btnCol, this.toggleCollapse.bind(this), "stroke");

        On.mouseup(document, (e) => {
            if (node.followingMouse) node.stopFollowingMouse();
        });

        if (this.titleInput) {
            On.focus(this.titleInput, () => this.updateSvgStrokeColor(true));
            On.blur(this.titleInput, () => this.updateSvgStrokeColor(false));
        }
    }

    updateSvgStrokeColor = (focused) => {
        const node = this.model;
        const style = focused ? 'focus' : 'initial';

        for (const [btn, mode] of this.svgButtons || []) {
            this.setSvgButtonStyle(btn, style, mode);
        }

        if (node.displayDiv) node.displayDiv.classList.toggle('focused', focused);
        this.resizeHandle.classList.toggle('focused', focused);
    };

    setSvgButtonStyle(btn, state, mode = "fill") {
        const [fill, stroke] = settings.buttonGraphics[state];

        // Background
        if (btn.children[0]) btn.children[0].setAttribute("fill", fill);

        // Main shape
        if (btn.children[1]) {
            if (mode === "stroke") btn.children[1].setAttribute("stroke", stroke);
            else btn.children[1].setAttribute("fill", stroke);
        }

        // Secondary shape (e.g. refresh arrowhead)
        if (btn.children[2] && btn.children[2].tagName !== "rect") {
            if (mode === "stroke") btn.children[2].setAttribute("stroke", stroke);
            else btn.children[2].setAttribute("fill", stroke);
        }
    }

    applySvgButtonUI(btn, cb = () => {}, mode = "fill") {
        const input = this.titleInput;

        const onMouseLeave = () => {
            const focusState = (input?.matches(':focus') ? 'focus' : 'initial');
            this.setSvgButtonStyle(btn, focusState, mode);
            btn.ready = false;
        };

        On.mouseenter(btn, () => this.setSvgButtonStyle(btn, "hover", mode));
        On.mouseleave(btn, onMouseLeave);
        On.mousedown(btn, (e) => {
            this.setSvgButtonStyle(btn, "click", mode);
            btn.ready = true;
            e.stopPropagation();
        });
        On.mouseup(btn, (e) => {
            this.setSvgButtonStyle(btn, "initial", mode);
            e.stopPropagation();
            if (btn.ready) cb(e);
        });

        onMouseLeave();
    }

    updateButtonContainerSize() {
        const svg = this.buttons;
        if (!svg) return;

        const buttonCount = svg.querySelectorAll('.windowbutton').length;
        const unitPerButton = 20; // how far each button is translated

        const requiredWidth = (buttonCount * unitPerButton) / 8;
        svg.setAttribute('viewBox', `0 0 ${requiredWidth} 2.125`);
    }

    addSvgButton(id, iconId, translateX, clickHandler, mode = "stroke") {
        const svgNs = "http://www.w3.org/2000/svg";
        const buttons = this.buttons;
        if (!buttons) return;

        // Prevent duplicate creation
        if (buttons.querySelector(`#${id}`)) {
            return buttons.querySelector(`#${id}`);
        }

        const g = document.createElementNS(svgNs, "g");
        g.setAttribute("id", id);
        g.setAttribute("transform", `scale(0.125 0.125) translate(${translateX} 1)`);
        g.classList.add("windowbutton");

        // Button background
        const bg = document.createElementNS(svgNs, "rect");
        bg.setAttribute("x", "0");
        bg.setAttribute("y", "0");
        bg.setAttribute("width", "16");
        bg.setAttribute("height", "16");
        bg.setAttribute("fill", "RGB(100,100,100)");
        bg.setAttribute("stroke", "none");
        g.appendChild(bg);

        // Icon from symbol
        const symbol = document.getElementById(iconId);
        if (!symbol) return;

        for (const child of symbol.children) {
            const clone = child.cloneNode(true);
            if (clone instanceof SVGGeometryElement || clone instanceof SVGElement) {
                clone.setAttribute(mode, settings.buttonGraphics.initial[1]);
                g.appendChild(clone);
            }
        }

        // Transparent click area
        const overlay = document.createElementNS(svgNs, "rect");
        overlay.setAttribute("x", "0");
        overlay.setAttribute("y", "0");
        overlay.setAttribute("width", "16");
        overlay.setAttribute("height", "16");
        overlay.setAttribute("fill", "transparent");
        overlay.setAttribute("stroke", "none");
        g.appendChild(overlay);

        buttons.appendChild(g);
        this.applySvgButtonUI(g, clickHandler, mode);
        this.updateButtonContainerSize();

        if (!this.svgButtons) this.svgButtons = [];
        this.svgButtons.push([g, mode]);

        return g;
    }

    static addAtNaturalScale(node, title, content, window_it = true){
        if (window_it) {
            if (!Array.isArray(content)) content = [content];
            NodeView.windowify(title, content, node, 0.5);
        } else {
            node.content.appendChild(content);
        }
        Graph.appendNode(node);
        Graph.addNode(node);
        return node.view || node.content;
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
        let resizeOverlay = null;

        let lastCall = 0;
        const throttleMs = 8; // ~125 FPS cap

        const handleMouseMove = (e) => {
            const now = performance.now();
            if (now - lastCall < throttleMs) return;
            lastCall = now;
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

            function setStyles(style, rules) {
                for (const key in rules) {
                    if (style[key] !== rules[key]) style[key] = rules[key];
                }
            }

            if (node.textNodeSyntaxWrapper?.style)
                setStyles(node.textNodeSyntaxWrapper.style, {
                    flexGrow: '1',
                    minHeight: '0px',
                    maxHeight: '100%',
                    width: '100%',
                });

            if (node.htmlView?.style)
                setStyles(node.htmlView.style, {
                    width: '100%',
                    height: '100%',
                });

            if (node.viewerWrapper?.style)
                setStyles(node.viewerWrapper.style, {
                    width: '100%',
                    height: '100%',
                });

            if (node.ainodewrapperDiv?.style)
                setStyles(node.ainodewrapperDiv.style, {
                    flexGrow: '1',
                    width: '100%',
                });

            if (node.fileTreeContainer?.style)
                setStyles(node.fileTreeContainer.style, {
                    width: '100%',
                });
        };

        On.mousedown(this.resizeHandle, (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Use the helper to add an overlay
            OverlayHelper.add('nwse-resize');

            startX = e.pageX;
            startY = e.pageY;
            startWidth = parseInt(document.defaultView.getComputedStyle(windowDiv).width, 10);
            startHeight = parseInt(document.defaultView.getComputedStyle(windowDiv).height, 10);
            isMouseMoving = true; // Indicate that a resize is in progress
            On.mousemove(document, handleMouseMove);
            On.mouseup(document, handleMouseUp);
        });

        const handleMouseUp = () => {
            isMouseMoving = false;
            Off.mousemove(document, handleMouseMove);
            Off.mouseup(document, handleMouseUp);
            // Remove the overlay via the helper
            OverlayHelper.remove();
        };
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

const OverlayHelper = {
    overlay: null,

    add(cursor = 'auto') {
        // If an overlay already exists, remove it first
        if (this.overlay) this.remove();

        this.overlay = document.createElement('div');
        Object.assign(this.overlay.style, {
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 9999,
            background: 'transparent',
            pointerEvents: 'auto',
            cursor,
        });
        document.body.appendChild(this.overlay);
        document.body.style.cursor = '';
    },

    remove() {
        if (!this.overlay) return;

        document.body.style.cursor = 'auto';

        try {
            this.overlay.remove();
        } catch (_) {}

        this.overlay = null;
    }
};

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
