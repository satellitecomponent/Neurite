
// Function to handle various events on the node panel
function handlePanelEvent(event) {
    cancel(event); // Prevents the event from bubbling up to parent elements
}

function handlePanelMouseMove(event) {
    // Check if the event target is inside the functionCallPanel
    if (functionCallPanel.contains(event.target)) {
        // If the event is inside functionCallPanel, don't stop its propagation
        return;
    }

    // For all other elements, stop propagation
    cancel(event);
}

// Add event listeners to the node panel for different types of events
nodePanel.addEventListener('click', handlePanelEvent);
nodePanel.addEventListener('mousedown', handlePanelEvent); // For drag (mousedown)
nodePanel.addEventListener('mousemove', handlePanelMouseMove);
nodePanel.addEventListener('wheel', handlePanelEvent);     // For scroll (wheel event)
nodePanel.addEventListener('dragstart', handlePanelEvent); // Prevents dragging from propagating
nodePanel.addEventListener('dragend', handlePanelEvent);   // Optional, handle end of drag

const functionLoadingIcon = document.getElementById('functionLoadingIcon');
const functionErrorIcon = document.getElementById('functionErrorIcon');

//buttons

const functionSendButton = document.getElementById('function-send-button');
const functionRegenButton = document.getElementById('function-regen-button');


CodeMirror.defineMode("ignoreCodeBlocks", function (config) {
    var jsMode = CodeMirror.getMode(config, { name: "javascript" });

    return {
        token: function (stream, state) {
            // Skip code block markers
            if (stream.match("```")) {
                stream.skipToEnd();
                return null;
            }

            // Extract and match the next word token
            if (stream.match(/^\w+/)) {
                var currentToken = stream.current();
                if (functionNameList.includes(currentToken)) {
                    return "neurite-function-name"; // Custom style for function names
                }
                stream.backUp(currentToken.length); // Back up to reprocess this token in jsMode
            }

            // Use JavaScript mode for all other text
            return jsMode.token(stream, state.jsState);
        },
        startState: function () {
            return {
                jsState: CodeMirror.startState(jsMode)
            };
        },
        copyState: function (state) {
            return {
                jsState: CodeMirror.copyState(jsMode, state.jsState)
            };
        },
        // Other necessary methods from jsMode (if needed)
    };
});

const neuriteFunctionCM = CodeMirror.fromTextArea(document.getElementById('neurite-function-cm'), {
    mode: "ignoreCodeBlocks", // Use the custom mode
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

let userScrolledUpFunctionPanel = false;

// Scroll event listener
neuriteFunctionCM.on("scroll", function () {
    var scrollInfo = neuriteFunctionCM.getScrollInfo();
    var atBottom = scrollInfo.height - scrollInfo.top - scrollInfo.clientHeight < 1;
    userScrolledUpFunctionPanel = !atBottom;
});

// Change event listener
neuriteFunctionCM.on("change", function () {
    if (!userScrolledUpFunctionPanel) {
        // Scroll to the bottom
        var scrollInfo = neuriteFunctionCM.getScrollInfo();
        neuriteFunctionCM.scrollTo(null, scrollInfo.height);
    }
});


// Global log collector
let logCollector = [];

function runNeuriteCode() {
    const code = neuriteFunctionCM.getValue();
    const codeBlocks = extractCodeBlocks(code);
    const codeToRun = codeBlocks.length > 0 ? codeBlocks.join('\n') : code;

    clearActiveStates();

    // Generate the default title and initialize the log collector
    const defaultTitle = generateTitleForCode(codeToRun);
    logCollector = [defaultTitle];

    // Custom log function
    function customLog(...args) {
        const logOutput = args.map(arg => {
            if (arg instanceof Error) {
                return `<span class="error-log">${arg.message}</span>`;
            } else if (typeof arg === 'object') {
                return JSON.stringify(arg);
            } else {
                return String(arg);
            }
        }).join(' ');
        logCollector.push(logOutput);
        updateTitleWithLogs();
    }

    // Function to update title based on collected logs
    function updateTitleWithLogs() {
        const title = logCollector.join(' \n');
        updateFunctionCallItem(title, itemId);
    }

    let itemId;

    // Save the original window.onerror
    const originalOnError = window.onerror;

    // Set up a global error handler
    window.onerror = function (message, source, lineno, colno, error) {
        customLog(`${message}`, error);
        return false;
    };

    try {
        // Setup custom console
        const customCodeToRun = `(function(originalConsole, customLog) {
            const console = {
                ...originalConsole,
                log: function(...args) {
                    originalConsole.log(...args);
                    customLog(...args);
                },
                error: function(...args) {
                    originalConsole.error(...args);
                    customLog(...args);
                }
            };
            ${codeToRun}
        })(console, customLog);`;

        const result = eval(customCodeToRun);
        itemId = addFunctionCallItem(defaultTitle, code);

        // Handle the final result
        if (result !== undefined) {
            logCollector.push(JSON.stringify(result));
        }
    } catch (error) {
        console.error('Error executing code:', error);
        itemId = addFunctionCallItem(`${error.message}`, code, true);
    }

    // Cleanup
    window.onerror = originalOnError;
    updateTitleWithLogs();
    neuriteFunctionCM.setValue('');
}

// Function to update the UI with the current title
function updateFunctionCallItem(title, itemId, error = null) {
    const item = document.querySelector(`[data-item-id="${itemId}"]`);

    if (item) {
        // Update the innerHTML of the item
        item.innerHTML = title.replace(/\n/g, '<br>');

        // Update callData with the new title
        const callData = JSON.parse(item.getAttribute('data-call-data'));
        callData.functionName = title.replace(/<br>/g, '\n'); // Convert <br> back to \n for the data structure
        item.setAttribute('data-call-data', JSON.stringify(callData));

        // Style error logs if there's an error
        if (error) {
            const errorLogs = item.getElementsByClassName('error-log');
            for (const errorLog of errorLogs) {
                errorLog.style.color = '#cb1b1b'; // Style for error logs
            }
        }

        item.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
}


function formatResultAsTitle(result) {
    let titleString;

    if (typeof result === 'object' && result !== null) {
        try {
            titleString = JSON.stringify(result);
        } catch {
            titleString = '[Complex Object]';
        }
    } else if (typeof result === 'undefined') {
        titleString = 'undefined';
    } else if (typeof result === 'symbol') {
        titleString = 'Symbol';
    } else if (typeof result === 'bigint') {
        titleString = `BigInt (${result.toString()})`;
    } else if (Array.isArray(result)) {
        titleString = '[Array]';
    } else if (typeof result === 'function') {
        titleString = `Function ${result.name || '(anonymous)'}`;
    } else if (result instanceof Error) {
        titleString = `Error (${result.message})`;
    } else {
        titleString = result.toString();
    }

    // Truncate the title if it's too long
    if (titleString.length > 200) {
        titleString = titleString.substring(0, 197) + '...';
    }

    return `Result: ${titleString}`;
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function addFunctionCallItem(functionName, code, isError = false) {
    const currentCoords = neuriteGetMandelbrotCoords(); // Get current coordinates

    const item = document.createElement('div');
    item.classList.add('function-call-item');

    // Generate a UUID for the item
    const itemId = generateUUID(); // Implement this function to generate a UUID
    item.setAttribute('data-item-id', itemId);

    // Replace newline characters with <br> tags for HTML rendering
    const formattedFunctionName = functionName.replace(/\n/g, '<br>');
    item.innerHTML = formattedFunctionName;
    item.originalText = code;

    // Store code along with the current zoom and pan
    const callData = {
        code: code,
        zoom: currentCoords.zoom,
        pan: currentCoords.pan,
        functionName: functionName
    };
    item.setAttribute('data-call-data', JSON.stringify(callData));

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

    functionCallList.appendChild(item);
    item.scrollIntoView({ behavior: 'smooth', block: 'end' });

    // Return the UUID for further reference
    return itemId;
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
    // Regular expressions for block and line comments
    const blockCommentRegex = /\/\*([\s\S]*?)\*\//;
    const lineCommentRegex = /\/\/(.*)/;

    // Find matches for both comment types
    const blockMatch = code.match(blockCommentRegex);
    const lineMatch = code.match(lineCommentRegex);

    // Determine the positions of the matches
    const blockCommentPos = blockMatch ? blockMatch.index : -1;
    const lineCommentPos = lineMatch ? code.indexOf(lineMatch[0]) : -1;

    // Use the comment that appears first in the code
    let title;
    if (blockCommentPos !== -1 && (blockCommentPos < lineCommentPos || lineCommentPos === -1)) {
        title = blockMatch[1].trim();
    } else if (lineCommentPos !== -1) {
        title = lineMatch[1].trim();
    }

    // If no title is extracted, use a default title with timestamp
    return title || `Code executed at ${new Date().toLocaleString()}`;
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