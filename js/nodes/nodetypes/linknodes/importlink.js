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

    // Concatenate all formatted texts to simulate one long text
    const concatenatedText = formattedTexts.join("\n\n");

    // Function to handle the addition of text chunks to Codemirror
    function addTextToCodemirror(textChunk) {
        if (window.myCodemirror) {
            const totalLines = window.myCodemirror.lineCount();
            window.myCodemirror.replaceRange(textChunk, { line: totalLines, ch: 0 });
        } else {
            console.error('Codemirror instance not found.');
        }
    }
    // Close the modal
    closeModal('importLinkModalContent');
    // Stream the text chunks into the Codemirror instance with minimal delay and larger chunks
    await imitateTextStream(concatenatedText, addTextToCodemirror, 2, 150, 500);  // Adjust chunk lengths and delay as needed
}