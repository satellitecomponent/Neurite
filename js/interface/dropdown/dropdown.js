const aiTab = new AiTab();
const dataTab = new DataTab();
const editTab = new EditTab(settings);

// Function to save the value of a specific slider or color picker
function saveInputValue(input) {
    const savedValues = localStorage.getItem('inputValues');
    const inputValues = savedValues ? JSON.parse(savedValues) : {};

    inputValues[input.id] = input.value;
    localStorage.setItem('inputValues', JSON.stringify(inputValues));
}

const debouncedSaveInputValue = debounce(function (input) {
    saveInputValue(input);
    //console.log(`saved`);
}, 300);

document.querySelectorAll('#tab2 input[type="range"], .color-picker-container input[type="color"]').forEach(function (input) {
    input.addEventListener('input', function () {
        debouncedSaveInputValue(input);
    });
});

function restoreInputValues() {
    const savedValues = localStorage.getItem('inputValues');
    if (savedValues) {
        const inputValues = JSON.parse(savedValues);
        document.querySelectorAll('#tab2 input[type="range"], .color-picker-container input[type="color"]').forEach(input => {
            if (input.id in inputValues) {
                input.value = inputValues[input.id];
                // Trigger the input event for both sliders and color pickers
                setTimeout(() => {
                    input.dispatchEvent(new Event('input'));
                }, 100);
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', restoreInputValues);

        //disable ctl +/- zoom on browser
        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey && (event.key === '+' || event.key === '-' || event.key === '=')) {
                event.preventDefault();
            }
        });

        document.addEventListener('wheel', (event) => {
            if (event.ctrlKey) {
                event.preventDefault();
            }
        }, {
            passive: false
        });

        document.body.style.transform = "scale(1)";
        document.body.style.transformOrigin = "0 0";


function openTab(tabId, element) {
    var i, tabcontent, tablinks;

    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    tablinks = document.getElementsByClassName("tablink");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("activeTab"); // We use classList.remove to remove the class
    }

    document.getElementById(tabId).style.display = "block";
    element.classList.add("activeTab"); // We use classList.add to add the class

    myCodeMirror.refresh();
}
        // Get the menu button and dropdown content elements
        const menuButton = document.querySelector(".menu-button");
        const dropdownContent = document.querySelector(".dropdown-content");
        const nodePanel = document.querySelector(".node-panel");


        // Get the first tabcontent element
        const firstTab = document.querySelector(".tabcontent");

        dropdownContent.addEventListener("paste", function (e) {
        });
        dropdownContent.addEventListener("wheel", function (e) {
            cancel(e);
        });
        dropdownContent.addEventListener("dblclick", function (e) {
            cancel(e);
        });

        // Add an event listener to the menu button
        menuButton.addEventListener("click", function (event) {
            // Prevent the click event from propagating
            event.stopPropagation();

            // Toggle the "open" class on the menu button and dropdown content
            menuButton.classList.toggle("open");
            dropdownContent.classList.toggle("open");
            nodePanel.classList.toggle("open");

            // If the dropdown is opened, manually set the first tab to active and display its content
            if (dropdownContent.classList.contains("open")) {
                var tablinks = document.getElementsByClassName("tablink");
                var tabcontent = document.getElementsByClassName("tabcontent");

                // Remove active class from all tablinks and hide all tabcontent
                for (var i = 0; i < tablinks.length; i++) {
                    tablinks[i].classList.remove("active");
                    tabcontent[i].style.display = "none";
                }

                // Open the first tab
                openTab('tab1', tablinks[0]);

                // If there's any selected text, deselect it
                if (window.getSelection) {
                    window.getSelection().removeAllRanges();
                } else if (document.selection) {
                    document.selection.empty();
                }
            }
            myCodeMirror.refresh();
        });


        dropdownContent.addEventListener("mousedown", (e) => {
            cancel(e);
        });

// Get all the menu items.
const menuItems = document.querySelectorAll(".menu-item");

// Add a click event listener to each menu item
menuItems.forEach(function (item) {
    item.addEventListener("click", function () {
        // Remove the "selected" class from all the menu items
        // menuItems.forEach(function(item) {
        //   item.classList.remove("selected");
        // });

        // Add the "selected" class to the clicked menu item
        item.classList.add("selected");
    });
});

function updateLoadingIcon(percentage) {
    const loaderFills = document.querySelectorAll('.loader-fill');

    loaderFills.forEach(loaderFill => {
        // Set a timeout to remove the initial animation class after 8 seconds
        setTimeout(() => {
            loaderFill.classList.remove('initial-animation');
        }, 8000); // 8000 milliseconds = 8 seconds

        // Scale from 0 to 1 based on the percentage
        const scale = percentage / 100;
        loaderFill.style.transform = `translate(-50%, -50%) scale(${scale})`;
    });
}