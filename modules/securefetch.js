const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let secureProxyWindow = null;

function ensureSecureProxyWindow() {
    if (secureProxyWindow && !secureProxyWindow.isDestroyed()) {
        return secureProxyWindow;
    }

    secureProxyWindow = new BrowserWindow({
        show: false,
        fullscreenable: false,
        minimizable: false,
        maximizable: false,
        resizable: false,
        closable: false,
        focusable: false,
        frame: false, // removes window controls
        skipTaskbar: true,
        webPreferences: {
            preload: path.join(__dirname, 'proxypreload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
            enableRemoteModule: false,
            partition: 'persist:secure-proxy',
            devTools: false,
        }
    });

    secureProxyWindow.loadURL('https://neurite.network/resources/proxy/proxy.html');
    return secureProxyWindow;
}

function setupSecureFetchHandler() {
    const win = ensureSecureProxyWindow();
    ipcMain.handle('secure-fetch', async (event, endpoint, options) => {
        const id = uuidv4();

        console.log('[Secure Fetch] secure-fetch to', endpoint);

        return new Promise((resolve, reject) => {
            const handleResponse = (event, result) => {
                if (!result || result.id !== id) return;
                ipcMain.off('secure-fetch-response', handleResponse);

                if (result.error) {
                    console.error('[Secure Fetch] Fetch error:', result.error);
                    reject(new Error(result.error));
                } else {
                    console.log('[Secure Fetch] Received secure-fetch response:', result.status);
                    resolve(result); // { status, headers, isText, body }
                }
            };

            ipcMain.on('secure-fetch-response', handleResponse);

            win.webContents.send('secure-fetch-request', {
                id,
                endpoint,
                options
            });
        });
    });

    ipcMain.on('secure-fetch-stream-start', (event, { id, endpoint, options }) => {
        console.log('[Secure Fetch] secure-fetch stream start:', { id, endpoint });

        const forwardToRenderer = (payload) => {
            event.sender.send('secure-fetch-chunk', payload);
        };

        const handleStreamResponse = (e, result) => {
            if (!result || result.id !== id) return;

            forwardToRenderer(result);
            if (result.done || result.error) {
                ipcMain.off('secure-fetch-response', handleStreamResponse);
            }
        };

        ipcMain.on('secure-fetch-response', handleStreamResponse);
        win.webContents.send('secure-fetch-request', { id, endpoint, options });
    });
    ipcMain.on('proxy-open-popup', (event, url) => {
        win.webContents.executeJavaScript(`window.open(${JSON.stringify(url)}, 'Neurite', 'width=500,height=600');`);
        console.log('[Secure Fetch] Forwarded popup open to proxy:', url);
    });
}

function destroySecureProxyWindow() {
    if (secureProxyWindow && !secureProxyWindow.isDestroyed()) {
        secureProxyWindow.close();
        secureProxyWindow = null;
    }
}

module.exports = {
    setupSecureFetchHandler,
    destroySecureProxyWindow
};
