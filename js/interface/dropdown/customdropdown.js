

function setupCustomDropdown(select, aiNode = false) {
    // Create the main custom dropdown container
    let selectReplacer = document.createElement('div');
    selectReplacer.className = 'select-replacer closed'; // add 'closed' class by default

    // Create the currently selected value container
    let selectedDiv = document.createElement('div');
    selectedDiv.innerText = select.options[select.selectedIndex].innerText;
    selectReplacer.appendChild(selectedDiv);

    // Create the dropdown options container
    let optionsReplacer = document.createElement('div');
    optionsReplacer.className = 'options-replacer';

    // Append the options container to the main dropdown container
    selectReplacer.appendChild(optionsReplacer);


    // Replace the original select with the custom dropdown
    let container = document.createElement('div');
    container.className = 'select-container';
    select.parentNode.insertBefore(container, select);
    container.appendChild(selectReplacer);
    container.appendChild(select);
    select.style.display = 'none'; // Hide the original select

    addEventListenersToCustomDropdown(select, aiNode);

}

function createOptionDiv(option, select, optionsReplacer, selectedDiv) {
    let optionDiv = document.createElement('div');
    optionDiv.className = 'dropdown-option';
    optionDiv.innerText = option.innerText;
    optionDiv.setAttribute('data-value', option.value);

    // Event handler for clicks on this option
    optionDiv.addEventListener('click', function (event) {
        event.stopPropagation(); // Stop the event from propagating further

        // First, remove 'selected' from all options
        Array.from(optionsReplacer.children).forEach(child => {
            child.classList.remove('selected');
        });

        // Set this option as the selected one
        optionDiv.classList.add('selected');
        select.value = option.value; // Update the underlying select value
        selectedDiv.innerText = option.innerText; // Update the selected display

        // Dispatch a change event to the original select element
        select.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    });

    optionsReplacer.appendChild(optionDiv);
}

function addEventListenersToCustomDropdown(select, aiNode) {
    let isPendingFrame = false;
    let container = select.parentNode;
    let selectReplacer = container.querySelector('.select-replacer');
    let optionsReplacer = selectReplacer.querySelector('.options-replacer');
    let selectedDiv = selectReplacer.querySelector('div');

    // Create individual options
    Array.from(select.options).forEach((option) => {
        createOptionDiv(option, select, optionsReplacer, selectedDiv);
    });

    selectReplacer.addEventListener('click', function (event) {
        // Get all the select containers
        const selectContainers = document.querySelectorAll('.select-container');
        // Reset z-index for all
        selectContainers.forEach((el) => el.style.zIndex = "20");

        if (optionsReplacer.classList.contains('show')) {
            if (!event.target.closest('.options-replacer')) {
                // Dropdown is open and click was outside of the options, so close it
                window.requestAnimationFrame(() => {
                    optionsReplacer.classList.remove('show');
                    selectReplacer.classList.add('closed');
                    container.style.zIndex = "20"; // reset the z-index of the parent container
                    isPendingFrame = false;
                });
                isPendingFrame = true;
            }
        } else {
            // Dropdown is closed, so open it
            container.style.zIndex = "30"; // increase the z-index of the parent container
            if (!isPendingFrame) {
                window.requestAnimationFrame(() => {
                    optionsReplacer.classList.add('show');
                    selectReplacer.classList.remove('closed');
                    isPendingFrame = false;
                });
                isPendingFrame = true;
            }
        }
    });
}

function setupModelSelect(selectElement, isEmbeddingsSelect = false) {
    if (selectElement) {
        setupCustomDropdown(selectElement);

        // Restore selection from local storage
        const storedValue = localStorage.getItem(selectElement.id);
        if (storedValue) {
            selectElement.value = storedValue;
            updateSelectedOptionDisplay(selectElement);
            if (isEmbeddingsSelect) {
                checkLocalEmbeddingsCheckbox(selectElement);
            }
        }

        // Set change event listener for caching selected value and updating display
        selectElement.addEventListener('change', function () {
            localStorage.setItem(this.id, this.value);
            updateSelectedOptionDisplay(this);
            if (isEmbeddingsSelect) {
                checkLocalEmbeddingsCheckbox(this);
            }
        });
    }
}

function updateSelectedOptionDisplay(selectElement) {
    // Update the custom dropdown display to show the selected value
    let selectedDiv = selectElement.parentNode.querySelector('.select-replacer > div');
    if (selectedDiv) {
        let selectedOption = selectElement.options[selectElement.selectedIndex];
        if (selectedOption) {
            selectedDiv.innerText = selectedOption.innerText;
        }
    }

    // Update highlighting in the custom dropdown options
    let optionsReplacer = selectElement.parentNode.querySelector('.options-replacer');
    if (optionsReplacer) {
        let optionDivs = optionsReplacer.querySelectorAll('div');
        optionDivs.forEach(div => {
            if (div.getAttribute('data-value') === selectElement.value) {
                div.classList.add('selected');
            } else {
                div.classList.remove('selected');
            }
        });
    }
}

function refreshCustomDropdownDisplay(select) {
    const optionsReplacer = select.parentNode.querySelector('.options-replacer');
    // Clear existing custom dropdown options
    while (optionsReplacer.firstChild) {
        optionsReplacer.removeChild(optionsReplacer.firstChild);
    }
    // Repopulate the custom dropdown options
    Array.from(select.options).forEach(option => {
        createOptionDiv(option, select, optionsReplacer, select.parentNode.querySelector('.select-replacer > div'));
    });
}

document.addEventListener('DOMContentLoaded', function () {
    // Setup for all existing custom-selects, excluding those in the modal
    let selects = document.querySelectorAll('select.custom-select:not(#customModal select.custom-select)');
    selects.forEach(select => setupModelSelect(select, select.id === 'embeddingsModelSelect'));
});

function addOptionToCustomDropdown(select, optionData) {
    let optionsReplacer = select.parentNode.querySelector('.options-replacer');
    let selectedDiv = select.parentNode.querySelector('.select-replacer > div');

    // Create the option element
    let option = new Option(optionData.text, optionData.value);
    option.setAttribute('data-key', optionData.key);

    // Append and bind event to this new option
    createOptionDiv(option, select, optionsReplacer, selectedDiv);
}


function addToCustomModelDropdown(select, selectData, cacheKey) {
    const uniqueId = Date.now().toString(); // Simple unique ID generation
    const option = new Option(selectData.modelName, uniqueId);

    // Store additional data in HTML5 data attributes
    option.setAttribute('data-endpoint', selectData.endpoint);
    option.setAttribute('data-key', selectData.key);

    select.appendChild(option);

    saveDropdownToLocalStorage(select, cacheKey);
    addOptionToCustomDropdown(select, option);
    updateSelectedOptionDisplay(select);
}

function saveDropdownToLocalStorage(select, storageKey) {
    const options = Array.from(select.options).map(option => ({
        value: option.value,
        text: option.textContent,
        key: option.getAttribute('data-key'),
        endpoint: option.getAttribute('data-endpoint')
    }));
    localStorage.setItem(storageKey, JSON.stringify(options));
    localStorage.setItem(storageKey + '_selected', select.value);
}

function loadDropdownFromLocalStorage(select, storageKey) {
    const storedOptions = JSON.parse(localStorage.getItem(storageKey));
    if (storedOptions) {
        const existingOptions = new Set(); // Use a Set to track existing option values
        Array.from(select.options).forEach(option => existingOptions.add(option.value));

        storedOptions.forEach(optionData => {
            // Only add option if it doesn't already exist
            if (!existingOptions.has(optionData.value)) {
                const option = new Option(optionData.text, optionData.value);
                option.setAttribute('data-key', optionData.key);
                option.setAttribute('data-endpoint', optionData.endpoint);
                select.appendChild(option);
                addOptionToCustomDropdown(select, option); // Custom function to handle UI updates
            }
        });

        // Ensure the select displays the correct selected value from storage
        select.value = localStorage.getItem(storageKey + '_selected');
        updateSelectedOptionDisplay(select); // Custom function to update UI display of selected option
    }
}
function deleteSelectedOption(selectId, storageKey) {
    const select = document.getElementById(selectId);
    const selectedIndex = select.selectedIndex;

    if (selectedIndex > -1 && select.options[selectedIndex].value !== "none") {
        if (confirm("Are you sure you want to delete this configuration?")) {
            const uniqueValue = select.options[selectedIndex].value;
            select.remove(selectedIndex);

            // After removal, update the currently selected index
            if (select.options.length > 0) {  // Check if there are remaining options
                select.selectedIndex = Math.max(0, selectedIndex - 1); // Adjust the selected index appropriately
            }

            updateStorageAfterDeletion(select, storageKey, uniqueValue);
            updateSelectedOptionDisplay(select);
        }
    } else {
        alert("No valid option selected to delete or cannot delete the placeholder.");
    }
}

function updateStorageAfterDeletion(select, storageKey, uniqueValue) {
    const options = Array.from(select.options).map(option => ({
        value: option.value,
        text: option.textContent,
        key: option.getAttribute('data-key'),
        endpoint: option.getAttribute('data-endpoint')
    }));
    localStorage.setItem(storageKey, JSON.stringify(options));
    localStorage.setItem(storageKey + '_selected', select.value);
    refreshCustomDropdownDisplay(select); // Ensure UI is updated
}


// Function for custom slider background
function setSliderBackground(slider) {
    const min = slider.min ? parseFloat(slider.min) : 0;
    const max = slider.max ? parseFloat(slider.max) : 100;
    const value = slider.value ? parseFloat(slider.value) : 0;
    const percentage = (value - min) / (max - min) * 100;
    slider.style.background = `linear-gradient(to right, #006BB6 0%, #006BB6 ${percentage}%, #18181c ${percentage}%, #18181c 100%)`;
}

document.querySelectorAll('input[type=range]:not(#customModal input[type=range])').forEach(function (slider) {
    setSliderBackground(slider);
    slider.addEventListener('input', function () {
        setSliderBackground(slider);
    });
});