// Global object to track the state of movement keys
const keyState = {};
On.keydown(window, (e)=>{ keyState[e.key] = true } );
On.keyup(window, (e)=>{ keyState[e.key] = false } );

const directionMap = {
    'ArrowUp': 'up',
    'ArrowDown': 'down',
    'ArrowLeft': 'left',
    'ArrowRight': 'right',
    'f': 'scaleUp',
    'd': 'scaleDown'
};

const SCALE_UP_FACTOR = 1.04;
const SCALE_DOWN_FACTOR = 0.96;

function directionToAngle(direction) {
    const map = {
        'up': 3 * Math.PI / 2, // 270 degrees
        'down': Math.PI / 2,   // 90 degrees
        'left': Math.PI,       // 180 degrees
        'right': 0,            // 0 degrees
        'up-left': 5 * Math.PI / 4,   // 225 degrees
        'up-right': 7 * Math.PI / 4,  // 315 degrees
        'down-left': 3 * Math.PI / 4, // 135 degrees
        'down-right': Math.PI / 4,    // 45 degrees
    };

    return map[direction] ?? null;
}

// calculate the combined direction
function getDirectionAngleFromKeyState() {
    const direction = [];
    if (keyState['ArrowUp']) direction.push('up');
    if (keyState['ArrowDown']) direction.push('down');
    if (keyState['ArrowLeft']) direction.push('left');
    if (keyState['ArrowRight']) direction.push('right');

    const combinedDirection = direction.join('-'); // e.g., 'up-left'
    return directionToAngle(combinedDirection);
}


function processScalingKeys() {
    Object.keys(keyState).forEach(key => {
        if (!keyState[key]) return;

        const action = directionMap[key];
        if (action === 'scaleUp' || action === 'scaleDown') {
            const scaleFactor = action === 'scaleUp' ? SCALE_UP_FACTOR : SCALE_DOWN_FACTOR;
            const centroid = SelectedNodes.getCentroid();
            if (centroid) SelectedNodes.scale(scaleFactor, centroid);
        }
    });
}

SelectedNodes.move = function(movementAngle){
    SelectedNodes.forEach(
        (node)=>node.moveNode(movementAngle)
    )
}
