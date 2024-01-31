function createEditorInterface() {
    let htmlContent = `<!DOCTYPE html>
<html lang="en" class="custom-scrollbar">
<head>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/codemirror@5/lib/codemirror.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/codemirror@5/theme/dracula.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/codemirror@5/addon/scroll/simplescrollbars.css">

    <script src="https://cdn.jsdelivr.net/npm/codemirror@5/lib/codemirror.js"></script>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.62.3/addon/scroll/simplescrollbars.js"></script>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.62.3/mode/htmlmixed/htmlmixed.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.62.3/mode/xml/xml.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.62.3/mode/css/css.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.62.3/mode/javascript/javascript.min.js"></script>

    <style type="text/css">
        .editorcontainer {
            box-sizing: border-box;
            width: 100%;
            min-width: 100%;
            margin: auto;
            /* Add any other styles you want for the container here... */
        }

        body {
            background-color: transparent;
            margin: 0;
            padding: 0px;
            display: flex;
            flex-direction: column;
            align-items: center;
            overflow: hidden;
        }

        #editor-wrapper {
            box-sizing: border-box;
            display: flex;
            justify-content: space-between;
            height: 95vh;
            width: 96%; /* 10px margin on left and right side */
            max-width: 100%;
            margin-top: 10px;
            margin-left: 15px; /* Left margin */
            overflow: hidden; /* Contains the children */
            resize:none;
        }

        .draggable-bar {
            box-sizing: border-box;
            width: 10px;
            height: 100%;
            cursor: ew-resize; /* East-west cursor */
            background-color: #262737;
            flex: none; /* No flex-grow, no flex-shrink */
        }

        .dragging {
            cursor: ew-resize !important;
        }

        #vertical-resize-handle {
            height: 5px;
            width: 100%;
            background-color: #262737; /* You can style this to match your theme */
        }

        .vertical-dragging {
            cursor: ns-resize !important;
        }

        .editor-container {
            height: 100%; /* Take full height of parent */
            margin: 0px 0px;
            background-color: transparent;
            padding: 0px;
            position: relative; /* Ensuring the child takes this height */
            flex: none; /* Ensure equal space division */
        }

        .editor-label {
            color: #888;
            font-size: 12px;
            padding: 15px;
            padding-left: 5px; /* Adjust this to move the text to the left */
            background-color: #262737;
            display: inline;
            margin: 0;
            line-height: 30px;
            user-select: none;
        }

        .CodeMirror {
            font-size: 12px;
            height: calc(100% - 32px); /* Adjusted for label height */
            width: 100%;
            position: absolute; /* Take full height of parent */
            bottom: 0; /* Align to the bottom of the container */
            overflow-x: hidden; /* Hide horizontal scrollbar */
        }

        .CodeMirror-simplescroll-horizontal {
            display: none !important; /* Hide horizontal scrollbar */
        }

        .CodeMirror-simplescroll-vertical {
            background: #222226 !important;
        }

            .CodeMirror-simplescroll-vertical div {
                background: #3f3f3f !important;
                border: 1px solid #555555;
                width: 6px !important;
            }

        .CodeMirror-simplescroll-scrollbar div:hover {
            background: #555 !important;
        }

        .CodeMirror-scrollbar-filler, .CodeMirror-gutter-filler {
            background-color: #222226;
        }

        .no-select {
            user-select: none;
            -webkit-user-select: none;
            -ms-user-select: none;
        }
    </style>
</head>
<body>
    <div id="editor-container-wrapper" class="editorcontainer">
        <div id="editor-wrapper">
            <div class="editor-container">
                <div class="editor-label">html</div>
                <div id="htmlEditor"></div>
            </div>
            <div class="draggable-bar"></div>
            <div class="editor-container">
                <div class="editor-label">css</div>
                <div id="cssEditor"></div>
            </div>
            <div class="draggable-bar"></div>
            <div class="editor-container">
                <div class="editor-label">js</div>
                <div id="jsEditor"></div>
            </div>
        </div>
        <div id="vertical-resize-handle"></div>
    </div>
    <script>
            var htmlEditor = CodeMirror(document.getElementById('htmlEditor'), {
                mode: 'htmlmixed', theme: 'dracula', lineNumbers: true, lineWrapping: false, scrollbarStyle: 'simple'
            });
            var cssEditor = CodeMirror(document.getElementById('cssEditor'), {
                mode: 'css', theme: 'dracula', lineNumbers: true, lineWrapping: false, scrollbarStyle: 'simple'
            });
            var jsEditor = CodeMirror(document.getElementById('jsEditor'), {
                mode: 'javascript', theme: 'dracula', lineNumbers: true, lineWrapping: false, scrollbarStyle: 'simple'
            });

            function refreshEditors() {
                htmlEditor.refresh();
                cssEditor.refresh();
                jsEditor.refresh();
            }

            window.requestAnimationFrame(refreshEditors);

            const draggableBars = document.querySelectorAll('.draggable-bar');
            const editorContainers = document.querySelectorAll('.editor-container');
            const draggableBarWidths = Array.from(draggableBars).reduce((total, bar) => total + bar.offsetWidth, 0);
            const initialEditorWidth = (editorContainers[0].parentElement.offsetWidth - draggableBarWidths) / 3;

            editorContainers.forEach(container => container.style.width = initialEditorWidth + 'px');

            let initialWidths;
            let initialX;

        function onMouseMoveLeft(e) {
            const dx = e.clientX - initialX;
            const totalWidth = editorContainers[0].parentElement.offsetWidth;
            let newHtmlWidth = Math.min(totalWidth - 20, initialWidths.htmlWidth + dx);
            let newCssWidth = totalWidth - newHtmlWidth - initialWidths.jsWidth;
            let newJsWidth = initialWidths.jsWidth;

            if (newHtmlWidth <= 10) {
                newHtmlWidth = 10;
            }

            if (newCssWidth <= 10) {
                newCssWidth = 10;
                newJsWidth = totalWidth - newHtmlWidth - newCssWidth;
            }

            editorContainers[0].style.width = newHtmlWidth + 'px';
            editorContainers[1].style.width = newCssWidth + 'px';
            editorContainers[2].style.width = newJsWidth + 'px';
        }

        function onMouseMoveRight(e) {
            const dx = e.clientX - initialX;
            const totalWidth = editorContainers[0].parentElement.offsetWidth;
            let newJsWidth = Math.min(totalWidth - 20, initialWidths.jsWidth - dx);
            let newCssWidth = totalWidth - newJsWidth - initialWidths.htmlWidth;
            let newHtmlWidth = initialWidths.htmlWidth;

            if (newJsWidth <= 10) {
                newJsWidth = 10;
            }

            if (newCssWidth <= 10) {
                newCssWidth = 10;
                newHtmlWidth = totalWidth - newCssWidth - newJsWidth;
            }

            editorContainers[0].style.width = newHtmlWidth + 'px';
            editorContainers[1].style.width = newCssWidth + 'px';
            editorContainers[2].style.width = newJsWidth + 'px';
        }
            function onMouseDown(e) {
                initialX = e.clientX;
                initialWidths = {
                    htmlWidth: editorContainers[0].offsetWidth,
                    cssWidth: editorContainers[1].offsetWidth,
                    jsWidth: editorContainers[2].offsetWidth
                };

                document.body.classList.add('no-select', 'dragging'); // Added 'dragging'
                if (e.target === draggableBars[0]) {
                    document.addEventListener('mousemove', onMouseMoveLeft);
                    document.addEventListener('mouseup', onMouseUp);
                } else {
                    document.addEventListener('mousemove', onMouseMoveRight);
                    document.addEventListener('mouseup', onMouseUp);
                }
            }

            function onMouseUp() {
                document.body.classList.remove('no-select', 'dragging'); // Removed 'dragging'
                document.removeEventListener('mousemove', onMouseMoveLeft);
                document.removeEventListener('mousemove', onMouseMoveRight);
                document.removeEventListener('mouseup', onMouseUp);
            }

        draggableBars.forEach(bar => bar.addEventListener('mousedown', onMouseDown));

        // Function to recalculate draggable bar widths when resizing
        function updateDraggableBarWidths() {
            return Array.from(draggableBars).reduce((total, bar) => total + bar.offsetWidth, 0);
        }

        // Initialize isResized flag to false
        let isResized = false;

        // Function to update editor widths
        function updateEditorWidth() {
            const editorWrapperWidth = editorContainers[0].parentElement.offsetWidth;
            const newDraggableBarWidths = updateDraggableBarWidths(); // Update the widths of draggable bars
            const totalCurrentWidths = Array.from(editorContainers).reduce((total, el) => total + el.offsetWidth, 0);
            const availableWidth = editorWrapperWidth - newDraggableBarWidths;

            if (!isResized) {
                // First-time call: Initialize all editors to a uniform width
                const newWidth = availableWidth / 3;
                editorContainers.forEach(container => container.style.width = newWidth + 'px');
                isResized = true;  // Set the flag to true after the first invocation
            } else {
                // Subsequent calls: Proportionally adjust the width of each editor
                const scalingFactor = availableWidth / totalCurrentWidths;
                editorContainers.forEach(container => {
                    const newWidth = container.offsetWidth * scalingFactor;
                    container.style.width = newWidth + 'px';
                });
            }

            refreshEditors(); // Refresh the editors
        }

        // Event listener to update editor widths on window resize
        window.addEventListener('resize', updateEditorWidth);

            // Initial call to set the size
            updateEditorWidth();

          
    </script>
</body>
</html>`;

    let iframeScript = `
<script>
    document.addEventListener('keydown', function(event) {
        let nodeMode = 0;
        if(event.altKey && event.shiftKey) {
            nodeMode = 1;
        }
        window.parent.postMessage({ altHeld: event.altKey, shiftHeld: event.shiftKey, nodeMode: nodeMode }, '*');
        if(event.altKey) event.preventDefault();  // Prevent default behavior only for Alt and Alt+Shift
    });

    document.addEventListener('keyup', function(event) {
        window.parent.postMessage({ altHeld: event.altKey, shiftHeld: event.shiftKey, nodeMode: 0 }, '*');
        if(!event.altKey) event.preventDefault();
    });
</script>
`;

        // Combine and return the full HTML content
    return htmlContent + iframeScript;
}

function createEditorNode(title = '', sx = undefined, sy = undefined, x = undefined, y = undefined) {
    // Create the wrapper div
    let editorWrapperDiv = document.createElement('div');
    editorWrapperDiv.className = 'editorWrapperDiv'; 
    editorWrapperDiv.style.width = '800px'; // Set width of the wrapper
    editorWrapperDiv.style.height = '400px'; // Set height of the wrapper 
    editorWrapperDiv.style.overflow = 'none';
    editorWrapperDiv.style.position = 'relative';

    // Create the iframe element with a data URI as the src attribute
    let iframeElement = document.createElement('iframe');
    iframeElement.style.overflow = `none`;
    iframeElement.style.width = '800px';
    iframeElement.style.height = '390px';
    iframeElement.style.border = '0';
    iframeElement.style.background = 'transparent';
    iframeElement.sandbox = 'allow-same-origin allow-scripts';

    // Append the iframe to the wrapper div
    editorWrapperDiv.appendChild(iframeElement);


    // Create the overlay div dynamically
    let overlay = document.createElement('div');
    overlay.id = "editorOverlay";
    overlay.style.position = "absolute";  // Position relative to editorWrapperDiv
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";  // 100% of editorWrapperDiv
    overlay.style.height = "100%";  // 100% of editorWrapperDiv
    overlay.style.zIndex = "9999";
    overlay.style.backgroundColor = "transparent";
    overlay.style.display = "none";  // Initially hidden

    // Append the overlay to the editorWrapperDiv
    editorWrapperDiv.appendChild(overlay);

    let node = addNodeAtNaturalScale(title, [editorWrapperDiv]); // Use the wrapper div here

        // Generate a unique identifier for the iframe using the node's uuid
    iframeElement.setAttribute('identifier', 'editor-' + node.uuid); // Store the identifier

    // Update the existing title of the node
    if (node.title) {
        node.title.value = title;
    }

    node.isEditorNode = true;

    node.editorSaveData = null;

    initEditorNode(node)

    return node;
}

function isEditorNode(node) {
    // First, check if the isEditorNode flag is set and true
    if (node.isEditorNode) {
        return true;
    }

    // Fallback: Check for an iframe with a specific identifier
    const iframeIdentifier = node.content.querySelector('iframe[identifier^="editor-"]');

    return Boolean(iframeIdentifier);
}


function initEditorNode(node) {
    let overlay = node.content.querySelector(`.editorWrapperDiv #editorOverlay`)
    overlays.push(overlay);

    let iframeElement = node.content.querySelector('.editorWrapperDiv iframe');
    node.iframeElement = iframeElement;

    iframeElement.onload = function () {
        let iframeWindow = iframeElement.contentWindow;
        if (iframeWindow.htmlEditor && iframeWindow.cssEditor && iframeWindow.jsEditor) {
            // Debounce function to limit how often we save the editor content
            const debounceSave = debounce(() => saveEditorContent(node), 300);

            // Set up event listeners for change in each editor
            iframeWindow.htmlEditor.on('change', debounceSave);
            iframeWindow.cssEditor.on('change', debounceSave);
            iframeWindow.jsEditor.on('change', debounceSave);
        }

        iframeElement.contentWindow.addEventListener('click', function () {
            node.followingMouse = 0;
        });

        setTimeout(() => restoreEditorContent(node), 500); // Delay restoration
    };

    let htmlContent = createEditorInterface();
    iframeElement.src = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
    iframeElement.srcdoc = htmlContent;
}

function saveEditorContent(node) {
    let iframeElement = document.querySelector(`iframe[identifier='editor-${node.uuid}']`);
    if (iframeElement && iframeElement.contentWindow) {
        let iframeWindow = iframeElement.contentWindow;
        node.editorSaveData = {
            html: iframeWindow.htmlEditor.getValue(),
            css: iframeWindow.cssEditor.getValue(),
            js: iframeWindow.jsEditor.getValue()
        };
        //console.log('Editor content saved:', node.editorSaveData);
    }
}

function restoreEditorContent(node) {
    if (!node.editorSaveData) {
        console.log('No saved editor data found for node.');
        return;
    }

    let iframeElement = document.querySelector(`iframe[identifier='editor-${node.uuid}']`);
    if (iframeElement && iframeElement.contentWindow) {
        try {
            //console.log(`save data`, node.editorSaveData);

            let iframeWindow = iframeElement.contentWindow;
            iframeWindow.htmlEditor.setValue(node.editorSaveData.html || '');
            iframeWindow.cssEditor.setValue(node.editorSaveData.css || '');
            iframeWindow.jsEditor.setValue(node.editorSaveData.js || '');
        } catch (error) {
            console.error('Error restoring editor content:', error);
        }
    } else {
        console.warn('No iframe editor found for node.');
    }
}