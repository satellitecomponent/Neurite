// Update handleUserPrompt, handleMarkdown, and renderCodeBlock to make the created divs draggable
function makeDivDraggable(div, customTitle, handle) {
    handle = handle || div; // Default to the div itself if no handle is provided

    const resetDraggable = div.setAttribute.bind(div, 'draggable', 'false');
    const setDraggable = div.setAttribute.bind(div, 'draggable', 'true');

    On.mousedown(handle, setDraggable);
    On.mouseup(handle, resetDraggable);

    On.dragstart(div, (e)=>{
        const json = JSON.stringify([customTitle, div.innerText]);
        e.dataTransfer.setData('text/plain', json);
    });
    On.dragend(div, resetDraggable);
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
        On.input(this.node.aiResponseTextArea, (e)=>{
            this.processingQueue = this.processingQueue.then(this.handleInput);
        });
    }

    handleInput = async ()=>{
        try {
            const content = this.node.aiResponseTextArea.value;
            let newContent = content.substring(this.previousContentLength);
            let trimmedNewContent = newContent.trim();
            if (trimmedNewContent.startsWith(`\n\n${PROMPT_IDENTIFIER} `)) {
                trimmedNewContent = trimmedNewContent.trimStart();
            }
            // Find the last occurrence of the prompt identifier in the trimmed content
            const lastPromptIndex = trimmedNewContent.lastIndexOf(`${PROMPT_IDENTIFIER}`);
            if (lastPromptIndex !== -1) {
                // Find the end of the prompt using PROMPT_END
                const promptEndIndex = trimmedNewContent.indexOf(PROMPT_END, lastPromptIndex);
                if (promptEndIndex !== -1) {
                    // Extract the prompt content between PROMPT_IDENTIFIER and PROMPT_END
                    const promptContent = trimmedNewContent.substring(lastPromptIndex + PROMPT_IDENTIFIER.length, promptEndIndex).trim();
                    const segments = promptContent.split('```');
                    for (let i = 0; i < segments.length; i++) {
                        const segment = segments[i].trim();
                        if (segment) {
                            if (i % 2 === 0) {
                                this.handleUserPrompt(segment); // Even segments are regular text
                            } else {
                                this.renderCodeBlock(segment, true, true); // Odd segments are code blocks within user prompts
                            }
                        }
                    }
                    // Clear newContent after processing the prompt
                    newContent = trimmedNewContent.substring(promptEndIndex + PROMPT_END.length).trim();
                } else {
                    // If PROMPT_END is not found, treat the entire content as part of the prompt
                    const promptContent = trimmedNewContent.substring(lastPromptIndex + PROMPT_IDENTIFIER.length).trim();
                    this.handleUserPrompt(promptContent);
                    newContent = '';
                }
            } else {
                // Handle non-prompt content (code blocks and markdown)
                if (this.inCodeBlock) {
                    this.codeBlockContent += newContent;
                    const endOfCodeBlockIndex = this.codeBlockContent.indexOf('```');
                    if (endOfCodeBlockIndex !== -1) {
                        const codeContent = this.codeBlockContent.substring(0, endOfCodeBlockIndex);
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
                    const startOfCodeBlockIndex = newContent.indexOf('```');
                    if (startOfCodeBlockIndex !== -1) {
                        if (startOfCodeBlockIndex > 0) {
                            this.handleMarkdown(newContent.substring(0, startOfCodeBlockIndex));
                        }
                        this.inCodeBlock = true;
                        this.codeBlockStartIndex = this.previousContent.length + startOfCodeBlockIndex;
                        this.codeBlockContent = newContent.substring(startOfCodeBlockIndex + 3);
                        const endOfCodeBlockIndex = this.codeBlockContent.indexOf('```');
                        if (endOfCodeBlockIndex !== -1) {
                            const codeContent = this.codeBlockContent.substring(0, endOfCodeBlockIndex);
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
        } catch (err) {
            Logger.err("While processing markdown:", err)
        }
    }

    restoreResponse(child){
        const divUserPrompt = child.querySelector('.user-prompt');
        if (divUserPrompt) {
            this.setupUserPrompt(divUserPrompt)
        } else if (child.classList.contains('response-wrapper')) {
            const divResponse = child.querySelector('.ai-response');
            if (!divResponse) return;

            this.setupAiResponse(child);
            this.reattachTooltips(divResponse);
        } else if (child.classList.contains('code-block-container')) {
            this.setupCodeBlock(child)
        }
    }

    reattachTooltips(divResponse) {
        divResponse.querySelectorAll('a.snippet-ref').forEach(link => {
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
            const links = recentResponseDivs[i].querySelectorAll('a.snippet-ref');
            for (const link of links) {
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
        if (!this.node.aiResponding && !this.node.localAiResponding) return;

        const segments = markdown.split('\n\n\n');
        let linkFound = false;

        segments.forEach((segment, index) => {
            const divResponse = this.getOrCreateResponseDiv(index);
            this.appendMarkdownSegment(divResponse, segment);
            // Check for links as segments are processed to avoid re-querying later
            if (!linkFound && divResponse.querySelector('a')) linkFound = true;
        });

        if (linkFound) {
            this.attachSnippetTooltips(this.node.aiResponseDiv);
        }
    }

    appendMarkdownSegment(divResponse, segment) {
        // Update the dataset with the new segment
        divResponse.dataset.markdown = (divResponse.dataset.markdown || '') + segment;

        // Updated regex to handle mentions more flexibly
        // Matches mentions starting with @, and including any subsequent @ symbols until a space or end of string
        const mentionPattern = /(?<=^|\s)@[a-zA-Z0-9._@-]+/g;

        // Replace mentions with a span for highlighting
        const highlightedSegment = divResponse.dataset.markdown.replace(mentionPattern, (match) => {
            return `<span class="mention">${match}</span>`
        });

        // Properly parse and render the updated content using the marked library
        const parsedHtml = marked.parse(highlightedSegment, { renderer: this.getMarkedRenderer() });
        divResponse.innerHTML = parsedHtml;
    }

    getOrCreateResponseDiv(index) {
        const divLastWrapper = this.node.aiResponseDiv.lastElementChild;
        if (index === 0 && divLastWrapper && divLastWrapper.classList.contains('response-wrapper')) {
            return divLastWrapper.querySelector('.ai-response');
        }

        const divResponse = Html.make.div('ai-response');

        const divWrapper = Html.make.div('response-wrapper');
        divWrapper.append(this.makeDivHandle(), divResponse);

        this.node.aiResponseDiv.appendChild(divWrapper);
        this.setupAiResponse(divResponse);

        return divResponse;
    }

    makeDivHandle() {
        const div = Html.make.div('drag-handle');
        div.innerHTML = `
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
        `;
        return div;
    }

    getMarkedRenderer() {
        const renderer = new marked.Renderer();
        renderer.image = function (href, title, text) {
            // Check if the image URL is a valid URL
            if (String.isUrl(href)) {
                return `<img src="${href}" alt="${text}" title="${title || ''}" />`;
            } else {
                // If the image URL is not a valid URL, treat it as a relative path
                const imagePath = 'path/to/your/images/directory/' + href;
                return `<img src="${imagePath}" alt="${text}" title="${title || ''}" />`;
            }
        };
        return renderer;
    }

    setupAiResponse(divResponse) {
        // Find the wrapper and handle divs relative to the divResponse
        const divWrapper = divResponse.closest('.response-wrapper');
        const divHandle = divWrapper.querySelector('.drag-handle');

        // Apply logic specific to AI response div
        makeDivDraggable(divWrapper, 'AI Response', divHandle);

        const classList = divWrapper.classList;
        On.mouseover(divHandle, (e)=>{ classList.add('hovered') });
        On.mouseout(divHandle, (e)=>{ classList.remove('hovered') });
    }

    handleUserPrompt(promptContent) {
        if (!promptContent) return;

        const formattedContent = promptContent.replace(/\n/g, '<br>');

        const divOuter = Html.new.div();
        divOuter.style.width = '100%';
        divOuter.style.textAlign = 'right';

        const divPrompt = Html.make.div('user-prompt');
        divPrompt.id = 'prompt-' + this.responseCount;
        divPrompt.contentEditable = false;

        // Set the innerHTML to display new lines correctly
        divPrompt.innerHTML = formattedContent;

        divOuter.appendChild(divPrompt);

        this.node.aiResponseDiv.appendChild(divOuter);

        this.setupUserPrompt(divPrompt);

        this.responseCount += 1;
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
        let divExistingContainer = Elem.byId(codeBlockDivId);

        if (!divExistingContainer) {
            divExistingContainer = Html.make.div('code-block-container');
            divExistingContainer.id = codeBlockDivId;
            this.node.aiResponseDiv.appendChild(divExistingContainer);

            // Add a specific identifier or class for user-prompt code blocks
            if (isUserPromptCodeBlock) {
                divExistingContainer.classList.add('user-prompt-codeblock');
            }

            const divLanguageLabel = Html.make.div('language-label');
            const divExistingWrapper = Html.make.div('code-block-wrapper custom-scrollbar');
            divExistingContainer.append(divLanguageLabel, divExistingWrapper);

            divExistingWrapper.append(Html.make.pre('code-block'));
        }

        const divExistingWrapper = divExistingContainer.getElementsByClassName('code-block-wrapper')[0];
        const divPre = divExistingWrapper.getElementsByClassName('code-block')[0];

        const className = 'language-' + (languageString || this.currentLanguage);
        const codeElement = Html.make.code(className);
        codeElement.textContent = decodeHTML(encodeHTML(codeContent));

        Prism.highlightElement(codeElement);

        divPre.innerHTML = '';
        divPre.appendChild(codeElement);

        const divLanguageLabel = divExistingContainer.getElementsByClassName('language-label')[0];
        divLanguageLabel.innerText = languageString || this.currentLanguage;
        divLanguageLabel.style.display = 'flex';
        divLanguageLabel.style.justifyContent = 'space-between';
        divLanguageLabel.style.alignItems = 'center';

        const copyButton = Html.make.button('copy-btn', "Copy");
        divLanguageLabel.appendChild(copyButton);

        this.setupCodeBlock(divExistingContainer);

        if (isFinal) this.node.codeBlockCount += 1;
        this.node.lastBlockId = (isFinal ? null : codeBlockDivId);
    }

    setupUserPrompt(divPrompt) {
        makeDivDraggable(divPrompt, 'Prompt');

        let isEditing = false;

        const handleKeyDown = (event)=>{
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.removeResponsesUntil(divPrompt.id);

                const message = divPrompt.innerHTML.replace(/<br\s*\/?>/gi, '\n');
                Logger.debug(`Sending message: "${message}"`);
                AiNode.sendMessage(this.node, message);
            }
        }

        function onBlur(){
            if (isEditing) { // div loses focus
                divPrompt.classList.remove('editing');
                divPrompt.contentEditable = false;

                isEditing = false;

                // Reset styles to non-editing state
                divPrompt.style.backgroundColor = '';
                divPrompt.style.color = '';

                divPrompt.style.cursor = "move";

                // Make the div draggable
                makeDivDraggable(divPrompt, 'Prompt');
                On.dragstart(divPrompt, (e)=>(isEditing ? false : null) );
                Off.keydown(divPrompt, handleKeyDown);
            }
        }

        function onDblClick(e){
            e.preventDefault();
            e.stopPropagation();

            isEditing = !isEditing;
            if (isEditing) { // entering edit mode
                divPrompt.classList.add('editing');
                divPrompt.contentEditable = true;
                divPrompt.removeAttribute('draggable');

                // Set the background and text color to match original, remove inherited text decoration
                const style = divPrompt.style;
                style.cursor = 'text';
                style.backgroundColor = 'inherit';
                style.color = '#bbb';
                style.textDecoration = 'none';
                style.outline = 'none';
                style.border = 'none';

                divPrompt.focus();
                On.keydown(divPrompt, handleKeyDown);

                On.dragstart(divPrompt, (e)=>false ); // Make non-draggable
            } else { // leaving edit mode
                divPrompt.classList.remove('editing');
                divPrompt.contentEditable = false;

                const style = divPrompt.style;
                style.backgroundColor = '';
                style.color = '';
                style.cursor = "move";

                makeDivDraggable(divPrompt, 'Prompt');
                On.dragstart(divPrompt, (e)=>(isEditing ? false : null) );
                Off.keydown(divPrompt, handleKeyDown);
            }
        }

        On.blur(divPrompt, onBlur);
        On.dblclick(divPrompt, onDblClick);
    }

    setupCodeBlock(divCodeBlock) {
        // Query necessary child elements within divCodeBlock
        const divLanguageLabel = divCodeBlock.querySelector('.language-label');
        const copyButton = divCodeBlock.querySelector('.copy-btn');
        const decodedContent = divCodeBlock.querySelector('.code-block');

        // Apply logic specific to code block div
        makeDivDraggable(divCodeBlock, 'Code Block', divLanguageLabel);

        On.click(copyButton, (e)=>{
            const textarea = Html.new.textarea();
            textarea.value = decodedContent;
            document.body.appendChild(textarea);
            textarea.select();

            if (document.execCommand('copy')) {
                copyButton.innerText = "Copied!";
                function revert(){ copyButton.innerText = "Copy" }
                Promise.delay(1200).then(revert);
            }

            document.body.removeChild(textarea);
        });

        On.mouseover(divCodeBlock, (e)=>{
            if (e.target === divLanguageLabel || e.target === copyButton) {
                divCodeBlock.classList.add('hovered');
            }
        });
        On.mouseout(divCodeBlock, (e)=>{
            if (e.target === divLanguageLabel || e.target === copyButton) {
                divCodeBlock.classList.remove('hovered');
            }
        });
    }

    removeLastResponse() {
        // Handling the div as per the new version
        const prompts = this.node.aiResponseDiv.querySelectorAll('.user-prompt');
        const lastPrompt = prompts[prompts.length - 1];
        const lastPromptId = lastPrompt ? lastPrompt.id : null;

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
            lastPromptIndex -= 1;
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
            const divCodeBlock = Elem.byId(`code-block-wrapper-${this.node.id}-${this.node.codeBlockCount}`);
            if (divCodeBlock) divCodeBlock.parentNode.removeChild(divCodeBlock);

            // Remove the partial code block from the textarea
            const codeBlockStartLine = this.node.aiResponseTextArea.value.lastIndexOf("```", this.previousContentLength);
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
