async function fetchDirectoryContents(path) { // from the Node.js server
    const response = await Request.send(new fetchDirectoryContents.ct(path));
    if (!response) return;

    const data = await response.json();
    //console.log('Directory data:', data);
    return data;
}
fetchDirectoryContents.ct = class {
    constructor(path){
        this.url = 'http://localhost:9099/api/navigate?path=' + encodeURIComponent(path);
        this.path = path;
    }
    onFailure(){ return `Failed to fetch contents of directory ${this.path}:` }
}

async function fetchFileContent(path) {
    const response = await Request.send(new fetchFileContent.ct(path));
    if (!response) return;

    const mimeType = response.headers.get('Content-Type') || '';
    if (mimeType.startsWith('text/') || mimeType.startsWith('application/json') || mimeType.startsWith('application/xml')) {
        const textContent = await response.text();
        return { content: textContent, blob: null, mimeType };
    } else {
        const blob = await response.blob();
        return { content: null, blob, mimeType };
    }
}
fetchFileContent.ct = class {
    constructor(path){
        this.url = 'http://localhost:9099/api/read-file?path=' + encodeURIComponent(path);
        this.path = path;
    }
    onFailure(){ return `Failed to fetch content of file ${this.path}:` }
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
        this.filePathInput.addEventListener('keypress', this.handlePathInput.bind(this));

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
                console.log("Invalid path");
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
        if (!useProxy) {  // Strict inequality check
            const errorElement = document.createElement('p');
            errorElement.textContent = 'Localhost servers for Neurite are not enabled. \n Download the servers here ';

            const linkElement = document.createElement('a');
            linkElement.href = 'https://download-directory.github.io/?url=https%3A%2F%2Fgithub.com%2Fsatellitecomponent%2FNeurite%2Ftree%2Fmain%2Flocalhost_servers';
            linkElement.textContent = 'here';

            // Open the link in a new tab
            linkElement.target = '_blank';
            linkElement.rel = 'noopener noreferrer';  // For security reasons

            errorElement.appendChild(linkElement);
            parentElement.appendChild(errorElement);
            return;
        }

        const contents = await fetchDirectoryContents(path);
        if (!contents) {
            const errorElement = document.createElement('p');
            errorElement.textContent = 'Error loading directory contents.';
            parentElement.appendChild(errorElement);
            return;
        }

        contents.forEach(item => {
            const itemElement = this.createFileItem(item.name, item.type);
            parentElement.appendChild(itemElement);

            const childContainer = document.createElement('div');
            childContainer.classList.add('folder-content');
            childContainer.style.display = 'none'; // Initially hide the child container

            if (item.type === 'directory') {
                itemElement.addEventListener('click', () => this.selectItem(itemElement));
                itemElement.addEventListener('click', async () => {
                    const newPath = path === '/' ? `/${item.name}` : `${path}/${item.name}`;
                    if (itemElement.classList.contains('expanded')) {
                        this.collapseDirectory(childContainer, itemElement);
                    } else {
                        itemElement.classList.add('expanded');
                        this.expandDirectory(childContainer, itemElement);
                        await this.loadDirectory(newPath, childContainer);
                    }
                });
                this.addDragEventsToFolder(itemElement, item, path);
                parentElement.appendChild(childContainer);
            } else {
                itemElement.addEventListener('click', () => this.selectItem(itemElement));
                this.addDragEvents(itemElement, item, path);
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

    addDragEvents(itemElement, item, path) {
        itemElement.setAttribute('draggable', 'true'); // Make the file item draggable
        itemElement.addEventListener('dragstart', (event) => {
            event.stopPropagation();
            const filePath = path === '/' ? `/${item.name}` : `${path}/${item.name}`;
            const metadata = JSON.stringify({ name: item.name, path: filePath, type: item.type });
            event.dataTransfer.setData('application/my-app-file', metadata);
            const icon = itemElement.querySelector('svg');
            if (icon) {
                event.dataTransfer.setDragImage(icon, 10, 10);
            }
            //console.log("Drag started with metadata:", filePath);
        });

        itemElement.addEventListener('dragend', (event) => {
            event.stopPropagation();
            //console.log("Drag ended:", item.name);
        });
    }

    addDragEventsToFolder(itemElement, item, path) {
        itemElement.setAttribute('draggable', 'true');
        itemElement.addEventListener('dragstart', (event) => {
            event.stopPropagation();
            const folderPath = path === '/' ? `/${item.name}` : `${path}/${item.name}`;
            const metadata = JSON.stringify({ name: item.name, path: folderPath, type: item.type });
            event.dataTransfer.setData('application/my-app-folder', metadata);
            const icon = itemElement.querySelector('svg');
            if (icon) {
                event.dataTransfer.setDragImage(icon, 10, 10);
            }
            //console.log("Folder Drag started with metadata:", folderPath);
        });

        itemElement.addEventListener('dragend', (event) => {
            event.stopPropagation();
            //console.log("Folder Drag ended:", item.name);
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
        const itemElement = document.createElement('div');
        itemElement.classList.add('file-item');

        const icon = SVG.create.svg();
        const use = SVG.create.use();
        icon.classList.add('file-icon');
        use.setAttribute('href', type === 'directory' ? '#folder-icon' : this.getFileIcon(name.split('.').pop().toLowerCase()));
        icon.appendChild(use);
        itemElement.appendChild(icon);

        const nameElement = document.createElement('span');
        nameElement.classList.add('file-name');
        nameElement.textContent = name;
        itemElement.appendChild(nameElement);

        return itemElement;
    }

    // Get the appropriate SVG icon based on file extension
    getFileIcon(extension) {
        switch (extension) {
            case 'txt':
            case 'md':
                return '#file-text-icon';
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
                return '#file-image-icon';
            case 'js':
            case 'html':
            case 'css':
            case 'json':
                return '#file-code-icon';
            case 'csv':
                return '#file-csv-icon';
            case 'pdf':
                return '#file-pdf-icon';
            case 'mp3':
            case 'wav':
                return '#file-audio-icon';
            case 'mp4':
            case 'avi':
            case 'mov':
                return '#file-video-icon';
            case 'zip':
            case 'rar':
            case '7z':
                return '#file-zip-icon';
            case 'exe':
            case 'bat':
            case 'sh':
                return '#file-exe-icon';
            default:
                return '#file-text-icon'; // Default icon
        }
    }

    static openModal() {
        Modal.open('fileTreeModal');

        const fileTreeContainer = Elem.byId('modal-file-tree-container');
        const modalHeader = document.querySelector('.modal-header');
        if (!fileTreeContainer || !modalHeader) {
            console.error("File tree container or modal header not found!");
            return;
        }

        const modalHeaderInput = document.createElement('input');
        modalHeaderInput.type = 'text';
        modalHeaderInput.classList.add('modal-filepath-input'); // Custom class for styling
        modalHeaderInput.placeholder = 'Enter file path...'; // Placeholder text
        modalHeaderInput.value = currentPath; // Set default value from localStorage

        const closeButton = modalHeader.querySelector('.close');
        modalHeader.insertBefore(modalHeaderInput, closeButton);

        // Pass true to ensure it updates localStorage when the user navigates
        const fileTree = new FileTree(fileTreeContainer, modalHeaderInput, currentPath, true);
    }
}
