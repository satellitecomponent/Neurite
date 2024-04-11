
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
    nodeMode = 1 - nodeMode;
    lockedNodeMode = !!nodeMode;  // Lock it only if activated by button
    toggleNodeModeState();
}

edgesIcon.addEventListener('click', toggleNodeMode);

addEventListener("keydown", (event) => {
    if (event.key === settings.nodeModeKey) {
        const isCapsLockMode = settings.nodeModeKey === "CapsLock" && event.getModifierState("CapsLock");

        if (lockedNodeMode && !nodeMode) {
            // If nodeMode was deactivated by the key while it was locked, unlock it
            lockedNodeMode = false;
        }

        if (settings.nodeModeTrigger === "down" && !isCapsLockMode) {
            nodeMode = 1;
            toggleNodeModeState();
            autoToggleAllOverlays();
        } else if (settings.nodeModeTrigger === "toggle" || isCapsLockMode) {
            toggleNodeMode();
        }
    } else if (event.key === "Escape") {
        for (let n of nodes) {
            n.followingMouse = 0;
        }
    }
});

addEventListener("keyup", (event) => {
    if (event.key === settings.nodeModeKey && settings.nodeModeTrigger === "down") {
        if (lockedNodeMode) {
            return;  // Don't allow the keyup event to deactivate nodeMode if it's locked
        }

        nodeMode = 0;
        toggleNodeModeState();
        autoToggleAllOverlays();
        cancel(event);
    }
});