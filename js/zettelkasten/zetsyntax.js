class SyntaxHighlighter {
    static applyCodeBlockHighlighting(content) {
        // Update the regex to capture multiline code blocks including HTML
        const codeBlockRegex = /(```)(html|css|js|javascript|python)?(\s*[\r\n]+)([\s\S]*?)(```)/gi;
        return content.replace(codeBlockRegex, (match, startDelimiter, languageLabel, leadingWhitespace, codeText, endDelimiter) => {
            const language = this.mapLanguage(languageLabel || '');
            const formattedCode = this.highlightCode(codeText, language);
            return `${startDelimiter}${languageLabel}${leadingWhitespace}${formattedCode}${endDelimiter}`;
        });
    }

    static mapLanguage(lang) {
        switch (lang.toLowerCase()) {
            case 'js':
            case 'javascript': return 'javascript';
            case 'html': return 'htmlmixed';
            case 'css': return 'css';
            case 'python': return 'python';
            default: return 'htmlmixed';
        }
    }

    static highlightCode(code, language) {
        let highlightedCode = '';
        CodeMirror.runMode(code, language, (text, style) => {
            let className = style ? `class="neurite-${style}"` : '';
            let escapedText = text.replace(/[&<>"']/g, function (match) {
                switch (match) {
                    case '&': return '&amp;';
                    case '<': return '&lt;';
                    case '>': return '&gt;';
                    case '"': return '&quot;';
                    case "'": return '&#39;';
                }
            });
            highlightedCode += `<span ${className}>${escapedText}</span>`;
        });
        return highlightedCode;
    }

    static applyNodeTitleHighlighting(content) {
        const sortedTitles = Array.from(nodeTitles).sort((a, b) => b.length - a.length);
        const titleRegex = new RegExp(`(${sortedTitles.map(RegExp.escape).join('|')})`, 'g');

        return content.replace(titleRegex, (match, title) => {
            const startIndex = content.lastIndexOf('<span', match.index);
            const endIndex = content.indexOf('</span>', match.index);

            if (startIndex !== -1 && endIndex !== -1 && startIndex < match.index && match.index < endIndex) {
                return match;
            } else {
                return `<span class="node-title-sd">${title}</span>`;
            }
        });
    }

    static applyZettelkastenSyntax(content, applyNodeTag = false) {
        const refTag = tagValues.refTag;

        if (applyNodeTag) {
            const nodeTag = tagValues.nodeTag;
            const nodeTagRegex = new RegExp(`\\b${RegExp.escape(nodeTag)}(?!\\w)`, 'gi');
            content = content.replace(nodeTagRegex, `<span class="cm-node">${nodeTag}</span>`);
        }

        if (bracketsMap[refTag]) {
            const openingBracket = refTag;
            const closingBracket = bracketsMap[refTag];
            const refRegex = new RegExp(`(${RegExp.escape(openingBracket)}|${RegExp.escape(closingBracket)})`, 'g');
            content = content.replace(refRegex, match => `<span class="cm-ref">${match}</span>`);
        } else {
            const directRefRegex = new RegExp(`\\b${RegExp.escape(refTag)}(?!\\w)`, 'gi');
            content = content.replace(directRefRegex, `<span class="cm-ref">${refTag}</span>`);
        }

        return content;
    }
}

class ZetSyntaxDisplay {
    static syncAndHighlight(displayDiv, hiddenTextarea) {
        let content = hiddenTextarea.value;

        content = SyntaxHighlighter.applyCodeBlockHighlighting(content);
        content = SyntaxHighlighter.applyNodeTitleHighlighting(content);
        content = SyntaxHighlighter.applyZettelkastenSyntax(content);
        content += '\n'; // Adds visual spacing

        displayDiv.innerHTML = content;
    }
}

document.addEventListener('click', function (event) {
    if (event.target.classList.contains('node-title-sd')) {
        const title = event.target.textContent;
        handleTitleClick(title);
    }
});

// Manage scroll behavior and temporarily disable pointer events
document.addEventListener('wheel', function (event) {
    if (event.target.classList.contains('node-title-sd')) {
        event.target.style.pointerEvents = 'none'; // Disable pointer events during scroll

        // Clear any existing timeout to avoid conflicts
        clearTimeout(event.target.pointerEventTimeout);

        // Set a timeout to restore pointer events after a period of inactivity
        event.target.pointerEventTimeout = setTimeout(() => {
            event.target.style.pointerEvents = 'auto';
        }, 20); // Adjust delay as necessary based on user behavior and preferences
    }
}, { passive: false });