// Suggestions component
class SuggestionsComponent {
    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'suggestions-container'; // Set the ID for the container
        this.container.classList.add('suggestions-container');
        document.body.appendChild(this.container); // Append to the body

        // Prevent click and scroll events from propagating
        ['wheel'].forEach(eventType => {
            this.container.addEventListener(eventType, event => event.stopPropagation(), true);
        });
    }

    position(x, y) {
        // Use CSS transforms for positioning to keep the bottom-right corner aligned.
        this.container.style.transform = `translate(calc(${x}px - 100%  + 5px), calc(${y}px - 100% + 6px))`;
        this.container.style.display = 'block';
    }

    clear() {
        this.container.innerHTML = '';
    }

    addSuggestion(text, inputField, onSelect, onPin, isPinned) {
        const suggestionItem = document.createElement('div');
        suggestionItem.classList.add('suggestion-item');

        const suggestionText = document.createElement('span');
        suggestionText.textContent = text;
        suggestionItem.appendChild(suggestionText);

        const pinButton = document.createElement('button');
        pinButton.classList.add('pin-button');
        if (isPinned) {
            pinButton.classList.add('pinned');
        }

        const svgPlus = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgPlus.setAttribute('class', 'icon icon-plus');
        svgPlus.setAttribute('viewBox', '0 0 24 24');
        svgPlus.setAttribute('width', '1em');
        svgPlus.setAttribute('height', '1em');
        const usePlus = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        usePlus.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#icon-plus');
        svgPlus.appendChild(usePlus);

        const svgMinus = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgMinus.setAttribute('class', 'icon icon-minus');
        svgMinus.setAttribute('viewBox', '0 0 24 24');
        svgMinus.setAttribute('width', '1em');
        svgMinus.setAttribute('height', '1em');
        const useMinus = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        useMinus.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#icon-minus');
        svgMinus.appendChild(useMinus);

        // Show or hide the appropriate SVG based on the pin state
        svgPlus.style.display = isPinned ? 'none' : 'inline';
        svgMinus.style.display = isPinned ? 'inline' : 'none';

        pinButton.appendChild(svgPlus);
        pinButton.appendChild(svgMinus);

        const togglePin = (event) => {
            event.preventDefault();
            event.stopPropagation();

            isPinned = !isPinned;
            pinButton.classList.toggle('pinned', isPinned);
            svgPlus.style.display = isPinned ? 'none' : 'inline';
            svgMinus.style.display = isPinned ? 'inline' : 'none';

            onPin(text, isPinned);
            onSelect(); // Call onSelect as well
        };

        suggestionText.addEventListener('click', togglePin);
        pinButton.addEventListener('click', togglePin);

        suggestionItem.appendChild(pinButton);
        this.container.appendChild(suggestionItem);
    }


    scrollToBottom() {
        // Scroll the container to its maximum scrollable height
        this.container.scrollTop = this.container.scrollHeight;
    }

    hide() {
        this.container.style.display = 'none';
    }
}

// Create a global instance of the suggestions component
let globalSuggestions = new SuggestionsComponent();

class RecentSuggestionsManager {
    constructor(storageKey) {
        this.storageKey = storageKey;
        this.recentCalls = this.loadFromLocalStorage();
    }

    loadFromLocalStorage() {
        const storedCalls = localStorage.getItem(this.storageKey);
        return storedCalls ? JSON.parse(storedCalls) : [];
    }

    saveToLocalStorage() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.recentCalls));
    }

    addSuggestion(suggestion) {
        // Remove the suggestion if it already exists to prevent duplicates
        this.recentCalls = this.recentCalls.filter(call => call !== suggestion);

        // Add the suggestion to the top of the list
        this.recentCalls.unshift(suggestion);

        // Keep only the 6 most recent suggestions
        this.recentCalls = this.recentCalls.slice(0, 6);

        // Save the updated list to local storage
        this.saveToLocalStorage();
    }

    getRecentSuggestions() {
        // Return a reversed copy of the recent calls array
        return [...this.recentCalls].reverse();
    }
}

const nodeMethodManager = new RecentSuggestionsManager('nodeMethodCalls');

class PinnedItemsManager {
    constructor(storageKey) {
        this.storageKey = storageKey;
        this.pinnedItems = this.loadFromLocalStorage();
    }

    loadFromLocalStorage() {
        const storedItems = localStorage.getItem(this.storageKey);
        return storedItems ? JSON.parse(storedItems) : [];
    }

    saveToLocalStorage() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.pinnedItems));
    }

    addPinnedItem(item) {
        if (!this.pinnedItems.includes(item)) {
            this.pinnedItems.push(item);
            this.saveToLocalStorage();
        }
    }

    getPinnedItems() {
        return this.pinnedItems;
    }

    removePinnedItem(item) {
        this.pinnedItems = this.pinnedItems.filter(pinnedItem => pinnedItem !== item);
        this.saveToLocalStorage();
    }

    isItemPinned(item) {
        return this.pinnedItems.includes(item);
    }
}

const pinnedItemsManager = new PinnedItemsManager('pinnedContextMenuItems');

function pinSuggestionToContextMenu(uniqueIdentifier, menu, node, isAlreadyPinned = false) {
    const { displayText, executeAction } = getDynamicActionDetails(uniqueIdentifier, node);
    let menuItem = Array.from(menu.children).find(item => item.dataset.identifier === uniqueIdentifier);

    if (!menuItem) {
        menuItem = createMenuItem(displayText, uniqueIdentifier, executeAction);
        menuItem.onclick = () => {
            globalSuggestions.hide();
            addToRecentSuggestions(uniqueIdentifier); // Update recent calls without executing again
        };
        // Insert new menu item at the end, but before the input field if it exists.
        const inputFieldLi = menu.querySelector('.input-item');
        if (inputFieldLi) {
            menu.appendChild(menuItem, inputFieldLi);
        } else {
            menu.appendChild(menuItem);
        }
        if (!isAlreadyPinned) {
            pinnedItemsManager.addPinnedItem(uniqueIdentifier);
        }
    } else {
        menuItem.textContent = displayText;
        menuItem.dataset.identifier = uniqueIdentifier;
        menuItem.onclick = () => {
            executeAction;
            addToRecentSuggestions(uniqueIdentifier); // Update recent calls without executing again
        };
    }
}

function getDynamicActionDetails(uniqueIdentifier, node) {
    const nodeActions = getNodeActions(node);
        return {
            displayText: uniqueIdentifier,
            executeAction: () => nodeActions[uniqueIdentifier] ? nodeActions[uniqueIdentifier]() : console.error('Invalid action')
        };
}

function loadPinnedItemsToContextMenu(menu, node) {
    const pinnedItems = pinnedItemsManager.getPinnedItems();

    pinnedItems.forEach(uniqueIdentifier => {
        const currentDetails = getDynamicActionDetails(uniqueIdentifier, node); // Fetch current details
        pinSuggestionToContextMenu(uniqueIdentifier, menu, node, true, currentDetails.displayText); // Pass current display text
    });
}

function setupSuggestionsForInput(menu, inputField, node, fetchSuggestions, pageX, pageY) {
    inputField.addEventListener('input', function (e) {
        const value = e.target.value;
        displaySuggestions(value);
    });

    inputField.addEventListener('focus', function () {
        if (inputField.value === '') {
            displaySuggestions('');
        }
    });

    inputField.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            globalSuggestions.hide();
            const nodeActions = getNodeActions(node);
            executeNodeMethod(nodeActions, e.target.value);
            e.target.value = '';
            globalSuggestions.hide();
        }
    });

    function displaySuggestions(value) {
        globalSuggestions.clear();
        globalSuggestions.position(pageX, pageY);

        const nodeActions = getNodeActions(node);
        const suggestions = fetchSuggestions(value, node);
        suggestions.forEach(suggestion => {
            const isPinned = pinnedItemsManager.isItemPinned(suggestion);
            const { displayText } = getDynamicActionDetails(suggestion, node);

            globalSuggestions.addSuggestion(
                displayText,
                inputField,
                () => { return; },
                (executeAction, pinState) => {
                    if (pinState) {
                        // Pinning the item
                        pinSuggestionToContextMenu(executeAction, menu, node);
                    } else {
                        // Unpinning the item
                        unpinSuggestionFromContextMenu(executeAction, menu);
                    }
                },
                isPinned
            );
        });

        globalSuggestions.scrollToBottom();
    }
}

function unpinSuggestionFromContextMenu(uniqueIdentifier, menu) {
    // Remove the menu item for the suggestion
    Array.from(menu.children).forEach(item => {
        if (item.dataset.identifier === uniqueIdentifier) {
            menu.removeChild(item);
        }
    });
    pinnedItemsManager.removePinnedItem(uniqueIdentifier);
}