const promptLibrary = JSON.parse(localStorage.getItem('promptLibrary')) || {
    prompts: [
        {
            title: 'Neurite',
            content: `neurite.network unleashes a new dimension of digital interface...
...the fractal dimension.

Bridging Fractals and Thought
Drawing from chaos theory and graph theory, Neurite unveils the hidden patterns and intricate connections that shape creative thinking.

For over a year, we've been iterating out a virtually limitless workspace that blends the mesmerizing complexity of fractals with contemporary mind mapping technique.

Why Fractals?
The Mandelbrot Set is not just an aesthetic choice - fractal logic is ingrained into a countless number of natural and constructed phenomena - from polynomial equations, to art and music - even the cosmic web.

Fractals act as the cross-disciplinary framework for non-integer dimensional thought - where conventional notions of 4D spacetime are put into question.

The goal of this project is to grow agentic graphs of fractal creativity & collaboration.

Why Nodes?
Nodes represent text, images, videos, code, and AI agents. Together, they thread a personalized microcosm of your thoughts and inspirations.
neurite.network connects physics simulation of graphs with an underlying fractal topology to kinematically define interactive, iterative, and modular graphs of ideation.` }
    ],
    currentPromptIndex: -1
};

function openPromptLibrary(node) {
    Modal.open('promptLibraryModalContent');
    renderPromptList();
    setupPromptLibraryListeners(node);

    // Select the first prompt by default if none is selected
    if (promptLibrary.currentPromptIndex === -1 && promptLibrary.prompts.length > 0) {
        selectPrompt(0);
    } else if (promptLibrary.currentPromptIndex !== -1) {
        // Ensure the current prompt is visually selected
        selectPrompt(promptLibrary.currentPromptIndex);
    }
}

function renderPromptList() {
    const promptList = document.querySelector('.prompt-list');
    promptList.innerHTML = '';
    promptLibrary.prompts.forEach((prompt, index) => {
        const listItem = Html.new.div();
        const className = (index === promptLibrary.currentPromptIndex ? 'selected' : '');
        const input = Html.make.input(className);
        input.value = prompt.title;
        On.click(input, selectPrompt.bind(null, index));
        On.change(input, (e)=>updatePromptTitle(index, e.target.value) );
        listItem.appendChild(input);
        promptList.appendChild(listItem);
    });
}

function selectPrompt(index) {
    if (index >= 0 && index < promptLibrary.prompts.length) {
        promptLibrary.currentPromptIndex = index;

        const inputs = document.querySelectorAll('.prompt-list input');
        inputs.forEach((input, i) => {
            if (i === index) {
                input.classList.add('selected');
            } else {
                input.classList.remove('selected');
            }
        });

        const textarea = document.querySelector('.prompt-content-textarea');
        if (textarea) {
            textarea.value = promptLibrary.prompts[index].content;
        } else {
            Logger.err("Prompt content textarea not found")
        }
    } else {
        promptLibrary.currentPromptIndex = -1;
        const textarea = document.querySelector('.prompt-content-textarea');
        if (textarea) {
            textarea.value = '';
        }
        // Deselect all prompts in the list
        const inputs = document.querySelectorAll('.prompt-list input');
        inputs.forEach(input => input.classList.remove('selected'));
    }
}

// Function to save the entire promptLibrary to localStorage
function savePromptLibrary() {
    localStorage.setItem('promptLibrary', JSON.stringify(promptLibrary));
}

// Modify functions that change the promptLibrary to save after changes
function updatePromptTitle(index, newTitle) {
    promptLibrary.prompts[index].title = newTitle;
    savePromptLibrary();
}

function addNewPrompt() {
    promptLibrary.prompts.push({ title: 'New Prompt', content: '' });
    renderPromptList();
    selectPrompt(promptLibrary.prompts.length - 1);
    savePromptLibrary();
}

function deleteCurrentPrompt() {
    if (promptLibrary.currentPromptIndex !== -1 && promptLibrary.prompts.length > 0) {
        const currentIndex = promptLibrary.currentPromptIndex;
        promptLibrary.prompts.splice(currentIndex, 1);

        // Determine the new index to select
        let newIndex;
        if (promptLibrary.prompts.length === 0) {
            newIndex = -1;
        } else if (currentIndex >= promptLibrary.prompts.length) {
            newIndex = promptLibrary.prompts.length - 1;
        } else {
            newIndex = currentIndex;
        }

        promptLibrary.currentPromptIndex = newIndex;

        renderPromptList();
        selectPrompt(newIndex);
        savePromptLibrary();
    }
}

function setInstructions(node) {
    if (!node.customInstructionsTextarea) {
        Logger.err("Custom instructions textarea not found");
        return;
    }

    const promptContentTextarea = document.querySelector('.prompt-content-textarea');
    if (!promptContentTextarea) {
        Logger.err("Prompt content textarea not found");
        return;
    }

    node.customInstructionsTextarea.value = promptContentTextarea.value;

    // Set the node's title input to the selected prompt's title
    if (promptLibrary.currentPromptIndex !== -1 && node.view.titleInput) {
        const selectedPromptTitle = document.querySelector('.prompt-list input.selected');
        if (selectedPromptTitle) {
            node.view.titleInput.value = selectedPromptTitle.value;
        }
    }
}

function setupPromptLibraryListeners(node) {
    const setInstructionsButton = document.querySelector('.set-instructions-button');
    const addPromptButton = document.querySelector('.add-prompt-button');
    const deletePromptButton = document.querySelector('.delete-prompt-button');
    const promptContentTextarea = document.querySelector('.prompt-content-textarea');
    const importPromptButton = document.querySelector('.import-prompt-button');
    const importButtonLabel = document.querySelector('.import-prompt-label');
    const exportPromptButton = document.querySelector('.export-prompt-button');

    // Set up Set Instructions button
    if (setInstructionsButton) {
        On.click(setInstructionsButton, setInstructions.bind(null, node));
    } else {
        Logger.err("Set Instructions button not found")
    }

    // Set up Add Prompt button
    if (addPromptButton) {
        On.click(addPromptButton, addNewPrompt);
    } else {
        Logger.err("Add Prompt button not found")
    }

    // Set up Delete Prompt button
    if (deletePromptButton) {
        On.click(deletePromptButton, deleteCurrentPrompt);
    } else {
        Logger.err("Delete Prompt button not found")
    }

    if (promptContentTextarea) {
        On.input(promptContentTextarea, (e)=>{
            if (promptLibrary.currentPromptIndex === -1) return;

            const prompt = promptLibrary.prompts[promptLibrary.currentPromptIndex];
            prompt.content = promptContentTextarea.value;
            savePromptLibrary();
        });
    } else {
        Logger.err("Prompt Content textarea not found")
    }

    // Set up Import Prompts functionality
    if (importPromptButton && importButtonLabel) {
        On.click(importButtonLabel, (e)=>{
            importPromptButton.value = ''; // Reset the file input
            importPromptButton.click(); // Trigger file input when clicked
        });
        On.change(importPromptButton, importPromptLibrary);
    } else {
        Logger.err("Import button or label not found")
    }

    // Set up Export Prompts functionality
    if (exportPromptButton) {
        const onClick = exportPromptLibraryAsJSON.bind(null, promptLibrary);
        On.click(exportPromptButton, onClick);
    } else {
        Logger.err("Export button not found")
    }
}

// Function to import prompts from a JSON file
function importPromptLibrary(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    On.load(reader, (e)=>{
        try {
            const importedData = JSON.parse(e.target.result);
            Logger.debug('Imported Data:', importedData);

            // Check for validity of the imported data
            if (Array.isArray(importedData) && importedData.every(prompt =>
                'name' in prompt && 'content' in prompt)) {

                // Add imported prompts to existing ones
                importedData.forEach(importedPrompt => {
                    promptLibrary.prompts.push({
                        title: importedPrompt.name,
                        content: importedPrompt.content
                    });
                });

                // Select the first imported prompt
                if (importedData.length > 0) {
                    promptLibrary.currentPromptIndex = promptLibrary.prompts.length - importedData.length;
                } else if (promptLibrary.prompts.length === 0) {
                    promptLibrary.currentPromptIndex = -1;
                }

                // Save the updated prompt library and re-render the list
                savePromptLibrary();
                renderPromptList();
                selectPrompt(promptLibrary.currentPromptIndex);
            } else {
                alert('Invalid file format. Please make sure you are importing a valid prompt library JSON.');
            }
        } catch (err) {
            Logger.err("In parsing JSON:", err);
            alert('Failed to import. Please make sure you are using a valid prompt library JSON file.');
        }

        // Reset the file input to ensure onchange event fires even if the same file is selected again
        event.target.value = '';
    });
    reader.readAsText(file);
}

function exportPromptLibraryAsJSON(promptLibrary) {
    const exportedPrompts = promptLibrary.prompts.map(prompt => ({
        name: prompt.title,
        content: prompt.content
    }));

    // Convert to JSON string
    const jsonString = JSON.stringify(exportedPrompts, null, 2);

    // Create a Blob and download the JSON file
    const blob = new Blob([jsonString], { type: "application/json" });
    const link = Html.make.a(URL.createObjectURL(blob));
    link.download = "promptLibrary.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
