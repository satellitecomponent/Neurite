let selectedCoordinateDiv = null;  // Global variable to keep track of the selected div
let selectedCoordinateIndex = null; // Global variable to keep track of the selected index

function distributeCoordinates(savedViews) {
    const mainCount = Math.round(savedViews.length * 0.50); // 50% for main
    const topCount = Math.round(savedViews.length * 0.32); // 32% for top
    // For the bottom, we use the remaining views
    const bottomCount = savedViews.length - mainCount - topCount; // 15% for bottom

    return {
        mainViews: savedViews.slice(0, mainCount),
        topViews: savedViews.slice(mainCount, mainCount + topCount),
        bottomViews: savedViews.slice(mainCount + topCount)
    };
}

function appendViewsToContainer(views, containerId, startIndex) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    views.forEach((view, index) => {
        const globalIndex = startIndex + index;
        const coordElement = document.createElement('div');
        coordElement.textContent = `${view.title}`;
        coordElement.classList.add('saved-coordinate-item');

        coordElement.addEventListener('click', () => {
            neuriteReturnToSavedView(view);

            // Update selected state
            document.querySelectorAll('.saved-coordinate-item').forEach(div => {
                div.classList.remove('selected-coordinate');
                div.style.transform = ''; // Reset transform
            });

            coordElement.classList.add('selected-coordinate');
            coordElement.style.transform = 'scale(0.95)'; // Scale down for selected
            selectedCoordinateIndex = globalIndex;
            selectedCoordinateDiv = coordElement;
        });

        // Reset the scale when mouse leaves the selected item
        coordElement.addEventListener('mouseleave', () => {
            if (coordElement.classList.contains('selected-coordinate')) {
                coordElement.style.transform = 'scale(1)';
            }
        });

        container.appendChild(coordElement);
    });
}

function displaySavedCoordinates() {
    const savedViews = getSavedViewsFromCache();
    const { mainViews, topViews, bottomViews } = distributeCoordinates(savedViews);

    appendViewsToContainer(mainViews, 'savedCoordinatesContainer', 0);
    appendViewsToContainer(topViews, 'savedCoordinatesContainerTop', mainViews.length);
    appendViewsToContainer(bottomViews, 'savedCoordinatesContainerBottom', mainViews.length + topViews.length);
}

document.addEventListener('DOMContentLoaded', () => {
    // Update the cache
    updateSavedViewsCache();

    displaySavedCoordinates();
});

function deselectCoordinate() {
    // If there's no selected coordinate, exit the function immediately
    if (!selectedCoordinateDiv) {
        return;
    }

    selectedCoordinateDiv.classList.remove('selected-coordinate');
    selectedCoordinateDiv = null;
    selectedCoordinateIndex = null;
}