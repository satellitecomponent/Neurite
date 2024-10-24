const Mouse = {
    buttonNameFromValue: {
        "0": "Left Click",
        "1": "Middle Click",
        "2": "Right Click",
        "scroll": "Scroll Wheel"
    },
    downIcon: false,
    dragThreshold: 1, // Adjust this value as needed
    initialX: 0,
    initialY: 0,
    isDragging: false
};
Mouse.onDraggingInit = function (e) {
    Mouse.initialX = e.clientX;
    Mouse.initialY = e.clientY;
    Mouse.downIcon = true;
}
Mouse.onDraggingSuspected = function (e) {
    if (!Mouse.downIcon || Mouse.isDragging) return;

    const dx2 = Math.pow(e.clientX - Mouse.initialX, 2);
    const dy2 = Math.pow(e.clientY - Mouse.initialY, 2);
    const distance = Math.sqrt(dx2 + dy2);
    if (distance > Mouse.dragThreshold) Mouse.isDragging = true;
}
Mouse.onDraggingFinish = function (e) {
    Mouse.downIcon = false;
    Mouse.isDragging = false;
}

function makeIconDraggable(iconDiv) {
    iconDiv.setAttribute('draggable', 'true');

    On.mousedown(iconDiv, Mouse.onDraggingInit);
    On.mousemove(iconDiv, Mouse.onDraggingSuspected);
    On.mouseup(iconDiv, Mouse.onDraggingFinish);

    On.dragstart(iconDiv, (e) => {
        if (!Mouse.isDragging) {
            e.preventDefault();
            return;
        }

        const rect = iconDiv.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        e.dataTransfer.setDragImage(iconDiv, offsetX, offsetY);
        const draggableData = {
            type: 'icon',
            iconName: iconDiv.classList[1]
        };
        e.dataTransfer.setData('text/plain', JSON.stringify(draggableData));
    });

    On.click(iconDiv, (e) => {
        if (!Mouse.isDragging) {
            if (iconDiv.classList.contains('note-icon')) {
                Modal.open('noteModal');
            }
            if (iconDiv.classList.contains('ai-icon')) {
                Modal.open('aiModal');
            }
            if (iconDiv.classList.contains('link-icon')) {
                Modal.open('importLinkModalContent');
            }
            if (iconDiv.classList.contains('edges-icon')) {
                FileTree.openModal();
            }
        }
    });
}

document.querySelectorAll('.panel-icon').forEach(makeIconDraggable);


class DropHandler {
    constructor(dropAreaId) {
        this.dropArea = Elem.byId(dropAreaId);
        this.initialize();

        this.typeHandlers = {
            image: this.createImageNode.bind(this),
            video: this.createMediaNode.bind(this, 'video'),
            audio: this.createMediaNode.bind(this, 'audio'),
            text: this.createTextNode.bind(this),
            code: this.createCodeNode.bind(this), // Use createCodeNode for code files
            application: this.handleApplication.bind(this), // Handle PDFs and other application types
            unknown: this.handleUnknown.bind(this)
        };
    }

    dragOverHandler = (ev) => {
        ev.preventDefault(); // Allow drop
        ev.dataTransfer.dropEffect = 'copy'; // Show a copy icon when dragging
    }

    initialize() {
        On.dragover(this.dropArea, this.dragOverHandler);
        On.drop(this.dropArea, this.handleDrop);
    }

    determineBaseType(mimeType) {
        if (!mimeType) return 'unknown';

        const mimeTypeWithoutParams = mimeType.split(';')[0].trim().toLowerCase();

        // Define exceptions for 'application/' types that are not code or text
        const nonTextApplicationTypes = [
            'application/pdf',
            'application/zip',
            'application/x-rar-compressed',
            'application/x-7z-compressed',
            'application/x-tar',
            'application/gzip',
            // Add more non-text 'application/' types as needed
        ];

        if (nonTextApplicationTypes.includes(mimeTypeWithoutParams)) {
            return 'application';
        }

        // Define common code-related MIME types (text/* and remaining application/*)
        const codeRelatedMimeTypes = ['text/', 'application/'];
        const imageRelatedMimeTypes = ['image/'];
        const videoRelatedMimeTypes = ['video/'];
        const audioRelatedMimeTypes = ['audio/'];

        // Code types
        if (codeRelatedMimeTypes.some(prefix => mimeTypeWithoutParams.startsWith(prefix))) {
            const codeLanguage = this.getCodeLanguageFromMimeType(mimeTypeWithoutParams);
            return codeLanguage ? 'code' : 'text';
        }

        // Non-code types
        if (imageRelatedMimeTypes.some(prefix => mimeTypeWithoutParams.startsWith(prefix))) return 'image';
        if (videoRelatedMimeTypes.some(prefix => mimeTypeWithoutParams.startsWith(prefix))) return 'video';
        if (audioRelatedMimeTypes.some(prefix => mimeTypeWithoutParams.startsWith(prefix))) return 'audio';

        return 'unknown';
    }

    getCodeLanguageFromMimeType(mimeType) {
        const mimeTypeToLanguageMap = {
            'application/javascript': 'javascript',
            'application/typescript': 'typescript',
            'application/json': 'json',
            'application/xml': 'xml',
            'application/x-sh': 'bash',
            'application/x-python-code': 'python',
            'application/x-httpd-php': 'php',
            'text/x-java-source': 'java',
            'text/x-csrc': 'c',
            'text/x-c++src': 'cpp',
            'text/x-csharp': 'csharp',
            'text/x-go': 'go',
            'application/x-rust': 'rust',
            'application/xhtml+xml': 'html',
            'text/html': 'html',
            'text/css': 'css',
            'text/javascript': 'javascript',
            'text/markdown': 'markdown', // Optional
        };

        return mimeTypeToLanguageMap[mimeType.toLowerCase()] || null; // Ensure case-insensitive matching
    }

    // Process the file based on its base type
    processFile(fileName, content, mimeType, blob = null) {
        const mimeTypeWithoutParams = mimeType.split(';')[0].trim().toLowerCase();
        const baseType = this.determineBaseType(mimeTypeWithoutParams);

        Logger.debug(`Processing file: ${fileName}, MIME Type: ${mimeTypeWithoutParams}, Base Type: ${baseType}`);

        // Route to code file handler
        if (baseType === 'code') {
            const codeLanguage = this.getCodeLanguageFromMimeType(mimeTypeWithoutParams);
            if (!content) {
                Logger.debug("Content is undefined for code file:", fileName);
                // Attempt to read blob as text
                if (!blob) return;

                const reader = new FileReader();

                On.load(reader, (e) => {
                    const textContent = reader.result;
                    this.createCodeNode({ name: fileName }, textContent, codeLanguage);
                });

                const msgError = "In reading blob for code file:";
                On.error(reader, Logger.err.bind(Logger, msgError, fileName));

                reader.readAsText(blob);
                return;
            }

            Logger.debug("Creating code node for:", fileName, ", Language:", codeLanguage);
            this.createCodeNode({ name: fileName }, content, codeLanguage);
            return;
        }

        if (baseType === 'text') {
            if (content) {
                this.typeHandlers[baseType]({ name: fileName }, null, content, mimeTypeWithoutParams);
            } else {
                Logger.err("Content is undefined for text file:", fileName)
            }
            return;
        }

        // Handle application types (PDFs, etc.)
        if (baseType === 'application') {
            if (mimeTypeWithoutParams === 'application/pdf') {
                if (!blob) {
                    Logger.err("Blob is undefined for PDF file:", fileName);
                    return;
                }
                const objectURL = URL.createObjectURL(blob);
                this.typeHandlers[baseType]({ name: fileName }, objectURL, null, mimeTypeWithoutParams);
            } else {
                if (!content) {
                    Logger.err("Content is undefined for application file:", fileName);
                    return;
                }
                // Treat other application types as text
                this.typeHandlers['text']({ name: fileName }, null, content, mimeTypeWithoutParams);
            }
            return;
        }

        // Handle binary files (image, video, audio)
        if (['image', 'video', 'audio'].includes(baseType)) {
            if (!blob) {
                Logger.err("Blob is undefined for binary file:", fileName);
                return;
            }
            const objectURL = URL.createObjectURL(blob);
            this.typeHandlers[baseType]({ name: fileName }, objectURL, null, mimeTypeWithoutParams);
            return;
        }

        Logger.warn("Unhandled file type:", mimeTypeWithoutParams, "for file:", fileName);
    }

    handleDrop = async (ev) => {
        ev.preventDefault();

        // **Handle Folder Drops First**
        const folderMetadataJSON = ev.dataTransfer.getData('application/my-app-folder');
        if (folderMetadataJSON && String.isJson(folderMetadataJSON)) {
            const folderMetadata = JSON.parse(folderMetadataJSON);
            await this.processFolderDrop(folderMetadata);
            return;
        }

        // **Handle File Drops**
        const fileMetadataJSON = ev.dataTransfer.getData('application/my-app-file');
        if (fileMetadataJSON && String.isJson(fileMetadataJSON)) {
            const fileMetadata = JSON.parse(fileMetadataJSON);
            await this.processCustomDrop(fileMetadata);
            return;
        }

        // Attempt to retrieve JSON data
        const data = ev.dataTransfer.getData('text');
        if (data && String.isJson(data)) {
            const parsedData = JSON.parse(data);
            if (parsedData.type === 'icon') {
                // Handle the icon drop
                this.handleIconDrop(ev, parsedData.iconName);
                return;
            }

            // Handle specific div types
            this.handleDivDrop(parsedData);
            return;
        }

        this.handleOSFileDrop(ev);
    }

    async processCustomDrop(metadata) {
        try {
            const fetcher = new Path.fileFetcher(metadata.path);
            await Request.send(fetcher);
            const { blob, content, mimeType } = fetcher;
            if (content === null && blob === null) {
                throw new Error("Failed to fetch file content for: " + metadata.path);
            }

            this.processFile(metadata.name, content, mimeType, blob);
        } catch (err) {
            Logger.err(err)
        }
    }

    processOSFile(file) {
        const mimeType = file.type || '';
        const fileName = file.name;

        const reader = new FileReader();

        On.load(reader, (e) => {
            const contentOrBlob = e.target.result;
            if (mimeType.startsWith('text/') || mimeType.startsWith('application/')) {
                this.processFile(fileName, contentOrBlob, mimeType);
            } else {
                const blob = new Blob([contentOrBlob], { type: mimeType });
                this.processFile(fileName, null, mimeType, blob);
            }
        });

        if (mimeType.startsWith('text/') || mimeType.startsWith('application/')) {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file); // Read as binary
        }
    }

    async processFolderDrop(folderMetadata) {
        try {
            const node = await FileTreeNode.create(folderMetadata.path);
            this.afterNodeCreation(node, toDZ(new vec2(0, -node.content.offsetHeight / 4)));
        } catch (err) {
            Logger.err("In processing folder drop:", err)
        }
    }

    createTextNode(metadata, url, content, mimeType) {
        const text = typeof content === 'string' ? content : undefined;
        const name = metadata.name || metadata;
        const node = createNodeFromWindow(name, text, true);
    }

    // Create a code node with syntax highlighting
    createCodeNode(metadata, content, codeLanguage) {
        const name = metadata.name || 'Code';
        if (!codeLanguage) {
            Logger.warn(`No language specified for code file: ${name}. Defaulting to plaintext.`)
        }
        const language = codeLanguage || 'plaintext';
        const codeBlock = `\`\`\`${language}\n${content}\n\`\`\``;
        const node = createNodeFromWindow(name, codeBlock, true);
    }

    // Centralized handler for 'application' base type (e.g., PDFs)
    createPDFNode(name, url) {
        const node = new LinkNode(name, name, url);
        node.fileName = name;
        this.afterNodeCreation(node);
    }

    handleApplication(metadataOrFile, url, content, mimeType) {
        if (mimeType && mimeType.endsWith('pdf')) {
            this.createPDFNode(metadataOrFile.name, url);
        } else {
            Logger.info("Unsupported application type:", mimeType)
        }
    }

    handleUnknown(metadataOrFile, url, content, mimeType) {
        Logger.info("Unsupported file type:", mimeType || metadataOrFile.type)
    }

    createImageNode(metadataOrFile, url) {
        const imageElement = Html.new.img();
        imageElement.src = url;
        imageElement.onload = () => {
            const node = createImageNode(imageElement, metadataOrFile.name || metadataOrFile);
            this.afterNodeCreation(node);
        };
    }

    createMediaNode(type, metadataOrFile, url) {
        const node = createMediaNode(type, metadataOrFile, url);
        const divisor = (type === 'audio' ? 4 : 1.2);
        const offset = new vec2(0, -node.content.offsetHeight / divisor);
        this.afterNodeCreation(node, toDZ(offset));
    }

    afterNodeCreation(node, mouseAnchor) {
        setupNodeForPlacement(node, mouseAnchor);
    }

    handleOSFileDrop(ev) {
        const files = ev.dataTransfer.files;
        if (!files || files.length === 0) {
            Logger.warn("No files detected in OS drop");
            return;
        }

        for (const file of files) {
            this.processOSFile(file);
        }
    }

    handleIconDrop(event, iconName) {
        Logger.debug("Dropped icon:", iconName);

        switch (iconName) {
            case 'note-icon':
                const textNode = createNodeFromWindow('', '', true); // The last parameter sets followMouse to true
                break;
            case 'ai-icon':
                this.afterNodeCreation(createLlmNode(''));
                break;
            case 'link-icon':
                returnLinkNodes();
                break;
            case 'edges-icon':
                const fileTreeNode = FileTreeNode.create();
                this.afterNodeCreation(fileTreeNode, toDZ(new vec2(0, -fileTreeNode.content.offsetHeight / 4)));
                break;
            default:
                Logger.warn("No handler defined for icon:", iconName);
                break;
        }

        event.stopPropagation();
        event.preventDefault();
    }

    handleDivDrop(parsedData) {
        let [title, content] = parsedData;

        if (['AI Response', 'Prompt', 'Code Block'].includes(title)) {
            if (title === 'Code Block') {
                const lines = content.split('\n');

                // Remove the second line (index 1 in a 0-indexed array)
                if (lines.length > 1) lines.splice(1, 1);

                // Add the triple backticks at the start of the first line and at the end of the content
                content = (lines[0] ? "```" + lines[0] : "```") + "\n" + lines.slice(1).join('\n') + "\n```";
            }

            const fullTitle = title + ' ' + getDefaultTitle();
            const node = createNodeFromWindow(fullTitle, content, true);

            // Stop the drop event from being handled further
            return;
        }
    }
}

const dropHandlerInstance = new DropHandler('neurite-workspace');

function handlePasteData(pastedData, target) {
    // Allow default handling for textareas and content-editable elements
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable) {
        return; // allow the browser to handle the paste
    }

    if (String.isUrl(pastedData)) {
        const node = new LinkNode(pastedData, pastedData);
        setupNodeForPlacement(node);
    } else if (String.isIframe(pastedData)) {
        const iframeUrl = getIframeUrl(pastedData);
        const node = new LinkNode(iframeUrl, iframeUrl);
        setupNodeForPlacement(node);
    } else if (isHtmlContent(pastedData)) {
        createHtmlNode(pastedData);
    } else { // plain text
        createNodeFromWindow(null, pastedData, true);
    }
    App.menuContext.hide();
}

function isHtmlContent(data) {
    // A simple check for HTML tags
    const htmlTagPattern = /<[^>]+>/;
    return htmlTagPattern.test(data);
}


function setupNodeForPlacement(node, mouseAnchor) {
    node.followingMouse = 1;
    node.mouseAnchor = mouseAnchor || toDZ(new vec2(0, 0));
}

function createHtmlNode(title, pastedData) {
    const content = Html.new.div();
    content.innerHTML = pastedData;
    const node = new Node();
    NodeView.windowify(title, [content], node);
    Graph.appendNode(node);
    Graph.addNode(node);
    setupNodeForPlacement(node, toDZ(new vec2(0, -node.content.offsetHeight / 4)));
}

// Existing paste event listener
On.paste(window, (e) => {
    const cd = (e.clipboardData || window.clipboardData);
    const pastedData = cd.getData("text");
    handlePasteData(pastedData, e.target);
});

On.paste(window, (e) => {
    let codeMirrorWrapper = window.currentActiveZettelkastenMirror.getWrapperElement();
    if (codeMirrorWrapper.contains(e.target)) {
        Logger.debug("Paste detected in CodeMirror");

        // Use setTimeout to defer the execution until after the paste event
        setTimeout(() => {
            processAll = true;
            Logger.debug("processAll set to true after paste in CodeMirror");

            // Simulate a minor change in content to trigger an input event
            const cursorPos = window.currentActiveZettelkastenMirror.getCursor();
            window.currentActiveZettelkastenMirror.replaceRange(' ', cursorPos); // Insert a temporary space
            window.currentActiveZettelkastenMirror.replaceRange('', cursorPos, { line: cursorPos.line, ch: cursorPos.ch + 1 }); // Immediately remove it

            Logger.debug("Triggered input event in CodeMirror");

            // Additional logic as required
        }, 0);
        e.stopPropagation();
    } else {
        // Check for other textarea or input elements
        let targetTag = e.target.tagName.toLowerCase();
        if (targetTag === "textarea" || targetTag === "input") {
            e.stopPropagation();
            Logger.debug("Paste disabled for textarea and input");
        }
    }
}, true);