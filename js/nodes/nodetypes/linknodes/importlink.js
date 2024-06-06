async function importLinkNodeTextToZettelkasten(link) {
    const text = await fetchLinkContentText(link);
    if (!text) {
        console.error('Failed to retrieve text for importing into Zettelkasten:', link);
        return;
    }

    // Open the import link modal
    openModal('importLinkModalContent');

    // Set the text in the textarea
    document.getElementById('importLinkTextarea').value = text;
}

async function confirmImport() {
    const text = document.getElementById('importLinkTextarea').value;
    const maxSentencesPerNote = parseInt(document.getElementById('maxSentencesPerNote').value);
    const connectNotes = document.getElementById('connectNotes').checked;

    // Update the ZetSplit instance with the user-defined settings
    zetSplit.maxSentencesPerNote = maxSentencesPerNote;
    zetSplit.maxCharsPerNote = maxSentencesPerNote * 100;
    zetSplit.connectNotes = connectNotes;

    // Split the text for Zettelkasten
    const formattedTexts = zetSplit.splitText(text);

    // Function to handle the addition of text chunks to Codemirror
    function addTextToCodemirror(textChunk) {
        if (window.currentActiveZettelkastenMirror) {
            const totalLines = window.currentActiveZettelkastenMirror.lineCount();
            window.currentActiveZettelkastenMirror.replaceRange(textChunk, { line: totalLines, ch: 0 });
        } else {
            console.error('Codemirror instance not found.');
        }
    }

    // Close the modal
    closeModal('importLinkModalContent');

    // Append the notes one at a time with a delay between each note
    for (const note of formattedTexts) {
        addTextToCodemirror(note + "\n\n");
        await new Promise(resolve => setTimeout(resolve, 30)); // Adjust the delay as needed
    }
}