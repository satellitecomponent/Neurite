async function setupConnectModal(originNode) {
    const maxNodes = 8;
    openModal(`nodeConnectionModal`);  // Open the connection modal
    const nodeList = document.getElementById('nodeList');
    const searchBar = document.getElementById('connectModalSearchBar');

    // Set initial search bar value and clear previous contents
    searchBar.value = originNode.getTitle();
    nodeList.innerHTML = '';

    // Populate initially with the origin node title
    await updateNodeList(originNode.getTitle(), maxNodes, originNode);

    // Event listener for search bar input
    searchBar.addEventListener('input', async () => {
        const searchInput = searchBar.value.trim();
        await updateNodeList(searchInput.length > 0 ? searchInput : originNode.getTitle(), maxNodes, originNode);
    });
}
async function updateNodeList(searchTerm, maxNodes, originNode) {
    let nodes;

    if (searchTerm) {
        let allNodes = await searchNodesBy(searchTerm, maxNodes);
        nodes = allNodes.slice(0, maxNodes); // Limit the results
    } else {
        nodes = Object.values(nodeMap); // Get all nodes from the nodeMap
    }

    const nodeList = document.getElementById('nodeList');
    nodeList.innerHTML = '';

    if (nodes.length === 0) {
        nodeList.innerHTML = '<li>No notes found.</li>';
        return;
    }

    nodes.forEach(node => {
        if (node !== originNode) {
            const li = document.createElement('li');
            const title = node.getTitle().trim() || 'Untitled'; // Check for empty title and set to 'Untitled'
            li.textContent = title;
            li.className = findExistingEdge(node, originNode) ? 'connected' : 'disconnected';
            li.onclick = () => {
                const connected = handleConnectOrRemove(node, originNode);
                updateUIAfterConnectionChange(li, connected);
            };
            nodeList.appendChild(li);
        }
    });
}
function updateUIAfterConnectionChange(li, connected) {
    if (connected) {
        li.className = 'connected';
    } else {
        li.className = 'disconnected';
    }
}


function handleConnectOrRemove(node, originNode) {
    const existingEdge = findExistingEdge(node, originNode);

    if (existingEdge) {
        if (node.isTextNode && originNode.isTextNode) {
            removeEdgeFromAllInstances(node.getTitle(), originNode.getTitle());
        } else {
            existingEdge.remove();
        }
        return false; // Indicates the connection was removed
    } else {
        connectNodes(node, originNode);
        return true; // Indicates a connection was added
    }
}