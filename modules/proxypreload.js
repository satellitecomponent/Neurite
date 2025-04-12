const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    proxyBridge: {
        sendFetchResponse: (data) => ipcRenderer.send('secure-fetch-response', data),
        sendAuthMessage: (data) => ipcRenderer.send('auth-message-from-proxy', data)
    }
});

// ✅ Forward fetch requests from Electron main → proxy.html
ipcRenderer.on('secure-fetch-request', (event, data) => {
    console.log('[proxypreload] Forwarding secure-fetch-request to proxy.html', data);
    window.postMessage(data, '*');
});
