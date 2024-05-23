
function createLinkNode(name = '', text = '', link = '', sx = undefined, sy = undefined, x = undefined, y = undefined) {
    let a = document.createElement("a");
    a.id = 'link-element';
    a.setAttribute("href", link);
    a.setAttribute("target", "_blank");
    a.textContent = name;
    a.style.cssText = "display: block; padding: 10px; word-wrap: break-word; white-space: pre-wrap; color: #bbb; transition: color 0.2s ease, background-color 0.2s ease; background-color: #222226; border-radius: 5px";

    let linkWrapper = document.createElement("div");
    linkWrapper.id = 'link-wrapper';
    linkWrapper.style.width = "300px";
    linkWrapper.style.padding = "20px 0"; // Add vertical padding
    linkWrapper.appendChild(a);

    let iframeWrapper = document.createElement("div");
    iframeWrapper.id = 'iframe-wrapper';
    iframeWrapper.style.padding = "10px";
    iframeWrapper.style.width = "100%";
    iframeWrapper.style.height = "100%";
    iframeWrapper.style.flexGrow = "1";
    iframeWrapper.style.flexShrink = "1";
    iframeWrapper.style.display = "none";
    iframeWrapper.style.boxSizing = "border-box";

    let contentWrapper = document.createElement("div");
    contentWrapper.style.display = "flex";
    contentWrapper.style.flexDirection = "column";
    contentWrapper.style.alignItems = "center";
    contentWrapper.style.height = "100%";
    contentWrapper.style.width = "100%";

    contentWrapper.appendChild(linkWrapper);
    contentWrapper.appendChild(iframeWrapper);

    // Determine the parameter for addNodeAtNaturalScale
    let nodeName = link.startsWith('blob:') ? name : link;
    let node = addNodeAtNaturalScale(nodeName, []);

    let windowDiv = node.windowDiv;

    windowDiv.appendChild(contentWrapper);

    node.isLink = true;

    initLinkNode(node);

    return node;
}

// To-Do: Find method to refresh saves of link nodes before the save update.

function initLinkNode(node) {
    let iframeWrapper = node.content.querySelector("#iframe-wrapper");
    node.iframeWrapper = iframeWrapper;

    let iframe = iframeWrapper.querySelector("iframe");
    if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.setAttribute("style", "width: 100%; height: 100%; border: none; overflow: auto;");
        iframeWrapper.appendChild(iframe); // Append once and reuse
    }
    node.iframe = iframe;

    let link = node.content.querySelector("#link-element");
    node.link = link;

    let linkUrl = link ? link.getAttribute("href") : "";

    node.linkUrl = linkUrl;

    let linkWrapper = node.content.querySelector("#link-wrapper");
    node.linkWrapper = linkWrapper;

    addEventListenersToLinkNode(node)
}

function addEventListenersToLinkNode(node) {
    setupLinkNodeLinkListeners(node);
    setupLinkNodeSearchBarListener(node)
}

function setupLinkNodeLinkListeners(node) {
    let a = node.link;

    a.addEventListener('mouseover', function () {
        this.style.color = '#888';
        this.style.backgroundColor = '#1a1a1d'; // Change background color on hover
    }, false);

    a.addEventListener('mouseout', function () {
        this.style.color = '#bbb';
        this.style.backgroundColor = '#222226'; // Reset background color when mouse leaves
    }, false);

    // Overwrite click event to display the iframe
    a.addEventListener('click', function (event) {
        event.preventDefault(); // Prevent default link behavior
        handleLinkNodeIframe(node.iframeWrapper, node.linkWrapper, node.linkUrl);
    }, false);
}

function setupLinkNodeSearchBarListener(node) {
    let titleInput = node.titleInput;
    titleInput.addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent default behavior
            let inputValue = titleInput.value;

            if (isUrl(inputValue)) {
                updateIframeSrc(node.iframeWrapper, node.linkWrapper, inputValue);
                node.linkUrl = inputValue;
                node.link.href = inputValue; // Update the href attribute of the <a> element
                node.link.textContent = inputValue; // Update the text content of the <a> element
            } else {
                handleNaturalLanguageSearch(inputValue);
            }
        }
    });
}

function updateIframeSrc(iframeWrapper, linkWrapper, url) {
    // Remove existing iframe if it exists
    while (iframeWrapper.firstChild) {
        iframeWrapper.removeChild(iframeWrapper.firstChild);
    }

    // Create a new iframe and set the src attribute
    const iframe = document.createElement("iframe");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.overflow = "auto";
    iframe.setAttribute("src", url);

    iframeWrapper.appendChild(iframe);

    linkWrapper.style.display = "none";
    iframeWrapper.style.display = "block";
}

function handleLinkNodeIframe(iframeWrapper, linkWrapper, link) {
    if (iframeWrapper.style.display === "none") {
        updateIframeSrc(iframeWrapper, linkWrapper, link)
    } else {
        linkWrapper.style.display = "block";
        iframeWrapper.style.display = "none";
    }
}

async function handleLinkNodeProxyDisplay(iframeWrapper, linkWrapper, link) {
    // Remove existing iframe if it exists
    while (iframeWrapper.firstChild) {
        iframeWrapper.removeChild(iframeWrapper.firstChild);
    }

    if (iframeWrapper.style.display === "none" || !iframeWrapper.style.display) {
        linkWrapper.style.display = "none";
        iframeWrapper.style.display = "block";

        try {
            const response = await fetch('http://localhost:4000/raw-proxy?url=' + encodeURIComponent(link));
            if (response.ok) {
                const webpageContent = await response.text();
                // Create a new iframe and set the srcdoc attribute
                const iframe = document.createElement("iframe");
                iframe.style.width = "100%";
                iframe.style.height = "100%";
                iframe.style.overflow = "auto";
                iframe.setAttribute("srcdoc", webpageContent);

                iframeWrapper.appendChild(iframe);
            } else {
                console.error('Failed to fetch webpage content:', response.statusText);
                alert("An error occurred displaying the webpage through a proxy server. Please ensure that the extract server is running on your localhost.");
            }
        } catch (error) {
            console.error('Error fetching webpage content:', error);
            alert("An error occurred displaying the webpage. Please check your network and try again.");
        }
    } else {
        linkWrapper.style.display = "block";
        iframeWrapper.style.display = "none";
    }
}