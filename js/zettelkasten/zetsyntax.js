class SyntaxHighlighter {
    static escapeHTML(text) {
        return text.replace(/[&<>"']/g, function (match) {
            switch (match) {
                case '&': return '&amp;';
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '"': return '&quot;';
                case "'": return '&#39;';
            }
        });
    }

    static escapeHTMLOutsideCodeBlocks(content) {
        const codeBlockRegex = /(```)(html|css|js|javascript|python)?(\s*[\r\n]+)([\s\S]*?)(```)/gi;
        let result = '';
        let lastIndex = 0;
        let match;

        while ((match = codeBlockRegex.exec(content)) !== null) {
            // Escape the content before this code block
            let beforeCode = content.slice(lastIndex, match.index);
            result += this.escapeHTML(beforeCode);
            // Add the code block as is, wrapped with spellcheck="false"
            result += `<div spellcheck="false">${match[0]}</div>`;
            lastIndex = match.index + match[0].length;
        }
        // Escape any content after the last code block
        if (lastIndex < content.length) {
            let afterCode = content.slice(lastIndex);
            result += this.escapeHTML(afterCode);
        }
        return result;
    }

    static applyCodeBlockHighlighting(content) {
        // Regex to capture multiline code blocks including HTML
        const codeBlockRegex = /<div spellcheck="false">(```)(html|css|js|javascript|python)?(\s*[\r\n]+)([\s\S]*?)(```)<\/div>/gi;
        return content.replace(codeBlockRegex, (match, startDelimiter, languageLabel, leadingWhitespace, codeText, endDelimiter) => {
            const language = this.mapLanguage(languageLabel || '');
            const formattedCode = this.highlightCode(codeText, language);
            // Ensure languageLabel is not undefined
            const languageLabelText = languageLabel ? languageLabel : '';
            return `<div style="font-size: inherit">${startDelimiter}${languageLabelText}${leadingWhitespace}${formattedCode}${endDelimiter}</div>`;
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
            let escapedText = this.escapeHTML(text);
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

        // Escape HTML outside of code blocks
        content = SyntaxHighlighter.escapeHTMLOutsideCodeBlocks(content);

        // Apply code block highlighting
        content = SyntaxHighlighter.applyCodeBlockHighlighting(content);

        // Apply additional highlighting
        content = SyntaxHighlighter.applyNodeTitleHighlighting(content);
        content = SyntaxHighlighter.applyZettelkastenSyntax(content);

        content += '\n'; // Adds visual spacing

        displayDiv.innerHTML = content;
    }
}

On.click(document, (e)=>{
    if (e.target.classList.contains('node-title-sd')) {
        const title = e.target.textContent;
        handleTitleClick(title);
    }
});

// Manage scroll behavior and temporarily disable pointer events
On.wheel(document, (e)=>{
    const target = e.target;
    if (target.classList.contains('node-title-sd')) {
        target.style.pointerEvents = 'none'; // Disable pointer events during scroll

        // Clear any existing timeout to avoid conflicts
        clearTimeout(target.pointerEventTimeout);

        // Set a timeout to restore pointer events after a period of inactivity
        target.pointerEventTimeout = setTimeout(() => {
            target.style.pointerEvents = 'auto';
        }, 20); // Adjust delay as necessary based on user behavior and preferences
    }
}, { passive: false });
