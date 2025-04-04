const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    startedViaElectron: true,
    sendReady: () => ipcRenderer.send('renderer-ready')
});

window.addEventListener('contextmenu', (evt) => {
    if (evt.defaultPrevented) return;

    ipcRenderer.send('show-context-menu', {
        x: evt.clientX,
        y: evt.clientY
    });
}, false);
