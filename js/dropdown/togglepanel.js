function togglePanel(panelContainer) {
    // Close any open custom dropdowns within the panel
    const openDropdowns = panelContainer.querySelectorAll('.options-replacer.show');
    openDropdowns.forEach(dropdown => {
        dropdown.classList.remove('show');
        const dropdownContainer = dropdown.closest('.select-replacer');
        if (dropdownContainer) {
            dropdownContainer.classList.add('closed');
        }
    });

    if (panelContainer.classList.contains('hidden')) {
        panelContainer.classList.add('panel-open');
        // Expand the panel
        panelContainer.classList.remove('hidden');
        panelContainer.style.display = ''; // Make it visible for height calculation

        // Directly set the height to start the transition
        panelContainer.style.height = panelContainer.scrollHeight + 'px';
    } else {
        panelContainer.classList.remove('panel-open');

        // Collapse the panel
        panelContainer.style.height = '0px'; // Trigger the collapse animation

        // Wait for the transition to finish before adding 'hidden'
        function onTransitionEnd() {
            panelContainer.classList.add('hidden');
            panelContainer.style.display = 'none'; // Fully hide after animation
            panelContainer.removeEventListener('transitionend', onTransitionEnd);
        }

        panelContainer.addEventListener('transitionend', onTransitionEnd, { once: true });
    }
}

const apiContainer = document.querySelector('.api-panel'); // Adjust selector as needed
const functionCallPanel = document.querySelector('.function-call-panel'); // Adjust selector as needed
const contextSettingsPanel = document.querySelector('.context-settings-panel');
const modelSelectPanel = document.querySelector('.model-select-panel');
const fractalSettingsPanel = document.querySelector('.fractal-settings-panel');
const colorSettingsPanel = document.querySelector('.color-settings-panel');

// Adjusted function calls
function toggleAPIPanel() {
    togglePanel(apiContainer);
}

function toggleFunctionCallPanel() {
    togglePanel(functionCallPanel);
}

function toggleContextSettingsPanel() {
    togglePanel(contextSettingsPanel);
}

function toggleModelSelectPanel() {
    togglePanel(modelSelectPanel);
}

function toggleFractalSettingsPanel() {
    togglePanel(fractalSettingsPanel);
}

function toggleColorSettingsPanel() {
    togglePanel(colorSettingsPanel);
}