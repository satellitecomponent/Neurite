const VectorDb = {};

VectorDb.openModal = async function(){
    Modal.open('vectorDbModal');
    On.click(Elem.byId('chunkAndStoreButton'), handleFileUploadVDBSelection);
    const buttonSelector = '.linkbuttons[title="Delete Document from Embeddings Database"]';
    On.click(document.querySelector(buttonSelector), async () => {
        await Keys.deleteSelected();
        Modal.open('vectorDbModal'); // Reopen after deletion
    });
    await Keys.fetchAndDisplayAll();
}
On.click(Elem.byId('openVectorDbButton'), VectorDb.openModal);

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

    indicator = Html.make.div('vdb-loading-item');
    indicator.id = id;
    indicator.innerHTML = `
        <div class="vdb-loading-content">
            <div class="loader" style="margin-right: 10px; flex-shrink: 0;"></div>
            <span class="vdb-loader-text">${key}</span>
        </div>
    `;
    const bar = Html.make.div('vdb-progress-bar-inner');
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
    return (progress)=>{ style.width = progress + '%' }
}

function testProgressBar(key) {
    const updateProgressBar = VectorDb.funcUpdateProgressBarForKey(key);
    let progress = 0;
    const interval = setInterval(() => {
        progress += 1;
        updateProgressBar(progress);
        Logger.info(`Progress for ${key}: ${progress}%`);

        if (progress >= 100) {
            clearInterval(interval);
            Logger.info("Progress complete for", key);
            const cb = VectorDb.removeLoadingIndicator.bind(VectorDb, key);
            Promise.delay(1000).then(cb);
        }
    }, 1000);
}
function testMultipleProgressBars() {
    testProgressBar('File1.pdf');
    Promise.delay(1000).then(testProgressBar.bind(null, 'File2.docx'));
    Promise.delay(2000).then(testProgressBar.bind(null, 'File3.txt'));
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
                        <div class="vdb-result-text custom-scrollbar">${escapeHtml(chunk)}</div>
                    </div>
                `).join('');
            } catch (err) {
                chunkedTextDisplay.innerHTML = `<div class="error">${err.message}</div>`;
                currentChunks = [];
            }
        }

        On.input(rawTextArea, updateChunkedText);
        On.input(maxChunkSizeSlider, (e)=>{
            maxChunkSizeValue.textContent = maxChunkSizeSlider.value;
            updateChunkedText();
        });
        On.input(overlapSizeSlider, (e)=>{
            overlapSizeDisplay.textContent = overlapSizeSlider.value;
            updateChunkedText();
        });

        On.click(Elem.byId('confirmChunkAndStoreButton'), (e)=>{
            window.currentVectorDbImportReject = null;
            resolve(currentChunks);
        });

        On.click(Elem.byId('cancelChunkAndStoreButton'), Modal.close);

        updateChunkedText();
    });
}
Modals.vectorDbImportConfirmModal.init = setupVectorDbImportConfirmModal;
