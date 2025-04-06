function isImageUrl(url) {
    return /\.(jpg|jpeg|png|webp|avif|gif|svg)$/.test(url);
}

Elem.resizeToFitHeight = function(elem, height){
    const aspectRatio = elem.naturalWidth / elem.naturalHeight;
    elem.style.width = (height * aspectRatio) + 'px';
    elem.style.height = height + 'px';
}

NodeView.addForImage = function(elemImage, title){
    Elem.resizeToFitHeight(elemImage, 600);

    const node = new Node();
    NodeView.addAtNaturalScale(node, title, elemImage);

    node.push_extra_cb( (node)=>({
        f: "textarea",
        a: {
            p: [0, 0, 1],
            v: node.view.titleInput.value
        }
    }) );
    if (elemImage.src.startsWith('blob:')) node.blob = title;

    node.isImageNode = true;
    node.imageData = elemImage.src; // Store the base64Data directly from elemImage.src
    Logger.debug(node.imageData);
    return node;
}
