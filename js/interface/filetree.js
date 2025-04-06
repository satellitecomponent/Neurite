class Path {
    static directoryFetcher = class DirectoryFetcher { // from the Node.js server
        static baseUrl = Host.urlForPath('/directaccess/navigate?path=');
        constructor(path) {
            this.url = DirectoryFetcher.baseUrl + encodeURIComponent(path);
            this.path = path;
        }
        onResponse(res) {
            const contentType = res.headers.get('Content-Type');
            Logger.debug("Response Content-Type:", contentType);
            Logger.debug("Response Status:", res.status);
        
            if (!contentType || !contentType.includes('application/json')) {
                return res.text().then(text => {
                    Logger.err("Unexpected response:", text);
                    throw new Error(`Unexpected Content-Type: ${contentType}`);
                });
            }
            return res.json().then(this.onData);
        }
        onData(data) {
            Logger.debug("Directory data:", data);
            return data;
        }
        onFailure() { return `Failed to fetch contents of directory ${this.path}:` }
    }
    static fileFetcher = class FileFetcher {
        blob = null;
        content = null;
        static baseUrl = Host.urlForPath('/directaccess/read-file?path=');
        constructor(path) {
            this.url = FileFetcher.baseUrl + encodeURIComponent(path);
            this.path = path;
        }
        isTextMime(mimeType) {
            return mimeType.startsWith('text/')
                || mimeType.startsWith('application/json')
                || mimeType.startsWith('application/xml')
        }
        onResponse(res) {
            this.mimeType = res.headers.get('Content-Type') || '';
            const isText = this.isTextMime(this.mimeType);
            if (isText) return res.text().then(this.onText);
            else return res.blob().then(this.onBlob);
        }
        onText = (text) => { this.content = text }
        onBlob = (blob) => { this.blob = blob }
        onFailure() { return `Failed to fetch content of file ${this.path}:` }
    }
}

class FileTree {
    constructor(containerElement, filePathInput, filePath = '/', shouldSavePath = false, onPathChangeCallback = null) {
        if (!(containerElement instanceof HTMLElement)) throw new Error("Container must be a valid HTMLElement");
        if (!(filePathInput instanceof HTMLInputElement)) throw new Error("File path input must be an input element");

        this.container = containerElement;
        this.filePathInput = filePathInput;
        this.currentPath = filePath;
        this.selectedElement = null;
        this.shouldSavePath = shouldSavePath;
        this.onPathChangeCallback = onPathChangeCallback;

        this.filePathInput.value = this.currentPath;
        On.keypress(this.filePathInput, this.handlePathInput.bind(this));

        this.init(this.currentPath);
    }

    // Initialize the file tree
    async init(path = '/') {
        this.currentPath = path;

        // Save the current path to localStorage only if shouldSavePath is true
        if (this.shouldSavePath) {
            localStorage.setItem('currentPath', this.currentPath);
        }

        // Update the input value with the new current path
        this.filePathInput.value = this.currentPath;

        // Load the directory contents into the container
        await this.loadDirectory(path, this.container);
    }

    // Handle the 'Enter' key event on the file path input
    handlePathInput(event) {
        if (event.key === 'Enter') {
            const newPath = this.filePathInput.value.trim();
            if (!newPath) {
                Logger.info("Invalid path");
                return;
            }

            this.container.innerHTML = '';
            this.init(newPath); // load the new directory

            // Trigger the callback to update the node's filePath
            if (this.onPathChangeCallback) {
                this.onPathChangeCallback(newPath);
            }
        }
    }

    // Load the directory contents and display them
    async loadDirectory(path, parentElement) {
        if (!useProxy) {
            const errorElement = Html.new.p();
        
            // Set innerHTML so we can use <br> for line breaks
            errorElement.innerHTML = `
                The Localhost servers for Neurite are not enabled.<br><br>
            `;
        
            const releaseUrl = 'https://github.com/satellitecomponent/Neurite/releases/latest?tag=electron';
            const linkElement = Html.make.a(releaseUrl);
            linkElement.textContent = 'Download Neurite Desktop';
        
            linkElement.target = '_blank';
            linkElement.rel = 'noopener noreferrer';
        
            errorElement.appendChild(document.createElement('br'));
            errorElement.appendChild(linkElement);
        
            parentElement.appendChild(errorElement);
            return;
        }

        const contents = await Request.send(new Path.directoryFetcher(path));
        if (!contents) {
            const errorElement = Html.new.p();
            errorElement.textContent = 'Error loading directory contents.';
            parentElement.appendChild(errorElement);
            return;
        }

        contents.forEach(item => {
            const itemElement = this.createFileItem(item.name, item.type);
            parentElement.appendChild(itemElement);

            const childContainer = Html.make.div('folder-content');
            Elem.hide(childContainer);

            On.click(itemElement, this.selectItem.bind(this, itemElement));
            if (item.type === 'directory') {
                On.click(itemElement, async (e) => {
                    const newPath = path === '/' ? `/${item.name}` : `${path}/${item.name}`;
                    if (itemElement.classList.contains('expanded')) {
                        this.collapseDirectory(childContainer, itemElement);
                    } else {
                        itemElement.classList.add('expanded');
                        this.expandDirectory(childContainer, itemElement);
                        await this.loadDirectory(newPath, childContainer);
                    }
                });
                this.addDragEvents("Folder", 'application/my-app-folder', itemElement, item, path);
                parentElement.appendChild(childContainer);
            } else {
                this.addDragEvents("File", 'application/my-app-file', itemElement, item, path);
            }
        });
    }

    selectItem(itemElement) {
        if (this.selectedElement) {
            this.selectedElement.classList.remove('selected');
        }

        this.selectedElement = itemElement;
        itemElement.classList.add('selected');
    }

    addDragEvents(type, mime, itemElement, item, itemPath) {
        itemElement.setAttribute('draggable', 'true');
        On.dragstart(itemElement, (e) => {
            e.stopPropagation();
            const path = (itemPath === '/' ? `/${item.name}` : `${itemPath}/${item.name}`);
            const metadata = JSON.stringify({ name: item.name, path, type: item.type });
            e.dataTransfer.setData(mime, metadata);
            const icon = itemElement.querySelector('svg');
            if (icon) e.dataTransfer.setDragImage(icon, 10, 10);
            Logger.debug(type, "drag started with metadata:", path);
        });
        On.dragend(itemElement, (e) => {
            e.stopPropagation();
            Logger.debug(type, "drag ended:", item.name);
        });
    }

    collapseDirectory(childContainer, itemElement) {
        childContainer.style.display = 'none';
        const iconUse = itemElement.querySelector('.file-icon use');
        if (iconUse) iconUse.setAttribute('href', '#folder-icon');
        itemElement.classList.remove('expanded');
    }

    expandDirectory(childContainer, itemElement) {
        childContainer.style.display = 'block';
        const iconUse = itemElement.querySelector('.file-icon use');
        if (iconUse) iconUse.setAttribute('href', '#folder-open-icon');
    }

    createFileItem(name, type) {
        const itemElement = Html.make.div('file-item');

        const icon = Svg.new.svg();
        const use = Svg.new.use();
        icon.classList.add('file-icon');
        use.setAttribute('href', this.getIconId(type, name));
        icon.appendChild(use);
        itemElement.appendChild(icon);

        const nameElement = Html.make.span('file-name');
        nameElement.textContent = name;
        itemElement.appendChild(nameElement);

        return itemElement;
    }

    getIconId(type, name) {
        if (type === 'directory') return '#folder-icon';

        const extension = name.split('.').pop().toLowerCase();
        return FileTree.iconIdFromExtension[extension] || '#file-text-icon'; // default
    }
    static iconIdFromExtension = {
        'txt': '#file-text-icon',
        'md': '#file-text-icon',
        'jpg': '#file-image-icon',
        'jpeg': '#file-image-icon',
        'png': '#file-image-icon',
        'gif': '#file-image-icon',
        'js': '#file-code-icon',
        'html': '#file-code-icon',
        'css': '#file-code-icon',
        'json': '#file-code-icon',
        'csv': '#file-csv-icon',
        'pdf': '#file-pdf-icon',
        'mp3': '#file-audio-icon',
        'wav': '#file-audio-icon',
        'mp4': '#file-video-icon',
        'avi': '#file-video-icon',
        'mov': '#file-video-icon',
        'zip': '#file-zip-icon',
        'rar': '#file-zip-icon',
        '7z': '#file-zip-icon',
        'exe': '#file-exe-icon',
        'bat': '#file-exe-icon',
        'sh': '#file-exe-icon'
    }

    static openModal() {
        Modal.open('fileTreeModal');

        const fileTreeContainer = Elem.byId('modal-file-tree-container');
        const modalHeader = document.querySelector('.modal-header');
        if (!fileTreeContainer || !modalHeader) {
            Logger.err("File tree container or modal header not found!");
            return;
        }

        const modalHeaderInput = Html.make.input('modal-filepath-input');
        modalHeaderInput.type = 'text';
        modalHeaderInput.placeholder = 'Enter file path...'; // Placeholder text
        modalHeaderInput.value = currentPath; // Set default value from localStorage

        const closeButton = modalHeader.querySelector('.close');
        modalHeader.insertBefore(modalHeaderInput, closeButton);

        // Pass true to ensure it updates localStorage when the user navigates
        const fileTree = new FileTree(fileTreeContainer, modalHeaderInput, currentPath, true);
    }
}
