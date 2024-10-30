const edgesIcon = document.querySelector('.edges-icon');

let lockedNodeMode = false;

function toggleNodeModeState() {
    if (nodeMode) {
        edgesIcon.classList.add('edges-active');
    } else {
        edgesIcon.classList.remove('edges-active');
    }
}

function toggleNodeMode() {
    nodeMode = 1 - nodeMode;  // Toggle nodeMode between 0 and 1
    toggleNodeModeState();
}

function enforceCapsLockState(event) {
    const isCapsLockOn = event.getModifierState("CapsLock");
    nodeMode = (isCapsLockOn ? 1 : 0); // on : off
    toggleNodeModeState();  // Update the visual state
}

On.keydown(window, (e)=>{
    if (e.key === settings.nodeModeKey) {
        const isCapsLockMode = settings.nodeModeKey === "CapsLock";

        if (isCapsLockMode) {
            // Handle CapsLock-specific behavior
            enforceCapsLockState(e);
        } else if (settings.nodeModeTrigger === "down") {
            nodeMode = 1;
            toggleNodeModeState();
            autoToggleAllOverlays();
        } else if (settings.nodeModeTrigger === "toggle") {
            toggleNodeMode();
        }
    } else if (e.key === 'Escape') {
        for (const node of Graph.nodes) {
            node.followingMouse = 0;
        }
    }
});

On.keyup(window, (e)=>{
    const isCapsLockMode = settings.nodeModeKey === "CapsLock";

    if (isCapsLockMode) {
        enforceCapsLockState(e);
    } else if (e.key === settings.nodeModeKey && settings.nodeModeTrigger === "down") {
        if (lockedNodeMode) return;

        nodeMode = 0;
        toggleNodeModeState();
        autoToggleAllOverlays();
        e.stopPropagation();
    }
});
