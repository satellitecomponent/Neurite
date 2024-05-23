
class DataTab {
    constructor() {
        this.initMaxChunkSizeSlider();
        this.initOverlapSizeSlider();
        this.initButtons();
        this.displayDocuments();
    }

    initMaxChunkSizeSlider() {
        const maxChunkSizeSlider = document.getElementById('maxChunkSizeSlider');
        const maxChunkSizeValue = document.getElementById('maxChunkSizeValue');

        // Display the initial slider value
        maxChunkSizeValue.textContent = maxChunkSizeSlider.value;

        // Update display value on slider input
        maxChunkSizeSlider.addEventListener('input', () => {
            maxChunkSizeValue.textContent = maxChunkSizeSlider.value;
        });
    }

    initOverlapSizeSlider() {
        const overlapSizeSlider = document.getElementById('overlapSizeSlider');
        const overlapSizeDisplay = document.getElementById('overlapSizeDisplay');

        // Display the initial slider value
        overlapSizeDisplay.textContent = overlapSizeSlider.value;

        // Update display value on slider input
        overlapSizeSlider.addEventListener('input', () => {
            overlapSizeDisplay.textContent = overlapSizeSlider.value;
        });
    }

    initButtons() {
        document.getElementById('chunkAndStoreButton').addEventListener('click', handleFileUploadVDBSelection);
        document.querySelector('.linkbuttons[title="Delete Document from Embeddings Database"]').addEventListener('click', deleteSelectedKeys);
    }

    displayDocuments() {
        fetchAndDisplayAllKeys();
    }
}

document.getElementById('openVectorDbButton').onclick = function () {
    openModal('vectorDbModal');
    const dataTab = new DataTab();
};

// Global constants using getters
Object.defineProperty(window, 'MAX_CHUNK_SIZE', {
    get() {
        return parseInt(modalInputValues['maxChunkSizeSlider'] || 400, 10);
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