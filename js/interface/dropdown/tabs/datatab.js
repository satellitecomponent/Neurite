
class DataTab {
    constructor() {
        this.initButtons();
    }

    initButtons() {
        document.getElementById('chunkAndStoreButton').addEventListener('click', handleFileUploadVDBSelection);
        document.querySelector('.linkbuttons[title="Delete Document from Embeddings Database"]').addEventListener('click', deleteSelectedKeys);
    }

    async displayDocuments() {
        await fetchAndDisplayAllKeys();
    }

    async initialize() {
        await this.displayDocuments();
    }
}

document.getElementById('openVectorDbButton').onclick = async function () {
    await openVectorDbModal();
};

async function openVectorDbModal() {
    openModal('vectorDbModal');
    const dataTab = new DataTab();
    await dataTab.initialize();
}

// Global constants using getters
Object.defineProperty(window, 'MAX_CHUNK_SIZE', {
    get() {
        return parseInt(modalInputValues['maxChunkSizeSlider'] || 1024, 10);
    }
});

Object.defineProperty(window, 'topN', {
    get() {
        return parseInt(modalInputValues['topNSlider'] || 5, 10);
    }
});

Object.defineProperty(window, 'overlapSize', {
    get() {
        return parseInt(modalInputValues['overlapSizeSlider'] || 10, 10);
    }
});






// Interacts with embeddingsdb.js

function addLoadingIndicator(key) {
    const keyList = document.getElementById("key-list");
    const loadingItem = document.createElement("div");
    loadingItem.id = `loading-${key}`;
    loadingItem.className = 'vdb-loading-item';
    loadingItem.innerHTML = `
        <div class="vdb-progress-bar-inner"></div>
        <div class="vdb-loading-content">
            <div class="loader" style="margin-right: 10px; flex-shrink: 0;"></div>
            <span class="vdb-loader-text">${key}</span>
        </div>
    `;

    // Get existing items to find correct insertion point based on alphabetical order
    const existingItems = Array.from(keyList.children);
    const insertionIndex = existingItems.findIndex(item => key.localeCompare(item.textContent) < 0);

    if (insertionIndex === -1) {
        // If no suitable spot is found, append to the end
        keyList.appendChild(loadingItem);
    } else {
        // Insert before the first item that is greater than the key
        keyList.insertBefore(loadingItem, existingItems[insertionIndex]);
    }

    return loadingItem;
}
// Function to remove the loading indicator
function removeVectorDbLoadingIndicator(key) {
    const loadingItem = document.getElementById(`loading-${key}`);
    if (loadingItem) {
        loadingItem.remove();
    }
}

function updateVectorDbProgressBar(key, progress) {
    let loadingItem = document.getElementById(`loading-${key}`);
    if (!loadingItem) {
        loadingItem = addLoadingIndicator(key);
    }

    let progressBar = loadingItem.querySelector('.vdb-progress-bar-inner');
    if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.className = 'vdb-progress-bar-inner';
        loadingItem.insertBefore(progressBar, loadingItem.firstChild);
    }

    progressBar.style.width = `${progress}%`;
}

function testProgressBar(key) {
    let progress = 0;
    const interval = setInterval(() => {
        progress += 1;
        updateVectorDbProgressBar(key, progress);
        console.log(`Progress for ${key}: ${progress}%`);

        if (progress >= 100) {
            clearInterval(interval);
            console.log(`Progress complete for ${key}`);
            setTimeout(() => {
                removeVectorDbLoadingIndicator(key);
            }, 1000);
        }
    }, 1000);
}

// Test multiple progress bars
function testMultipleProgressBars() {
    testProgressBar('File1.pdf');
    setTimeout(() => testProgressBar('File2.docx'), 1000);
    setTimeout(() => testProgressBar('File3.txt'), 2000);
}

function setupVectorDbImportConfirmModal(initialText, initialMaxLength, initialOverlapSize, storageKey) {
    return new Promise((resolve, reject) => {
        window.currentVectorDbImportReject = reject;

        const rawTextArea = document.getElementById('rawTextArea');
        const chunkedTextDisplay = document.getElementById('chunkedTextDisplay');
        const maxChunkSizeSlider = document.getElementById('maxChunkSizeSlider');
        const overlapSizeSlider = document.getElementById('overlapSizeSlider');
        const maxChunkSizeValue = document.getElementById('maxChunkSizeValue');
        const overlapSizeDisplay = document.getElementById('overlapSizeDisplay');

        // Set initial values
        rawTextArea.value = initialText;
        maxChunkSizeSlider.value = initialMaxLength;
        overlapSizeSlider.value = initialOverlapSize;
        maxChunkSizeValue.textContent = initialMaxLength;
        overlapSizeDisplay.textContent = initialOverlapSize;

        setSliderBackground(maxChunkSizeSlider);
        setSliderBackground(overlapSizeSlider);

        let currentChunks = [];

        function updateChunkedText() {
            const rawText = rawTextArea.value;
            const maxChunkSize = parseInt(maxChunkSizeSlider.value);
            const overlapSize = parseInt(overlapSizeSlider.value);

            try {
                currentChunks = chunkText(rawText, maxChunkSize, overlapSize);
                chunkedTextDisplay.innerHTML = currentChunks.map((chunk, index) => `
                    <div class="vdb-search-result">
                        <div class="vdb-result-header">
                            <div class="vdb-result-source">Snippet ${index + 1}</div>
                        </div>
                        <div class="vdb-result-text custom-scrollbar">${chunk}</div>
                    </div>
                `).join('');
            } catch (error) {
                chunkedTextDisplay.innerHTML = `<div class="error">${error.message}</div>`;
                currentChunks = [];
            }
        }

        rawTextArea.addEventListener('input', updateChunkedText);
        maxChunkSizeSlider.addEventListener('input', () => {
            maxChunkSizeValue.textContent = maxChunkSizeSlider.value;
            updateChunkedText();
        });
        overlapSizeSlider.addEventListener('input', () => {
            overlapSizeDisplay.textContent = overlapSizeSlider.value;
            updateChunkedText();
        });

        document.getElementById('confirmChunkAndStoreButton').addEventListener('click', () => {
            window.currentVectorDbImportReject = null;
            resolve(currentChunks);
        });

        document.getElementById('cancelChunkAndStoreButton').addEventListener('click', () => {
            closeModal();
        });

        updateChunkedText();
    });
}