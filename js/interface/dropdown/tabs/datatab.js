function checkLocalEmbeddingsCheckbox(selectElement) {
    const localEmbeddingsCheckbox = document.getElementById('local-embeddings-checkbox');

    localEmbeddingsCheckbox.checked = selectElement.value === 'local-embeddings';
}

function handleEmbeddingsSelection(selectElement) {
    const localEmbeddingsCheckbox = document.getElementById('local-embeddings-checkbox');

    if (selectElement.value === 'local-embeddings') {
        // Check the hidden checkbox when local embeddings is selected
        localEmbeddingsCheckbox.checked = true;
    } else {
        // Uncheck the hidden checkbox for other selections
        localEmbeddingsCheckbox.checked = false;
    }

    // Additional logic here if needed, e.g., saving the selection to localStorage
}


class DataTab {
    constructor() {
        this.initMaxChunkSizeSlider();
        this.initTopNSlider();
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

    initTopNSlider() {
        const topNSlider = document.getElementById('topNSlider');
        const topNValue = document.getElementById('topNValue');

        // Display the initial slider value
        topNValue.textContent = topNSlider.value;

        // Update display value on slider input
        topNSlider.addEventListener('input', () => {
            topNValue.textContent = topNSlider.value;
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
        document.getElementById('chunkAndStoreButton').addEventListener('click', chunkAndStoreInputExtract);
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