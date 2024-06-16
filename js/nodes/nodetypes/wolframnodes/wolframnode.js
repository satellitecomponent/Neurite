function createWolframNode(wolframData) {
    const { table, reformulatedQuery } = wolframData;
    let content = [table];
    let scale = 1;
    let wolframNode = addNodeAtNaturalScale(`${reformulatedQuery} - Wolfram Alpha Result`, content, scale, 0.5, true);
    wolframNode.followingMouse = 1;
    wolframNode.draw();
    wolframNode.mouseAnchor = toDZ(new vec2(0, -wolframNode.content.offsetHeight / 2 + 6));
}