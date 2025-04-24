//disable ctl +/- zoom on browser
On.keydown(document, (e)=>{
    if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=')) {
        e.preventDefault();
    }
});
On.wheel(document, (e)=>{
    if (e.ctrlKey) e.preventDefault();
}, {
    passive: false
});

document.body.style.transform = "scale(1)";
document.body.style.transformOrigin = "0 0";

function openTab(tabId, element) {
    var i, tabcontent, tablinks;

    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = 'none';
    }

    tablinks = document.getElementsByClassName("tablink");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("activeTab");
    }

    Elem.byId(tabId).style.display = 'block';
    element.classList.add("activeTab");

    window.currentActiveZettelkastenMirror.refresh();
}

// Get the menu button and dropdown content elements
const menuButton = document.querySelector(".menu-button");
const dropdownContent = document.querySelector(".dropdown-content");
const nodePanel = document.querySelector(".node-panel");

// Get the first tabcontent element
const firstTab = document.querySelector(".tabcontent");

On.paste(dropdownContent, (e)=>{
});
On.wheel(dropdownContent, Event.stopPropagation);
On.dblclick(dropdownContent, Event.stopPropagation);

On.click(menuButton, (e)=>{
    e.stopPropagation();

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
});

On.mousedown(dropdownContent, Event.stopPropagation);
