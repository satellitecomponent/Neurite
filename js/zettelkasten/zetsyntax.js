
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
            let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            highlightedCode += `<span ${className}>${escapedText}</span>`;
        });
        return highlightedCode;
    }

    //ToDo Fix RegExp escape.
    static applyNodeTitleHighlighting(content) {
        nodeTitles.sort((a, b) => b.length - a.length);
        nodeTitles.forEach(title => {
            const escapedTitle = RegExp.escape(title);
            const regex = new RegExp(`\\b${escapedTitle}(?!\\w)`, 'gi');
            content = content.replace(regex, `<span class="node-title-sd">${title}</span>`);
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
        content = SyntaxHighlighter.applyCodeBlockHighlighting(content);
        content = SyntaxHighlighter.applyNodeTitleHighlighting(content);
        content = SyntaxHighlighter.applyZettelkastenSyntax(content);
        content += '\n';  // Adds visual spacing

        // Sanitize the content using DOMPurify
        content = DOMPurify.sanitize(content);

        displayDiv.innerHTML = content;
    }
}