//https://github.com/tc39/proposal-regex-escaping/blob/main/specInJs.js
// this is a direct translation to code of the spec
if (!RegExp.escape) {
    RegExp.escape = (S) => {
        // 1. let str be ToString(S).
        // 2. ReturnIfAbrupt(str).
        let str = String(S);
        // 3. Let cpList be a List containing in order the code
        // points as defined in 6.1.4 of str, starting at the first element of str.
        let cpList = Array.from(str[Symbol.iterator]());
        // 4. let cuList be a new List
        let cuList = [];
        // 5. For each code point c in cpList in List order, do:
        for (let c of cpList) {
            // i. If c is a SyntaxCharacter then do:
            if ("^$\\.*+?()[]{}|".indexOf(c) !== -1) {
                // a. Append "\" to cuList.
                cuList.push("\\");
            }
            // Append c to cpList.
            cuList.push(c);
        }
        //6. Let L be a String whose elements are, in order, the elements of cuList.
        let L = cuList.join("");
        // 7. Return L.
        return L;
    };
}


        var mousePos = new vec2(0, 0);
        var mousePath = "";

        var zoom = new vec2(1.5, 0); //bigger is further out
        var pan = new vec2(-0.3, 0);

        var zoomTo = new vec2(4, 0);
        var panTo = new vec2(0, 0);
        var autopilotReferenceFrame = undefined;
        var autopilotSpeed = 0;

        function skipAutopilot() {
            zoom = zoomTo
            pan = autopilotReferenceFrame ? autopilotReferenceFrame.pos.plus(panTo) : panTo;
        }


function toggleNodeState(nodeOrTitle, cm, event) {
    let node;
    let title;

    if (typeof nodeOrTitle === 'string') {
        title = nodeOrTitle;
        node = getNodeByTitle(title);
    } else {
        node = nodeOrTitle;
        title = node.getTitle();
    }

    if (!node || !node.content) return;
    let div = node.content.querySelector('.window');
    let circle = div.querySelector('.collapsed-circle'); // Find the circle here

    // Collapse or expand based on current state
    if (div && div.collapsed) {
        expandNode(node, div, circle);
        if (title) showNodeText(title, cm); // Show node text in CodeMirror
    } else {
        collapseNode(node)(null);
        if (title) hideNodeText(title, cm); // Hide node text in CodeMirror
    }

    // Check if the CTRL key is being held
    if (event && event.ctrlKey) {
        let allConnectedNodes = getAllConnectedNodes(node);
        allConnectedNodes.forEach(connectedNode => {
            toggleNodeState(connectedNode, cm); // Pass the connected node
        });
    }
}

function collapseNode(node) {
    return function (event) {
        let div = node.content.querySelector('.window');
        let titleInput = div.querySelector('.title-input');
        let headerContainer = div.querySelector('.header-container');

        if (!div.collapsed) {
            div.originalSize = {
                width: div.offsetWidth,
                height: div.offsetHeight
            };

            // Hide all children of the window div except headerContainer and titleInput
            Array.from(div.children).forEach(child => {
                if (child !== headerContainer && child !== titleInput) {
                    child.style.display = 'none';
                }
            });

            // Hide all children of headerContainer except titleInput
            Array.from(headerContainer.children).forEach(child => {
                if (child !== titleInput) {
                    child.style.display = 'none';
                }
            });

            div.style.display = 'relative';
            // Adjust the window to make it look like a circle
            div.style.width = '60px';
            div.style.height = '60px';
            div.style.borderRadius = '50%';
            // Capture the box-shadow of the window div
            let boxShadow = getComputedStyle(div).boxShadow;

            div.style.boxShadow = 'none'; // Remove box-shadow from div
            div.classList.add('collapsed');

            // Position title input in the center
            titleInput.style.position = 'absolute';
            titleInput.style.top = '50%';
            titleInput.style.left = '50%';
            titleInput.style.transform = 'translate(-50%, -50%)';
            titleInput.style.border = 'none';
            titleInput.style.textAlign = 'center';
            titleInput.style.pointerEvents = 'none';
            titleInput.style.fontSize = '25px';

            // Create the circle
            let circle = document.createElement('div');
            circle.className = 'collapsed-circle';
            circle.style.borderRadius = '50%';
            circle.style.boxShadow = boxShadow;

            div.appendChild(circle);

            // Prevent the browser's default drag behavior for the circle
            circle.ondragstart = function (event) {
                event.preventDefault();
            };

            // If window is anchored, switch out for the collapsed node anchor class
            if (div.classList.contains('window-anchored')) {
                div.classList.remove('window-anchored');
                circle.classList.add('collapsed-anchor');
            }

            function handleCircleDoubleClick(event) {
                if (nodeMode !== 1) {
                    if (circle.classList.contains('collapsed-anchor')) {
                        circle.classList.remove('collapsed-anchor');
                    } else {
                        circle.classList.add('collapsed-anchor');
                    }
                } else {
                    // Call the toggleNodeState function instead of expanding the node directly
                    toggleNodeState(node, myCodeMirror, event); // Assuming myCodeMirror is in scope
                    event.stopPropagation(); // Prevent the event from propagating up the DOM tree only in node mode
                }
            }

            circle.addEventListener('dblclick', handleCircleDoubleClick);

            //Flag for toggleanchored in node class
            div.collapsed = true;
        } else {
            expandNode(node, div);
        }
    }
}

function expandNode(node, div, circle) {
    // Reset the window properties
    div.style.display = '';
    div.style.borderRadius = '';
    div.style.width = div.originalSize ? div.originalSize.width + 'px' : '';
    div.style.height = div.originalSize ? div.originalSize.height + 'px' : '';
    div.style.backgroundColor = '';
    div.style.borderColor = '';
    div.style.boxShadow = '';
    div.classList.remove('collapsed');

    // Show all the children of the window div
    let children = Array.from(div.children);
    for (let child of children) {
        child.style.display = '';
    }

    // Show the children of the header container
    let headerChildren = Array.from(div.querySelector('.header-container').children);
    for (let child of headerChildren) {
        child.style.display = '';
    }

    // Reset the title input's position and transformation
    let titleInput = div.querySelector('.title-input');
    titleInput.style.position = '';
    titleInput.style.top = '';
    titleInput.style.left = '';
    titleInput.style.transform = '';
    titleInput.style.textAlign = '';
    titleInput.style.pointerEvents = '';
    titleInput.style.border = '';
    titleInput.style.fontSize = '';

    // Transfer the .window-anchored class from circle to node.content if present
    if (circle && circle.classList.contains('collapsed-anchor')) {
        div.classList.add('window-anchored');
        circle.classList.remove('collapsed-anchor');
    }

    // Remove the circle from the window div
    if (circle) {
        div.removeChild(circle);
    }

    div.collapsed = false;
}

        function windowify(title, content, pos, scale, iscale, link) {
            let odiv = document.createElement('div');
            let div = document.createElement('div');
            let buttons = document.getElementById("elements").children[0];
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

            div.addEventListener('click', (event) => {
                event.stopPropagation();
                if (event.altKey) {
                    div.classList.toggle('selected');
                }
            });

            let dropdown = document.querySelector('.dropdown');

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
                windowDiv.style.width = `${newWidth}px`;
                windowDiv.style.height = `${newHeight}px`;
            };

            const handleMouseUp = () => {
                isMouseMoving = false;
                // Remove event listeners when mouse is released
                removeEventListeners();
            };

            const addEventListeners = () => {
                // Listen for mousemove and mouseup on the entire document
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            };

            const removeEventListeners = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };

            resizeHandle.addEventListener('mousedown', (event) => {
                event.preventDefault();
                event.stopPropagation();
                startX = event.pageX;
                startY = event.pageY;
                startWidth = parseInt(document.defaultView.getComputedStyle(windowDiv).width, 10);
                startHeight = parseInt(document.defaultView.getComputedStyle(windowDiv).height, 10);

                addEventListeners();
            });

            resizeHandle.addEventListener('mouseenter', addEventListeners);

            resizeHandle.addEventListener('mouseleave', (event) => {
                if (!event.buttons) {
                    document.body.style.cursor = 'auto';
                    removeEventListeners();
                }
            });

            windowDiv.addEventListener('mouseleave', (event) => {
                if (!event.buttons) {
                    document.body.style.cursor = 'auto';
                    removeEventListeners();
                }
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

//used for programatic interaction in zettelkasten.js
function adjustTextareaHeight(textarea) {
    requestAnimationFrame(() => {
        // Save the current scroll state
        const currentScrollTop = textarea.scrollTop;
        const currentClientHeight = textarea.clientHeight;

        // Determine the distance from the current scroll position to the bottom before height adjustment
        const distanceToBottomBeforeAdjustment = textarea.scrollHeight - currentScrollTop - currentClientHeight;

        // Epsilon for determining how close the user must be to the bottom
        const epsilon = 100;

        // Determine if the user is at the bottom before the adjustment
        const isAtBottom = distanceToBottomBeforeAdjustment < epsilon;


        // Adjust the height
        textarea.style.height = "";
        textarea.style.height = Math.min(textarea.scrollHeight, textarea.maxHeight || Infinity) + "px";

        // If the user was at the bottom, scroll them to the bottom again
        if (isAtBottom) {
            textarea.scrollTop = textarea.scrollHeight - textarea.clientHeight;
        }
    });
}
//used for user interaction in create text node
function adjustTextareaElement(node, element) {
    let max_height = 300; // Set maximum height in pixels

    // Function to adjust the height and handle overflow of the textarea
    const adjustHeight = (element) => {
        if (!node.isResizing) {
            if (element.scrollHeight > max_height) {
                if (element.clientHeight < max_height) {
                    element.style.height = max_height + 'px';
                    element.style.overflowY = 'auto';
                }
            } else {
                element.style.height = 'auto'; // Reset the height
                element.style.height = element.scrollHeight + 'px'; // Set to scrollHeight
            }
        }
    };

    // Function to auto-scroll to the bottom if user is already at the bottom
    const autoScrollToBottom = (element) => {
        if (element.scrollTop + element.clientHeight >= element.scrollHeight - 5) {
            // Using scrollIntoView to smoothly scroll to the bottom
            element.scrollIntoView(false);
        }
    };

    node.isResizing = false;

    element.addEventListener('mousedown', (e) => {
        node.isResizing = true;
    });

    element.addEventListener('mouseup', (e) => {
        node.isResizing = false;
    });

    adjustHeight(element);

    node.observer = new ResizeObserver(() => {
        adjustHeight(element);
    });
    node.observer.observe(element);

    let prevScrollHeight = element.scrollHeight;

    const mutationObserver = new MutationObserver(() => {
        if (element.scrollHeight !== prevScrollHeight) {
            adjustHeight(element);
            autoScrollToBottom(element);
            prevScrollHeight = element.scrollHeight;
        }
    });

    mutationObserver.observe(element, {
        childList: true,
        subtree: true,
        characterData: true
    });
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


        var movingNode = undefined;
        let prevNode = undefined;
        var NodeUUID = 0;
        var nodeMap = {};
        var draggedNode = null;
        var mousedownNode = undefined;

        function nextUUID() {
            while (nodeMap[NodeUUID] !== undefined) {
                NodeUUID++;
            }
            return NodeUUID;
        }
class Node {
    constructor(p, thing, scale = 1, intrinsicScale = 1, createEdges = true) {
        this.anchor = new vec2(0, 0);
        this.anchorForce = 0;
        this.mouseAnchor = new vec2(0, 0);
        this.edges = [];
        this.createdAt = new Date().toISOString();
        this.init = (nodeMap) => { };
        if (p === undefined) {
            let n = thing;
            let o = JSON.parse(n.dataset.node_json)
            for (const k of ['anchor', 'mouseAnchor', 'vel', 'pos', 'force']) {
                o[k] = new vec2(o[k]);
            }
            for (const k in o) {
                this[k] = o[k];
            }
            this.save_extras = [];
            this.content = thing;
            if (n.dataset.node_extras) {
                o = JSON.parse(n.dataset.node_extras);
                for (const e of o) {
                    NodeExtensions[e.f](this, e.a);
                }
            }
            this.attach();
            this.content.setAttribute("data-uuid", this.uuid);
            if (n.dataset.edges !== undefined && createEdges) {
                let es = JSON.parse(n.dataset.edges);
                this.init = ((nodeMap) => {
                    for (let e of es) {
                        edgeFromJSON(e, nodeMap);
                    }
                }).bind(this);
            }
            return;
        } else {
            this.uuid = nextUUID();
        }
        this.uuid = "" + this.uuid;

        this.pos = p;
        this.scale = scale;
        this.intrinsicScale = intrinsicScale;

        this.content = thing;

        this.vel = new vec2(0, 0);
        this.force = new vec2(0, 0);
        this.followingMouse = 0;
        this.followingAiCursor = false;
        this.aiCursorAnchor = new vec2(0, 0);

        this.removed = false;

        this.content.setAttribute("data-uuid", this.uuid);
        this.attach();
        this.save_extras = [];
    }
    attach() {
        let div = this.content;
        let node = this;
        div.onclick = node.onclick.bind(node);
        div.ondblclick = node.ondblclick.bind(node);
        div.onmousedown = node.onmousedown.bind(node);
        document.onmousemove = this.onmousemove.bind(this);
        document.onmouseup = this.onmouseup.bind(this);
        div.onwheel = node.onwheel.bind(node);
    }
    json() {
        return JSON.stringify(this, (k, v) => {
            if (k === "content" || k === "edges" || k === "save_extras" || k === "aiResponseEditor" || k === "aiCursor") {
                return undefined;
            }
            return v;
        });
    }
    push_extra_cb(f) {
        this.save_extras.push(f);
    }
    push_extra(func_name, args = undefined) {
        this.save_extras.push({
            f: func_name,
            a: args
        });
    }
    draw() {
        put(this.content, this.pos, this.intrinsicScale * this.scale * (zoom.mag2() ** -settings.zoomContentExp));

        // Before saving, get the current title input value and store it in a data-attribute
        let titleInput = this.content.querySelector('.title-input');
        if (titleInput) {
            this.content.setAttribute('data-title', titleInput.value);
        }

        this.content.setAttribute("data-node_json", this.json());
        let se = [];
        for (let e of this.save_extras) {
            se.push(typeof e === "function" ? e(this) : e);
        }
        this.content.setAttribute("data-node_extras", JSON.stringify(se));
    }
    zoom_to_fit(margin = 1) {
        let bb = this.content.getBoundingClientRect();
        let svgbb = svg.getBoundingClientRect();
        let so = windowScaleAndOffset();
        let aspect = svgbb.width / svgbb.height;
        let scale = bb.height * aspect > bb.width ? svgbb.height / (margin * bb.height) : svgbb.width / (margin * bb.width);
        this.zoom_by(1 / scale);
    }
    zoom_by(s = 1) {
        panTo = new vec2(0, 0); //this.pos;
        let gz = ((s) ** (-1 / settings.zoomContentExp));
        zoomTo = zoom.unscale(gz ** 0.5);
        autopilotReferenceFrame = this;
        panToI = new vec2(0, 0);
    }
    zoom_to(s = 1) {
        panTo = new vec2(0, 0); //this.pos;
        let gz = zoom.mag2() * ((this.scale * s) ** (-1 / settings.zoomContentExp));
        zoomTo = zoom.unscale(gz ** 0.5);
        autopilotReferenceFrame = this;
        panToI = new vec2(0, 0);
    }
    addEdge(edge) {
        this.edges.push(edge);
        this.updateEdgeData();
    }
    updateEdgeData() {
        let es = JSON.stringify(this.edges.map((e) => e.dataObj()));
        this.content.setAttribute("data-edges", es);
    }
    getTitle() {
        return this.content.getAttribute('data-title');
    }


    step(dt) {
        if (dt === undefined || isNaN(dt)) {
            dt = 0;
        } else {
            if (dt > 1) {
                dt = 1;
            }
        }
        if (!this.followingMouse) {
            this.pos = this.pos.plus(this.vel.scale(dt / 2));
            this.vel = this.vel.plus(this.force.scale(dt));
            this.pos = this.pos.plus(this.vel.scale(dt / 2));
            this.force = this.vel.scale(-Math.min(this.vel.mag() + 0.4 + this.anchorForce, 1 / (dt + 1e-300)));
        } else {
            this.vel = new vec2(0, 0);
            this.force = new vec2(0, 0);
        }
        if (this.followingAiCursor) {
            let p = toZ(this.aiCursor.position).minus(this.aiCursorAnchor);
            this.vel = p.minus(this.pos).unscale(nodeMode ? 1 : dt);
            this.pos = p;
            this.anchor = this.pos;
        }
        if (this.aiCursor) {
            this.pos = toDZ(this.aiCursor.position);
        }
        let g = mandGrad(settings.iterations, this.pos);
        //g.y *= -1; //why?
        this.force = this.force.plus(g.unscale((g.mag2() + 1e-10) * 300));
        this.force = this.force.plus(this.anchor.minus(this.pos).scale(this.anchorForce));
        //let d = toZ(mousePos).minus(this.pos);
        //this.force = this.force.plus(d.scale(this.followingMouse/(d.mag2()+1)));
        if (this.followingMouse) {
            let p = toZ(mousePos).minus(this.mouseAnchor);
            this.vel = p.minus(this.pos).unscale(nodeMode ? 1 : dt);
            this.pos = p;
            this.anchor = this.pos;
        }
        //this.force = this.force.plus((new vec2(-.1,-1.3)).minus(this.pos).scale(0.1));
        this.draw();
    }
    searchStrings() {
        function* search(e) {
            yield e.textContent;
            if (e.value)
                yield e.value;
            for (let c of e.children) {
                yield* search(c);
            }
        }
        return search(this.content);
    }
    onclick(event) {

    }
    toggleWindowAnchored(anchored) {
        let windowDiv = this.content.querySelector('.window');
        if (windowDiv && !windowDiv.collapsed) { // Check if not collapsed
            if (anchored) {
                windowDiv.classList.add("window-anchored");
            } else {
                windowDiv.classList.remove("window-anchored");
            }
        }
    }
    ondblclick(event) {
        this.anchor = this.pos;
        this.anchorForce = 1 - this.anchorForce;
        this.toggleWindowAnchored(this.anchorForce === 1);
        //let connectednodes = getAllConnectedNodesData(this)
        //console.log(connectednodes)
        cancel(event);
    }
    onmousedown(event) {
        this.mouseAnchor = toZ(new vec2(event.clientX, event.clientY)).minus(this.pos);
        this.followingMouse = 1;
        window.draggedNode = this;
        movingNode = this;
        if (nodeMode) {
            if (prevNode === undefined) {
                prevNode = this;
            } else {
                connectDistance(this, prevNode, this.pos.minus(prevNode.pos).mag() / 2);
                prevNode = undefined;
            }
        }
        // Add an event listener to window.mouseup that stops the node from following the mouse
        window.addEventListener('mouseup', () => this.stopFollowingMouse());
        cancel(event);
    }

    stopFollowingMouse() {
        this.followingMouse = 0;
        movingNode = undefined;
        // Remove the event listener to clean up
        window.removeEventListener('mouseup', this.stopFollowingMouse);
    }
    onmouseup(event) {
        if (this === window.draggedNode) {
            this.followingMouse = 0;
            window.draggedNode = undefined;
        }
    }
    onmousemove(event) {
        if (this === window.draggedNode) {
            prevNode = undefined;
        }
        /*if (this.followingMouse){
        this.pos = this.pos.plus(toDZ(new vec2(event.movementX,event.movementY)));
        this.draw()
        //cancel(event);
        }*/
    }
    onwheel(event) {
                if (nodeMode) {
                    let amount = Math.exp(event.wheelDelta * -settings.zoomSpeed);
                    let targetWindow = event.target.closest('.window');

                    // Check if the event target is a selected window
                    if (targetWindow && targetWindow.classList.contains('selected')) {
                        // Get all selected windows
                        const selectedWindows = document.querySelectorAll('.window.selected');

                        // Scale all selected windows
                        selectedWindows.forEach((selectedWindow) => {
                            let winNode = selectedWindow.win;

                            // Modify the scaling logic for selected windows here
                            winNode.scale *= amount;
                            winNode.pos = winNode.pos.lerpto(toZ(mousePos), 1 - amount);

                            // Scale edges connected to the selected window
                            winNode.edges.forEach((edge) => {
                                edge.scaleEdge(amount);
                            });
                        });
                    } else {
                        // Scale the current window
                        this.scale *= amount;
                        this.pos = this.pos.lerpto(toZ(mousePos), 1 - amount);
                    }

                    cancel(event);
                }
            }
            remove() {
                let dels = [];
                for (let n of nodes) {
                    for (let e of n.edges) {
                        if (e.pts.includes(this)) {
                            dels.push(e);
                        }
                    }
                }
                for (let e of dels) {
                    e.remove();
                }

                // Remove this node from the edges array of any nodes it was connected to
                for (let n of nodes) {
                    n.edges = n.edges.filter(edge => !edge.pts.includes(this));
                }

                let index = nodes.indexOf(this);
                if (index !== -1) {
                    nodes.splice(index, 1);
                }
                if (nodeMap[this.uuid] === this) {
                    delete nodeMap[this.uuid];
                }

                this.removed = true;
                this.content.remove();
            }

        }
        let htmlnodes_parent = document.getElementById("nodes");
        let htmlnodes = htmlnodes_parent.children;
        let htmledges = document.getElementById("edges");

function edgeFromJSON(o, nodeMap) {
    let pts = o.p.map((k) => nodeMap[k]);

    if (pts.includes(undefined)) {
        console.warn("missing keys", o, nodeMap);
    }

    // Check if edge already exists
    for (let e of edges) {
        let e_pts = e.pts.map(n => n.uuid).sort();
        let o_pts = o.p.sort();
        if (JSON.stringify(e_pts) === JSON.stringify(o_pts)) {
            // Edge already exists, return without creating new edge
            return;
        }
    }

    let e = new Edge(pts, o.l, o.s, o.g);

    for (let pt of pts) {
        pt.addEdge(e); // add edge to all points
    }

    edges.push(e);
    return e;
}
        class Edge {
            constructor(pts, length = 0.6, strength = 0.1, style = {
                stroke: "red",
                "stroke-width": "0.01",
                fill: "red"
            }) {
                this.pts = pts;
                this.length = length;
                this.strength = strength;
                this.style = style;
                this.html = document.createElementNS("http://www.w3.org/2000/svg", "path");
                for (const [key, value] of Object.entries(style)) {
                    this.html.setAttribute(key, value);
                }
                htmledges.appendChild(this.html);
                this.attach();

                this.maxWidth = 0.05;
            }
            scaleEdge(amount) {
                this.length *= amount;
            }
            dataObj() {
                let o = {};
                o.l = this.length;
                o.s = this.strength;
                o.g = this.style;
                o.p = this.pts.map((n) => n.uuid);
                return o;
            }
            attach() {
                this.html.onwheel = this.onwheel.bind(this);
                this.html.onmouseover = this.onmouseover.bind(this);
                this.html.onmouseout = this.onmouseout.bind(this);
                this.html.ondblclick = this.ondblclick.bind(this);
            }
            stress() {
                let avg = this.center();
                return this.pts.reduce((t, n, i, a) => {
                    return t + n.pos.minus(avg).mag() - this.length;
                }, 0) / (this.length + 1);
            }
            center() {
                return this.pts.reduce((t, n, i, a) => {
                    return t.plus(n.pos);
                }, new vec2(0, 0)).unscale(this.pts.length);
            }
            draw() {
                this.html.setAttribute("stroke", this.mouseIsOver ? "lightskyblue" : this.style.stroke);
                this.html.setAttribute("fill", this.mouseIsOver ? "lightskyblue" : this.style.fill);

                const stressValue = Math.max(this.stress(), 0.01); // Make sure stressValue never goes below 0.01
                let wscale = this.style['stroke-width'] / (0.5 + stressValue) * (this.mouseIsOver ? 1.5 : 1.0);
                wscale = Math.min(wscale, this.maxWidth);
                let path = "M ";
                let c = this.center();
                let validPath = true;

                for (let n of this.pts) {
                    let r = n.scale * wscale;
                    let minusC = n.pos.minus(c);
                    let rotated = minusC.rot90();

                    if (rotated.x !== 0 || rotated.y !== 0) {
                        let left = rotated.normed(r);

                        // Check if coordinates are not NaN
                        if (!isNaN(left.x) && !isNaN(left.y) && !isNaN(n.pos.x) && !isNaN(n.pos.y)) {
                            path += toSVG(n.pos.minus(left)).str();
                            path += " L ";
                            path += toSVG(left.plus(n.pos)).str() + " ";
                        } else {
                            validPath = false;
                            break;
                        }
                    }
                }

                // Check if the first point's coordinates are not NaN
                let firstPoint = this.pts[0].pos.minus(this.pts[0].pos.minus(c).rot90().normed(this.pts[0].scale * wscale));
                if (!isNaN(firstPoint.x) && !isNaN(firstPoint.y)) {
                    path += " " + toSVG(firstPoint).str() + "z";
                } else {
                    validPath = false;
                }

                // Only set the 'd' attribute if the path is valid
                if (validPath) {
                    this.html.setAttribute("d", path);
                }
            }
            step(dt) {
                if (dt === undefined || isNaN(dt)) {
                    dt = 0;
                } else {
                    if (dt > 1) {
                        dt = 1;
                    }
                }
                let avg = this.center();
                for (let n of this.pts) {
                    let d = n.pos.minus(avg);
                    // Calculate the force only if the distance is greater than the desired length
                    if (d.mag() > this.length) {
                        let f = d.scale(1 - this.length / (d.mag() + 1e-300));
                        n.force = n.force.plus(f.scale(-this.strength));
                    }
                }
                this.draw();
            }
            onwheel(event) {
                if (nodeMode) {
                    let amount = Math.exp(event.wheelDelta * -settings.zoomSpeed);
                    this.length *= amount;
                    let avg = this.center();
                    for (let n of this.pts) {
                        n.pos = n.pos.minus(avg).scale(amount).plus(avg);
                    }
                    if (this.pts[0] !== undefined) {
                        this.pts[0].updateEdgeData();
                    }
                    cancel(event);
                }
            }
            onmouseover(event) {
                this.mouseIsOver = true;
            }
            onmouseout(event) {
                this.mouseIsOver = false;
            }
            ondblclick(event) {
                if (nodeMode) {
                    this.remove();
                    cancel(event);
                }
            }
            remove() {
                // Remove the edge from the global edge array
                let index = edges.indexOf(this);
                if (index !== -1) {
                    edges.splice(index, 1);
                }

                // Remove this edge from both connected nodes' edges arrays
                this.pts.forEach((node) => {
                    index = node.edges.indexOf(this);
                    if (index !== -1) {
                        node.edges.splice(index, 1);
                        node.updateEdgeData();
                    }
                });

                // Remove the edge from the DOM
                this.html.remove();
            }
        }

        var nodes = [];
        var edges = [];
        var nodeMode_v = 0;
        var nodeMode = 0;



for (let n of htmlnodes) {
    let node = new Node(undefined, n, true);  // Indicate edge creation with `true`
    registernode(node);
}
for (let n of nodes) {
    n.init(nodeMap);
}

function clearnet() {
    while (edges.length > 0) {
        edges[edges.length - 1].remove();
    }
    while (nodes.length > 0) {
        nodes[nodes.length - 1].remove();
    }
}

//this is a quick fix to retain textarea height, the full fix requires all event listeners to be attatched to each node.

function adjustTextareaHeightToContent(nodes) {
    for (let node of nodes) {
        let textarea = node.content.querySelector('textarea');
        if (textarea) {
            textarea.style.height = 'auto'; // Temporarily shrink to content
            textarea.style.height = (textarea.scrollHeight) + 'px'; // Set to full content height
        }
    }
}

function loadnet(text, clobber, createEdges = true) {
    if (clobber) {
        clearnet();
    }
    let d = document.createElement("div");
    d.innerHTML = text;
    let newNodes = [];
    for (let n of d.children) {
        let node = new Node(undefined, n, true, undefined, createEdges);
        newNodes.push(node);
        registernode(node);
        if (n.dataset.init === "window")
            rewindowify(node);
    }
    for (let n of newNodes) {
        htmlnodes_parent.appendChild(n.content);
    }

    adjustTextareaHeightToContent(newNodes);
    for (let n of newNodes) {
        n.init(nodeMap); //2 pass for connections
    }
    for (let n of newNodes) {
        // Restore the title
        let titleInput = n.content.querySelector('.title-input');
        if (titleInput) {
            let savedTitle = n.content.getAttribute('data-title');
            if (savedTitle) {
                titleInput.value = savedTitle;
            }
        }
    }
}

        function searchNodesBy(searchTerm) {
            let keywords = searchTerm.toLowerCase().split(' ');
            let matched = [];
            for (let n of nodes) {
                let numMatches = 0;
                for (let keyword of keywords) {
                    if ([...n.searchStrings()].join().toLowerCase().includes(keyword)) {
                        numMatches++;
                    }
                }
                if (numMatches > 0) {
                    n.content.classList.add("search_matched");
                    n.content.classList.remove("search_nomatch");
                    matched.push({
                        node: n,
                        numMatches: numMatches
                    });
                } else {
                    n.content.classList.remove("search_matched");
                    n.content.classList.add("search_nomatch");
                }
            }
            matched.sort((a, b) => b.numMatches - a.numMatches);
            return matched.map(m => m.node);
        }

        function clearSearch() {
            for (let n of nodes) {
                n.content.classList.remove("search_matched");
                n.content.classList.remove("search_nomatch");
            }
        }

        let inp = document.getElementById("Searchbar")
        inp.addEventListener("input", function () {
            let res = document.getElementById("search-results")
            if (inp.value) {
                res.style.display = "block";
                let ns = searchNodesBy(inp.value);
                let resdiv = res.children[0];
                resdiv.innerHTML = "";
                for (let n of ns) {
                    let c = document.createElement("a")
                    c.appendChild(document.createTextNode(n.uuid + ""));
                    c.addEventListener("click", (function (event) {
                        this.zoom_to();
                        autopilotSpeed = settings.autopilotSpeed;
                    }).bind(n));
                    c.addEventListener("dblclick", (function (event) {
                        this.zoom_to();
                        skipAutopilot();
                        autopilotSpeed = settings.autopilotSpeed;
                    }).bind(n));
                    resdiv.appendChild(c);
                }
            } else {
                res.style.display = "none"
                clearSearch();
            }
        });

function connect(na, nb, length = 0.2, linkStrength = 0.1, linkStyle = {
    stroke: "none",
    "stroke-width": "0.005",
    fill: "lightcyan",
    opacity: "0.5"
}) {
    // Check if edge already exists
    if (na.edges.some(edge => edge.pts.includes(nb)) && nb.edges.some(edge => edge.pts.includes(na))) {
        return;
    }

    let edge = new Edge([na, nb], length, linkStrength, linkStyle);

    na.edges.push(edge);
    nb.edges.push(edge);

    edges.push(edge);
    return edge;
}

function connectRandom(n) {
    for (let i = 0; i < n; i++) {
        let a = Math.floor(Math.random() * nodes.length);
        let b = Math.floor(Math.random() * nodes.length);
        // Ensures both nodes have the connection
        connect(nodes[a], nodes[b]);
    }
}

        var gen = iter();

        function frame() {
            gen.next();
            setTimeout(frame, 100);
        }
        const panInput = document.getElementById("pan");
        const zoomInput = document.getElementById("zoom");
        let coordsLive = true;
        const coords = document.getElementById("coordinates");
        panInput.addEventListener("input", (e) => {
            const r = /([+-]?(([0-9]*\.[0-9]*)|([0-9]+))([eE][+-]?[0-9]+)?)\s*,?\s*([+-]?i?(([0-9]*\.[0-9]*)|([0-9]+))([eE][+-]?[0-9]+)?)/;
            const m = panInput.value.match(r);
            coordsLive = false;
            if (m === null) return;
            pan = new vec2(parseFloat(m[0]), parseFloat(m[6].replace(/[iI]/, "")));
        });
        zoomInput.addEventListener("input", (e) => {
            const r = /([+-]?(([0-9]*\.[0-9]*)|([0-9]+))([eE][+-]?[0-9]+)?)/;
            const m = zoomInput.value.match(r);
            coordsLive = false;
            if (m === null) return;
            const z = parseFloat(m);
            if (z !== 0) {
                zoom = zoom.scale(z / zoom.mag());
            }
        });
        for (const k of ["paste", "mousemove", "mousedown", "dblclick", "click"]) {
            panInput.addEventListener(k, (e) => {
                cancel(e);
            })
            zoomInput.addEventListener(k, (e) => {
                cancel(e);
            })
        }
        //frame();
        var mousePathPos;
        var current_time = undefined;
        let regenAmount = 0;
        let regenDebt = 0;
        let avgfps = 0;
        let panToI = new vec2(0, 0);
        let panToI_prev = undefined;

        function nodeStep(time) {
            let autopilot_travelDist = 0;
            let newPan = pan;
            if (autopilotReferenceFrame && autopilotSpeed !== 0) {
                if (panToI_prev === undefined) {
                    panToI_prev = autopilotReferenceFrame.pos.scale(1);
                }
                panToI = panToI.scale(1 - settings.autopilotRF_Iscale).plus(autopilotReferenceFrame.pos.minus(panToI_prev).scale(settings.autopilotRF_Iscale));
                newPan = pan.scale(1 - autopilotSpeed).plus(autopilotReferenceFrame.pos.scale(autopilotSpeed).plus(panToI));
                panToI_prev = autopilotReferenceFrame.pos.scale(1);
            } else {
                newPan = pan.scale(1 - autopilotSpeed).plus(panTo.scale(autopilotSpeed));
                panToI_prev = undefined;
            }
            autopilot_travelDist = pan.minus(newPan).mag() / zoom.mag();
            if (autopilot_travelDist > settings.autopilotMaxSpeed) {
                newPan = pan.plus(newPan.minus(pan).scale(settings.autopilotMaxSpeed / autopilot_travelDist));
                const speedCoeff = Math.tanh(Math.log(settings.autopilotMaxSpeed / autopilot_travelDist + 1e-300) / 10) * 2;
                zoom = zoom.scale(1 - speedCoeff * autopilotSpeed);
                //*Math.log(autopilot_travelDist/settings.autopilotMaxSpeed));
            } else {
                zoom = zoom.scale(1 - autopilotSpeed).plus(zoomTo.scale(autopilotSpeed));
            }
            pan = newPan;
            //zoom = zoom.scale(0.9).plus(zoom_to.scale(0.1));
            //pan = pan.scale(0.9).plus(pan_to.scale(0.1));
            if (coordsLive) {
                panInput.value = pan.ctostring();
                zoomInput.value = zoom.mag() + "";
            }
            //const inpColor = scol(Math.log(zoom.mag()),undefined,64,128);
            //coords.style.color = inpColor;
            updateViewbox();
            if (mousePath == "") {
                mousePathPos = toZ(mousePos);
                mousePath = "M " + toSVG(mousePathPos).str() + " L ";
            }
            for (let i = 0; i < settings.orbitStepRate; i++) {
                //let g = mandGrad(settings.iterations,mousePathPos);
                //mousePathPos = mousePathPos.plus(g.unscale((g.mag()+1e-10)*1000));

                mousePathPos = mand_step(mousePathPos, toZ(mousePos));

                //let p = findPeriod(mousePathPos);
                //mousePathPos = mand_iter_n(p,mousePathPos,mousePathPos);
                if (toSVG(mousePathPos).isFinite() && toSVG(mousePathPos).mag2() < 1e60)
                    mousePath += toSVG(mousePathPos).str() + " ";


            }
            let width = zoom.mag() * 0.0005 * SVGzoom;

            if (nodeMode && prevNode !== undefined) {
                svg_mousePath.setAttribute("d", "M " + toSVG(prevNode.pos).str() + " L " + toSVG(toZ(mousePos)).str());
                width *= 50; // This will increase the width when connecting nodes. Adjust as needed.
            } else {
                svg_mousePath.setAttribute("d", mousePath);
            }

            // Moved the check to clear prevNode outside of the if-else block
            if (!nodeMode && prevNode !== undefined) {
                prevNode = undefined;

                // Clear the mouse path
                mousePath = "";
                svg_mousePath.setAttribute("d", "");
            }

            svg_mousePath.setAttribute("stroke-width", width + "");
            if (current_time === undefined) {
                current_time = time;
            }
            let dt = time - current_time;
            current_time = time;
            if (dt > 0) {
                const alpha = Math.exp(-1 * dt / 1000);
                avgfps = avgfps * alpha + (1 - alpha) * 1000 / dt;
            }
            document.getElementById("debug_layer").children[1].textContent = "fps:" + avgfps;
            document.getElementById("fps").textContent = Math.round(avgfps).toString() + " fps";

            dt *= (1 - nodeMode_v) ** 5;
            for (let n of nodes) {
                n.step(dt);
                let d = toZ(mousePos).minus(n.pos);
                //n.force = n.force.plus(d.unscale(-((d.mag2()**2)*500+1e-5)));
            }
            for (let e of edges) {
                e.step(dt); //line 2703
            }
            regenDebt = Math.min(16, regenDebt + lerp(settings.regenDebtAdjustmentFactor, regenAmount, Math.min(1, (nodeMode_v ** 5) * 1.01)));
            for (; regenDebt > 0; regenDebt--) {
                render_hair(Math.random() * settings.renderSteps);
            }
            regenAmount = 0;
            nodeMode_v = lerp(nodeMode_v, nodeMode, 0.125);
            window.requestAnimationFrame(nodeStep);
        }
        nodeStep();


        //connectRandom(10);


        document.addEventListener('wheel', (event) => {
            // Get the element that the user is scrolling on
            let targetElement = event.target;

            // Check if the target is a textarea and if so, ignore the zoom logic
            if (targetElement.tagName.toLowerCase() === 'textarea') {
                return;
            }
            if (event.getModifierState(settings.rotateModifier)) {
                autopilotSpeed = 0;
                coordsLive = true;
                let amount = event.wheelDelta * settings.rotateModifierSpeed;
                let p = toZ(new vec2(event.pageX, event.pageY));
                let zc = p.minus(pan);
                // p = zoom*center+pan = zoom'*center+pan'
                // zoom' = zoom*rot
                // pan' = pan + (zoom*center-zoom*rot*center)
                //      = pan + (1-rot) * zoom*center
                let r = new vec2(Math.cos(amount), Math.sin(amount));
                zoom = zoom.cmult(r);
                pan = pan.plus(zc.cmult(new vec2(1, 0).minus(r)));
                cancel(event);
                return;
            }
            if (settings.scroll === "zoom") {
                autopilotSpeed = 0;
                coordsLive = true;
                let dest = toZ(mousePos);
                regenAmount += Math.abs(event.wheelDelta);
                let amount = Math.exp(event.wheelDelta * settings.zoomSpeed);
                zoom = zoom.scale(amount);
                pan = dest.scale(1 - amount).plus(pan.scale(amount));
                cancel(event);
            } else if (settings.scroll === "pan") {
                autopilotSpeed = 0;
                coordsLive = true;
                let dest = toZ(mousePos);
                let dp;
                let amount;
                if (event.ctrlKey) {
                    dp = new vec2(0, 0);
                    amount = event.deltaY * settings.zoomSpeed;
                } else {
                    dp = toDZ(new vec2(event.deltaX, event.deltaY).scale(settings.panSpeed));
                    amount = event.deltaZ * settings.zoomSpeed;
                }
                regenAmount += Math.hypot(event.deltaX, event.deltaY, event.deltaZ);
                amount = Math.exp(amount)
                zoom = zoom.scale(amount);
                pan = dest.scale(1 - amount).plus(pan.scale(amount)).plus(dp);
                cancel(event);
                event.preventDefault();
            }
        });


        let mouseDown = false;
        let mouseDownPos = new vec2(0, 0);
        addEventListener("mousedown", (event) => {
            autopilotSpeed = 0;
            mouseDownPos = mousePos.scale(1);
            mouseDown = true;
            cancel(event);
        });
addEventListener("mouseup", (event) => {
    mouseDown = false;
    if (movingNode !== undefined) {
        movingNode.onmouseup(event);
    }
    isDraggingIcon = false; // Reset the flag
});
addEventListener("mousemove", (event) => {
    if (mouseDown) {
        autopilotSpeed = 0;
        coordsLive = true;
        let delta = mousePos.minus(mouseDownPos);
        pan = pan.minus(toDZ(delta));
        regenAmount += delta.mag() * 0.25;
        mouseDownPos = mousePos.scale(1);
    }
});

const edgesIcon = document.querySelector('.edges-icon');
let lockedNodeMode = false;

function toggleNodeModeState() {
    if (nodeMode) {
        edgesIcon.classList.add('edges-active');
    } else {
        edgesIcon.classList.remove('edges-active');
    }
}

function toggleNodeMode() {
    nodeMode = 1 - nodeMode;
    lockedNodeMode = !!nodeMode;  // Lock it only if activated by button
    toggleNodeModeState();
}

edgesIcon.addEventListener('click', toggleNodeMode);

addEventListener("keydown", (event) => {
    if (event.key === settings.nodeModeKey) {
        const isCapsLockMode = settings.nodeModeKey === "CapsLock" && event.getModifierState("CapsLock");

        if (lockedNodeMode && !nodeMode) {
            // If nodeMode was deactivated by the key while it was locked, unlock it
            lockedNodeMode = false;
        }

        if (settings.nodeModeTrigger === "down" && !isCapsLockMode) {
            nodeMode = 1;
            toggleNodeModeState();
        } else if (settings.nodeModeTrigger === "toggle" || isCapsLockMode) {
            toggleNodeMode();
        }
    } else if (event.key === "Escape") {
        for (let n of nodes) {
            n.followingMouse = 0;
        }
    }
});

addEventListener("keyup", (event) => {
    if (event.key === settings.nodeModeKey && settings.nodeModeTrigger === "down") {
        if (lockedNodeMode) {
            return;  // Don't allow the keyup event to deactivate nodeMode if it's locked
        }

        nodeMode = 0;
        toggleNodeModeState();
        cancel(event);
    }
});


let pyodideLoadingPromise = null;
let pyodide = null;
let loadedPackages = {};

// List of Python's built-in modules
let builtinModules = [
    "io",
    "base64",
    // Add more built-in modules here as needed
];

async function loadPyodideAndSetup(pythonView) {
    let pyodideLoadPromise = loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.0/full/",
    });
    pyodide = await pyodideLoadPromise;

    // Define the JavaScript function to be called from Python
    function outputHTML(html) {
        let resultDiv = document.createElement("div");
        resultDiv.innerHTML = html || '';
        pythonView.appendChild(resultDiv);
    }
    window.outputHTML = outputHTML;

    // Add the output_html function to Python builtins
    pyodide.runPython(`
        from js import window

        def output_html(html):
            window.outputHTML(html)

        __builtins__.output_html = output_html
    `);

    console.log('Pyodide loaded');
}

async function runPythonCode(code, pythonView) {
    pythonView.innerHTML = "Initializing Pyodide and dependencies...";

    if (!pyodide) {
        if (!pyodideLoadingPromise) {
            pyodideLoadingPromise = loadPyodideAndSetup(pythonView);
        }
        await pyodideLoadingPromise;
    }

    try {
        pythonView.innerHTML = "";
        let imports = pyodide.runPython(
            'from pyodide.code import find_imports\n' +
            `find_imports('''${code}''')`
        );

        for (let module of imports) {
            if (!builtinModules.includes(module) && !loadedPackages[module]) {
                try {
                    await pyodide.loadPackage(module);
                    loadedPackages[module] = true;
                } catch (error) {
                    console.log(`Failed to load module: ${module}`);
                }
            }
        }

        let result = pyodide.runPython(code);

        return result;
    } catch (error) {
        return error.message;
    }
}




function bundleWebContent(nodesInfo) {
    let htmlContent = [];
    let cssContent = [];
    let jsContent = [];

    for (let nodeInfo of nodesInfo) {
        let re = /Text Content: (.*?)$/gs;
        let contentMatch = re.exec(nodeInfo);

        if (!contentMatch || contentMatch.length < 2) {
            console.warn('No content found for node');
            continue;
        }

        let content = contentMatch[1];
        let codeBlocks = content.matchAll(/```(.*?)\n([\s\S]*?)```/gs);

        for (let block of codeBlocks) {
            let language = block[1].trim();
            let code = block[2];

            switch (language) {
                case 'html':
                case '':
                    htmlContent.push(code);
                    break;
                case 'css':
                    cssContent.push(code);
                    break;
                case 'javascript':
                    jsContent.push(code);
                    break;
                default:
                    console.warn(`Language ${language} not supported for bundling.`);
            }
        }
    }

    return {
        html: htmlContent.join('\n'),
        css: `<style>${cssContent.join('\n')}</style>`,
        js: `<script>${jsContent.join('\n')}</script>`
    };
}

function handleCodeButton(button, textarea, node) {
    button.onclick = async function () {
        if (button.innerHTML === 'Render Code') {
            textarea.style.display = "none";
            let re = /```(.*?)\n([\s\S]*?)```/gs;
            let codeBlocks = textarea.value.matchAll(re);

            let allPythonCode = '';
            let allWebCode = [];

            for (let block of codeBlocks) {
                let language = block[1].trim();
                let code = block[2];

                if (language === 'python') {
                    allPythonCode += '\n' + code;
                } else if (language === 'html' || language === 'css' || language === 'javascript' || language === '') {
                    allWebCode.push(`Text Content: \n\`\`\`${language}\n${code}\n\`\`\``);
                }
            }

            if (allPythonCode !== '') {
                if (!textarea.pythonView) {
                    textarea.pythonView = document.createElement("div");
                    textarea.parentNode.insertBefore(textarea.pythonView, textarea.nextSibling);
                }
                textarea.pythonView.style.display = "block";
                console.log('Running Python code...');
                let result = await runPythonCode(allPythonCode, textarea.pythonView);
                console.log('Python code executed, result:', result);
            }

            if (allWebCode.length > 0) {
                let allConnectedNodesInfo = getAllConnectedNodesData(node);
                allConnectedNodesInfo.push(...allWebCode);
                let bundledContent = bundleWebContent(allConnectedNodesInfo);

                if (textarea.htmlView) {
                    textarea.htmlView.remove();
                }

                textarea.htmlView = document.createElement("iframe");
                textarea.htmlView.style.border = "none";
                textarea.htmlView.style.boxSizing = "border-box";
                textarea.htmlView.style.width = "100%";
                textarea.htmlView.style.height = "100%";

                textarea.htmlView.onmousedown = function (event) {
                    event.stopPropagation();
                };

                textarea.parentNode.insertBefore(textarea.htmlView, textarea.nextSibling);

                textarea.htmlView.srcdoc = `${bundledContent.html}\n${bundledContent.css}\n${bundledContent.js}`;

                let windowDiv = textarea.htmlView.parentNode;
                while (windowDiv && (!windowDiv.win || !windowDiv.classList.contains('window'))) {
                    windowDiv = windowDiv.parentNode;
                }
                if (windowDiv) {
                    observeParentResize(windowDiv, textarea.htmlView);
                }
            }

            button.innerHTML = 'Code Text';
            button.style.backgroundColor = '#717171';
        } else {
            textarea.style.display = "block";
            if (textarea.htmlView) {
                textarea.htmlView.style.display = "none";
                textarea.htmlView.srcdoc = "";
            }
            if (textarea.pythonView) {
                textarea.pythonView.style.display = "none";
                textarea.pythonView.innerHTML = "";
            }
            button.innerHTML = 'Render Code';
            button.style.backgroundColor = '';
        }
    };
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
        
function createTextNode(name = '', text = '', sx = undefined, sy = undefined, x = undefined, y = undefined, addCodeButton = false) {
    let t = document.createElement("input");
    t.setAttribute("type", "text");
    t.setAttribute("value", "untitled");
    t.setAttribute("style", "background:none; ");
    t.classList.add("title-input");

    let n = document.createElement("textarea");
    n.classList.add('custom-scrollbar');
    n.onmousedown = cancel;
    n.setAttribute("type", "text");
    n.setAttribute("size", "11");
    n.setAttribute("style", "background-color: #222226; color: #bbb; overflow-y: scroll; resize: both; width: 259px; line-height: 1.4;");
    n.style.display = "block";

    let elements = [n];

    let buttonCallback = null;

    let button = document.createElement("button");
    button.innerHTML = "Render Code";
    button.classList.add("code-button");

    // Initially hide the button
    button.style.display = "none";

    if (document.getElementById('code-checkbox')) {
        // Add an event listener to the checkbox to show/hide the button based on its state
        document.getElementById('code-checkbox').addEventListener('change', (event) => {
            // If addCodeButton is set, always show the button and return
            if (addCodeButton) {
                button.style.display = "block";
                return;
            }

            if (event.target.checked) {
                button.style.display = "block";
            } else {
                button.style.display = "none";
            }
        });

        // If the checkbox is initially checked, show the button
        if (document.getElementById('code-checkbox').checked) {
            button.style.display = "block";
        }
    }

    if (addCodeButton) {
        // If addCodeButton is set, always show the button
        button.style.display = "block";
    }

    // Store the callback to set up the button onclick handler.
    buttonCallback = (node) => handleCodeButton(button, n, node);
    elements.push(button);

    let node = addNodeAtNaturalScale(name, elements);

    // Call the button callback after the node has been created.
    if (buttonCallback) {
        buttonCallback(node);
    }

    // Resize/height adjustment
    n.oninput = function () {
        adjustTextareaElement(node, this);
    };

    //Highlight Codemirror text
    n.onfocus = function () {
        const title = node.getTitle();
        highlightNodeSection(title, myCodeMirror);
    };

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
                        v: t.value
                    }
                };
            })

            node.push_extra_cb((node) => {
                return {
                    f: "textarea",
                    a: {
                        p: [0, 1, 0],
                        v: n.value
                    }
                };
            })

            return node;
        }


//Touchpad controls (WIP)

        let touches = new Map();

        addEventListener("touchstart", (ev) => {
            //pan = pan.plus(new vec2(0,1))
            for (let i = 0; i < ev.changedTouches.length; i++) {
                const touch = ev.changedTouches.item(i);
                touches.set(touch.identifier, {
                    prev: touch,
                    now: touch
                });
            }
        }, false);
        addEventListener("touchcancel", (ev) => {
            for (let i = 0; i < ev.changedTouches.length; i++) {
                const touch = ev.changedTouches.item(i);
                touches.delete(touch.identifier);
            }
        }, false);
        addEventListener("touchend", (ev) => {
            //pan = pan.plus(new vec2(0,-1))
            switch (touches.size) {
                case 2: //tap to zoom
                    if (ev.changedTouches.length == 1) {
                        const id = ev.changedTouches.item(0).identifier;
                        const t = touches.get(id);
                        if (t && t.prev == t.now) { //hasn't moved
                            const ts = [...touches.keys()];
                            const other = touches.get(ts[0] === id ? ts[1] : ts[0])
                            const {
                                s,
                                o
                            } = windowScaleAndOffset();
                            const amount = Math.exp(-(other.now.clientY - t.now.clientY) / s);
                            const dest = toZ(new vec2(other.now.clientX, other.now.clientY));
                            zoom = zoom.scale(amount);
                            pan = dest.scale(1 - amount).plus(pan.scale(amount));
                        }
                    }
                    break;

            }
            for (let i = 0; i < ev.changedTouches.length; i++) {
                const touch = ev.changedTouches.item(i);
                touches.delete(touch.identifier);
            }
        }, false);
        addEventListener("touchmove", (ev) => {
            for (let i = 0; i < ev.changedTouches.length; i++) {
                const touch = ev.changedTouches.item(i);
                touches.set(touch.identifier, {
                    prev: touches.get(touch.identifier)?.now,
                    now: touch
                });
            }
            switch (touches.size) {
                case 1:
                    autopilotSpeed = 0;
                    coordsLive = true;
                    const t = [...touches.values()][0];
                    pan = pan.plus(toDZ(new vec2(t.prev.clientX, t.prev.clientY).minus(new vec2(t.now.clientX, t.now.clientY))));
                    cancel(ev);
                    break;
                case 2:
                /*
                const pts = [...touches.values()];
                const p1p = toS(new vec2(pts[0].prev.clientX,pts[0].prev.clientY));
                const p2p = toS(new vec2(pts[1].prev.clientX,pts[1].prev.clientY));
                const p1n = toS(new vec2(pts[0].now.clientX,pts[0].now.clientY));
                const p2n = toS(new vec2(pts[1].now.clientX,pts[1].now.clientY));
                //want to find new zoom,pan such that
                // old toZ(p1p) = new toZ(p1n)
                // old toZ(p2p) = new toZ(p2n)
                //
                //  toZ(x) ≈ x*zoom + pan
                //
                // so, we want zoom' pan' s.t.
                //  p1p*zoom + pan = p1n*zoom' + pan'
                //  p2p*zoom + pan = p2n*zoom' + pan'
                //
                //  (p2p-p1p) * zoom = (p2n-p1n) * zoom'
                //  (p1p+p2p)*zoom + 2pan = (p1p+p2p)*zoom' + 2pan'
                //
                //  zoom' = zoom * (p2p-p1p)/(p2n-p1n)
                //  pan' = pan + (p1p+p2p)*zoom/2 - (p1p+p2p)*zoom'/2
                //       = pan + (p1p+p2p)*(zoom - zoom')/2
                const nzoom = zoom.cmult( p2p.minus(p1p).cdiv( p2n.minus(p1n)));
                pan = pan.plus(p2p.plus(p1p).cmult(zoom.minus(nzoom)).scale(0.5));
                zoom = nzoom;


                ev.preventDefault();
                cancel(ev);
                break;
                */
                default:
                    break;
            }


        }, false);




        var gestureStartParams = {
            rotation: 0,
            x: 0,
            y: 0,
            scale: 0,
            zoom: new vec2(),
            pan: new vec2()
        };
        addEventListener("gesturestart", (e) => {
            e.preventDefault();
            //console.log(e);
            gestureStartParams.rotation = e.rotation;
            gestureStartParams.scale = e.scale;
            gestureStartParams.x = e.pageX;
            gestureStartParams.y = e.pageY;
            gestureStartParams.zoom = zoom;
            gestureStartParams.pan = pan;

        });
        addEventListener("gesturechange", (e) => {
            e.preventDefault();
            //console.log(e);
            let d_theta = e.rotation - gestureStartParams.rotation;
            let d_scale = e.scale;
            let r = -e.rotation * settings.gestureRotateSpeed;
            pan = gestureStartParams.pan;
            zoom = gestureStartParams.zoom;
            let r_center = toZ(new vec2(e.pageX, e.pageY));
            let s = 0;
            zoom = gestureStartParams.zoom.cmult(new vec2(Math.cos(r), Math.sin(r)));
            if (e.scale !== 0) {
                let s = 1 / e.scale;
                zoom = zoom.scale(s);
                regenAmount += Math.abs(Math.log(s)) * settings.maxLines;
            }
            let dest = r_center;
            let amount = s;
            let dp = r_center.minus(gestureStartParams.pan);
            pan = gestureStartParams.pan.plus(
                dp.minus(dp.cmult(zoom.cdiv(gestureStartParams.zoom))));
            //pan = dest.scale(1-amount).plus(gestureStartParams.pan.scale(amount));

        });
        addEventListener("gestureend", (e) => {
            e.preventDefault();
        });


// Check if a string is valid JSON
function isJSON(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

        //todo patches for zoom in

// Check if the user's message is a URL
const isUrl = (text) => {
    try {
        const url = new URL(text);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

const isIframe = (text) => {
    try {
        const doc = new DOMParser().parseFromString(text, "text/html");
        return doc.body.childNodes[0] && doc.body.childNodes[0].nodeName.toLowerCase() === 'iframe';
    } catch (_) {
        return false;
    }
}

function getIframeUrl(iframeContent) {
    // Function to extract URL from the iframe content
    // Using a simple regex to get the 'src' attribute value
    const match = iframeContent.match(/src\s*=\s*"([^"]+)"/);
    return match ? match[1] : null; // Return URL or null if not found
}

        //Drag and Drop

let isDraggingIcon = false;
let initialMousePosition = null;

function makeIconDraggable(iconDiv) {
    iconDiv.addEventListener('mousedown', function (event) {
        if (!iconDiv.classList.contains('edges-icon')) {
            iconDiv.dataset.draggable = 'true';  // Set to draggable immediately on mousedown
            mouseDown = true;
        }
    });

    iconDiv.addEventListener('mousemove', function (event) {
        if (mouseDown && !isDraggingIcon && !iconDiv.classList.contains('edges-icon')) {
            iconDiv.setAttribute('draggable', 'true');
            isDraggingIcon = true;
        }
    });

    iconDiv.addEventListener('mouseup', function () {
        iconDiv.setAttribute('draggable', 'false');
        isDraggingIcon = false;
        mouseDown = false;
        initialMousePosition = null;
    });

    iconDiv.addEventListener('dragstart', function (event) {
        const rect = iconDiv.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;

        event.dataTransfer.setDragImage(iconDiv, offsetX, offsetY);

        const draggableData = {
            type: 'icon',
            iconName: iconDiv.classList[1]
        };
        event.dataTransfer.setData('text/plain', JSON.stringify(draggableData));
    });

    // When dragging ends, make sure the div is non-draggable
    iconDiv.addEventListener('dragend', function () {
        iconDiv.setAttribute('draggable', 'false');
        isDraggingIcon = false;
        mouseDown = false;
    });
}

const icons = document.querySelectorAll('.panel-icon');
icons.forEach(icon => {
    makeIconDraggable(icon);
});

function makeEdgesIconNotDraggable(iconDiv) {
    iconDiv.addEventListener('dragstart', function (event) {
        event.preventDefault();
    });
}

const edgesIcons = document.querySelectorAll('.edges-icon');
edgesIcons.forEach(icon => {
    makeEdgesIconNotDraggable(icon);
});


function handleIconDrop(event, iconName) {

    console.log(`Dropped icon: ${iconName}`);

    switch (iconName) {
        case 'note-icon':
            node = createNodeFromWindow(``, ``, true); // The last parameter sets followMouse to true
            console.log('Handle drop for the note icon');
            break;
        case 'ai-icon':
            node = createLLMNode('', undefined, undefined, undefined, undefined);
            node.followingMouse = 1;
            node.draw();
            node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
            console.log('Handle drop for the ai icon');
            break;
        case 'link-icon':
            let linkUrl = prompt("Enter a Link or Search Query", "");

            if (linkUrl) {
                processLinkInput(linkUrl);
            }
            break;
        case 'code-icon':
            node = createEditorNode();
            node.followingMouse = 1;
            node.draw();
            node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
            console.log('Handle drop for the code icon');
            break;
        case 'edges-icon':
            console.log('Handle drop for the edges icon');
            break;
        default:
            console.warn(`No handler defined for icon: ${iconName}`);
            break;
    }

    event.stopPropagation();
    event.preventDefault();
}

function dropHandler(ev) {
    ev.preventDefault();

    const data = ev.dataTransfer.getData('text');

    if (data && isJSON(data)) {
        const parsedData = JSON.parse(data);
        
        if (parsedData.type === 'icon') {
            // Handle the icon drop
            handleIconDrop(ev, parsedData.iconName);
            return;  // Exit the handler early
        }

        // Now only try destructuring if the data isn't an icon type
        let [title, content] = parsedData;
        // If this is one of the three specific types of divs, handle it here
        if (['AI Response', 'Prompt', 'Code Block'].includes(title)) {
            //console.log(`Dropped div "${title}": "${content}"`);

            let addCheckbox = false;

            if (title === 'Code Block') {
                // Split the content into lines
                let lines = content.split('\n');

                // Remove the second line (index 1 in a 0-indexed array)
                if (lines.length > 1) {
                    lines.splice(1, 1);
                }

                // Add the triple backticks at the start of the first line and at the end of the content
                // If the first line exists, add the backticks directly before it. If not, just start with backticks
                content = (lines[0] ? "```" + lines[0] : "```") + "\n" + lines.slice(1).join('\n') + "\n```";

                addCheckbox = true;
            }



            const defaultTitle = getDefaultTitle();
            const fullTitle = title + ' ' + defaultTitle;
            node = createNodeFromWindow(fullTitle, content, true);

            // Stop the drop event from being handled further
            return;
        }
    }
            let files = [];
            if (ev.dataTransfer.items) {
                // Use DataTransferItemList interface to access the file(s)
                [...ev.dataTransfer.items].forEach((item, i) => {
                    // If dropped items aren't files, reject them
                    if (item.kind === 'file') {
                        const file = item.getAsFile();
                        files.push(file);
                        console.log(`… file[${i}].name = ${file.name}`);
                    }
                });
            } else {
                // Use DataTransfer interface to access the file(s)
                [...ev.dataTransfer.files].forEach((file, i) => {
                    files.push(file)
                    console.log(`… file[${i}].name = ${file.name}`);
                });
            }
            console.log(files);
            //https://stackoverflow.com/questions/3814231/loading-an-image-to-a-img-from-input-file
            if (FileReader && files && files.length) {
                for (let i = 0; i < files.length; i++) {

                    let reader = new FileReader();

                    let baseType;
                    if (files[i].type) {
                        baseType = files[i].type.split("/")[0];
                    } else if (files[i].name.toLowerCase().endsWith(".txt")) {
                        baseType = "text";
                    } else if (files[i].name.toLowerCase().endsWith(".md")) {
                        baseType = "markdown";
                    } else {
                        console.log("Unhandled file type:", files[i]);
                        baseType = "unknown";
                    }

                    let url = URL.createObjectURL(files[i]);
                    let img;
                    let content = [];

                    let add = function (scale) {
                        let node = windowify(files[i].name, content, toZ(mousePos), (zoom.mag2() ** settings.zoomContentExp), scale);
                        /*node.push_extra_cb((node) => { //superceeded by new rewindowify (todo)
                          return {
                            f: "textarea",
                            a: {
                              p: [0, 1],
                              v: files[i].name.value
                            }
                          };
                        })*/
                        htmlnodes_parent.appendChild(node.content);
                        registernode(node);
                        node.followingMouse = 1;
                        node.draw();
                        node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
                    }
                    console.log("loading " + baseType);
                    switch (baseType) {
                        case "image":
                            img = document.createElement('img');
                            img.ondragstart = (e) => false;
                            content = [
                                img
                            ];
                            img.style = "display: block";
                            img.onload = function () {
                                let s = 512 / Math.hypot(img.naturalWidth, img.naturalHeight);
                                //img.style.transform = "scale("+s+","+s+")";
                                img.width = img.naturalWidth * s;
                                img.height = img.naturalHeight * s;
                                add(1);
                                URL.revokeObjectURL(img.src);
                            }
                            img.src = url;
                            break;
                        case "audio":
                            img = new Audio();
                            img.setAttribute("controls", "");
                            //let c = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                            //c.setAttribute("viewBox","0 0 128 64");
                            //let name = document.createElementNS("http://www.w3.org/2000/svg","text");
                            //name.setAttribute("x","0");name.setAttribute("y","0");
                            //name.appendChild(document.createTextNode(files[i].name));
                            //c.appendChild(name);
                            img.style = "display: block";
                            content = [
                                img
                            ];
                            add(1);
                            //div.appendChild(c);
                            img.src = url;
                            break;
                        case "video":
                            img = document.createElement('video');
                            img.style = "display: block";
                            img.setAttribute("controls", "");
                            content = [
                                img
                            ];
                            add(1);
                            img.src = url;
                            break;
                        case "text":
                            reader.onload = function (e) {
                                let text = e.target.result;
                                let node = createNodeFromWindow(files[i].name, text);
                            }
                            reader.readAsText(files[i]);
                            break;
                        case "markdown":
                            let mdReader = new FileReader();
                            mdReader.onload = function (e) {
                                let mdText = e.target.result;
                                let htmlContent = marked.parse(mdText, { mangle: false, headerIds: false });
                                let node = createTextNode(files[i].name, '');

                                let htmlContainer = document.createElement('div');
                                htmlContainer.innerHTML = htmlContent;
                                htmlContainer.style.maxWidth = '1000px';
                                htmlContainer.style.overflow = 'auto';
                                htmlContainer.style.height = '1400px';
                                htmlContainer.style.backgroundColor = '#222226'; // Set background color

                                // Check if there is a textarea being appended, if there is remove it.
                                if (node.content.children[0].children[1].getElementsByTagName('textarea').length > 0) {
                                    node.content.children[0].children[1].removeChild(node.content.children[0].children[1].getElementsByTagName('textarea')[0]);
                                }

                                node.content.children[0].children[1].appendChild(htmlContainer);
                                htmlnodes_parent.appendChild(node.content);
                            }
                            mdReader.readAsText(files[i]);
                            break;
                        case "application": // Handle PDF files
                            if (files[i].type.endsWith("pdf")) {
                                let reader = new FileReader();
                                reader.readAsArrayBuffer(files[i]);

                                reader.onload = function () {
                                    let url = URL.createObjectURL(new Blob([reader.result], { type: 'application/pdf' }));
                                    let node = createLinkNode(files[i].name, files[i].name, url); // Pass file name
                                    node.fileName = files[i].name; // Store file name in node
                                    htmlnodes_parent.appendChild(node.content);
                                    node.followingMouse = 1;
                                    node.draw();
                                    node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
                                };

                                reader.onerror = function (err) {
                                    console.error('Error reading PDF file:', err);
                                };
                            }
                            break;
                    }
                }
            } else {
                // fallback -- perhaps submit the input to an iframe and temporarily store
                // them on the server until the user's session ends.
                console.log("FileReader not supported or no files");
            }
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

        function dragOverHandler(ev) {
            ev.preventDefault();
        }

        function nodemousedown(id) {
            if (id < nodes.length) {
                nodes[id].mousedown();
            }
        }

        function nodemouseup(id) {
            if (id < nodes.length) {
                nodes[id].mouseup();
            }
        }

        function nodemousemove(id) {
            if (id < nodes.length) {
                nodes[id].mousemove();
            }
        }

        function nodeclick(id) {
            if (id < nodes.length) {
                nodes[id].mouseclick();
            }
        }


        function cancel(event) {
            if (event.stopPropagation) {
                event.stopPropagation(); // W3C model
            } else {
                event.cancelBubble = true; // IE model
            }
        }

//Paste event listener...

addEventListener("paste", (event) => {
    console.log(event);
    let cd = (event.clipboardData || window.clipboardData);
    let pastedData = cd.getData("text");

    // Check if the pasted data is a URL or an iframe
    if (isUrl(pastedData)) {
        let node = createLinkNode(pastedData, pastedData, pastedData); // Use 'pastedData' instead of 'url'
        node.followingMouse = 1;
        node.draw();
        node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
    } else if (isIframe(pastedData)) {
        let iframeUrl = getIframeUrl(pastedData);
        let node = createLinkNode(iframeUrl, iframeUrl, iframeUrl);
        node.followingMouse = 1;
        node.draw();
        node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
    } else {
        // Existing code for handling other pasted content
        let content = document.createElement("div");
        content.innerHTML = pastedData;
        let t = document.createElement("input");
        t.setAttribute("type", "text");
        t.setAttribute("value", "untitled");
        t.setAttribute("style", "background:none;");
        t.classList.add("title-input");
        let node = windowify("untitled", [content], toZ(mousePos), (zoom.mag2() ** settings.zoomContentExp), 1);
        htmlnodes_parent.appendChild(node.content);
        registernode(node);
        node.followingMouse = 1;
        node.draw();
        node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
    }
});

        addEventListener("paste", (event) => {
            if (event.target.tagName.toLowerCase() === "textarea") {
                event.stopPropagation();
                //console.log("Paste disabled for textarea");
            }
        }, true);