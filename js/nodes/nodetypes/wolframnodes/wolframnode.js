function createWolframNode(wolframData) {
    const { table, reformulatedQuery } = wolframData;
    let content = [table];
    let scale = 1;

    let wolframNode = windowify(`${reformulatedQuery} - Wolfram Alpha Result`, content, toZ(mousePos), (zoom.mag2() ** settings.zoomContentExp), scale);
    htmlnodes_parent.appendChild(wolframNode.content);
    registernode(wolframNode);
    wolframNode.followingMouse = 1;
    wolframNode.draw();
    wolframNode.mouseAnchor = toDZ(new vec2(0, -wolframNode.content.offsetHeight / 2 + 6));
}