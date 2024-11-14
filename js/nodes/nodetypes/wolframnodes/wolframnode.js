function createWolframNode(wolframData) {
    const content = [wolframData.table];
    const title = wolframData.reformulatedQuery + " - Wolfram Alpha Result";
    const wolframNode = NodeView.addAtNaturalScale(title, content, 1, 0.5, true);
    wolframNode.followingMouse = 1;
    wolframNode.draw();
    wolframNode.mouseAnchor = toDZ(new vec2(0, -wolframNode.content.offsetHeight / 2 + 6));

    wolframNode.push_extra_cb((node) => {
        return {
            f: "textarea",
            a: {
                p: [0, 0, 1],
                v: node.view.titleInput.value
            }
        };
    });
}
