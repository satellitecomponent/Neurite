let isDraggingIcon = false;
let initialMousePosition = null;
let clickThreshold = 1; // Adjust this value as needed
let mouseDownIcon = false;

function makeIconDraggable(iconDiv) {
    iconDiv.setAttribute('draggable', 'true'); // Set draggable to true by default

    iconDiv.addEventListener('mousedown', function (event) {
        initialMousePosition = { x: event.clientX, y: event.clientY };
        mouseDownIcon = true;
    });

    iconDiv.addEventListener('mousemove', function (event) {
        if (mouseDownIcon && !isDraggingIcon) {
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
            if (iconDiv.classList.contains('note-icon')) {
                openModal('noteModal');
            }
            if (iconDiv.classList.contains('ai-icon')) {
                openModal('aiModal');
            }
            if (iconDiv.classList.contains('link-icon')) {
                openModal('importLinkModalContent');
            }
            if (iconDiv.classList.contains('edges-icon')) {
                openFileTreeModal();
            }
        }
    });
}

const icons = document.querySelectorAll('.panel-icon');
icons.forEach(icon => {
    makeIconDraggable(icon);
});


class DropHandler {
    constructor(dropAreaId) {
        this.dropArea = document.getElementById(dropAreaId);
        this.initialize();

        // Define handlers for different base types
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

    // Handle drag over event
    dragOverHandler(ev) {
        ev.preventDefault(); // Allow drop
        ev.dataTransfer.dropEffect = 'copy'; // Show a copy icon when dragging
    }

    // Initialize event listeners
    initialize() {
        this.dropArea.addEventListener('dragover', this.dragOverHandler.bind(this));
        this.dropArea.addEventListener('drop', this.handleDrop.bind(this));
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

        return 'unknown'; // Handle any other types not defined
    }

    // Map MIME types to code languages
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

        //console.log(`Processing file: ${fileName}, MIME Type: ${mimeTypeWithoutParams}, Base Type: ${baseType}`);

        // Route to code file handler
        if (baseType === 'code') {
            const codeLanguage = this.getCodeLanguageFromMimeType(mimeTypeWithoutParams);
            if (!content) {
                //console.error(`Content is undefined for code file: ${fileName}`);
                // Attempt to read blob as text if content is undefined
                if (blob) {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const textContent = reader.result;
                        this.createCodeNode({ name: fileName }, textContent, codeLanguage);
                    };
                    reader.onerror = (error) => {
                        console.error(`Error reading blob for code file: ${fileName}`, error);
                    };
                    reader.readAsText(blob);
                }
                return;
            }
            //console.log(`Creating code node for: ${fileName}, Language: ${codeLanguage}`);
            this.createCodeNode({ name: fileName }, content, codeLanguage);
            return;
        }

        // Route to text handler
        if (baseType === 'text') {
            if (!content) {
                console.error(`Content is undefined for text file: ${fileName}`);
                return;
            }
            this.typeHandlers[baseType]({ name: fileName }, null, content, mimeTypeWithoutParams);
            return;
        }

        // Handle application types (PDFs, etc.)
        if (baseType === 'application') {
            if (mimeTypeWithoutParams === 'application/pdf') {
                if (!blob) {
                    console.error(`Blob is undefined for PDF file: ${fileName}`);
                    return;
                }
                const objectURL = URL.createObjectURL(blob);
                this.typeHandlers[baseType]({ name: fileName }, objectURL, null, mimeTypeWithoutParams);
            } else {
                if (!content) {
                    console.error(`Content is undefined for application file: ${fileName}`);
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
                console.error(`Blob is undefined for binary file: ${fileName}`);
                return;
            }
            const objectURL = URL.createObjectURL(blob);
            this.typeHandlers[baseType]({ name: fileName }, objectURL, null, mimeTypeWithoutParams);
            return;
        }

        // If we get here, it's unhandled
        console.warn(`Unhandled file type: ${mimeTypeWithoutParams} for file: ${fileName}`);
    }

    // Handle the drop event
    async handleDrop(ev) {
        ev.preventDefault();

        // **Handle Folder Drops First**
        const folderMetadataJSON = ev.dataTransfer.getData('application/my-app-folder');
        if (folderMetadataJSON && isJSON(folderMetadataJSON)) {
            const folderMetadata = JSON.parse(folderMetadataJSON);
            await this.processFolderDrop(folderMetadata);
            return;
        }

        // **Handle File Drops**
        const fileMetadataJSON = ev.dataTransfer.getData('application/my-app-file');
        if (fileMetadataJSON && isJSON(fileMetadataJSON)) {
            const fileMetadata = JSON.parse(fileMetadataJSON);
            await this.processCustomDrop(fileMetadata);
            return;
        }

        // Attempt to retrieve JSON data
        const data = ev.dataTransfer.getData('text');
        if (data && isJSON(data)) {
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

        // Handle standard OS file drops
        this.handleOSFileDrop(ev);
    }

    // Handle the custom drop
    async processCustomDrop(metadata) {
        try {
            const fileResponse = await fetchFileContent(metadata.path);
            if (!fileResponse) throw new Error(`Failed to fetch file content for: ${metadata.path}`);

            const { content, blob, mimeType } = fileResponse;

            if (content === null && blob === null) {
                throw new Error('No content received');
            }

            this.processFile(metadata.name, content, mimeType, blob);
        } catch (error) {
            console.error(error);
        }
    }

    // Handle OS file drops
    processOSFile(file) {
        const mimeType = file.type || '';
        const fileName = file.name;

        const reader = new FileReader();

        reader.onload = (event) => {
            const contentOrBlob = event.target.result;

            if (mimeType.startsWith('text/')) {
                // For text files, use content as string
                this.processFile(fileName, contentOrBlob, mimeType);
            } else {
                // For application and other non-text files, create Blob
                const blob = new Blob([contentOrBlob], { type: mimeType });
                this.processFile(fileName, null, mimeType, blob);
            }
        };

        if (mimeType.startsWith('text/')) {
            reader.readAsText(file);  // Read as text
        } else {
            reader.readAsArrayBuffer(file);  // Read as binary
        }
    }


    // Handle folder drops
    async processFolderDrop(folderMetadata) {
        try {
            const { name, path } = folderMetadata;

            // **Create a File Tree Node Starting from the Dropped Folder's Path**
            const node = await createFileTreeNode(path);
            this.afterNodeCreation(node, toDZ(new vec2(0, -node.content.offsetHeight / 4)));
        } catch (error) {
            console.error('Error processing folder drop:', error);
        }
    }

    // Create a text node
    createTextNode(metadata, url, content, mimeType) {
        const text = typeof content === 'string' ? content : undefined;
        const name = metadata.name || metadata;
        const node = createNodeFromWindow(name, text, true);
    }

    // Create a code node with syntax highlighting
    createCodeNode(metadata, content, codeLanguage) {
        const name = metadata.name || 'Code';
        if (!codeLanguage) {
            console.warn(`No language specified for code file: ${name}. Defaulting to plaintext.`);
        }
        const language = codeLanguage || 'plaintext';
        const codeBlock = `\`\`\`${language}\n${content}\n\`\`\``;
        const node = createNodeFromWindow(name, codeBlock, true);
    }

    // Centralized handler for 'application' base type (e.g., PDFs)
    createPDFNode(name, url) {
        const node = createLinkNode(name, name, url);
        node.fileName = name; // Store file name in node
        this.afterNodeCreation(node);
    }

    handleApplication(metadataOrFile, url, content, mimeType) {
        if (mimeType && mimeType.endsWith('pdf')) {
            this.createPDFNode(metadataOrFile.name, url);
        } else {
            console.log("Unsupported application type:", mimeType);
        }
    }

    handleUnknown(metadataOrFile, url, content, mimeType) {
        console.log("Unsupported file type:", mimeType || metadataOrFile.type);
    }

    // Create an image node
    createImageNode(metadataOrFile, url) {
        const imageElement = document.createElement('img');
        imageElement.src = url;
        imageElement.onload = () => {
            const node = createImageNode(imageElement, metadataOrFile.name || metadataOrFile);
            this.afterNodeCreation(node);
        };
    }

    // Create a media node (video/audio)
    createMediaNode(type, metadataOrFile, url) {
        const node = createMediaNode(type, metadataOrFile, url);
        let offset;

        // Check if the media type is audio to apply different offset
        if (type === 'audio') {
            offset = new vec2(0, -node.content.offsetHeight / 4); // Adjust for audio
        } else {
            offset = new vec2(0, -node.content.offsetHeight / 1.2); // Default offset for video or other media
        }

        this.afterNodeCreation(node, toDZ(offset));
    }

    afterNodeCreation(node, mouseAnchor = toDZ(new vec2(0, 0))) {
        setupNodeForPlacement(node, mouseAnchor);
    }


    // Handle standard OS file drops
    handleOSFileDrop(ev) {
        const files = ev.dataTransfer.files; // Get the files from the drop event

        if (!files || files.length === 0) {
            console.warn('No files detected in OS drop');
            return;
        }

        for (const file of files) {
            this.processOSFile(file); // Process each file
        }
    }

    // Handle icon drops
    handleIconDrop(event, iconName) {
        //console.log(`Dropped icon: ${iconName}`);

        switch (iconName) {
            case 'note-icon':
                const textNode = createNodeFromWindow(``, ``, true); // The last parameter sets followMouse to true
                break;
            case 'ai-icon':
                const llmNode = createLLMNode('', undefined, undefined, undefined, undefined);
                this.afterNodeCreation(llmNode);
                break;
            case 'link-icon':
                returnLinkNodes();
                break;
            case 'edges-icon':
                const fileTreeNode = createFileTreeNode();
                this.afterNodeCreation(fileTreeNode, toDZ(new vec2(0, -fileTreeNode.content.offsetHeight / 4)));
                break;
            default:
                console.warn(`No handler defined for icon: ${iconName}`);
                break;
        }

        event.stopPropagation();
        event.preventDefault();
    }

    // Handle specific div drops
    handleDivDrop(parsedData) {
        let [title, content] = parsedData;

        if (['AI Response', 'Prompt', 'Code Block'].includes(title)) {
            if (title === 'Code Block') {
                // Split the content into lines
                let lines = content.split('\n');

                // Remove the second line (index 1 in a 0-indexed array)
                if (lines.length > 1) {
                    lines.splice(1, 1);
                }

                // Add the triple backticks at the start of the first line and at the end of the content
                content = (lines[0] ? "```" + lines[0] : "```") + "\n" + lines.slice(1).join('\n') + "\n```";
            }

            const defaultTitle = getDefaultTitle();
            const fullTitle = title + ' ' + defaultTitle;
            const node = createNodeFromWindow(fullTitle, content, true);

            // Stop the drop event from being handled further
            return;
        }
    }
}

const dropHandlerInstance = new DropHandler('neurite-workspace');

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


function setupNodeForPlacement(node, mouseAnchor = toDZ(new vec2(0, 0))) {
    node.followingMouse = 1;
    node.mouseAnchor = mouseAnchor;
}

function createHtmlNode(title, pastedData) {
    let content = document.createElement("div");
    content.innerHTML = pastedData;
    let node = windowify(title, [content], toZ(mousePos), (zoom.mag2() ** settings.zoomContentExp), 1);
    htmlnodes_parent.appendChild(node.content);
    registernode(node);
    setupNodeForPlacement(node, toDZ(new vec2(0, -node.content.offsetHeight / 4)));
}

// Existing paste event listener
addEventListener('paste', (event) => {
    let cd = (event.clipboardData || window.clipboardData);
    let pastedData = cd.getData("text");
    handlePasteData(pastedData, event.target);
});

addEventListener("paste", (event) => {
    let codeMirrorWrapper = window.currentActiveZettelkastenMirror.getWrapperElement();
    if (codeMirrorWrapper.contains(event.target)) {
        //console.log('Paste detected in CodeMirror');

        // Use setTimeout to defer the execution until after the paste event
        setTimeout(() => {
            processAll = true;
            //console.log('processAll set to true after paste in CodeMirror');

            // Simulate a minor change in content to trigger an input event
            const cursorPos = window.currentActiveZettelkastenMirror.getCursor();
            window.currentActiveZettelkastenMirror.replaceRange(' ', cursorPos); // Insert a temporary space
            window.currentActiveZettelkastenMirror.replaceRange('', cursorPos, { line: cursorPos.line, ch: cursorPos.ch + 1 }); // Immediately remove it

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