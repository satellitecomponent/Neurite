
// Function to handle click, drag, and scroll events on the node panel
function handlePanelEvent(event) {
    event.stopPropagation(); // Prevents the event from bubbling up to parent elements
}

// Add event listeners to the node panel for different events
nodePanel.addEventListener('click', handlePanelEvent);
nodePanel.addEventListener('mousedown', handlePanelEvent); // For drag (mousedown)
nodePanel.addEventListener('wheel', handlePanelEvent);     // For scroll (wheel event)

const functionCallPanel = nodePanel.querySelector('.function-call-panel');


const functionLoadingIcon = document.getElementById('functionLoadingIcon');
const functionErrorIcon = document.getElementById('functionErrorIcon');
const functionPrompt = document.getElementById('function-prompt');
//buttons

const functionSendButton = document.getElementById('function-send-button');
const functionRegenButton = document.getElementById('function-regen-button');


CodeMirror.defineMode("jsCodeBlocks", function (config, parserConfig) {
    var jsMode = CodeMirror.getMode(config, { name: "javascript" });
    var overlay = {
        token: function (stream, state) {
            if (stream.match("```")) {
                state.inCodeBlock = !state.inCodeBlock;
                return null;
            }
            if (state.inCodeBlock) {
                return jsMode.token(stream, state.jsState);
            }
            while (stream.next() != null && !stream.match('```', false)) { }
            return null;
        },
        startState: function () {
            return {
                inCodeBlock: false,
                jsState: CodeMirror.startState(jsMode)
            };
        }
    };
    return CodeMirror.overlayMode(jsMode, overlay);
});

const neuriteFunctionCM = CodeMirror.fromTextArea(document.getElementById('neurite-function-cm'), {
    mode: "jsCodeBlocks",  // Set the custom mode
    lineNumbers: false,
    lineWrapping: true,
    scrollbarStyle: 'simple',
    theme: 'default',
    // Additional CodeMirror options as required
});

// Add class to the CodeMirror wrapper
neuriteFunctionCM.display.wrapper.classList.add('neurite-function-cm-style');
// Function to update the content of the CodeMirror instance
function updateNeuriteFunctionCMContent(content) {
    neuriteFunctionCM.setValue(content);
    neuriteFunctionCM.refresh();
}




const functionSendSvg = functionSendButton.querySelector('svg');
functionSendButton.addEventListener('click', () => {
    requestFunctionCall();
});


// Function to toggle the visibility of the function call panel
function toggleFunctionCallPanel() {
    console.log('Toggle function called');

    if (functionCallPanel.classList.contains('hidden')) {
        // Expand the panel
        functionCallPanel.style.display = 'block'; // Temporarily display it to calculate height
        const height = functionCallPanel.scrollHeight + 'px';
        functionCallPanel.style.height = '0px'; // Reset before animation
        setTimeout(() => {
            functionCallPanel.style.height = height;
            functionCallPanel.classList.remove('hidden');
        }, 10); // Start the expand animation
    } else {
        // Start collapse animation
        functionCallPanel.style.height = '0px';
        // Update the class immediately
        functionCallPanel.classList.add('hidden');

        // Wait for transition to complete before setting display: none
        functionCallPanel.addEventListener('transitionend', () => {
            if (functionCallPanel.classList.contains('hidden')) {
                functionCallPanel.style.display = 'none'; // Hide after animation
            }
        }, { once: true });
    }
}

// Initialize the function call panel as hidden on startup
document.addEventListener('DOMContentLoaded', () => {
    functionCallPanel.style.height = '0px'; // Set initial height to 0
    functionCallPanel.classList.add('hidden');
});


async function runNeuriteCode() {
    const code = neuriteFunctionCM.getValue();
    const codeBlocks = extractCodeBlocks(code);
    const codeToRun = codeBlocks.length > 0 ? codeBlocks.join('\n') : code;

    clearActiveStates();

    try {
        eval(codeToRun);
        //onFunctionCalled('Custom Code', 'Executed Successfully');
        addFunctionCallItem(generateTitleForCode(codeToRun), code);
        neuriteFunctionCM.setValue(''); // Clear the CodeMirror
    } catch (error) {
        console.error('Error executing code:', error);
        addFunctionCallItem(`Error: ${error.message}`, code, true); // Set isError to true
        neuriteFunctionCM.setValue(''); // Clear the CodeMirror
    }
}

function addFunctionCallItem(functionName, code, isError = false) {
    const item = document.createElement('div');
    item.textContent = `${functionName}`;
    item.originalText = code;

    // Add a specific class if it's an error
    if (isError) {
        item.classList.add('error-item');

        const errorIcon = document.getElementById('funcErrorIcon').cloneNode(true);
        errorIcon.style.display = 'inline-block';
        errorIcon.classList.add('func-error-icon'); // Add a class for styling

        item.insertBefore(errorIcon, item.firstChild);
    }

    // Hover events
    item.addEventListener('mouseenter', () => {
        item.classList.add('hover-state');
        if (isError) {
            item.classList.add('error-hover-state'); // Add error-specific hover state
        }
    });
    item.addEventListener('mouseleave', () => {
        item.classList.remove('hover-state');
        if (isError) {
            item.classList.remove('error-hover-state'); // Remove error-specific hover state
        }
    });

    item.addEventListener('click', () => {
        if (item.classList.contains('active-state')) {
            clearActiveStates();
        } else {
            // If the item is not active, set it to active and clear other active states
            clearActiveStates();
            item.classList.add('active-state');
            if (isError) {
                item.classList.add('error-active-state'); // Add error-specific active state
            }
        }
    });

    // Append the item to the list
    functionCallList.appendChild(item);

    // Scroll the newly added item into view
    item.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

// Function to clear active states from all items
function clearActiveStates() {
    const items = functionCallList.querySelectorAll('div');
    items.forEach(item => {
        item.classList.remove('active-state');
        item.classList.remove('error-active-state'); // Add this line
    });
}

function generateTitleForCode(code) {
    // Extract the first line of the code
    const firstLine = code.split('\n')[0].trim();

    let title;
    if (firstLine.startsWith('/*')) {
        // Find the closing */ for block comments
        const endCommentIndex = code.indexOf('*/');
        if (endCommentIndex !== -1) {
            // Extract the comment, removing /* and */
            title = code.substring(2, endCommentIndex).trim();
        } else {
            // If there's no closing */, use the whole line
            title = firstLine.slice(2).trim();
        }
    } else if (firstLine.startsWith('//')) {
        // Extract single-line comment, removing //
        title = firstLine.slice(2).trim();
    } else {
        // Use the first line as is
        title = firstLine;
    }

    // If no title is extracted, use a default title with timestamp
    return title || `${new Date().toLocaleString()}`;
}

const functionRunButton = document.getElementById('function-run-button');
functionRunButton.addEventListener('click', runNeuriteCode);

const functionCallList = document.querySelector('.function-call-list');

functionCallList.addEventListener('click', function (event) {
    // Check if the clicked target is a div
    if (event.target.tagName === 'DIV') {
        if (event.target.classList.contains('active-state')) {
            neuriteFunctionCM.setValue('');
            // If the div becomes active, repopulate the CodeMirror
            const originalText = event.target.originalText;
            if (originalText) {
                updateNeuriteFunctionCMContent(originalText);
            }
        } else {
            // Clear the CodeMirror content if the div is not active
            neuriteFunctionCM.setValue('');
        }
    }
});



function extractCodeBlocks(code) {
    // Regular expression to match code blocks enclosed in triple backticks, ignoring any language label
    const blockDelimiter = /```.*?\n([\s\S]*?)```/g;
    const matches = code.match(blockDelimiter) || [];
    return matches.map(block => {
        // Extract the content within the backticks, excluding the language label
        const contentMatch = block.match(/```.*?\n([\s\S]*?)```/);
        return contentMatch ? contentMatch[1].trim() : '';
    });
}