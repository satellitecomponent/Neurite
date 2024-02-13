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