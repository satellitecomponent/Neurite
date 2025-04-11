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
        this.pendingPromptContent = '';
        this.foundPromptStart = false;
        this.tooltip = new TopNChunksTooltip();
        On.input(this.node.aiResponseTextArea, () => this.processingQueue = this.processingQueue.then(this.handleInput));
    }

    handleInput = async () => {
        try {
            const content = this.node.aiResponseTextArea.value;
            await this.processContent(content.substring(this.previousContentLength));
            this.checkForCompletePrompts();
            this.previousContent = content;
            this.previousContentLength = content.length;
        } catch (err) {
            Logger.err("While processing markdown:", err);
        }
    }

    processContent = async (newContent) => {
        const trimmedContent = newContent.trim();

        if (this.foundPromptStart) {
            this.pendingPromptContent += newContent;
            const promptEndIndex = this.pendingPromptContent.indexOf(PROMPT_END);
            if (promptEndIndex !== -1) {
                this.processPromptContent(this.pendingPromptContent.substring(0, promptEndIndex + PROMPT_END.length));
                this.foundPromptStart = false;
                const remainingContent = this.pendingPromptContent.substring(promptEndIndex + PROMPT_END.length);
                this.pendingPromptContent = '';
                if (remainingContent) await this.processContent(remainingContent);
                return;
            }
            return;
        }

        if (trimmedContent.includes(PROMPT_IDENTIFIER)) {
            const promptStartIndex = trimmedContent.indexOf(PROMPT_IDENTIFIER);
            if (promptStartIndex > 0) this.processNonPromptContent(trimmedContent.substring(0, promptStartIndex));

            this.foundPromptStart = true;
            this.pendingPromptContent = trimmedContent.substring(promptStartIndex);

            const promptEndIndex = this.pendingPromptContent.indexOf(PROMPT_END);
            if (promptEndIndex !== -1) {
                this.processPromptContent(this.pendingPromptContent.substring(0, promptEndIndex + PROMPT_END.length));
                this.foundPromptStart = false;
                const remainingContent = this.pendingPromptContent.substring(promptEndIndex + PROMPT_END.length);
                this.pendingPromptContent = '';
                if (remainingContent) await this.processContent(remainingContent);
            }
            return;
        }

        this.processNonPromptContent(newContent);
    }

    processPromptContent = (promptContent) => {
        const startIndex = promptContent.indexOf(PROMPT_IDENTIFIER) + PROMPT_IDENTIFIER.length;
        const endIndex = promptContent.indexOf(PROMPT_END);
        const extractedContent = promptContent.substring(startIndex, endIndex).trim();

        extractedContent.split('```').forEach((segment, i) => {
            if (!segment.trim()) return;
            i % 2 === 0 ? this.handleUserPrompt(segment.trim()) : this.renderCodeBlock(segment, true, true);
        });
    }

    processNonPromptContent = (content) => {
        if (this.inCodeBlock) {
            this.codeBlockContent += content;
            const endIndex = this.codeBlockContent.indexOf('```');
            if (endIndex !== -1) {
                this.renderCodeBlock(this.codeBlockContent.substring(0, endIndex), true);
                this.codeBlockContent = '';
                this.codeBlockStartIndex = -1;
                this.inCodeBlock = false;
                const remaining = this.codeBlockContent.substring(endIndex + 3);
                if (remaining) this.processNonPromptContent(remaining);
            } else {
                this.renderCodeBlock(this.codeBlockContent, false);
            }
            return;
        }

        let remaining = content;
        while (remaining.length > 0) {
            const startIndex = remaining.indexOf('```');
            if (startIndex !== -1) {
                if (startIndex > 0) this.handleMarkdown(remaining.substring(0, startIndex));
                this.inCodeBlock = true;
                this.codeBlockStartIndex = this.previousContent.length + startIndex;
                this.codeBlockContent = remaining.substring(startIndex + 3);
                const endIndex = this.codeBlockContent.indexOf('```');
                if (endIndex !== -1) {
                    this.renderCodeBlock(this.codeBlockContent.substring(0, endIndex), true);
                    this.codeBlockContent = '';
                    this.codeBlockStartIndex = -1;
                    this.inCodeBlock = false;
                    remaining = this.codeBlockContent.substring(endIndex + 3);
                } else {
                    this.renderCodeBlock(this.codeBlockContent, false);
                    remaining = '';
                }
            } else {
                this.handleMarkdown(remaining);
                remaining = '';
            }
        }
    }

    checkForCompletePrompts = () => {
        const lastWrapper = this.node.aiResponseDiv.lastElementChild;
        if (!lastWrapper?.classList.contains('response-wrapper')) return;

        const lastResponseDiv = lastWrapper.querySelector('.ai-response');
        if (!lastResponseDiv?.dataset.markdown) return;

        const content = lastResponseDiv.dataset.markdown;
        const promptStartIndex = content.indexOf(PROMPT_IDENTIFIER);
        if (promptStartIndex === -1) return;

        const promptEndIndex = content.indexOf(PROMPT_END, promptStartIndex);
        if (promptEndIndex === -1) return;

        const beforePrompt = content.substring(0, promptStartIndex);
        const promptContent = content.substring(promptStartIndex, promptEndIndex + PROMPT_END.length);
        const afterPrompt = content.substring(promptEndIndex + PROMPT_END.length);

        const newContent = beforePrompt + afterPrompt;

        if (newContent.trim() === '') {
            lastWrapper.remove();
        } else {
            lastResponseDiv.dataset.markdown = newContent;
            lastResponseDiv.innerHTML = marked.parse(lastResponseDiv.dataset.markdown, { renderer: this.getMarkedRenderer() });
        }

        this.processPromptContent(promptContent);
    }

    restoreResponse(child) {
        const divUserPrompt = child.querySelector('.user-prompt');
        if (divUserPrompt) {
            this.setupUserPrompt(divUserPrompt);
        } else if (child.classList.contains('response-wrapper')) {
            const divResponse = child.querySelector('.ai-response');
            if (divResponse) {
                this.setupAiResponse(child);
                this.reattachTooltips(divResponse);
            }
        } else if (child.classList.contains('code-block-container')) {
            this.setupCodeBlock(child);
        }
    }

    reattachTooltips(divResponse) {
        divResponse.querySelectorAll('a.snippet-ref').forEach(link => {
            if (link.dataset.snippetData) {
                this.tooltip.detachTooltipEvents(link);
                this.tooltip.attachTooltipEvents(link);
            }
        });
    }

    findSnippetData(snippetNumber, source) {
        if (this.node.currentTopNChunks) {
            const snippet = this.node.currentTopNChunks.find(chunk => {
                const [chunkSource, chunkNumber] = chunk.key.split('_chunk_');
                return chunkSource === source && parseInt(chunkNumber) === snippetNumber;
            });
            if (snippet) return { source, relevanceScore: snippet.relevanceScore, text: snippet.text };
        }
        return this.findSnippetDataInPreviousResponses(snippetNumber, source);
    }

    findSnippetDataInPreviousResponses(snippetNumber, source) {
        const recentResponseDivs = Array.from(this.node.aiResponseDiv.querySelectorAll('.ai-response')).slice(-10);
        for (let i = recentResponseDivs.length - 1; i >= 0; i--) {
            const links = recentResponseDivs[i].querySelectorAll('a.snippet-ref');
            for (const link of links) {
                if (!link.dataset.snippetData) continue;
                const snippetDataList = JSON.parse(link.dataset.snippetData);
                const match = snippetDataList.find(s => s.source === source && s.snippetNumber === snippetNumber);
                if (match) return match;
            }
        }
        return null;
    }

    attachSnippetTooltips(aiResponseDiv) {
        aiResponseDiv.querySelectorAll('a').forEach(link => {
            const href = link.getAttribute('href');
            const snippetMatch = link.textContent.match(/^Snippet (\d+(?:,\s*\d+)*)/);
            if (!snippetMatch) return;

            const snippetDataList = snippetMatch[1].split(',')
                .map(Number)
                .map(num => this.findSnippetData(num, href))
                .filter(Boolean);

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
        if (!this.node.aiResponding) return;

        let linkFound = false;
        markdown.split('\n\n\n').forEach((segment, index) => {
            const divResponse = this.getOrCreateResponseDiv(index);
            this.appendMarkdownSegment(divResponse, segment);
            if (!linkFound && divResponse.querySelector('a')) linkFound = true;
        });

        if (linkFound) this.attachSnippetTooltips(this.node.aiResponseDiv);
    }

    appendMarkdownSegment(divResponse, segment) {
        divResponse.dataset.markdown = (divResponse.dataset.markdown || '') + segment;
        const mentionPattern = /(?<=^|\s)@[a-zA-Z0-9._@-]+/g;
        const unescapedMarkdown = divResponse.dataset.markdown.replace(/\\_/g, '_');
        const highlightedSegment = unescapedMarkdown.replace(mentionPattern, match =>
            `<span class="mention">${match}</span>`
        );
        divResponse.innerHTML = marked.parse(highlightedSegment, { renderer: this.getMarkedRenderer() });
    }

    getOrCreateResponseDiv(index) {
        const divLastWrapper = this.node.aiResponseDiv.lastElementChild;
        if (index === 0 && divLastWrapper?.classList.contains('response-wrapper')) {
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
        div.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
        return div;
    }

    getMarkedRenderer() {
        const renderer = new marked.Renderer();
        renderer.image = (href, title, text) => {
            const src = String.isUrl(href) ? href : `path/to/your/images/directory/${href}`;
            return `<img src="${src}" alt="${text}" title="${title || ''}" />`;
        };
        return renderer;
    }

    setupAiResponse(divResponse) {
        const divWrapper = divResponse.closest('.response-wrapper');
        const divHandle = divWrapper.querySelector('.drag-handle');
        makeDivDraggable(divWrapper, 'AI Response', divHandle);
        const classList = divWrapper.classList;
        On.mouseover(divHandle, () => classList.add('hovered'));
        On.mouseout(divHandle, () => classList.remove('hovered'));
    }

    handleUserPrompt(promptContent) {
        if (!promptContent) return;

        const divOuter = Html.new.div();
        divOuter.style.width = '100%';
        divOuter.style.textAlign = 'right';

        const divPrompt = Html.make.div('user-prompt');
        divPrompt.id = 'prompt-' + this.responseCount++;
        divPrompt.contentEditable = false;

        const escapedContent = escapeHtml(promptContent).replace(/\n/g, '<br>');
        divPrompt.innerHTML = escapedContent;

        divOuter.appendChild(divPrompt);
        this.node.aiResponseDiv.appendChild(divOuter);
        this.setupUserPrompt(divPrompt);
    }

    renderCodeBlock(content, isFinal = false, isUserPromptCodeBlock = false) {
        // Parse language and content
        const languageStringEndIndex = content.indexOf('\n');
        const languageString = languageStringEndIndex !== -1 ? content.substring(0, languageStringEndIndex).trim() : '';
        const codeContent = languageStringEndIndex !== -1 ? content.substring(languageStringEndIndex + 1) : content;

        // Remove old block if not final
        if (!isFinal && this.node.lastBlockId) {
            const oldBlock = Elem.byId(this.node.lastBlockId);
            if (oldBlock) oldBlock.parentNode.removeChild(oldBlock);
        }

        // Create or get code block container
        const codeBlockDivId = `code-block-wrapper-${this.node.id}-${this.node.codeBlockCount}`;
        let divExistingContainer = Elem.byId(codeBlockDivId) || (() => {
            const container = Html.make.div('code-block-container');
            container.id = codeBlockDivId;
            this.node.aiResponseDiv.appendChild(container);

            if (isUserPromptCodeBlock) container.classList.add('user-prompt-codeblock');

            const divLanguageLabel = Html.make.div('language-label');
            const divExistingWrapper = Html.make.div('code-block-wrapper custom-scrollbar');
            divExistingWrapper.append(Html.make.pre('code-block'));
            container.append(divLanguageLabel, divExistingWrapper);

            return container;
        })();

        // Update code content with syntax highlighting
        const divExistingWrapper = divExistingContainer.getElementsByClassName('code-block-wrapper')[0];
        const divPre = divExistingWrapper.getElementsByClassName('code-block')[0];
        const codeElement = Html.make.code('language-' + (languageString || this.currentLanguage));
        codeElement.textContent = decodeHTML(encodeHTML(codeContent));
        Prism.highlightElement(codeElement);
        divPre.innerHTML = '';
        divPre.appendChild(codeElement);

        // Setup language label and copy button
        const divLanguageLabel = divExistingContainer.getElementsByClassName('language-label')[0];
        divLanguageLabel.innerText = languageString || this.currentLanguage;
        divLanguageLabel.style.display = 'flex';
        divLanguageLabel.style.justifyContent = 'space-between';
        divLanguageLabel.style.alignItems = 'center';

        const copyButton = Html.make.button('copy-code-btn', "Copy");
        divLanguageLabel.appendChild(copyButton);

        this.setupCodeBlock(divExistingContainer);

        if (isFinal) this.node.codeBlockCount += 1;
        this.node.lastBlockId = isFinal ? null : codeBlockDivId;
    }

    setupUserPrompt(divPrompt) {
        makeDivDraggable(divPrompt, 'Prompt');
        let isEditing = false;

        const handleKeyDown = (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.removeResponsesUntil(divPrompt.id);
                const message = divPrompt.textContent;
                Logger.debug(`Sending message: "${message}"`);
                AiNode.sendMessage(this.node, message);
            }
        };

        const toggleEditMode = (activate, e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }

            isEditing = activate;
            divPrompt.classList[activate ? 'add' : 'remove']('editing');
            divPrompt.contentEditable = activate;
            divPrompt.style.cursor = activate ? 'text' : 'move';
            divPrompt.style.backgroundColor = activate ? 'inherit' : '';
            divPrompt.style.color = activate ? '#bbb' : '';

            if (activate) {
                divPrompt.removeAttribute('draggable');
                divPrompt.style.textDecoration = 'none';
                divPrompt.style.outline = 'none';
                divPrompt.style.border = 'none';
                divPrompt.focus();
                On.keydown(divPrompt, handleKeyDown);
                On.dragstart(divPrompt, () => false);
            } else {
                makeDivDraggable(divPrompt, 'Prompt');
                On.dragstart(divPrompt, () => isEditing ? false : null);
                Off.keydown(divPrompt, handleKeyDown);
            }
        };

        divPrompt.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
        });
        On.blur(divPrompt, () => isEditing && toggleEditMode(false));
        On.dblclick(divPrompt, (e) => toggleEditMode(!isEditing, e));
    }

    setupCodeBlock(divCodeBlock) {
        const divLanguageLabel = divCodeBlock.querySelector('.language-label');
        const copyButton = divCodeBlock.querySelector('.copy-code-btn');
        const decodedContent = divCodeBlock.querySelector('.code-block');

        makeDivDraggable(divCodeBlock, 'Code Block', divLanguageLabel);

        On.click(copyButton, () => {
            const textarea = Html.new.textarea();
            textarea.value = decodedContent.textContent;
            document.body.appendChild(textarea);
            textarea.select();

            if (document.execCommand('copy')) {
                copyButton.innerText = "Copied!";
                Promise.delay(1200).then(() => copyButton.innerText = "Copy");
            }
            document.body.removeChild(textarea);
        });

        On.mouseover(divCodeBlock, (e) => {
            if (e.target === divLanguageLabel || e.target === copyButton) {
                divCodeBlock.classList.add('hovered');
            }
        });

        On.mouseout(divCodeBlock, (e) => {
            if (e.target === divLanguageLabel || e.target === copyButton) {
                divCodeBlock.classList.remove('hovered');
            }
        });
    }

    removeLastResponse() {
        // Handle div removal
        const prompts = this.node.aiResponseDiv.querySelectorAll('.user-prompt');
        const lastPrompt = prompts[prompts.length - 1];
        const lastPromptId = lastPrompt ? lastPrompt.id : null;

        if (lastPrompt) {
            while (this.node.aiResponseDiv.lastChild !== lastPrompt.parentNode) {
                this.node.aiResponseDiv.removeChild(this.node.aiResponseDiv.lastChild);
            }
            this.node.aiResponseDiv.removeChild(lastPrompt.parentNode);
        }

        // Handle textarea content
        const lines = this.node.aiResponseTextArea.value.split('\n');
        let lastPromptIndex = lines.length - 1;
        while (lastPromptIndex >= 0 && !lines[lastPromptIndex].startsWith(PROMPT_IDENTIFIER)) {
            lastPromptIndex -= 1;
        }

        if (lastPromptIndex >= 0) {
            lines.length = lastPromptIndex;
            this.node.aiResponseTextArea.value = lines.join('\n');
            this.previousContentLength = this.node.aiResponseTextArea.value.length;
        }

        // Reset code block state if needed
        if (this.inCodeBlock) {
            this.inCodeBlock = false;
            this.codeBlockContent = '';
            this.codeBlockStartIndex = -1;
            this.currentLanguage = "javascript";

            const divCodeBlock = Elem.byId(`code-block-wrapper-${this.node.id}-${this.node.codeBlockCount}`);
            if (divCodeBlock) divCodeBlock.parentNode.removeChild(divCodeBlock);

            const codeBlockStartLine = this.node.aiResponseTextArea.value.lastIndexOf("```", this.previousContentLength);
            if (codeBlockStartLine >= 0) {
                this.node.aiResponseTextArea.value = this.node.aiResponseTextArea.value.substring(0, codeBlockStartLine);
                this.previousContentLength = this.node.aiResponseTextArea.value.length;
            }
        }

        this.handleInput();
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
