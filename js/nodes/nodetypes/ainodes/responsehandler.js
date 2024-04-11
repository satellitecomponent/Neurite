

// Update handleUserPrompt, handleMarkdown, and renderCodeBlock to make the created divs draggable
function makeDivDraggable(div, customTitle, handle) {
    handle = handle || div; // Default to the div itself if no handle is provided

    handle.addEventListener('mousedown', function () {
        // When the mouse button is pressed down, make the div draggable
        div.setAttribute('draggable', 'true');
    });

    handle.addEventListener('mouseup', function () {
        // When the mouse button is released, make the div non-draggable
        div.setAttribute('draggable', 'false');
    });

    div.addEventListener('dragstart', function (event) {
        event.dataTransfer.setData('text/plain', JSON.stringify([customTitle, div.innerText]));
    });

    // When dragging ends, make sure the div is non-draggable
    div.addEventListener('dragend', function () {
        div.setAttribute('draggable', 'false');
    });
}


//Handles Ai node conversation parsing for Prismjs and a div css.
//Creates div class, user-prompt, ai-response, code-block
class ResponseHandler {
    constructor(node) {
        this.node = node;
        this.previousContent = "";
        this.inCodeBlock = false;
        this.codeBlockContent = '';
        this.codeBlockStartIndex = -1;
        this.currentLanguage = "javascript";
        this.node.codeBlockCount = 0;
        this.processingQueue = Promise.resolve();
        this.previousContentLength = 0;
        this.responseCount = 0;
        this.currentResponseEnded = false

            // Attach the input event listener for new input
            this.node.aiResponseTextArea.addEventListener('input', () => {
                this.processingQueue = this.processingQueue.then(() => this.handleInput());
            });
    }

    restoreAiResponseDiv() {
        // Iterate through each child element in the AI response div
        const children = this.node.aiResponseDiv.children;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];

            // Check if the child contains a user-prompt div
            const userPromptDiv = child.querySelector('.user-prompt');
            if (userPromptDiv) {
                // Initialize the user prompt div found within the child
                this.initUserPromptDiv(userPromptDiv);
            } else if (child.classList.contains('response-wrapper')) {
                // For AI responses, find the .ai-response div within the wrapper
                const responseDiv = child.querySelector('.ai-response');
                if (responseDiv) {
                    this.initAiResponseDiv(child); // Pass the wrapper div
                }
            } else if (child.classList.contains('code-block-container')) {
                // For code blocks, pass the container div
                this.initCodeBlockDiv(child);
            }
        }
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

            if (newContent.trim() === "") {
                newContent = newContent.replace(/ /g, "&nbsp;");
            }
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
                            this.renderCodeBlock(segment, false, true); // Odd segments are code blocks within user prompts
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
                        let endOfLanguageStringIndex = this.codeBlockContent.indexOf('\n');
                        if (endOfLanguageStringIndex !== -1) {
                            let languageString = this.codeBlockContent.substring(0, endOfLanguageStringIndex).trim();
                            if (languageString.length > 0) {
                                this.currentLanguage = languageString;
                            }
                        }
                        this.renderCodeBlock(this.codeBlockContent);
                        newContent = '';
                    }
                }


                if (newContent.length > 0) {
                    let startOfCodeBlockIndex = trimmedNewContent.indexOf('```');
                    if (startOfCodeBlockIndex !== -1) {
                        let markdown = newContent.substring(0, startOfCodeBlockIndex);
                        this.handleMarkdown(markdown);

                        this.inCodeBlock = true;
                        this.codeBlockStartIndex = this.previousContent.length + startOfCodeBlockIndex;
                        this.codeBlockContent = trimmedNewContent.substring(startOfCodeBlockIndex + 3);
                    } else if (!trimmedNewContent.startsWith('```') && !trimmedNewContent.endsWith('```')) {
                        this.handleMarkdown(newContent);
                    }
                }
            }

            this.previousContent = content;
            this.previousContentLength = this.previousContent.length;

        } catch (error) {
            console.error('Error while processing markdown:', error);
        }
    }

    handleUserPrompt(promptContent) {
        if (!promptContent) return;
        // Create a new div for the outer container
        let outerDiv = document.createElement('div');
        outerDiv.style.width = '100%';
        outerDiv.style.textAlign = 'right';

        // Create a new div for the user prompt
        let promptDiv = document.createElement('div');
        promptDiv.className = 'user-prompt';
        promptDiv.id = `prompt-${this.responseCount}`;  // Assign a unique ID to each prompt
        promptDiv.contentEditable = false; // Set contentEditable to false when the promptDiv is created


        promptDiv.textContent = promptContent;

        // Append the prompt div to the outer div
        outerDiv.appendChild(promptDiv);

        // Append the outer div to the response area
        this.node.aiResponseDiv.appendChild(outerDiv);

        this.initUserPromptDiv(promptDiv)

        this.responseCount++;  // Increment the response count after each prompt
    }

    handleMarkdown(markdown) {
        if ((this.node.aiResponding || this.node.localAiResponding) && markdown.trim().length > 0) {
            let sanitizedMarkdown = DOMPurify.sanitize(markdown);
            let lastWrapperDiv = this.node.aiResponseDiv.lastElementChild;
            let responseDiv;

            if (lastWrapperDiv && lastWrapperDiv.classList.contains('response-wrapper')) {
                responseDiv = lastWrapperDiv.querySelector('.ai-response');
            } else {
                let handleDiv = document.createElement('div');
                handleDiv.className = 'drag-handle';
                handleDiv.innerHTML = `
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
            `;

                responseDiv = document.createElement('div');
                responseDiv.className = 'ai-response';

                let wrapperDiv = document.createElement('div');
                wrapperDiv.className = 'response-wrapper';
                wrapperDiv.appendChild(handleDiv);
                wrapperDiv.appendChild(responseDiv);

                

                this.node.aiResponseDiv.appendChild(wrapperDiv);

                this.initAiResponseDiv(responseDiv);
            }

            responseDiv.innerHTML += sanitizedMarkdown.replace(/\n/g, "<br>");
        }
    }

    renderCodeBlock(content, isFinal = false, isUserPromptCodeBlock = false) {
        let encodedContent = encodeHTML(content);
        let cleanedContent = encodedContent.split('\n').slice(1).join('\n');
        let decodedContent = decodeHTML(cleanedContent);

        if (!isFinal && this.node.lastBlockId) {
            let oldBlock = document.getElementById(this.node.lastBlockId);
            if (oldBlock) {
                oldBlock.parentNode.removeChild(oldBlock);
            }
        }

        let codeBlockDivId = `code-block-wrapper-${this.node.id}-${this.node.codeBlockCount}`;

        let existingContainerDiv = document.getElementById(codeBlockDivId);

        if (!existingContainerDiv) {
            existingContainerDiv = document.createElement('div');
            existingContainerDiv.id = codeBlockDivId;
            existingContainerDiv.className = "code-block-container";
            this.node.aiResponseDiv.appendChild(existingContainerDiv);

            // Add a specific identifier or class for user-prompt code blocks
            if (isUserPromptCodeBlock) {
                existingContainerDiv.classList.add('user-prompt-codeblock');
            }

            let languageLabelDiv = document.createElement('div');
            languageLabelDiv.className = "language-label";
            existingContainerDiv.appendChild(languageLabelDiv);

            let existingWrapperDiv = document.createElement('div');
            existingWrapperDiv.className = "code-block-wrapper custom-scrollbar";
            existingContainerDiv.appendChild(existingWrapperDiv);

            let preDiv = document.createElement('pre');
            preDiv.className = "code-block";
            existingWrapperDiv.appendChild(preDiv);
        }

        let existingWrapperDiv = existingContainerDiv.getElementsByClassName('code-block-wrapper')[0];
        let preDiv = existingWrapperDiv.getElementsByClassName('code-block')[0];

        let codeElement = document.createElement("code");
        codeElement.className = `language-${this.currentLanguage}`;
        codeElement.textContent = decodedContent;

        Prism.highlightElement(codeElement);

        preDiv.innerHTML = '';
        preDiv.appendChild(codeElement);

        let languageLabelDiv = existingContainerDiv.getElementsByClassName('language-label')[0];
        languageLabelDiv.innerText = this.currentLanguage;
        languageLabelDiv.style.display = 'flex';
        languageLabelDiv.style.justifyContent = 'space-between';
        languageLabelDiv.style.alignItems = 'center';

        let copyButton = document.createElement('button');
        copyButton.innerText = 'Copy';
        copyButton.className = 'copy-btn';

        languageLabelDiv.appendChild(copyButton);

        this.initCodeBlockDiv(existingContainerDiv);

        if (isFinal) {
            this.node.codeBlockCount++;
            this.node.lastBlockId = null;
        } else {
            this.node.lastBlockId = codeBlockDivId;
        }
    }

    setupUserPrompt(promptDiv) {
        // Make the prompt div draggable
        makeDivDraggable(promptDiv, 'Prompt');

        let isEditing = false; // Flag to check if user is editing the content

        let handleKeyDown = function (event) {
            if (event.key === 'Enter' && event.shiftKey) {
                event.preventDefault();
                this.removeResponsesUntil(promptDiv.id);

                // Get the HTML content of the promptDiv
                let message = promptDiv.innerHTML;

                //console.log(`Sending message: "${message}"`);
                sendLLMNodeMessage(this.node, message);
            }
        }.bind(this);

        // Set an onBlur event handler to handle when the div loses focus
        promptDiv.addEventListener('blur', function () {
            // If the div is in editing mode
            if (isEditing) {
                // Remove the .editing class
                promptDiv.classList.remove('editing');
                // Set contentEditable to false when div loses focus
                promptDiv.contentEditable = false;

                // Reset isEditing
                isEditing = false;

                // Reset styles to non-editing state
                promptDiv.style.backgroundColor = "#b799ce";
                promptDiv.style.color = "#222226";

                // Reset the cursor style to move
                promptDiv.style.cursor = "move";

                // Make the div draggable
                makeDivDraggable(promptDiv, 'Prompt');
                promptDiv.ondragstart = function () { return isEditing ? false : null; };

                // Remove the keydown event listener
                promptDiv.removeEventListener('keydown', handleKeyDown);
            }
        }.bind(this));

        // Add a double click listener to the prompt div
        promptDiv.addEventListener('dblclick', function (event) {
            // Prevent the default action of double click
            event.preventDefault();

            // Toggle isEditing
            isEditing = !isEditing;

            if (isEditing) {
                // Add the .editing class
                promptDiv.classList.add('editing');
                // Set contentEditable to true when entering edit mode
                promptDiv.contentEditable = true;

                // Remove draggable attribute
                promptDiv.removeAttribute('draggable');

                // Set the cursor style to text
                promptDiv.style.cursor = "text";

                // Set the background and text color to match original, remove inherited text decoration
                promptDiv.style.backgroundColor = "inherit";
                promptDiv.style.color = "#bbb";
                promptDiv.style.textDecoration = "none";
                promptDiv.style.outline = "none";
                promptDiv.style.border = "none";

                // Focus the div
                promptDiv.focus();

                // Add the keydown event listener when the promptDiv enters edit mode
                promptDiv.addEventListener('keydown', handleKeyDown);

                // Set promptDiv non-draggable
                promptDiv.ondragstart = function () { return false; };
            } else {
                // Remove the .editing class
                promptDiv.classList.remove('editing');
                // Set contentEditable to false when leaving edit mode
                promptDiv.contentEditable = false;


                // Handle leaving edit mode
                promptDiv.style.backgroundColor = "#b799ce";
                promptDiv.style.color = "#222226";

                // Set the cursor style to move
                promptDiv.style.cursor = "move";

                makeDivDraggable(promptDiv, 'Prompt');
                promptDiv.ondragstart = function () { return isEditing ? false : null; };
                promptDiv.removeEventListener('keydown', handleKeyDown);
            }

        }.bind(this));
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
        const lines = this.node.aiResponseTextArea.value.split("\n");

        // Find the index of the last "Prompt:"
        let lastPromptIndex = lines.length - 1;
        while (lastPromptIndex >= 0 && !lines[lastPromptIndex].startsWith(`${PROMPT_IDENTIFIER}`)) {
            lastPromptIndex--;
        }

        // Remove all lines from the last "Prompt:" to the end
        if (lastPromptIndex >= 0) {
            lines.length = lastPromptIndex;
            this.node.aiResponseTextArea.value = lines.join("\n");
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
            let codeBlockDiv = document.getElementById(`code-block-wrapper-${this.node.id}-${this.node.codeBlockCount}`);
            if (codeBlockDiv) {
                codeBlockDiv.parentNode.removeChild(codeBlockDiv);
            }

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
document.getElementById("localLLM").addEventListener("change", function () {
    let llmNodes = document.querySelectorAll("[id^=dynamicLocalLLMselect-]");
    for (let i = 0; i < llmNodes.length; i++) {
        let selectContainer = llmNodes[i].closest('.select-container');  // Find the closest parent .select-container

        if (this.checked) {
            selectContainer.style.display = "block";
        } else {
            selectContainer.style.display = "none";
        }
    }
});
*/