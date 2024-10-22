

// Update handleUserPrompt, handleMarkdown, and renderCodeBlock to make the created divs draggable
function makeDivDraggable(div, customTitle, handle) {
    handle = handle || div; // Default to the div itself if no handle is provided

    const resetDraggable = div.setAttribute.bind(div, 'draggable', 'false');
    const setDraggable = div.setAttribute.bind(div, 'draggable', 'true');

    handle.addEventListener('mousedown', setDraggable);
    handle.addEventListener('mouseup', resetDraggable);

    div.addEventListener('dragstart', function (event) {
        event.dataTransfer.setData('text/plain', JSON.stringify([customTitle, div.innerText]));
    });
    div.addEventListener('dragend', resetDraggable);
}


//Handles Ai node conversation parsing for Prismjs and a div css.
//Creates div class, user-prompt, ai-response, code-block
class ResponseHandler {
    constructor(node) {
        this.node = node;
        this.previousContent = '';
        this.inCodeBlock = false;
        this.codeBlockContent = '';
        this.codeBlockStartIndex = -1;
        this.currentLanguage = "javascript";
        this.node.codeBlockCount = 0;
        this.processingQueue = Promise.resolve();
        this.previousContentLength = 0;
        this.responseCount = 0;
        this.currentResponseEnded = false;

        this.tooltip = new TopNChunksTooltip();

            // Attach the input event listener for new input
            this.node.aiResponseTextArea.addEventListener('input', () => {
                this.processingQueue = this.processingQueue.then(() => this.handleInput());
            });
    }

    initUserPromptDiv(promptDiv) {
        this.setupUserPrompt(promptDiv);
    }

    initAiResponseDiv(responseDiv) {
        this.setupAiResponse(responseDiv);
    }

    initCodeBlockDiv(codeBlockDiv) {
        this.setupCodeBlock(codeBlockDiv);
    }

    async handleInput() {
        try {
            let content = this.node.aiResponseTextArea.value;
            let newContent = content.substring(this.previousContentLength);
            let trimmedNewContent = newContent.trim();
            if (trimmedNewContent.startsWith(`\n\n${PROMPT_IDENTIFIER} `)) {
                trimmedNewContent = trimmedNewContent.trimStart();
            }
            // Find the last occurrence of the prompt identifier in the trimmed content
            let lastPromptIndex = trimmedNewContent.lastIndexOf(`${PROMPT_IDENTIFIER}`);
            if (lastPromptIndex !== -1) {
                let promptContent = trimmedNewContent.substring(lastPromptIndex + PROMPT_IDENTIFIER.length).trim();
                let segments = promptContent.split('```');
                for (let i = 0; i < segments.length; i++) {
                    let segment = segments[i].trim();
                    if (segment) {
                        if (i % 2 === 0) {
                            this.handleUserPrompt(segment); // Even segments are regular text
                        } else {
                            this.renderCodeBlock(segment, true, true); // Odd segments are code blocks within user prompts
                        }
                    }
                }
                newContent = '';
            } else {
                if (this.inCodeBlock) {
                    this.codeBlockContent += newContent;
                    let endOfCodeBlockIndex = this.codeBlockContent.indexOf('```');
                    if (endOfCodeBlockIndex !== -1) {
                        let codeContent = this.codeBlockContent.substring(0, endOfCodeBlockIndex);
                        this.renderCodeBlock(codeContent, true);
                        this.codeBlockContent = '';
                        this.codeBlockStartIndex = -1;
                        this.inCodeBlock = false;
                        newContent = this.codeBlockContent.substring(endOfCodeBlockIndex + 3);
                    } else {
                        this.renderCodeBlock(this.codeBlockContent, false);
                        newContent = '';
                    }
                }

                while (newContent.length > 0) {
                    let startOfCodeBlockIndex = newContent.indexOf('```');
                    if (startOfCodeBlockIndex !== -1) {
                        if (startOfCodeBlockIndex > 0) {
                            this.handleMarkdown(newContent.substring(0, startOfCodeBlockIndex));
                        }
                        this.inCodeBlock = true;
                        this.codeBlockStartIndex = this.previousContent.length + startOfCodeBlockIndex;
                        this.codeBlockContent = newContent.substring(startOfCodeBlockIndex + 3);
                        let endOfCodeBlockIndex = this.codeBlockContent.indexOf('```');
                        if (endOfCodeBlockIndex !== -1) {
                            let codeContent = this.codeBlockContent.substring(0, endOfCodeBlockIndex);
                            this.renderCodeBlock(codeContent, true);
                            this.codeBlockContent = '';
                            this.codeBlockStartIndex = -1;
                            this.inCodeBlock = false;
                            newContent = this.codeBlockContent.substring(endOfCodeBlockIndex + 3);
                        } else {
                            this.renderCodeBlock(this.codeBlockContent, false);
                            newContent = '';
                        }
                    } else {
                        this.handleMarkdown(newContent);
                        newContent = '';
                    }
                }
            }
            this.previousContent = content;
            this.previousContentLength = this.previousContent.length;
        } catch (error) {
            console.error('Error while processing markdown:', error);
        }
    }

    restoreAiResponseDiv() {
        const children = this.node.aiResponseDiv.children;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const userPromptDiv = child.querySelector('.user-prompt');
            if (userPromptDiv) {
                this.initUserPromptDiv(userPromptDiv);
            } else if (child.classList.contains('response-wrapper')) {
                const responseDiv = child.querySelector('.ai-response');
                if (responseDiv) {
                    this.initAiResponseDiv(child);
                    this.reattachTooltips(responseDiv);
                }
            } else if (child.classList.contains('code-block-container')) {
                this.initCodeBlockDiv(child);
            }
        }
    }

    reattachTooltips(responseDiv) {
        responseDiv.querySelectorAll('a.snippet-ref').forEach(link => {
            if (!link.dataset.snippetData) return;

            this.tooltip.detachTooltipEvents(link);
            this.tooltip.attachTooltipEvents(link);
        });
    }


    findSnippetData(snippetNumber, source) {
        // First, check in the current top N chunks
        if (this.node.currentTopNChunks) {
            const snippet = this.node.currentTopNChunks.find(chunk => {
                const [chunkSource, chunkNumber] = chunk.key.split('_chunk_');
                return chunkSource === source && parseInt(chunkNumber) === snippetNumber;
            });
            if (snippet) {
                return {
                    source,
                    relevanceScore: snippet.relevanceScore,
                    text: snippet.text
                };
            }
        }

        // If not found, search in previous AI responses
        return this.findSnippetDataInPreviousResponses(snippetNumber, source);
    }

    findSnippetDataInPreviousResponses(snippetNumber, source) {
        const aiResponseDivs = Array.from(this.node.aiResponseDiv.querySelectorAll('.ai-response'));
        // Get the 10 most recent response divs, adjust number as needed for balance between depth and performance
        const recentResponseDivs = aiResponseDivs.slice(-10);

        for (let i = recentResponseDivs.length - 1; i >= 0; i--) {
            const responseDiv = recentResponseDivs[i];
            const links = responseDiv.querySelectorAll('a.snippet-ref');
            for (let link of links) {
                if (!link.dataset.snippetData) continue;

                const snippetDataList = JSON.parse(link.dataset.snippetData);
                const matchingSnippet = snippetDataList.find(snippet =>
                    snippet.source === source && snippet.snippetNumber === snippetNumber
                );
                if (matchingSnippet) return matchingSnippet;
            }
        }
        return null;
    }

    attachSnippetTooltips(aiResponseDiv) {
        aiResponseDiv.querySelectorAll('a').forEach(link => {
            const href = link.getAttribute('href');
            const text = link.textContent;
            const snippetMatch = text.match(/^Snippet (\d+(?:,\s*\d+)*)/);
            if (!snippetMatch) return;

            const snippetNumbers = snippetMatch[1].split(',').map(Number);
            const cb = (snippetNumber)=>this.findSnippetData(snippetNumber, href) ;
            const snippetDataList = snippetNumbers.map(cb).filter(Boolean);
            this.addTooltipEventListeners(link, snippetDataList);
        });
    }

    addTooltipEventListeners(link, snippetDataList) {
        if (snippetDataList.length < 1) return;

        link.classList.add('snippet-ref');
        link.dataset.snippetData = JSON.stringify(snippetDataList);
        this.tooltip.attachTooltipEvents(link);
    }

    handleMarkdown(markdown) {
        if (this.node.aiResponding || this.node.localAiResponding) {
            let segments = markdown.split('\n\n\n');
            let linkFound = false;

            segments.forEach((segment, index) => {
                let responseDiv = this.getOrCreateResponseDiv(index);
                this.appendMarkdownSegment(responseDiv, segment);
                // Check for links as segments are processed to avoid re-querying later
                if (!linkFound && responseDiv.querySelector('a')) linkFound = true;
            });

            if (linkFound) {
                this.attachSnippetTooltips(this.node.aiResponseDiv);
            }
        }
    }

    appendMarkdownSegment(responseDiv, segment) {
        // Update the dataset with the new segment
        responseDiv.dataset.markdown = (responseDiv.dataset.markdown || '') + segment;

        // Updated regex to handle mentions more flexibly
        // Matches mentions starting with @, and including any subsequent @ symbols until a space or end of string
        const mentionPattern = /(?<=^|\s)@[a-zA-Z0-9._@-]+/g;

        // Replace mentions with a span for highlighting
        const highlightedSegment = responseDiv.dataset.markdown.replace(mentionPattern, (match) => {
            return `<span class="mention">${match}</span>`
        });

        // Properly parse and render the updated content using the marked library
        let parsedHtml = marked.parse(highlightedSegment, { renderer: this.getMarkedRenderer() });
        responseDiv.innerHTML = parsedHtml;
    }


    getOrCreateResponseDiv(index) {
        const lastWrapperDiv = this.node.aiResponseDiv.lastElementChild;
        if (index === 0 && lastWrapperDiv && lastWrapperDiv.classList.contains('response-wrapper')) {
            return lastWrapperDiv.querySelector('.ai-response');
        }

        const responseDiv = document.createElement('div');
        responseDiv.className = 'ai-response';

        const wrapperDiv = document.createElement('div');
        wrapperDiv.className = 'response-wrapper';
        wrapperDiv.appendChild(this.createHandleDiv());
        wrapperDiv.appendChild(responseDiv);

        this.node.aiResponseDiv.appendChild(wrapperDiv);
        this.initAiResponseDiv(responseDiv);

        return responseDiv;
    }

    createHandleDiv() {
        const handleDiv = document.createElement('div');
        handleDiv.className = 'drag-handle';
        handleDiv.innerHTML = `
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
        `;
        return handleDiv;
    }

    getMarkedRenderer() {
        const renderer = new marked.Renderer();
        renderer.image = function (href, title, text) {
            // Check if the image URL is a valid URL
            if (String.isUrl(href)) {
                return `<img src="${href}" alt="${text}" title="${title || ''}" />`;
            } else {
                // If the image URL is not a valid URL, treat it as a relative path
                let basePath = 'path/to/your/images/directory/';
                let imagePath = basePath + href;
                return `<img src="${imagePath}" alt="${text}" title="${title || ''}" />`;
            }
        };
        return renderer;
    }

    setupAiResponse(responseDiv) {
        // Find the wrapper and handle divs relative to the responseDiv
        const wrapperDiv = responseDiv.closest('.response-wrapper');
        const handleDiv = wrapperDiv.querySelector('.drag-handle');

        // Apply logic specific to AI response div
        makeDivDraggable(wrapperDiv, 'AI Response', handleDiv);

        handleDiv.addEventListener('mouseover', () => {
            wrapperDiv.classList.add('hovered');
        });

        handleDiv.addEventListener('mouseout', () => {
            wrapperDiv.classList.remove('hovered');
        });
    }

    handleUserPrompt(promptContent) {
        if (!promptContent) return;

        // Replace newline characters with <br> tags
        let formattedContent = promptContent.replace(/\n/g, '<br>');

        // Create a new div for the outer container
        let outerDiv = document.createElement('div');
        outerDiv.style.width = '100%';
        outerDiv.style.textAlign = 'right';

        // Create a new div for the user prompt
        let promptDiv = document.createElement('div');
        promptDiv.className = 'user-prompt';
        promptDiv.id = `prompt-${this.responseCount}`;  // Assign a unique ID to each prompt
        promptDiv.contentEditable = false; // Set contentEditable to false when the promptDiv is created

        // Set the innerHTML to display new lines correctly
        promptDiv.innerHTML = formattedContent;

        // Append the prompt div to the outer div
        outerDiv.appendChild(promptDiv);

        // Append the outer div to the response area
        this.node.aiResponseDiv.appendChild(outerDiv);

        this.initUserPromptDiv(promptDiv);

        this.responseCount++;  // Increment the response count after each prompt
    }

    renderCodeBlock(content, isFinal = false, isUserPromptCodeBlock = false) {
        let languageString = '';
        let codeContent = content;

        // Check if the content starts with a language string
        const languageStringEndIndex = content.indexOf('\n');
        if (languageStringEndIndex !== -1) {
            languageString = content.substring(0, languageStringEndIndex).trim();
            codeContent = content.substring(languageStringEndIndex + 1);
        }

        if (!isFinal && this.node.lastBlockId) {
            const oldBlock = Elem.byId(this.node.lastBlockId);
            if (oldBlock) oldBlock.parentNode.removeChild(oldBlock);
        }

        const codeBlockDivId = `code-block-wrapper-${this.node.id}-${this.node.codeBlockCount}`;
        let existingContainerDiv = Elem.byId(codeBlockDivId);

        if (!existingContainerDiv) {
            existingContainerDiv = document.createElement('div');
            existingContainerDiv.id = codeBlockDivId;
            existingContainerDiv.className = "code-block-container";
            this.node.aiResponseDiv.appendChild(existingContainerDiv);

            // Add a specific identifier or class for user-prompt code blocks
            if (isUserPromptCodeBlock) {
                existingContainerDiv.classList.add('user-prompt-codeblock');
            }

            const languageLabelDiv = document.createElement('div');
            languageLabelDiv.className = "language-label";
            existingContainerDiv.appendChild(languageLabelDiv);

            const existingWrapperDiv = document.createElement('div');
            existingWrapperDiv.className = "code-block-wrapper custom-scrollbar";
            existingContainerDiv.appendChild(existingWrapperDiv);

            const preDiv = document.createElement('pre');
            preDiv.className = "code-block";
            existingWrapperDiv.appendChild(preDiv);
        }

        const existingWrapperDiv = existingContainerDiv.getElementsByClassName('code-block-wrapper')[0];
        const preDiv = existingWrapperDiv.getElementsByClassName('code-block')[0];

        const codeElement = document.createElement('code');
        codeElement.className = 'language-' + (languageString || this.currentLanguage);
        codeElement.textContent = decodeHTML(encodeHTML(codeContent));

        Prism.highlightElement(codeElement);

        preDiv.innerHTML = '';
        preDiv.appendChild(codeElement);

        const languageLabelDiv = existingContainerDiv.getElementsByClassName('language-label')[0];
        languageLabelDiv.innerText = languageString || this.currentLanguage;
        languageLabelDiv.style.display = 'flex';
        languageLabelDiv.style.justifyContent = 'space-between';
        languageLabelDiv.style.alignItems = 'center';

        const copyButton = document.createElement('button');
        copyButton.innerText = 'Copy';
        copyButton.className = 'copy-btn';

        languageLabelDiv.appendChild(copyButton);

        this.initCodeBlockDiv(existingContainerDiv);

        if (isFinal) this.node.codeBlockCount += 1;
        this.node.lastBlockId = (isFinal ? null : codeBlockDivId);
    }

    setupUserPrompt(promptDiv) {
        // Make the prompt div draggable
        makeDivDraggable(promptDiv, 'Prompt');

        let isEditing = false;

        const handleKeyDown = function handleKeyDown(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.removeResponsesUntil(promptDiv.id);

                // Get the HTML content of the promptDiv and replace <br> with newline
                const message = promptDiv.innerHTML.replace(/<br\s*\/?>/gi, '\n');

                //console.log(`Sending message: "${message}"`);
                AiNode.sendMessage(this.node, message);
            }
        }.bind(this);

        function onBlur(){
            if (isEditing) { // div loses focus
                promptDiv.classList.remove('editing');
                promptDiv.contentEditable = false;

                isEditing = false;

                // Reset styles to non-editing state
                promptDiv.style.backgroundColor = '';
                promptDiv.style.color = '';

                promptDiv.style.cursor = "move";

                // Make the div draggable
                makeDivDraggable(promptDiv, 'Prompt');
                promptDiv.ondragstart = function () { return isEditing ? false : null; };

                promptDiv.removeEventListener('keydown', handleKeyDown);
            }
        }

        function onDblclick(e){
            e.preventDefault();
            e.stopPropagation();

            isEditing = !isEditing;
            if (isEditing) { // entering edit mode
                promptDiv.classList.add('editing');
                promptDiv.contentEditable = true;
                promptDiv.removeAttribute('draggable');

                // Set the background and text color to match original, remove inherited text decoration
                const style = promptDiv.style;
                style.cursor = 'text';
                style.backgroundColor = 'inherit';
                style.color = '#bbb';
                style.textDecoration = 'none';
                style.outline = 'none';
                style.border = 'none';

                promptDiv.focus();
                promptDiv.addEventListener('keydown', handleKeyDown);

                // Set promptDiv non-draggable
                promptDiv.ondragstart = function () { return false; };
            } else { // leaving edit mode
                promptDiv.classList.remove('editing');
                promptDiv.contentEditable = false;

                const style = promptDiv.style;
                style.backgroundColor = '';
                style.color = '';
                style.cursor = "move";

                makeDivDraggable(promptDiv, 'Prompt');
                promptDiv.ondragstart = function () { return isEditing ? false : null; };
                promptDiv.removeEventListener('keydown', handleKeyDown);
            }
        }

        promptDiv.addEventListener('blur', onBlur.bind(this));
        promptDiv.addEventListener('dblclick', onDblclick.bind(this));
    }

    setupCodeBlock(codeBlockDiv) {
        // Query necessary child elements within the codeBlockDiv
        const languageLabelDiv = codeBlockDiv.querySelector('.language-label');
        const copyButton = codeBlockDiv.querySelector('.copy-btn');
        const preDiv = codeBlockDiv.querySelector('.code-block');
        const decodedContent = preDiv.textContent; // Assuming the content is within the <pre> tag

        // Apply logic specific to code block div
        makeDivDraggable(codeBlockDiv, 'Code Block', languageLabelDiv);

        copyButton.onclick = () => {
            const textarea = document.createElement('textarea');
            textarea.value = decodedContent;
            document.body.appendChild(textarea);
            textarea.select();

            if (document.execCommand('copy')) {
                copyButton.innerText = "Copied!";
                setTimeout(() => copyButton.innerText = "Copy", 1200);
            }

            document.body.removeChild(textarea);
        };

        codeBlockDiv.addEventListener('mouseover', (event) => {
            if (event.target === languageLabelDiv || event.target === copyButton) {
                codeBlockDiv.classList.add('hovered');
            }
        });

        codeBlockDiv.addEventListener('mouseout', (event) => {
            if (event.target === languageLabelDiv || event.target === copyButton) {
                codeBlockDiv.classList.remove('hovered');
            }
        });
    }

    removeLastResponse() {
        // Handling the div as per the new version
        let prompts = this.node.aiResponseDiv.querySelectorAll('.user-prompt');
        let lastPrompt = prompts[prompts.length - 1];
        let lastPromptId = lastPrompt ? lastPrompt.id : null;

        if (lastPrompt) {
            // Remove everything after the last 'user-prompt' div
            while (this.node.aiResponseDiv.lastChild !== lastPrompt.parentNode) {
                this.node.aiResponseDiv.removeChild(this.node.aiResponseDiv.lastChild);
            }
            // Remove the last 'user-prompt' div itself
            this.node.aiResponseDiv.removeChild(lastPrompt.parentNode);
        }

        // Handling the textarea as per the old version
        const lines = this.node.aiResponseTextArea.value.split('\n');

        // Find the index of the last "Prompt:"
        let lastPromptIndex = lines.length - 1;
        while (lastPromptIndex >= 0 && !lines[lastPromptIndex].startsWith(`${PROMPT_IDENTIFIER}`)) {
            lastPromptIndex--;
        }

        // Remove all lines from the last "Prompt:" to the end
        if (lastPromptIndex >= 0) {
            lines.length = lastPromptIndex;
            this.node.aiResponseTextArea.value = lines.join('\n');
            this.previousContentLength = this.node.aiResponseTextArea.value.length; // Update previousContentLength here
        }

        // Handle the case where a code block is being processed but is not yet complete
        if (this.inCodeBlock) {
            // Reset properties related to code block
            this.inCodeBlock = false;
            this.codeBlockContent = '';
            this.codeBlockStartIndex = -1;
            this.currentLanguage = "javascript";

            // Remove the partial code block from the div if present
            const codeBlockDiv = Elem.byId(`code-block-wrapper-${this.node.id}-${this.node.codeBlockCount}`);
            if (codeBlockDiv) codeBlockDiv.parentNode.removeChild(codeBlockDiv);

            // Remove the partial code block from the textarea
            let codeBlockStartLine = this.node.aiResponseTextArea.value.lastIndexOf("```", this.previousContentLength);
            if (codeBlockStartLine >= 0) {
                this.node.aiResponseTextArea.value = this.node.aiResponseTextArea.value.substring(0, codeBlockStartLine);
                this.previousContentLength = this.node.aiResponseTextArea.value.length; // Update previousContentLength again
            }
        }

        this.handleInput(); // Invoke handleInput here
        return lastPromptId;
    }

    removeResponsesUntil(id) {
        let lastRemovedId;
        do {
            lastRemovedId = this.removeLastResponse();
        } while (lastRemovedId !== id && lastRemovedId !== null);
    }
}

const nodeResponseHandlers = new Map();


/*
Elem.byId('localLLM).addEventListener('change', function () {
    let llmNodes = document.querySelectorAll("[id^=dynamicLocalLLMselect-]");
    for (let i = 0; i < llmNodes.length; i++) {
        let selectContainer = llmNodes[i].closest('.select-container');  // Find the closest parent .select-container

        if (this.checked) {
            selectContainer.style.display = 'block';
        } else {
            selectContainer.style.display = 'none';
        }
    }
});
*/