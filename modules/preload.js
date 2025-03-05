const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    startedViaElectron: true,
    sendReady: () => ipcRenderer.send('renderer-ready')
});

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
