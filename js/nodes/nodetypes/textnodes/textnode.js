class TextNode {
    static create(name = '', text = '', sx, sy, x, y){
        const textarea = Html.make.textarea('custom-scrollbar node-textarea');
        On.mousedown(textarea, Event.stopPropagation);
        textarea.value = text;

        const editorWrapper = createSyntaxTextarea();  // Now this includes both the input and display div
        editorWrapper.id = 'text-syntax-wrapper';

        const htmlView = Html.make.iframe('html-iframe hidden');
        htmlView.id = 'html-iframe';

        const pythonView = Html.make.div('python-frame hidden');
        pythonView.id = 'python-frame';

        const node = addNodeAtNaturalScale(name, [textarea]);
        const divWindow = node.windowDiv;
        divWindow.append(htmlView, pythonView, editorWrapper);
        divWindow.style.minWidth = '100px';
        divWindow.style.minHeight = '100px';

        // Handle position and scale if necessary
        if (sx !== undefined) {
            const pos = (new vec2(sx, sy)).cmult(zoom).plus(pan);
            y = pos.y;
            x = pos.x;
        }

        if (x !== undefined) node.pos.x = x;
        if (y !== undefined) node.pos.y = y;

        node.push_extra_cb( (node)=>({
                f: 'textarea',
                a: {
                    p: [0, 0, 1],
                    v: node.titleInput.value
                }
            })
        );

        node.push_extra_cb( (node)=>({
                f: 'textarea',
                a: {
                    p: [0, 1, 0],
                    v: textarea.value
                }
            })
        );

        node.isTextNode = true;
        node.codeEditingState = 'edit';

        TextNode.init(node);

        return node;
    }
    static init(node){
        const content = node.content;

        //No longer a contentEditableDiv, returned to textarea
        const divContentEditable = content.querySelector('.editable-div');
        node.contentEditableDiv = divContentEditable;

        const divDisplay = content.querySelector('.syntax-display-div');
        node.displayDiv = divDisplay;

        const textarea = content.querySelector('textarea');
        node.textarea = textarea;

        node.htmlView = content.querySelector('#html-iframe');
        node.pythonView = content.querySelector('#python-frame');
        node.textNodeSyntaxWrapper = content.querySelector('#text-syntax-wrapper');

        // Attach events for contentEditable and textarea
        addEventsToUserInputTextarea(divContentEditable, textarea, node, divDisplay);
    }
}
