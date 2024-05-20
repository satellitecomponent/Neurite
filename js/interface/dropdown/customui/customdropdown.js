function createDropdown(id) {
    const select = document.createElement('select');
    select.id = id;
    select.className = 'model-selector custom-select ignoreSetup';
    return select;
}

function createDropdownWrapper(dropdown, wrapperIdPrefix, nodeIndex) {
    const wrapper = document.createElement('div');
    wrapper.className = 'dropdown-wrapper';
    wrapper.id = `${wrapperIdPrefix}-${nodeIndex}`;

    const container = document.createElement('div');
    container.className = 'dropdown-container';
    container.appendChild(dropdown);

    wrapper.appendChild(container);

    return wrapper;
}

function setupCustomDropdown(select, delayListeners = false) {
    // Create the main custom dropdown container
    let selectReplacer = document.createElement('div');
    selectReplacer.className = 'select-replacer closed'; // add 'closed' class by default

    // Create the currently selected value container
    let selectedDiv = document.createElement('div');
    selectedDiv.className = 'selected-text';
    if (select.options.length > 0) {
        selectedDiv.innerText = select.options[select.selectedIndex].innerText;
    }
    selectReplacer.appendChild(selectedDiv);

    // Create the dropdown options container
    let optionsReplacer = document.createElement('div');
    optionsReplacer.className = 'options-replacer custom-scrollbar';

    // Append the options container to the main dropdown container
    selectReplacer.appendChild(optionsReplacer);

    // Replace the original select with the custom dropdown
    let container = document.createElement('div');
    container.className = 'select-container';
    select.parentNode.insertBefore(container, select);
    container.appendChild(selectReplacer);
    container.appendChild(select);
    select.style.display = 'none'; // Hide the original select

    // Create the custom options
    Array.from(select.options).forEach(option => {
        createOptionDiv(option, select, optionsReplacer, selectedDiv);
    });

    if (!delayListeners) {
        addEventListenersToCustomDropdown(select);
    }
}

function createOptionDiv(option, select, optionsReplacer, selectedDiv) {
    let optionDiv = document.createElement('div');
    optionDiv.className = 'dropdown-option';
    optionDiv.innerText = option.innerText;
    optionDiv.setAttribute('data-value', option.value);

    // Check if this option is the currently selected one
    if (option.selected) {
        optionDiv.classList.add('selected');
    }

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


function addEventListenersToCustomDropdown(select) {
    let isPendingFrame = false;
    let container = select.parentNode;
    let selectReplacer = container.querySelector('.select-replacer');
    let optionsReplacer = selectReplacer.querySelector('.options-replacer');
    let selectedDiv = selectReplacer.querySelector('.selected-text');

    // Clear existing options to avoid duplicates
    optionsReplacer.innerHTML = '';

    // Create individual options
    Array.from(select.options).forEach((option) => {
        createOptionDiv(option, select, optionsReplacer, selectedDiv);
    });

    selectReplacer.addEventListener('click', function (event) {

        if (optionsReplacer.classList.contains('show')) {
            // Dropdown is open, so close it
            window.requestAnimationFrame(() => {
                optionsReplacer.classList.remove('show');
                selectReplacer.classList.add('closed');
                container.style.zIndex = "20"; // Reset the z-index of the parent container
                isPendingFrame = false;
            });
            isPendingFrame = true;
        } else {
            // Close all other dropdowns
            document.querySelectorAll('.options-replacer.show').forEach(el => {
                el.classList.remove('show');
                el.parentElement.classList.add('closed');
                el.parentElement.parentElement.style.zIndex = "20"; // Reset the z-index of other dropdowns
            });

            // Dropdown is closed, so open it
            container.style.zIndex = "30"; // Increase the z-index of the parent container
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

    // Close dropdown when clicking outside
    document.addEventListener('click', function (event) {
        if (!container.contains(event.target)) {
            optionsReplacer.classList.remove('show');
            selectReplacer.classList.add('closed');
            container.style.zIndex = "20"; // Reset the z-index of the parent container
        }
    });
}

function setupModelSelect(selectElement) {
    const isEmbeddingsSelect = selectElement.id === 'embeddingsModelSelect';
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

document.addEventListener('DOMContentLoaded', function () {
    // Setup for all existing custom-selects, excluding those with the ignoreSetup class
    let selects = document.querySelectorAll('select.custom-select:not(.ignoreSetup)');
    selects.forEach(select => setupModelSelect(select));
});

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

function restoreDropdownState(dropdown) {
    const customDropdown = dropdown.parentNode.querySelector('.select-replacer');
    if (customDropdown) {
        const selectedText = customDropdown.querySelector('.selected-text').textContent.trim();
        const options = dropdown.options;
        for (let i = 0; i < options.length; i++) {
            if (options[i].textContent.trim() === selectedText) {
                dropdown.selectedIndex = i;
                // Optionally, trigger a change event if needed
                dropdown.dispatchEvent(new Event('change'));
                break;
            }
        }
    }
}

function addOptionToCustomDropdown(select, optionData) {
    let optionsReplacer = select.parentNode.querySelector('.options-replacer');
    let selectedDiv = select.parentNode.querySelector('.select-replacer > div');

    // Create the option element
    let option = new Option(optionData.text, optionData.value);
    option.setAttribute('data-key', optionData.key);

    // Append and bind event to this new option
    if (optionsReplacer) {
        createOptionDiv(option, select, optionsReplacer, selectedDiv);
    }

    // Append option to the select element
    select.appendChild(option);
}


function addToCustomModelDropdown(select, selectData, cacheKey) {
    const uniqueId = Date.now().toString(); // Simple unique ID generation
    const option = new Option(selectData.modelName, uniqueId);

    // Store additional data in HTML5 data attributes
    option.setAttribute('data-endpoint', selectData.endpoint);
    option.setAttribute('data-key', selectData.key);

    select.appendChild(option);
    saveDropdownToLocalStorage(select, cacheKey);
    updateSelectedOptionDisplay(select);
    refreshCustomDropdownDisplay(select);
}

function saveDropdownToLocalStorage(select, storageKey) {
    const options = Array.from(select.options)
        .filter(option => option.value !== 'default') // Exclude the default option
        .map(option => ({
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
        // Remove existing non-default options
        Array.from(select.options).forEach(option => {
            if (option.value !== 'default') {
                select.removeChild(option);
            }
        });

        storedOptions.forEach(optionData => {
            const option = new Option(optionData.text, optionData.value);
            option.setAttribute('data-key', optionData.key);
            option.setAttribute('data-endpoint', optionData.endpoint);
            select.appendChild(option);
        });

        // Ensure the select displays the correct selected value from storage
        select.value = localStorage.getItem(storageKey + '_selected') || 'default';
        updateSelectedOptionDisplay(select);
    }
}
function deleteSelectedOption(selectId, storageKey) {
    const select = document.getElementById(selectId);
    const selectedIndex = select.selectedIndex;

    if (selectedIndex > -1 && select.options[selectedIndex].value !== "none") {
        const uniqueValue = select.options[selectedIndex].value;
        select.remove(selectedIndex);

        // After removal, update the currently selected index
        if (select.options.length > 0) {  // Check if there are remaining options
            select.selectedIndex = Math.max(0, selectedIndex - 1); // Adjust the selected index appropriately
        }

        updateStorageAfterDeletion(select, storageKey, uniqueValue);
        updateSelectedOptionDisplay(select);
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




function storeSelectSelectedValue(selectId) {
    const select = document.getElementById(selectId);
    if (select) {
        const selectedValue = select.value;
        localStorage.setItem(selectId, selectedValue);
    }
}

function restoreSelectSelectedValue(selectId) {
    const select = document.getElementById(selectId);
    if (select) {
        const storedValue = localStorage.getItem(selectId);
        if (storedValue) {
            const optionExists = Array.from(select.options).some(option => option.value === storedValue);
            if (optionExists) {
                select.value = storedValue;
            }
        }
    }
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