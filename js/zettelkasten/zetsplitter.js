class ZetSplit {
    constructor(maxSentencesPerNote = 5, maxCharsPerNote = 500, connectNotes = false) {
        this.maxSentencesPerNote = maxSentencesPerNote;
        this.maxCharsPerNote = maxCharsPerNote;
        this.connectNotes = connectNotes;
    }

    splitText(text) {
        let sections = [];
        const paragraphs = text.split(/\n\n+/);

        paragraphs.forEach(paragraph => {
            const sentences = paragraph.split(/(?<=[.!?])\s+/);
            if (sentences.length > this.maxSentencesPerNote) {
                this._processLongParagraph(sentences, sections);
            } else {
                sections.push(paragraph);
            }
        });

        return this._formatSections(sections);
    }

    _processLongParagraph(sentences, sections) {
        let currentChunk = '';
        sentences.forEach(sentence => {
            if (currentChunk.length + sentence.length > this.maxCharsPerNote) {
                sections.push(currentChunk.trim());
                currentChunk = sentence;
            } else {
                currentChunk += ' ' + sentence;
            }
        });
        if (currentChunk.trim().length > 0) {
            sections.push(currentChunk.trim());
        }
    }

    _formatSections(sections) {
        const formattedSections = sections.map((section, index) => {
            const titleWords = section.split(/\s+/).slice(0, 4).join(' ');
            const title = titleWords.length > 4 ? titleWords : section.slice(0, 30);
            let formattedSection = `${tagValues.nodeTag} ${title}\n${section}`;

            if (this.connectNotes && index > 0) {
                const prevTitle = sections[index - 1].split(/\s+/).slice(0, 4).join(' ');
                const connectionFormat = checkBracketsMap ? `${tagValues.refTag}${prevTitle}${getClosingBracket(tagValues.refTag)}` : `${tagValues.refTag}${prevTitle}`;
                formattedSection += `\n\n${connectionFormat}`;
            }

            return formattedSection;
        });

        return formattedSections;
    }
}

const zetSplit = new ZetSplit(5, 500, false);