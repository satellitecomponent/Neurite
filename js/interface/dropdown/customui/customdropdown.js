const Select = {};

Select.selectOption = function(select, option){
    const optionsReplacer = select.parentNode.querySelector('.options-replacer');
    Array.from(optionsReplacer.children).forEach(
        (child)=>child.classList.remove('selected')
    );

    // Set this option as the selected one
    select.parentNode.querySelector(`[data-value="${option.value}"]`).classList.add('selected');
    select.value = option.value;
    Select.updateSelectedOption(select);

    select.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
}

function createSelectWithWrapper(name, wrapperName, nodeIndex) {
    const select = document.createElement('select');
    select.id = name + '-select-' + nodeIndex;
    select.className = 'model-selector custom-select ignoreSetup';

    const container = document.createElement('div');
    container.className = 'dropdown-container';
    container.appendChild(select);

    const wrapper = document.createElement('div');
    wrapper.className = 'dropdown-wrapper';
    wrapper.id = `wrapper-${wrapperName}-${nodeIndex}`;
    wrapper.appendChild(container);
    return wrapper;
}

const CustomDropdown = {
    model: {selectId: 'custom-model-select', storageId: 'customModelDropdown'}
};
CustomDropdown.setup = function(select, delayListeners = false){
    const selectReplacer = document.createElement('div');
    selectReplacer.className = 'select-replacer closed';

    const selectedDiv = document.createElement('div');
    selectedDiv.className = 'selected-text';

    // Safeguard against empty select or invalid selectedIndex
    if (select.options.length > 0 && select.selectedIndex >= 0 && select.selectedIndex < select.options.length) {
        selectedDiv.innerText = select.options[select.selectedIndex].innerText;
    }
    selectReplacer.appendChild(selectedDiv);

    const optionsReplacer = document.createElement('div');
    optionsReplacer.className = 'options-replacer custom-scrollbar';
    selectReplacer.appendChild(optionsReplacer);

    // Replace the original select with the custom dropdown
    const container = document.createElement('div');
    container.className = 'select-container';
    select.parentNode.insertBefore(container, select);
    container.appendChild(selectReplacer);
    container.appendChild(select);
    select.style.display = 'none'; // Hide the original select

    CustomDropdown.populateOptions(select, optionsReplacer, selectedDiv);

    if (!delayListeners) CustomDropdown.addEventListeners(select);
}

CustomDropdown.populateOptions = function(select, optionsReplacer, selectedDiv){
    const create = CustomDropdown.createOptionDiv.bind(CustomDropdown, select, optionsReplacer, selectedDiv);
    Array.from(select.options).forEach(create);
}
CustomDropdown.createOptionDiv = function(select, optionsReplacer, selectedDiv, option){
    const optionDiv = document.createElement('div');
    optionDiv.className = 'dropdown-option';
    optionDiv.setAttribute('data-value', option.value);
    optionDiv.innerText = option.innerText;

    if (option.selected) optionDiv.classList.add('selected');

    optionDiv.addEventListener('click', function (event) {
        event.stopPropagation();

        Array.from(optionsReplacer.children).forEach(
            (child)=>child.classList.remove('selected')
        );

        // Set this option as the selected one
        optionDiv.classList.add('selected');
        select.value = option.value;
        selectedDiv.innerText = option.innerText;

        // Dispatch a change event to the original select element
        select.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    });

    optionsReplacer.appendChild(optionDiv);
}

CustomDropdown.addOption = function(select, text, value, key){
    const option = new Option(text, value);
    option.setAttribute('data-key', key);
    select.appendChild(option);

    const optionsReplacer = select.parentNode.querySelector('.options-replacer');
    if (optionsReplacer) {
        const selectedDiv = select.parentNode.querySelector('.select-replacer > div');
        CustomDropdown.createOptionDiv(select, optionsReplacer, selectedDiv, option);
    }
}

CustomDropdown.addEventListeners = function(select){
    const container = select.parentNode;
    const selectReplacer = container.querySelector('.select-replacer');
    const optionsReplacer = selectReplacer.querySelector('.options-replacer');
    const selectedDiv = selectReplacer.querySelector('.selected-text');

    // Clear existing options to avoid duplicates
    optionsReplacer.innerHTML = '';

    CustomDropdown.populateOptions(select, optionsReplacer, selectedDiv);

    let isPendingFrame = false;
    selectReplacer.addEventListener('click', function (e) {
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
    document.addEventListener('mousedown', function (event) {
        if (!container.contains(event.target)) {
            container.setAttribute('data-outside-click', 'true');
        }
    });

    document.addEventListener('mouseup', function (event) {
        if (container.getAttribute('data-outside-click') === 'true' && !container.contains(event.target)) {
            optionsReplacer.classList.remove('show');
            selectReplacer.classList.add('closed');
            container.style.zIndex = "20"; // Reset the z-index of the parent container
        }
        container.removeAttribute('data-outside-click');
    });
}

CustomDropdown.setupModelSelect = function(selectElement){
    CustomDropdown.setup(selectElement);

    const storedValue = localStorage.getItem(selectElement.id);
    if (storedValue) {
        selectElement.value = storedValue;
        Select.updateSelectedOption(selectElement);
    }

    selectElement.addEventListener('change', function onChange(){
        localStorage.setItem(this.id, this.value);
        Select.updateSelectedOption(this);
    });
}

CustomDropdown.initializeCustomSelects = function(){
    const selects = document.querySelectorAll('select.custom-select:not(.ignoreSetup)');
    selects.forEach(CustomDropdown.setupModelSelect);
}

Select.updateSelectedOption = function(selectElement){
    Select.updateSelectedOptionDisplay(selectElement);
    Select.updateSelectedOptionHighlighting(selectElement);
}
Select.updateSelectedOptionDisplay = function(selectElement){ // to show the selected value
    const selectedDiv = selectElement.parentNode.querySelector('.select-replacer > div');
    if (!selectedDiv) return;

    const selectedOption = selectElement.options[selectElement.selectedIndex];
    if (selectedOption) selectedDiv.innerText = selectedOption.innerText;
}
Select.updateSelectedOptionHighlighting = function(selectElement){
    const optionsReplacer = selectElement.parentNode.querySelector('.options-replacer');
    if (!optionsReplacer) return;

    optionsReplacer.querySelectorAll('div').forEach(div => {
        if (div.getAttribute('data-value') === selectElement.value) {
            div.classList.add('selected');
        } else {
            div.classList.remove('selected');
        }
    });
}

CustomDropdown.initializeCustomSelects();

CustomDropdown.refreshDisplay = function(select){
    const optionsReplacer = select.parentNode.querySelector('.options-replacer');
    // Clear existing custom dropdown options
    while (optionsReplacer.firstChild) {
        optionsReplacer.removeChild(optionsReplacer.firstChild);
    }

    const selectedDiv = select.parentNode.querySelector('.select-replacer > div');
    CustomDropdown.populateOptions(select, optionsReplacer, selectedDiv);
}

CustomDropdown.restoreState = function(dropdown){
    const customDropdown = dropdown.parentNode.querySelector('.select-replacer');
    if (!customDropdown) return;

    const selectedText = customDropdown.querySelector('.selected-text').textContent.trim();
    const options = dropdown.options;
    for (let i = 0; i < options.length; i++) {
        if (options[i].textContent.trim() !== selectedText) continue;

        dropdown.selectedIndex = i;
        // Optionally, trigger a change event if needed
        dropdown.dispatchEvent(new Event('change'));
        break;
    }
}

CustomDropdown.addModel = function(dropdown, selectData){
    const select = Elem.byId(dropdown.selectId);
    if (select.options[0].value === 'none') select.remove(0);

    const uniqueId = Date.now().toString(); // Simple unique ID generation
    const option = new Option(selectData.modelName, uniqueId);
    option.setAttribute('data-endpoint', selectData.endpoint);
    option.setAttribute('data-key', selectData.key);
    select.appendChild(option);

    CustomDropdown.updateLocalStorage(select, dropdown.storageId);
    Select.updateSelectedOption(select);
    CustomDropdown.refreshDisplay(select);
}
CustomDropdown.updateLocalStorage = function(select, storageId){
    const options = Array.from(select.options)
        .filter(option => option.value !== 'default')
        .map(CustomDropdown.plainOption);
    localStorage.setItem(storageId, JSON.stringify(options));
    localStorage.setItem(storageId + '_selected', select.value);
}
CustomDropdown.plainOption = function(option){
    return {
        value: option.value,
        text: option.textContent,
        key: option.getAttribute('data-key'),
        endpoint: option.getAttribute('data-endpoint')
    }
}

CustomDropdown.loadFromLocalStorage = function(select, storageId){
    const storedOptions = JSON.parse(localStorage.getItem(storageId));
    if (!storedOptions) return;

    // Remove existing non-default options
    Array.from(select.options).forEach(option => {
        if (option.value !== 'default') select.removeChild(option);
    });

    storedOptions.forEach(optionData => {
        const option = new Option(optionData.text, optionData.value);
        option.setAttribute('data-key', optionData.key);
        option.setAttribute('data-endpoint', optionData.endpoint);
        select.appendChild(option);
    });

    // Ensure the select displays the correct selected value from storage
    select.value = localStorage.getItem(storageId + '_selected') || 'default';
    Select.updateSelectedOption(select);
}

CustomDropdown.deleteSelectedOption = function(dropdown){
    const select = Elem.byId(dropdown.selectId);
    const selectedIndex = select.selectedIndex;
    if (selectedIndex < 0 || select.options[selectedIndex].value === 'none') return;

    select.remove(selectedIndex);

    if (select.options.length > 0) {
        select.selectedIndex = Math.max(0, selectedIndex - 1);
    } else {
        const noneOption = new Option('none', 'none');
        select.appendChild(noneOption);
        select.selectedIndex = 0;
    }

    CustomDropdown.updateLocalStorage(select, dropdown.storageId);
    Select.updateSelectedOption(select);
    CustomDropdown.refreshDisplay(select);
}



Select.storeSelectedValue = function(selectId){
    const select = Elem.byId(selectId);
    if (select) localStorage.setItem(selectId, select.value);
}
Select.restoreSelectedValue = function(select){
    const storedValue = localStorage.getItem(select.id);
    if (!storedValue) return;

    const optionExists = Array.from(select.options).some(option => option.value === storedValue);
    if (optionExists) select.value = storedValue;
}



function updateOptionTitle(selectElement, optionValue, newTitle) {
    const option = Array.from(selectElement.options).find(opt => opt.value === optionValue);
    if (!option) return;

    option.innerText = newTitle;
    const optionDiv = selectElement.parentNode.querySelector(`.dropdown-option[data-value="${optionValue}"] .option-input`);
    if (optionDiv) optionDiv.innerText = newTitle;
    if (option.selected) Select.updateSelectedOption(selectElement);
}

CustomDropdown.addHtmlOption = function(select, optionData, createOptionContent){
    const option = new Option(optionData.text, optionData.value);
    option.setAttribute('data-key', optionData.key);
    select.appendChild(option);

    const optionsReplacer = select.parentNode.querySelector('.options-replacer');
    if (optionsReplacer) {
        const selectedDiv = select.parentNode.querySelector('.select-replacer > div');
        CustomDropdown.createHtmlOptionDiv(select, optionsReplacer, selectedDiv, createOptionContent, option);
    }
}

CustomDropdown.setupHtmlOptions = function(select, createOptionContent, delayListeners = false){
    // Create the main custom dropdown container
    const selectReplacer = document.createElement('div');
    selectReplacer.className = 'select-replacer closed'; // add 'closed' class by default

    // Create the currently selected value container
    const selectedDiv = document.createElement('div');
    selectedDiv.className = 'selected-text';

    // Safeguard against empty select or invalid selectedIndex
    if (select.options.length > 0 && select.selectedIndex >= 0 && select.selectedIndex < select.options.length) {
        selectedDiv.innerText = select.options[select.selectedIndex].innerText;
    }
    selectReplacer.appendChild(selectedDiv);

    // Create the dropdown options container
    const optionsReplacer = document.createElement('div');
    optionsReplacer.className = 'options-replacer custom-scrollbar';

    // Append the options container to the main dropdown container
    selectReplacer.appendChild(optionsReplacer);

    // Replace the original select with the custom dropdown
    const container = document.createElement('div');
    container.className = 'select-container';
    select.parentNode.insertBefore(container, select);
    container.appendChild(selectReplacer);
    container.appendChild(select);
    select.style.display = 'none'; // Hide the original select

    CustomDropdown.populateHtmlOptions(select, optionsReplacer, selectedDiv, createOptionContent);

    if (!delayListeners) CustomDropdown.addEventListeners(select);
}

CustomDropdown.populateHtmlOptions = function(select, optionsReplacer, selectedDiv, createOptionContent){
    const create = CustomDropdown.createHtmlOptionDiv.bind(CustomDropdown, select, optionsReplacer, selectedDiv, createOptionContent);
    Array.from(select.options).forEach(create);
}
CustomDropdown.createHtmlOptionDiv = function(select, optionsReplacer, selectedDiv, createOptionContent, option){
    const optionDiv = document.createElement('div');
    optionDiv.className = 'dropdown-option';
    optionDiv.setAttribute('data-value', option.value);

    const optionContent = createOptionContent(option);
    optionDiv.appendChild(optionContent);

    if (option.selected) optionDiv.classList.add('selected');

    optionDiv.addEventListener('click', function (event) {
        event.stopPropagation();
        Select.selectOption(select, option);
    });

    optionsReplacer.appendChild(optionDiv);
}

function createZetContainerDropdown(option) {
    const inputDiv = document.createElement('div');
    inputDiv.className = 'option-input';
    inputDiv.contentEditable = true;
    inputDiv.innerText = option.text;

    const optionContent = document.createElement('div');
    optionContent.className = 'option-content';
    optionContent.appendChild(inputDiv);

    // Event handler for input changes in the option
    inputDiv.addEventListener('input', function () {
        option.text = inputDiv.innerText;

        const paneId = option.value;
        const pane = document.querySelector('#' + paneId);
        if (pane) pane.setAttribute('data-pane-name', option.text);

        if (option.selected) Select.updateSelectedOption(option.parentNode);
    });

    inputDiv.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') event.preventDefault(); // prevent adding new lines
    });

    inputDiv.addEventListener('paste', function (event) {
        event.preventDefault();
        event.stopPropagation();
    });

    inputDiv.addEventListener('focus', function () {
        Select.selectOption(option.parentNode, option);
    });

    return optionContent;
}

function refreshHtmlDropdownDisplay(select, createOptionContent) {
    const optionsReplacer = select.parentNode.querySelector('.options-replacer');
    const selectedDiv = select.parentNode.querySelector('.select-replacer > div');

    // Clear existing custom dropdown options
    while (optionsReplacer.firstChild) {
        optionsReplacer.removeChild(optionsReplacer.firstChild);
    }

    CustomDropdown.populateHtmlOptions(select, optionsReplacer, selectedDiv, createOptionContent);

    Select.updateSelectedOption(select);
}
