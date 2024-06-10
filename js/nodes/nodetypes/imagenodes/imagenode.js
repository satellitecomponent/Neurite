
function isImageUrl(url) {
    return /\.(jpg|jpeg|png|webp|avif|gif|svg)$/.test(url);
}

function createImageNode(imageElement, title) {
    let node = addNodeAtNaturalScale(title, imageElement);
    node.isImageNode = true;
    node.imageData = imageElement.src; // Store the base64Data directly from imageElement.src
    console.log(node.imageData);
    return node;
}