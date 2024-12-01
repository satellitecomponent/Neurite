function createWolframNode(wolframData) {
    const content = [wolframData.table];
    const title = wolframData.reformulatedQuery + " - Wolfram Alpha Result";
    const node = new Node();
    NodeView.addAtNaturalScale(node, title, content);
    node.followingMouse = 1;
    node.draw();
    node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));

    node.push_extra_cb((node) => {
        return {
            f: "textarea",
            a: {
                p: [0, 0, 1],
                v: node.view.titleInput.value
            }
        };
    });
}
