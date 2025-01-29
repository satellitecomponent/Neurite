const { ipcRenderer } = require('electron');

window.addEventListener('contextmenu', () => { }, true);

window.addEventListener('contextmenu', (evt) => {
    if (!evt.defaultPrevented) {
        evt.preventDefault();
        ipcRenderer.send('show-context-menu', {
            x: evt.clientX,
            y: evt.clientY
        });
    }
}, false);
