
document.getElementById("clearLocalStorage").onclick = function () {
    localStorage.clear();
    alert('Local storage has been cleared.');
}

document.querySelectorAll('input[type=range]').forEach(function (slider) {
    function setSliderBackground(slider) {
        const min = slider.min ? parseFloat(slider.min) : 0;
        const max = slider.max ? parseFloat(slider.max) : 100;
        const value = slider.value ? parseFloat(slider.value) : 0;
        const percentage = (value - min) / (max - min) * 100;
        slider.style.background = `linear-gradient(to right, #006BB6 0%, #006BB6 ${percentage}%, #222226 ${percentage}%, #222226 100%)`;
    }

    // Set the background color split initially
    setSliderBackground(slider);

    // Update background color split when the slider value changes
    slider.addEventListener('input', function () {
        setSliderBackground(slider);
    });
});


document.getElementById('model-temperature').addEventListener('input', updateLabel);

function updateLabel() {
    const temperature = document.getElementById('model-temperature').value;
    document.getElementById('model-temperature-label').innerText = 'Model Temperature: ' + temperature;
}
        // Load any saved keys from local storage
        document.getElementById('googleApiKey').value = localStorage.getItem('googleApiKey') || '';
        document.getElementById('googleSearchEngineId').value = localStorage.getItem('googleSearchEngineId') || '';
        document.getElementById('api-key-input').value = localStorage.getItem('openaiApiKey') || '';
        document.getElementById('wolframApiKey').value = localStorage.getItem('wolframApiKey') || '';

        function saveKeys() {
            // Save keys to local storage
            localStorage.setItem('googleApiKey', document.getElementById('googleApiKey').value);
            localStorage.setItem('googleSearchEngineId', document.getElementById('googleSearchEngineId').value);
            localStorage.setItem('openaiApiKey', document.getElementById('api-key-input').value);
            localStorage.setItem('wolframApiKey', document.getElementById('wolframApiKey').value);
        }

        function clearKeys() {
            // Clear keys from local storage
            localStorage.removeItem('googleApiKey');
            localStorage.removeItem('googleSearchEngineId');
            localStorage.removeItem('openaiApiKey');
            localStorage.removeItem('wolframApiKey');

            // Clear input fields
            document.getElementById('googleApiKey').value = '';
            document.getElementById('googleSearchEngineId').value = '';
            document.getElementById('api-key-input').value = '';
            document.getElementById('wolframApiKey').value = '';
        }

        function handleKeyDown(event) {
            if (event.key === 'Enter') {
                if (event.shiftKey) {
                    // Shift + Enter was pressed, submit the form
                    event.preventDefault();
                    sendMessage(event);
                } else {
                    // Enter was pressed without Shift, insert a newline
                    event.preventDefault();
                    // insert a newline at the cursor
                    const cursorPosition = event.target.selectionStart;
                    event.target.value = event.target.value.substring(0, cursorPosition) + "\n" + event.target.value.substring(cursorPosition);
                    // position the cursor after the newline
                    event.target.selectionStart = cursorPosition + 1;
                    event.target.selectionEnd = cursorPosition + 1;
                    // force the textarea to resize
                    autoGrow(event);
                }
            }
            return true;
        }

        function autoGrow(event) {
            const textarea = event.target;
            // Temporarily make the height 'auto' so the scrollHeight is not affected by the current height
            textarea.style.height = 'auto';
            let maxHeight = 200;
            if (textarea.scrollHeight < maxHeight) {
                textarea.style.height = textarea.scrollHeight + 'px';
                textarea.style.overflowY = 'hidden';
            } else {
                textarea.style.height = maxHeight + 'px';
                textarea.style.overflowY = 'auto';
            }
        }



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
                tablinks[i].className = tablinks[i].className.replace(" active", "");
            }

            document.getElementById(tabId).style.display = "block";
            element.className += " active";
        }

        // Get the menu button and dropdown content elements
        const menuButton = document.querySelector(".menu-button");
        const dropdownContent = document.querySelector(".dropdown-content");

        // Get the first tabcontent element
        const firstTab = document.querySelector(".tabcontent");

        dropdownContent.addEventListener("paste", function (e) {
            cancel(e);
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
        });


        dropdownContent.addEventListener("mousedown", (e) => {
            cancel(e);
        });




    document.getElementById("save-button").addEventListener("click", function () {
     nodes.map((n) => n.updateEdgeData());
            let s = document.getElementById("nodes").innerHTML;
            //navigator.clipboard.writeText(s);
            //console.log("save",s);
            document.getElementById("save-or-load").value = s;
        });
        document.getElementById("load-button").addEventListener("click", function () {
            loadnet(document.getElementById("save-or-load").value, true);
        });
        // Get all the menu items
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
        document.getElementById("clear-button").addEventListener("click", function () {
            document.getElementById("clear-sure").setAttribute("style", "display:block");
            document.getElementById("clear-button").text = "Are you sure?";
        });
        document.getElementById("clear-unsure-button").addEventListener("click", function () {
            document.getElementById("clear-sure").setAttribute("style", "display:none");
            document.getElementById("clear-button").text = "clear";
        });
        document.getElementById("clear-sure-button").addEventListener("click", function () {
            clearnet();
            document.getElementById("clear-sure").setAttribute("style", "display:none");
            document.getElementById("clear-button").text = "clear";
        });

        function getQuality() {
            let v = document.getElementById("quality").value / 100;
            return 2 ** (v * 4);
        }
        document.getElementById("quality").addEventListener("input", (e) => {
            let v = getQuality();
            setRenderQuality(v);
            document.getElementById("quality_value").textContent = "Quality:" + (Math.round(v * 100) / 100);
        });

        function getLength() {
            let v = document.getElementById("length").value / 100;
            return 2 ** (v * 8);
        }
        document.getElementById("length").addEventListener("input", (e) => {
            let v = getLength();
            setRenderLength(v);
            document.getElementById("length_value").textContent = "Length:" + (Math.round(v * 100) / 100);
        });
        document.getElementById("exponent").addEventListener("input", (e) => {
            let v = e.target.value * 1;
            mand_step = (z, c) => {
                return z.ipow(v).cadd(c);
            }
            document.getElementById("exponent_value").textContent = v;
        })
        const submenuBtn = document.querySelector('.submenu-btn');

document.getElementById('node-count-slider').addEventListener('input', function () {
    document.getElementById('node-slider-label').innerText = 'Top ' + this.value + ' nodes';
});