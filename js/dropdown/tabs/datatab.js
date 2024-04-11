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


// Global variables
let MAX_CHUNK_SIZE = 400;
let topN = 5;
let overlapSize = parseInt(document.getElementById('overlapSizeSlider').value, 10);

class DataTab {
    constructor() {
        this.initMaxChunkSizeSlider();
        this.initTopNSlider();
        this.initOverlapSizeSlider();
    }

    initMaxChunkSizeSlider() {
        const maxChunkSizeSlider = document.getElementById('maxChunkSizeSlider');
        const maxChunkSizeValue = document.getElementById('maxChunkSizeValue');

        // Display the initial slider value
        maxChunkSizeValue.textContent = maxChunkSizeSlider.value;

        // Update the global MAX_CHUNK_SIZE and display value on slider input
        maxChunkSizeSlider.addEventListener('input', () => {
            MAX_CHUNK_SIZE = parseInt(maxChunkSizeSlider.value, 10);
            maxChunkSizeValue.textContent = maxChunkSizeSlider.value;
        });
    }

    initTopNSlider() {
        const topNSlider = document.getElementById('topNSlider');
        const topNValue = document.getElementById('topNValue');

        // Update the global topN and display value on slider input
        topNSlider.addEventListener('input', () => {
            topN = parseInt(topNSlider.value, 10);
            topNValue.textContent = topNSlider.value;
        });
    }

    initOverlapSizeSlider() {
        const overlapSizeSlider = document.getElementById('overlapSizeSlider');
        const overlapSizeDisplay = document.getElementById('overlapSizeDisplay');

        // Update the global overlapSize and display value on slider input
        overlapSizeSlider.addEventListener('input', (e) => {
            overlapSize = Number(e.target.value);
            overlapSizeDisplay.textContent = overlapSize;
        });
    }
}