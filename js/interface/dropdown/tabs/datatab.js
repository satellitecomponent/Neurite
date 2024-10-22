const VectorDb = {};

VectorDb.openModal = async function(){
    Modal.open('vectorDbModal');
    Elem.byId('chunkAndStoreButton').addEventListener('click', handleFileUploadVDBSelection);
    document.querySelector('.linkbuttons[title="Delete Document from Embeddings Database"]').addEventListener('click', Keys.deleteSelected);
    await Keys.fetchAndDisplayAll();
}
Elem.byId('openVectorDbButton').onclick = VectorDb.openModal;

// Global constants using getters
Object.defineProperty(window, 'MAX_CHUNK_SIZE', {
    get() {
        return parseInt(Modal.inputValues.maxChunkSizeSlider || 1024, 10)
    }
});
Object.defineProperty(window, 'topN', {
    get() {
        return parseInt(Modal.inputValues.topNSlider || 5, 10)
    }
});
Object.defineProperty(window, 'overlapSize', {
    get() {
        return parseInt(Modal.inputValues.overlapSizeSlider || 10, 10)
    }
});



// Interacts with embeddingsdb.js

VectorDb.loadingIndicatorForKey = function(key){
    const id = 'loading-' + key;
    let indicator = Elem.byId(id);
    if (indicator) return indicator;

    indicator = document.createElement('div');
    indicator.id = id;
    indicator.className = 'vdb-loading-item';
    indicator.innerHTML = `
        <div class="vdb-loading-content">
            <div class="loader" style="margin-right: 10px; flex-shrink: 0;"></div>
            <span class="vdb-loader-text">${key}</span>
        </div>
    `;
    const bar = document.createElement('div');
    bar.className = 'vdb-progress-bar-inner';
    indicator.insertBefore(bar, indicator.firstChild);
    return VectorDb.insertLoadingIndicatorByKey(indicator, key);
}
VectorDb.insertLoadingIndicatorByKey = function(indicator, key){
    // find correct insertion point based on alphabetical order
    const compare = (item)=>(key.localeCompare(item.textContent) < 0);
    const keyList = Elem.byId('key-list');
    const insertionItem = Array.from(keyList.children).find(compare);
    if (insertionItem) {
        keyList.insertBefore(indicator, insertionItem);
    } else {
        keyList.appendChild(indicator);
    }
    return indicator;
}
VectorDb.removeLoadingIndicator = function(key){
    const indicator = Elem.byId('loading-' + key);
    if (indicator) indicator.remove();
}
VectorDb.funcUpdateProgressBarForKey = function(key){
    const indicator = VectorDb.loadingIndicatorForKey(key);
    const style = indicator.querySelector('.vdb-progress-bar-inner').style;
    return (progress)=>(style.width = progress + '%')
}

function testProgressBar(key) {
    const updateProgressBar = VectorDb.funcUpdateProgressBarForKey(key);
    let progress = 0;
    const interval = setInterval(() => {
        progress += 1;
        updateProgressBar(progress);
        console.log(`Progress for ${key}: ${progress}%`);

        if (progress >= 100) {
            clearInterval(interval);
            console.log("Progress complete for", key);
            setTimeout(VectorDb.removeLoadingIndicator.bind(VectorDb, key), 1000);
        }
    }, 1000);
}
function testMultipleProgressBars() {
    testProgressBar('File1.pdf');
    setTimeout(() => testProgressBar('File2.docx'), 1000);
    setTimeout(() => testProgressBar('File3.txt'), 2000);
}

function setupVectorDbImportConfirmModal(initialText, initialMaxLength, initialOverlapSize, storageId) {
    return new Promise((resolve, reject) => {
        window.currentVectorDbImportReject = reject;

        const rawTextArea = Elem.byId('rawTextArea');
        const chunkedTextDisplay = Elem.byId('chunkedTextDisplay');
        const maxChunkSizeSlider = Elem.byId('maxChunkSizeSlider');
        const overlapSizeSlider = Elem.byId('overlapSizeSlider');
        const maxChunkSizeValue = Elem.byId('maxChunkSizeValue');
        const overlapSizeDisplay = Elem.byId('overlapSizeDisplay');

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
            } catch (err) {
                chunkedTextDisplay.innerHTML = `<div class="error">${err.message}</div>`;
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

        Elem.byId('confirmChunkAndStoreButton').addEventListener('click', () => {
            window.currentVectorDbImportReject = null;
            resolve(currentChunks);
        });

        Elem.byId('cancelChunkAndStoreButton').addEventListener('click', Modal.close);

        updateChunkedText();
    });
}
Modals.vectorDbImportConfirmModal.init = setupVectorDbImportConfirmModal;
