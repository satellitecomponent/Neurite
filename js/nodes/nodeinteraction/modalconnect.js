Modal.Connect = {}

Modal.Connect.setup = function(originNode){
    const maxNodes = 8;
    Modal.open('nodeConnectionModal');
    const searchBar = Elem.byId('connectModalSearchBar');
    searchBar.value = originNode.getTitle();
    Elem.byId('nodeList').innerHTML = ''; // clear previous contents

    const update = Modal.Connect.updateNodeList.bind(null, originNode, maxNodes);
    update();
    On.input(searchBar, update);
}

Modal.Connect.updateNodeList = function(originNode, maxNodes){
    const nodeList = Elem.byId('nodeList');

    const searchInput = Elem.byId('connectModalSearchBar').value.trim();
    const searchTerm = (searchInput.length > 0 ? searchInput : originNode.getTitle());
    const nodes = nodesForSearchTerm(searchTerm, maxNodes);
    if (nodes.length < 1) {
        nodeList.innerHTML = '<li>No notes found.</li>';
        return;
    }

    nodeList.innerHTML = '';
    nodes.forEach(node => {
        if (node === originNode) return;

        const li = document.createElement('li');
        li.textContent = node.getTitle().trim() || 'Untitled';
        li.className = (findExistingEdge(node, originNode) ? 'connected' : 'disconnected');
        On.click(li, (e)=>{
            const existingEdge = findExistingEdge(node, originNode);
            if (!existingEdge) {
                connectNodes(node, originNode);
                li.className = 'connected';
                return;
            }

            if (node.isTextNode && originNode.isTextNode) {
                removeEdgeFromAllInstances(node.getTitle(), originNode.getTitle());
            } else {
                existingEdge.remove();
            }
            li.className = 'disconnected';
        });
        nodeList.appendChild(li);
    });
}
