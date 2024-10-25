function createMediaNode(type, metadataOrFile, url) {
    // Ensure name is extracted properly
    const name = typeof metadataOrFile === 'string' ? metadataOrFile : metadataOrFile.name || 'Untitled Media';

    // Create the media element (audio or video)
    const mediaElement = document.createElement(type);
    mediaElement.style.display = "block";
    mediaElement.setAttribute("controls", "");
    mediaElement.src = url;

    // Create and append the media node
    const contentArray = [mediaElement];
    const node = addNodeAtNaturalScale(name, contentArray);

    // Listen for metadata to adjust the size afterward
    mediaElement.addEventListener('loadedmetadata', () => {
        const maxHeight = 600;
        const aspectRatio = mediaElement.videoWidth / mediaElement.videoHeight;

        // If the natural height is larger than 600, scale it down
        if (mediaElement.videoHeight > maxHeight) {
            mediaElement.style.height = `${maxHeight}px`;
            mediaElement.style.width = `${maxHeight * aspectRatio}px`;
        }
    });

    return node;
}
