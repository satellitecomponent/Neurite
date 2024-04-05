// Global object to track the state of movement keys
const keyState = {};

window.addEventListener('keydown', (event) => {
    keyState[event.key] = true;
});

window.addEventListener('keyup', (event) => {
    keyState[event.key] = false;
});

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

    return map[direction] ?? null; // Return null if direction is not recognized
}

// New function to calculate the combined direction
function getDirectionAngleFromKeyState() {
    let direction = [];
    if (keyState['ArrowUp']) direction.push('up');
    if (keyState['ArrowDown']) direction.push('down');
    if (keyState['ArrowLeft']) direction.push('left');
    if (keyState['ArrowRight']) direction.push('right');

    // Convert named direction(s) to an angle
    const combinedDirection = direction.join('-'); // e.g., 'up-left'
    return directionToAngle(combinedDirection); // Use the updated directionToAngle function
}
