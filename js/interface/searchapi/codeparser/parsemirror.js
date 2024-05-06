// Centralized Tokenizer Class
var CodemMirrorTokenizer = (function () {
    // Private CodeMirror instance
    var codeMirrorInstance = null;

    // Private method to initialize CodeMirror instance
    function initializeCodeMirror() {
        if (!codeMirrorInstance) {
            codeMirrorInstance = CodeMirror(document.createElement('div'), {
                value: '',
                mode: 'text/plain'
            });
        }
    }

    // Public API for tokenization
    return {
        tokenize: function (code, languageMode) {
            initializeCodeMirror();

            // Configure the mode for the current language
            codeMirrorInstance.setOption('mode', languageMode);

            // Set the text and tokenize
            codeMirrorInstance.setValue(code);
            var tokens = [];
            codeMirrorInstance.eachLine(function (line) {
                var lineTokens = codeMirrorInstance.getLineTokens(line.lineNo());
                tokens.push(...lineTokens);
            });

            // Return the tokens
            return tokens;
        }
    };
})();