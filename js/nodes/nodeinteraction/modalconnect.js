Modal.Connect = class {
    maxNodes = 8;
    constructor(originNode){
        this.originNode = originNode;

        Modal.open('nodeConnectionModal'); // clones searchBar and nodeList
        this.searchBar = Elem.byId('connectModalSearchBar');
        this.nodeList = Elem.byId('nodeList');

        this.searchBar.value = originNode.getTitle();
        this.setContents('');
        this.updateNodeList();
        On.input(this.searchBar, this.updateNodeList);
    }

    setContents(html){ this.nodeList.innerHTML = html }
    updateNodeList = ()=>{
        const searchInput = this.searchBar.value.trim();
        const searchTerm = (searchInput.length > 0) ? searchInput
                         : this.originNode.getTitle();
        const nodes = nodesForSearchTerm(searchTerm, this.maxNodes);
        const found = (nodes.length > 0);
        this.setContents(found ? '' : '<li>No notes found.</li>');
        if (found) nodes.forEach(this.addItem, this);
    }
    addItem(node){
        const originNode = this.originNode;
        if (node === originNode) return;

        const textContent = node.getTitle().trim() || 'Untitled';
        const className = (node.edges[originNode.uuid])
                        ? 'connected' : 'disconnected';
        const li = Html.make.li(textContent, className, this.onItemClicked);
        li.dataset.nodeId = node.uuid;
        this.nodeList.appendChild(li);
    }
    onItemClicked = (e)=>{
        const li = e.target;
        const node = Node.byUuid(li.dataset.nodeId);
        const originNode = this.originNode;
        const existingEdge = node.edges[originNode.uuid];
        if (!existingEdge) {
            connectNodes(node, originNode);
            li.setAttribute('class', 'connected');
            return;
        }

        if (node.isTextNode && originNode.isTextNode) {
            removeEdgeFromAllInstances(node, originNode);
        } else {
            existingEdge.remove();
        }
        li.setAttribute('class', 'disconnected');
    }
}
