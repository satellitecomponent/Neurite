
class SyntaxHighlighter {
    static applyCodeBlockHighlighting(content) {
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
            let escapedText = RegExp.escape(text);
            highlightedCode += `<span ${className}>${escapedText}</span>`;
        });
        return highlightedCode;
    }

    static applyNodeTitleHighlighting(content) {
        nodeTitles.sort((a, b) => b.length - a.length);
        nodeTitles.forEach(title => {
            let index = content.indexOf(title);
            while (index !== -1) {
                // Check if the matched title is already within a <span> tag
                const startIndex = content.lastIndexOf('<span', index);
                const endIndex = content.indexOf('</span>', index);
                if (startIndex !== -1 && endIndex !== -1 && startIndex < index && index < endIndex) {
                    // The matched title is already within a <span> tag, so don't add another one
                    index = content.indexOf(title, index + title.length);
                } else {
                    // The matched title is not within a <span> tag, so add one
                    content = content.slice(0, index) +
                        `<span class="node-title-sd">${title}</span>` +
                        content.slice(index + title.length);
                    index = content.indexOf(title, index + title.length + 31);
                }
            }
        });
        return content;
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
        // Sanitize the content as soon as it is retrieved
        content = DOMPurify.sanitize(content);

        // Apply various syntax highlightings
        content = SyntaxHighlighter.applyCodeBlockHighlighting(content);
        content = SyntaxHighlighter.applyNodeTitleHighlighting(content);
        content = SyntaxHighlighter.applyZettelkastenSyntax(content);
        content += '\n';  // Adds visual spacing

        // Directly set sanitized and highlighted content to the displayDiv
        displayDiv.innerHTML = content;
    }
}