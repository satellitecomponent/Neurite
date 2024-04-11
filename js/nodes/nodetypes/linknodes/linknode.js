
function createLinkNode(name = '', text = '', link = '', sx = undefined, sy = undefined, x = undefined, y = undefined) {
    let t = document.createElement("input");
    t.setAttribute("type", "text");
    t.setAttribute("value", name);
    t.setAttribute("style", "background:none; ");
    t.classList.add("title-input");

    let a = document.createElement("a");
    a.id = 'link-element';
    a.setAttribute("href", link);
    a.setAttribute("target", "_blank");
    a.textContent = text;
    a.style.cssText = "display: block; padding: 10px; word-wrap: break-word; white-space: pre-wrap; color: #bbb; transition: color 0.2s ease, background-color 0.2s ease; background-color: #222226; border-radius: 5px";

    let linkWrapper = document.createElement("div");
    linkWrapper.id = 'link-wrapper';
    linkWrapper.style.width = "300px";
    linkWrapper.style.padding = "20px 0"; // Add vertical padding
    linkWrapper.appendChild(a);

    let iframeWrapper = document.createElement("div");
    iframeWrapper.id = 'iframe-wrapper';
    iframeWrapper.style.width = "100%";
    iframeWrapper.style.height = "0";
    iframeWrapper.style.flexGrow = "1";
    iframeWrapper.style.flexShrink = "1";
    iframeWrapper.style.display = "none";
    iframeWrapper.style.boxSizing = "border-box";

    //iframe button
    let button = document.createElement("button");
    button.textContent = "Load as iframe";
    button.classList.add("linkbuttons");
    button.id = 'iframe-button';

    //extract text
    let extractButton = document.createElement("button");
    extractButton.textContent = "Extract Text";
    extractButton.classList.add("linkbuttons");
    extractButton.id = 'extract-button';

    //display through proxy
    let displayWrapper = document.createElement("div");
    displayWrapper.classList.add("display-wrapper");
    displayWrapper.style.width = "100%";
    displayWrapper.style.height = "100%";
    displayWrapper.style.flexGrow = "1";
    displayWrapper.style.flexShrink = "1";
    displayWrapper.style.display = "none";
    displayWrapper.style.boxSizing = "border-box";

    let displayButton = document.createElement("button");
    displayButton.textContent = "Display Webpage";
    displayButton.classList.add("linkbuttons");
    displayButton.id = 'display-button';

    let buttonsWrapper = document.createElement("div");
    buttonsWrapper.classList.add("buttons-wrapper");
    buttonsWrapper.style.order = "1";
    buttonsWrapper.appendChild(button);
    buttonsWrapper.appendChild(displayButton);
    buttonsWrapper.appendChild(extractButton);

    let contentWrapper = document.createElement("div");
    contentWrapper.style.display = "flex";
    contentWrapper.style.flexDirection = "column";
    contentWrapper.style.alignItems = "center";
    contentWrapper.style.height = "100%";

    contentWrapper.appendChild(linkWrapper);
    contentWrapper.appendChild(iframeWrapper);
    contentWrapper.appendChild(displayWrapper);
    contentWrapper.appendChild(buttonsWrapper);


    let node = addNodeAtNaturalScale(name, []);

    let windowDiv = node.windowDiv;

    windowDiv.appendChild(contentWrapper);

    let minWidth = Math.max(linkWrapper.offsetWidth, contentWrapper.offsetWidth) + 5;
    let minHeight = Math.max(linkWrapper.offsetHeight, contentWrapper.offsetHeight) + 35;
    windowDiv.style.width = minWidth + "px";
    windowDiv.style.height = minHeight + "px";

    node.isLink = true;

    initLinkNode(node)

    return node;
}

// To-Do: Find method to refresh saves of link nodes before the save update.

function initLinkNode(node) {
    let displayWrapper = node.content.querySelector(".display-wrapper");
    node.displayWrapper = displayWrapper;

    let iframeWrapper = node.content.querySelector("#iframe-wrapper");
    node.iframeWrapper = iframeWrapper;

    let iframeButton = node.content.querySelector("#iframe-button");
    node.iframeButton = iframeButton;

    let displayIframe = node.content.querySelector("iframe");
    node.displayIframe = displayIframe;

    let displayButton = node.content.querySelector("#display-button");
    node.displayButton = displayButton;

    let link = node.content.querySelector("#link-element");
    node.link = link;

    let linkUrl = link ? link.getAttribute("href") : "";

    node.linkUrl = linkUrl;

    let linkWrapper = node.content.querySelector("#link-wrapper");
    node.linkWrapper = linkWrapper;

    let extractButton = node.content.querySelector("#extract-button");
    node.extractButton = extractButton;

    addEventListenersToLinkNode(node)
}

function addEventListenersToLinkNode(node) {
    let windowDiv = node.windowDiv;
    let iframeWrapper = node.iframeWrapper;
    let displayWrapper = node.displayWrapper;
    // Initialize the resize observer
    observeContentResize(windowDiv, iframeWrapper, displayWrapper);

    setupLinkNodeIframeButtonListeners(node)
    setupLinkNodeDisplayButtonListeners(node);
    setupLinkNodeExtractButtonListeners(node)
    setupLinkNodeLinkListeners(node);
}

function setupLinkNodeDisplayButtonListeners(node) {
    let displayButton = node.displayButton;
    let displayWrapper = node.displayWrapper;
    let linkWrapper = node.linkWrapper;
    let button = node.iframeButton;
    let link = node.link;
    let extractButton = node.extractButton;
    const windowDiv = node.windowDiv;
    const buttonsWrapper = node.content.querySelector(".buttons-wrapper");

    displayButton.addEventListener("click", async function () {
        let displayIframe = displayWrapper.querySelector("iframe");

        if (displayIframe) {
            displayIframe.remove();
            displayButton.textContent = "Display Webpage";
            displayWrapper.style.display = "none";
            linkWrapper.style.display = "block";
        } else {
            // Iframe does not exist, so fetch the webpage content and create it
            try {
                const response = await fetch('http://localhost:4000/raw-proxy?url=' + encodeURIComponent(link));

                if (response.ok) {
                    const webpageContent = await response.text();
                    displayIframe = document.createElement("iframe");
                    displayIframe.srcdoc = webpageContent;
                    displayIframe.style.width = "100%";
                    displayIframe.style.height = "100%";
                    displayIframe.style.overflow = "auto";

                    displayWrapper.appendChild(displayIframe);
                    displayButton.textContent = "Close Webpage";
                    displayWrapper.style.display = "block";
                    linkWrapper.style.display = "none";

                    let availableHeight = windowDiv.offsetHeight - buttonsWrapper.offsetHeight;
                    displayWrapper.style.height = availableHeight + 'px';
                } else {
                    console.error('Failed to fetch webpage content:', response.statusText);
                    alert("An error occurred displaying the webpage through a proxy server. Please ensure that the extract server is running on your localhost.");
                }
            } catch (error) {
                console.error('Error fetching webpage content:', error);
                alert("An error occurred displaying the webpage. Please check your network and try again.");
            }
        }
    });
}

function setupLinkNodeExtractButtonListeners(node) {
    let extractButton = node.extractButton;

    let link = node.linkUrl;

    extractButton.addEventListener("click", async function () {
        let dotCount = 0;

        const dotInterval = setInterval(() => {
            dotCount = (dotCount + 1) % 4;
            extractButton.textContent = "Extracting" + ".".repeat(dotCount);
        }, 500);

        let storageKey = link;
        if (node && node.fileName) {
            storageKey = node.fileName;
        }

        async function processExtraction(text, storageKey) {
            extractButton.textContent = "Storing...";
            await storeTextData(storageKey, text);
            extractButton.textContent = "Extracted";
        }

        try {
            if (link.toLowerCase().endsWith('.pdf') || link.startsWith('blob:')) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.9.179/build/pdf.worker.min.js';
                const loadingTask = pdfjsLib.getDocument(link);
                loadingTask.promise.then(async (pdf) => {
                    let extractedText = '';
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        extractedText += textContent.items.map(item => item.str).join(' ');
                    }
                    await processExtraction(extractedText, storageKey);
                }).catch(error => {
                    console.error('Error reading PDF:', error);
                    extractButton.textContent = "Extract Failed";
                });
            } else {
                await fetchAndStoreWebPageContent(link);
                extractButton.textContent = "Extracted";
            }
        } catch (error) {
            console.error('Error during extraction:', error);
            extractButton.textContent = "Extract Failed";
            alert("An error occurred during extraction. Please ensure that the extract server is running on your localhost. Localhosts can be found at the Github link in the ? tab.");
        } finally {
            clearInterval(dotInterval);
        }
    });
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
}

function setupLinkNodeIframeButtonListeners(node) {
    const button = node.iframeButton;
    const iframeWrapper = node.iframeWrapper;
    const linkWrapper = node.linkWrapper;
    const link = node.linkUrl;
    const windowDiv = node.windowDiv;
    const buttonsWrapper = node.content.querySelector(".buttons-wrapper");

    let iframe = iframeWrapper.querySelector("iframe");
    if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.setAttribute("style", "width: 100%; height: 100%; border: none; overflow: auto;");
        iframeWrapper.appendChild(iframe); // Append once and reuse
    }

    button.addEventListener("click", () => {
        if (iframeWrapper.style.display === "none") {
            linkWrapper.style.display = "none";
            iframeWrapper.style.display = "block";
            button.textContent = "Return to link";

            // Set the src attribute of the iframe here
            iframe.setAttribute("src", link);

            let availableHeight = windowDiv.offsetHeight - buttonsWrapper.offsetHeight;
            iframeWrapper.style.height = availableHeight + 'px';
        } else {
            linkWrapper.style.display = "block";
            iframeWrapper.style.display = "none";
            button.textContent = "Load as iframe";
            iframe.setAttribute("src", "");
        }
    });
}