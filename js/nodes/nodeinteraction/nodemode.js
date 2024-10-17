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

    if (isCapsLockOn) {
        nodeMode = 1;  // Ensure nodeMode is on when CapsLock is on
    } else {
        nodeMode = 0;  // Ensure nodeMode is off when CapsLock is off
    }

    toggleNodeModeState();  // Update the visual state
}

edgesIcon.addEventListener('click', toggleNodeMode);

addEventListener("keydown", (event) => {
    if (event.key === settings.nodeModeKey) {
        const isCapsLockMode = settings.nodeModeKey === "CapsLock";

        if (isCapsLockMode) {
            // Handle CapsLock-specific behavior
            enforceCapsLockState(event);
        } else if (settings.nodeModeTrigger === "down") {
            nodeMode = 1;
            toggleNodeModeState();
            autoToggleAllOverlays();
        } else if (settings.nodeModeTrigger === "toggle") {
            toggleNodeMode();
        }
    } else if (event.key === "Escape") {
        for (let n of nodes) {
            n.followingMouse = 0;
        }
    }
});

addEventListener("keyup", (event) => {
    const isCapsLockMode = settings.nodeModeKey === "CapsLock";

    if (isCapsLockMode) {
        // Handle CapsLock-specific behavior during keyup
        enforceCapsLockState(event);
    } else if (event.key === settings.nodeModeKey && settings.nodeModeTrigger === "down") {
        if (lockedNodeMode) {
            return;  // Don't allow deactivation of nodeMode if it's locked
        }
        nodeMode = 0;
        toggleNodeModeState();
        autoToggleAllOverlays();
        cancel(event);
    }
});