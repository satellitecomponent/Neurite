function createMediaNode(type, metadataOrFile, url) {
    const elem = Html.new[type]; // audio or video
    elem.style.display = "block";
    elem.setAttribute("controls", "");
    elem.src = url;

    // Listen for metadata to adjust the size afterward
    On.loadedmetadata(elem, (e)=>{
        const maxHeight = 600;
        if (elem.videoHeight <= maxHeight) return;

        // If the natural height is larger than 600, scale it down
        const aspectRatio = elem.videoWidth / elem.videoHeight;
        elem.style.height = maxHeight + 'px';
        elem.style.width = (maxHeight * aspectRatio) + 'px';
    });

    const name = (typeof metadataOrFile === 'string' ? metadataOrFile : metadataOrFile.name || 'Untitled Media');
    const node = new Node();
    NodeView.addAtNaturalScale(node, name, [elem]);
    return node;
}
