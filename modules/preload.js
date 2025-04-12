const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    startedViaElectron: true,
    sendReady: () => ipcRenderer.send('renderer-ready'),

    // Strips signals
    secureFetch: (endpoint, options) => {
        const safeOptions = { ...options };
        delete safeOptions.signal;
        return ipcRenderer.invoke('secure-fetch', endpoint, safeOptions);
    },
    sendStreamRequest: (id, endpoint, options) => {
        ipcRenderer.send('secure-fetch-stream-start', { id, endpoint, options });
    },
    _addStreamListener: (handler) => {
        ipcRenderer.on('secure-fetch-chunk', handler);
    },
    _removeStreamListener: (handler) => {
        ipcRenderer.off('secure-fetch-chunk', handler);
    },
    openPopupViaProxy: (url) => ipcRenderer.send('proxy-open-popup', url),
});

ipcRenderer.on('auth-message', (event, data) => {
    try {
        const safeData = JSON.parse(JSON.stringify(data));
        console.log('[Renderer] Received auth message (sanitized):', safeData);
        window.postMessage(safeData, '*');
    } catch (err) {
        console.error('[Renderer] Failed to postMessage (uncloneable object):', err, data);
    }
});

window.addEventListener('contextmenu', (evt) => {
    if (!evt.defaultPrevented) {
        ipcRenderer.send('show-context-menu', {
            x: evt.clientX,
            y: evt.clientY
        });
    }
}, false);
