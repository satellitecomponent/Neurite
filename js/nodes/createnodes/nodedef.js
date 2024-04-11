/* Node Flag Types

    if (node.isTextNode) {
        initTextNode(node)
    }

    if (node.isLLM) {
        initAiNode(node);
        restoreNewLinesInPreElements(node.aiResponseDiv);
    }

    if (node.isLink) {
        initLinkNode(node);
    }

    if (isEditorNode(node)) {
        initEditorNode(node)
    }
}

*/

function createImageNode(imageSrc, title, isUrl = false) {
    let node;

    // If isUrl is true, we assume imageSrc is a direct URL to an image.
    if (isUrl) {
        node = addNodeAtNaturalScale(title, imageSrc); // Assuming this function takes a URL or base64 data
        node.isImageNode = true;
        node.imageUrl = imageSrc;
        console.log("URL Found", node.imageUrl);
    } else {
        // If isUrl is false, we assume imageSrc is an HTMLImageElement that needs conversion
        if (!(imageSrc instanceof HTMLImageElement) || !imageSrc.src) {
            console.error('createImageNode was called without a valid image element or src');
            return null;
        }

        node = addNodeAtNaturalScale(title, imageSrc); // Assuming this function takes a URL or base64 data
        node.isImageNode = true;
        node.imageData = null; // Placeholder for base64 data

        // Determine whether the source is a blob URL or a Data URL (base64)
        if (imageSrc.src.startsWith('blob:')) {
            // Convert blob URL to base64 because the OpenAI API cannot access blob URLs
            convertImageToBase64(imageSrc.src, base64String => {
                node.imageData = base64String;
                console.log("Image converted to base64", base64String);
            });
        } else {
            // If it's not a blob, we can use the src directly (data URL or external URL)
            node.imageUrl = imageSrc.src;
            console.log("Image URL or Data URL found", imageSrc.src);
        }
    }

    return node;
}