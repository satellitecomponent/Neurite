

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

function addEventListenersToCustomDropdown(select, aiNode) {
    let container = select.parentNode;
    let selectReplacer = container.querySelector('.select-replacer');
    let optionsReplacer = selectReplacer.querySelector('.options-replacer');
    let selectedDiv = selectReplacer.querySelector('div');

    // Toggle dropdown on click
    let isPendingFrame = false;

    // Create individual options
    Array.from(select.options).forEach((option, index) => {
        let optionDiv = document.createElement('div');
        optionDiv.innerText = option.innerText;
        optionDiv.setAttribute('data-value', option.value);

        // Highlight the selected option
        if (select.selectedIndex === index) {
            optionDiv.classList.add('selected');
        }

        optionDiv.addEventListener('click', function (event) {
            event.stopPropagation(); // Stops the event from bubbling up

            select.value = option.value;
            selectedDiv.innerText = option.innerText;

            // Remove `selected` class from previously selected option
            const previousSelected = optionsReplacer.querySelector('.selected');
            if (previousSelected) {
                previousSelected.classList.remove('selected');
            }
            // Add `selected` class to the new selected option
            optionDiv.classList.add('selected');

            // Trigger the original dropdown's change event
            let changeEvent = new Event('change', {
                'bubbles': true,
                'cancelable': true
            });
            select.dispatchEvent(changeEvent);
        });
        optionsReplacer.appendChild(optionDiv);
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

document.addEventListener('DOMContentLoaded', function () {
    // Setup for all existing custom-selects, excluding those in the modal
    let selects = document.querySelectorAll('select.custom-select:not(#customModal select.custom-select)');
    selects.forEach(select => setupModelSelect(select, select.id === 'embeddingsModelSelect'));
});

function addOptionToCustomDropdown(select, option) {
    let container = select.parentNode;
    let optionsReplacer = container.querySelector('.options-replacer');
    let optionDiv = document.createElement('div');
    optionDiv.innerText = option.textContent;
    optionDiv.setAttribute('data-value', option.value);

    // Add click event listener to new option div
    optionDiv.addEventListener('click', function(event) {
        event.stopPropagation();
        select.value = option.value;
        let selectedDiv = container.querySelector('.select-replacer > div');
        selectedDiv.innerText = option.textContent;
        
        // Update selection visually across all options
        const previousSelected = optionsReplacer.querySelector('.selected');
        if (previousSelected) {
            previousSelected.classList.remove('selected');
        }
        optionDiv.classList.add('selected');

        // Trigger change event on the original select element
        let changeEvent = new Event('change', {
            'bubbles': true,
            'cancelable': true
        });
        select.dispatchEvent(changeEvent);
    });

    optionsReplacer.appendChild(optionDiv);
}

function addToCustomModelDropdown(select, selectData, cacheKey) {
    // Extract data from selectData object
    const { modelName, endpoint, key } = selectData;

    // Create a new option with these details
    const option = new Option(modelName, endpoint);
    option.setAttribute('data-key', key);
    select.appendChild(option);

    // Update local storage to reflect this new addition
    saveDropdownToLocalStorage(select, cacheKey);

    addOptionToCustomDropdown(select, option);
    updateSelectedOptionDisplay(select);
}

function saveDropdownToLocalStorage(select, storageKey) {
    const options = Array.from(select.options).map(option => ({
        value: option.value,
        text: option.textContent,
        key: option.getAttribute('data-key')
    }));
    localStorage.setItem(storageKey, JSON.stringify(options));

    // Save the currently selected value
    localStorage.setItem(storageKey + '_selected', select.value);
}

function loadDropdownFromLocalStorage(select, storageKey) {
    const selectContainer = select.parentNode.querySelector('.options-replacer');
    // Clear existing options first to prevent duplication
    while (selectContainer.firstChild) {
        selectContainer.removeChild(selectContainer.firstChild);
    }

    // Retrieve and load options from localStorage
    const options = JSON.parse(localStorage.getItem(storageKey));
    if (options) {
        options.forEach(optionData => {
            addOptionToCustomDropdown(select, new Option(optionData.text, optionData.value, undefined, optionData.key));
        });

        // Update selected option display after loading all options
        updateSelectedOptionDisplay(select);
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