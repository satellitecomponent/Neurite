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
            code: this.createCodeNode.bind(this),
            application: this.handleApplication.bind(this),
            unknown: this.handleUnknown.bind(this)
        };
    }

    initialize() {
        On.dragover(this.dropArea, this.dragOverHandler);
        On.drop(this.dropArea, this.handleDrop);
    }

    dragOverHandler = (ev) => {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'copy';
    }

    determineBaseType(mimeType) {
        if (!mimeType) return 'unknown';
        const base = mimeType.split(';')[0].trim().toLowerCase();

        const nonTextApps = new Set([
            'application/pdf', 'application/zip', 'application/x-rar-compressed',
            'application/x-7z-compressed', 'application/x-tar', 'application/gzip'
        ]);

        if (nonTextApps.has(base)) return 'application';
        if (base.startsWith('image/')) return 'image';
        if (base.startsWith('video/')) return 'video';
        if (base.startsWith('audio/')) return 'audio';

        const lang = this.getCodeLanguageFromMimeType(base);
        return lang ? 'code' : (base.startsWith('text/') || base.startsWith('application/')) ? 'text' : 'unknown';
    }

    getCodeLanguageFromMimeType(mimeType) {
        const map = {
            'application/javascript': 'javascript', 'application/typescript': 'typescript',
            'application/json': 'json', 'application/xml': 'xml',
            'application/x-sh': 'bash', 'application/x-python-code': 'python',
            'application/x-httpd-php': 'php', 'text/x-java-source': 'java',
            'text/x-csrc': 'c', 'text/x-c++src': 'cpp', 'text/x-csharp': 'csharp',
            'text/x-go': 'go', 'application/x-rust': 'rust',
            'application/xhtml+xml': 'html', 'text/html': 'html',
            'text/css': 'css', 'text/javascript': 'javascript', 'text/markdown': 'markdown'
        };
        return map[mimeType.toLowerCase()] || null;
    }

    processFile(name, content, mimeType, blob = null) {
        const base = this.determineBaseType(mimeType);
        const lang = this.getCodeLanguageFromMimeType(mimeType);

        if (base === 'code') {
            if (content) return this.createCodeNode({ name }, content, lang);
            if (!blob) return;
            const reader = new FileReader();
            On.load(reader, () => this.createCodeNode({ name }, reader.result, lang));
            On.error(reader, Logger.err.bind(Logger, 'In reading blob for code file:', name));
            reader.readAsText(blob);
            return;
        }

        if (base === 'text') {
            return this.createTextNode({ name }, null, content || '', mimeType);
        }

        if (base === 'application') {
            if (mimeType.endsWith('pdf') && blob) {
                const url = URL.createObjectURL(blob);
                return this.handleApplication({ name }, url, null, mimeType);
            }
            if (content) return this.createTextNode({ name }, null, content, mimeType);
            return Logger.err('Content is undefined for application file:', name);
        }

        if (['image', 'video', 'audio'].includes(base)) {
            if (!blob) return Logger.err('Blob is undefined for binary file:', name);
            const url = URL.createObjectURL(blob);
            return this.typeHandlers[base]({ name }, url, null, mimeType);
        }

        Logger.warn('Unhandled file type:', mimeType, 'for file:', name);
    }

    handleDrop = async (ev) => {
        ev.preventDefault();

        const folderData = ev.dataTransfer.getData('application/my-app-folder');
        if (folderData && String.isJson(folderData)) return this.processFolderDrop(JSON.parse(folderData));

        const fileData = ev.dataTransfer.getData('application/my-app-file');
        if (fileData && String.isJson(fileData)) return this.processCustomDrop(JSON.parse(fileData));

        const plainData = ev.dataTransfer.getData('text');
        if (plainData && String.isJson(plainData)) {
            const parsed = JSON.parse(plainData);
            if (parsed.type === 'icon') return this.handleIconDrop(ev, parsed.iconName);
            return this.handleDivDrop(parsed);
        }

        this.handleOSFileDrop(ev);
    }

    async processCustomDrop(meta) {
        try {
            const fetcher = new Path.fileFetcher(meta.path);
            await Request.send(fetcher);
            const { blob, content, mimeType } = fetcher;
            this.processFile(meta.name, content, mimeType, blob);
        } catch (e) {
            Logger.err(e);
        }
    }

    processOSFile(file) {
        const mimeType = file.type || '', name = file.name;
        const reader = new FileReader();

        On.load(reader, (e) => {
            const result = e.target.result;
            const isText = mimeType.startsWith('text/') || mimeType === 'application/json';
            const blob = new Blob([result], { type: mimeType });
            this.processFile(name, isText ? result : null, mimeType, isText ? null : blob);
        });

        if (mimeType === 'application/pdf') reader.readAsArrayBuffer(file);
        else if (mimeType.startsWith('text/') || mimeType === 'application/json') reader.readAsText(file);
        else reader.readAsArrayBuffer(file);
    }

    async processFolderDrop(meta) {
        try {
            const node = await FileTreeNode.create(meta.path);
            this.afterNodeCreation(node, toDZ(new vec2(0, -node.content.offsetHeight / 4)));
        } catch (err) {
            Logger.err('In processing folder drop:', err);
        }
    }

    createTextNode(meta, url, content, mime) {
        createNodeFromWindow(meta.name || meta, content, true);
    }

    createCodeNode(meta, content, lang) {
        const name = meta.name || 'Code';
        const code = `\`\`\`${lang || 'plaintext'}\n${content}\n\`\`\``;
        createNodeFromWindow(name, code, true);
    }

    createPDFNode(name, url) {
        const node = new LinkNode(url, name);
        node.fileName = name;
        this.afterNodeCreation(node);
    }

    handleApplication(meta, url, content, mime) {
        if (mime.endsWith('pdf')) return this.createPDFNode(meta.name, url);
        Logger.info('Unsupported application type:', mime);
    }

    handleUnknown(meta, url, content, mime) {
        Logger.info('Unsupported file type:', mime || meta.type);
    }

    createImageNode(meta, url) {
        const img = Html.new.img();
        img.src = url;
        img.onload = () => {
            const node = NodeView.addForImage(img, meta.name || meta);
            this.afterNodeCreation(node);
        };
    }

    createMediaNode(type, meta, url) {
        const node = createMediaNode(type, meta, url);
        const d = type === 'audio' ? 4 : 1.2;
        this.afterNodeCreation(node, toDZ(new vec2(0, -node.content.offsetHeight / d)));
    }

    afterNodeCreation(node, anchor) {
        setupNodeForPlacement(node, anchor);
    }

    handleOSFileDrop(ev) {
        const files = ev.dataTransfer.files;
        if (!files || !files.length) return Logger.warn('No files detected in OS drop');
        for (const file of files) this.processOSFile(file);
    }

    handleIconDrop(ev, icon) {
        ev.preventDefault();
        ev.stopPropagation();
        switch (icon) {
            case 'note-icon': createNodeFromWindow('', '', true); break;
            case 'ai-icon': this.afterNodeCreation(createLlmNode('')); break;
            case 'link-icon': returnLinkNodes(); break;
            case 'edges-icon':
                const node = FileTreeNode.create();
                this.afterNodeCreation(node, toDZ(new vec2(0, -node.content.offsetHeight / 4)));
                break;
            default: Logger.warn('No handler defined for icon:', icon);
        }
    }

    handleDivDrop(parsed) {
        let [title, content] = parsed;
        if (['AI Response', 'Prompt', 'Code Block'].includes(title)) {
            if (title === 'Code Block') {
                const lines = content.split('\n');
                if (lines.length > 1) lines.splice(1, 1);
                content = (lines[0] ? '```' + lines[0] : '```') + '\n' + lines.slice(1).join('\n') + '\n```';
            }
            const node = createNodeFromWindow(title + ' ' + getDefaultTitle(), content, true);
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
    const cm = window.currentActiveZettelkastenMirror;
    const codeMirrorWrapper = cm.getWrapperElement();
    if (codeMirrorWrapper.contains(e.target)) {
        Logger.debug("Paste detected in CodeMirror");

        function paste(){
            processAll = true;
            Logger.debug("processAll set to true after paste in CodeMirror");

            // Simulate a minor change in content to trigger an input event
            const cursorPos = cm.getCursor();
            cm.replaceRange(' ', cursorPos); // Insert a temporary space
            cm.replaceRange('', cursorPos, { line: cursorPos.line, ch: cursorPos.ch + 1 }); // Immediately remove it

            Logger.debug("Triggered input event in CodeMirror");
        }
        Promise.delay(1).then(paste);
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
