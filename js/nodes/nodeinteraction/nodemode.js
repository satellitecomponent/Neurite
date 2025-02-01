
Node.stopFollowingMouse = function(node){ node.followingMouse = 0 }

class NodeMode {
    edgesIcon = document.querySelector('.edges-icon');
    locked = false;
    key = settings.nodeModeKey;
    trigger = settings.nodeModeTrigger;
    val = 0;
    constructor(autoToggleAllOverlays){
        this.autoToggleAllOverlays = autoToggleAllOverlays;
        On.keydown(window, this.onKeyDown);
        On.keyup(window, this.onKeyUp);
    }

    switch(newState){
        this.val = newState;
        this.edgesIcon.classList[newState ? 'add' : 'remove']('edges-active');
    }
    skipCapsLockState(e){
        if (this.key !== "CapsLock") return true;

        this.switch(e.getModifierState("CapsLock") ? 1 : 0); // on : off
    }
    onKeyDown = (e)=>{
        if (e.key === this.key) {
            if (!this.skipCapsLockState(e)) return;

            if (this.trigger === "down") {
                this.switch(1);
                this.autoToggleAllOverlays();
            } else if (this.trigger === "toggle") {
                this.switch(1 - this.val); // Toggle between 0 and 1
            }
        } else if (e.key === 'Escape') {
            Graph.forEachNode(Node.stopFollowingMouse)
        }
    }
    onKeyUp = (e)=>{
        if (!this.skipCapsLockState(e)) return;
        if (e.key !== this.key || this.trigger !== "down") return;
        if (this.locked) return;

        // Clear the previous node to prevent sticky connect behavior.
        Node.prev = null;

        this.switch(0);
        this.autoToggleAllOverlays();
        e.stopPropagation();
    }
}
