let selectedCoordinateDiv = null;  // Global variable to keep track of the selected div

function displaySavedCoordinates() {
    const savedViews = getSavedViewsFromCache();
    const container = document.getElementById('savedCoordinatesContainer');
    container.innerHTML = '';

    savedViews.forEach((view, index) => {
        const coordElement = document.createElement('div');
        coordElement.textContent = `${view.title}`;
        coordElement.classList.add('saved-coordinate-item');

        coordElement.addEventListener('click', () => {
            neuriteReturnToSavedView(view);

            // Remove 'selected-coordinate' class from all divs
            document.querySelectorAll('.saved-coordinate-item').forEach(div => {
                div.classList.remove('selected-coordinate');
            });

            // Add 'selected-coordinate' class to the clicked div
            coordElement.classList.add('selected-coordinate');
            selectedCoordinateIndex = index;
        });

        container.appendChild(coordElement);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    displaySavedCoordinates();
});

document.getElementById('deleteCoordinatesBtn').addEventListener('click', function () {
    if (selectedCoordinateIndex !== null && savedViews[selectedCoordinateIndex]) {
        // Remove the selected view from the array
        savedViews.splice(selectedCoordinateIndex, 1);

        // Update the cache
        updateSavedViewsCache();

        // Refresh the display of saved coordinates
        displaySavedCoordinates();

        // Reset the selected coordinate index and div
        selectedCoordinateIndex = null;
        selectedCoordinateDiv = null;
    } else {
        alert('No coordinate selected for deletion.');
    }
});

document.addEventListener('click', function (event) {
    if (!event.target.closest('#savedCoordinatesContainer')) {
        if (selectedCoordinateDiv) {
            selectedCoordinateDiv.classList.remove('selected-coordinate');
            selectedCoordinateDiv = null;
            selectedCoordinateIndex = null;
        }
    }
});