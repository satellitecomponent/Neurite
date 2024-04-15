// Get the modal element
const modal = document.getElementById('customModal');
// Get the close button element
const closeBtn = modal.querySelector('.close');
// Get the modal content element
const modalContent = modal.querySelector('.modal-content');
// Store the values of the input elements
let modalInputValues = {};

// Function to store input values and perform modal-specific actions
const storeInputValue = debounce(function (input, contentId) {
    if (input.type === 'checkbox') {
        modalInputValues[input.id] = input.checked;
    } else {
        modalInputValues[input.id] = input.value;
    }
    localStorage.setItem('modalInputValues', JSON.stringify(modalInputValues));

    // Perform modal-specific actions based on contentId
    if (contentId === 'noteModal') {
        updatePathOptions();
    }
    // Add more conditions for other modals if needed
}, 100);

// Retrieve modalInputValues from local storage when the page loads
document.addEventListener('DOMContentLoaded', function () {
    const storedInputValues = localStorage.getItem('modalInputValues');
    if (storedInputValues) {
        modalInputValues = JSON.parse(storedInputValues);
    }
});

// Function to open the modal
function openModal(contentId) {
    //console.log(`Opened Modal: ${contentId}`);
    const content = document.getElementById(contentId);
    if (!content) {
        console.error(`No content found for ID: ${contentId}`);
        return; // Exit the function if content doesn't exist
    }

    const modalBody = modal.querySelector('.modal-body');
    if (modalBody) {
        modalBody.innerHTML = content.innerHTML; // Ensure modalBody exists before setting its innerHTML
    } else {
        console.error('Modal body element is missing');
        return; // Exit if there is no modal body
    }

    // Set the modal title based on the contentId
    const modalTitle = modal.querySelector('.modal-title');
    switch (contentId) {
        case 'noteModal':
            modalTitle.textContent = 'Zettelkasten Settings';
            break;
        case 'alertModal':
            modalTitle.textContent = 'Alert';
            break;
        case 'apiConfigModalContent':
            modalTitle.textContent = 'Custom Endpoint'; // Set title for the API config modal
            break;
        default:
            modalTitle.textContent = ''; // Default, clears the title
    }

    modal.style.display = 'flex';

    // Set up custom selects within the modal
    let modalSelects = modalBody.querySelectorAll('select.custom-select');
    modalSelects.forEach(select => {
        setupModelSelect(select, select.id === 'embeddingsModelSelect');
        // Restore the stored value if available
        if (modalInputValues[select.id] !== undefined) {
            select.value = modalInputValues[select.id];
        }
        // Store the value when changed
        select.addEventListener('change', function () {
            storeInputValue(select, contentId);
        });
    });

    // Set up sliders within the modal
    let modalSliders = modalBody.querySelectorAll('input[type=range]');
    modalSliders.forEach(function (slider) {
        setSliderBackground(slider);
        // Restore the stored value if available
        if (modalInputValues[slider.id] !== undefined) {
            slider.value = modalInputValues[slider.id];
            setSliderBackground(slider); // Update the background after restoring the value
        }
        // Store the value when changed
        slider.addEventListener('input', function () {
            setSliderBackground(slider);
            storeInputValue(slider, contentId);
        });
    });

    // Set up other input elements within the modal
    let modalInputs = modalBody.querySelectorAll('input:not([type=range]), textarea');
    modalInputs.forEach(function (input) {
        // Restore the stored value if available
        if (modalInputValues[input.id] !== undefined) {
            if (input.type === 'checkbox') {
                input.checked = modalInputValues[input.id];
            } else {
                input.value = modalInputValues[input.id];
            }
        }
        // Store the value when changed
        input.addEventListener('change', function () {
            storeInputValue(input, contentId);
        });
    });
}

// Function to close the modal
function closeModal() {
    //console.log('close Modal');
    modal.style.display = 'none';
}

// Event listener for the close button
closeBtn.addEventListener('click', closeModal);

// Event listener to prevent all events from passing through the modal content
modalContent.addEventListener('click', stopEventPropagation);
modalContent.addEventListener('dblclick', stopEventPropagation);
modalContent.addEventListener('mousedown', stopEventPropagation);
modalContent.addEventListener('touchstart', stopEventPropagation);
modalContent.addEventListener('touchend', stopEventPropagation);
modalContent.addEventListener('wheel', stopEventPropagation);
modalContent.addEventListener('dragstart', stopEventPropagation);
modalContent.addEventListener('drag', stopEventPropagation);
modalContent.addEventListener('drop', stopEventPropagation);

// Function to stop event propagation
function stopEventPropagation(event) {
    event.stopPropagation();
}

// Variables to store the initial position and mouse offset
let isDraggingModal = false;
let initialModalMouseX;
let initialModalMouseY;
let initialModalX;
let initialModalY;

// Event listener for mousedown on the modal content
modalContent.addEventListener('mousedown', startDragging);

// Function to start dragging the modal content
function startDragging(event) {
    if (!isInputElement(event.target)) {
        isDraggingModal = true;
        initialModalMouseX = event.clientX;
        initialModalMouseY = event.clientY;
        initialModalX = modal.offsetLeft;
        initialModalY = modal.offsetTop;
    }
}

// Function to check if an element is an input element
function isInputElement(element) {
    const inputTypes = ['input', 'select', 'textarea', 'button'];
    return inputTypes.includes(element.tagName.toLowerCase()) || element.classList.contains('custom-select');
}

// Event listener for mousemove on the document
document.addEventListener('mousemove', dragModalContent);

// Function to drag the modal content
function dragModalContent(event) {
    if (isDraggingModal) {
        event.preventDefault();
        const deltaX = event.clientX - initialModalMouseX;
        const deltaY = event.clientY - initialModalMouseY;
        modal.style.left = `${initialModalX + deltaX}px`;
        modal.style.top = `${initialModalY + deltaY}px`;
    }
}

// Event listener for mouseup on the document
document.addEventListener('mouseup', stopDragging);

// Function to stop dragging the modal content
function stopDragging() {
    isDraggingModal = false;
}