let isDraggingIcon = false;
let initialMousePosition = null;
let clickThreshold = 1; // Adjust this value as needed
let mouseDownIcon = false;

function makeIconDraggable(iconDiv) {
    iconDiv.setAttribute('draggable', 'true'); // Set draggable to true by default

    iconDiv.addEventListener('mousedown', function (event) {
        if (!iconDiv.classList.contains('edges-icon')) {
            initialMousePosition = { x: event.clientX, y: event.clientY };
            mouseDownIcon = true;
        }
    });

    iconDiv.addEventListener('mousemove', function (event) {
        if (mouseDownIcon && !isDraggingIcon && !iconDiv.classList.contains('edges-icon')) {
            const currentMousePosition = { x: event.clientX, y: event.clientY };
            const distance = Math.sqrt(
                Math.pow(currentMousePosition.x - initialMousePosition.x, 2) +
                Math.pow(currentMousePosition.y - initialMousePosition.y, 2)
            );
            if (distance > clickThreshold) {
                isDraggingIcon = true;
            }
        }
    });

    iconDiv.addEventListener('mouseup', function () {
        mouseDownIcon = false;
        isDraggingIcon = false;
    });

    iconDiv.addEventListener('dragstart', function (event) {
        if (!isDraggingIcon) {
            event.preventDefault(); // Prevent default behavior when not dragging
            return;
        }

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

    iconDiv.addEventListener('click', function (event) {
        if (!isDraggingIcon) {
            // Handle the click event here
            console.log('Icon clicked:', iconDiv.classList[1]);
            // Add your custom click event handling logic
            if (iconDiv.classList.contains('note-icon')) {
                openModal('noteModal');
            }
        }
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
            returnLinkNodes();
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

                shouldAddCodeButton = true;
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
                    // We use a FileReader to read the dropped file and convert it to a Data URL (base64)
                    let reader = new FileReader();
                    reader.onload = function (e) {
                        let base64DataUrl = e.target.result;
                        let imageElement = document.createElement('img');
                        imageElement.src = base64DataUrl;

                        // Once the image is loaded, create the node
                        imageElement.onload = function () {
                            let node = createImageNode(imageElement, files[i].name);
                            // Append the node to the DOM here, as the image data is now ready
                            htmlnodes_parent.appendChild(node.content);
                            node.followingMouse = 1;
                            node.draw();
                            node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
                        };
                    };
                    reader.readAsDataURL(files[i]); // Read the file as a Data URL
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


function dragOverHandler(ev) {
    ev.preventDefault();
}

//Paste event listener...
function handlePasteData(pastedData, target) {
    // Allow default handling for textareas and content-editable elements
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable) {
        return; // Exit the function and allow the browser to handle the paste
    }

    // Handle special cases
    if (isUrl(pastedData)) {
        // Handle URL paste
        let node = createLinkNode(pastedData, pastedData, pastedData);
        setupNodeForPlacement(node);
    } else if (isIframe(pastedData)) {
        // Handle iframe paste
        let iframeUrl = getIframeUrl(pastedData);
        let node = createLinkNode(iframeUrl, iframeUrl, iframeUrl);
        setupNodeForPlacement(node);
    } else if (isHtmlContent(pastedData)) {
        // Handle HTML content
        createHtmlNode(pastedData);
    } else {
        // Handle plain text
        createNodeFromWindow(null, pastedData, true);
    }
    hideContextMenu();
}

function isHtmlContent(data) {
    // A simple check for HTML tags
    const htmlTagPattern = /<[^>]+>/;
    return htmlTagPattern.test(data);
}


function setupNodeForPlacement(node) {
    node.followingMouse = 1;
    node.draw();
    node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
}

function createHtmlNode(pastedData) {
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
    setupNodeForPlacement(node);
}

// Existing paste event listener
addEventListener('paste', (event) => {
    let cd = (event.clipboardData || window.clipboardData);
    let pastedData = cd.getData("text");
    handlePasteData(pastedData, event.target);
});

addEventListener("paste", (event) => {
    let codeMirrorWrapper = window.myCodeMirror.getWrapperElement();
    if (codeMirrorWrapper.contains(event.target)) {
        //console.log('Paste detected in CodeMirror');

        // Use setTimeout to defer the execution until after the paste event
        setTimeout(() => {
            processAll = true;
            //console.log('processAll set to true after paste in CodeMirror');

            // Simulate a minor change in content to trigger an input event
            const cursorPos = window.myCodeMirror.getCursor();
            window.myCodeMirror.replaceRange(' ', cursorPos); // Insert a temporary space
            window.myCodeMirror.replaceRange('', cursorPos, { line: cursorPos.line, ch: cursorPos.ch + 1 }); // Immediately remove it

            //console.log('Triggered input event in CodeMirror');

            // Additional logic as required
        }, 0);
        event.stopPropagation();
    } else {
        // Check for other textarea or input elements
        let targetTag = event.target.tagName.toLowerCase();
        if (targetTag === "textarea" || targetTag === "input") {
            event.stopPropagation();
            //console.log("Paste disabled for textarea and input");
        }
    }
}, true);