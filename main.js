const { app, BrowserWindow, ipcMain } = require('electron');
const { registerShortcuts, unregisterShortcuts } = require('./modules/shortcuts');
const { createLoadingWindow, closeLoadingWindow } = require('./modules/loadingwindow');
const { isLocalServerRunning, startLocalServers, stopLocalServers } = require('./modules/servermanager');
const { createMainWindow } = require('./modules/windowmanager');
const { initializeUpdater } = require('./modules/update');
const { ensureServersDownloaded } = require('./modules/serverdownloader');
const { setupSecureFetchHandler, destroySecureProxyWindow } = require('./modules/securefetch');
const { stopFrontendServer } = require('./modules/frontendserver');

app.whenReady().then(async () => {
    // Run updater and wait for possible restart
    const shouldContinue = await initializeUpdater();
    if (!shouldContinue) return;
    
    const loadingWindow = createLoadingWindow();

    loadingWindow.on('closed', () => {
        const anyVisible = BrowserWindow.getAllWindows().some(win => win.isVisible());
        if (!anyVisible && !globalThis.isUpdating) {
            console.log('[main] Loading window closed before main window was shown. Quitting app...');
            app.quit();
        }
    });

    setupSecureFetchHandler();

    // Create the main window
    const mainWindow = await createMainWindow();
    registerShortcuts();

    // Server readiness
    const serversPromise = (async () => {
        try {
            const path = await ensureServersDownloaded();
            await startLocalServers(path);
            console.log('[main] Servers signaled ready');
        } catch (err) {
            console.error('[main] Failed to start localhost_servers:', err);
        }
    })();

    // Renderer readiness
    const rendererPromise = new Promise((resolve) => {
        ipcMain.once('renderer-ready', () => {
            console.log('[main] Renderer signaled ready');
            resolve(true);
        });
    });

    await Promise.all([serversPromise, rendererPromise]);

    try {
        await mainWindow.webContents.executeJavaScript('Host?.checkServer?.();');
    } catch (err) {
        console.warn('[main] Renderer hook failed:', err);
    }

    closeLoadingWindow();
    mainWindow.show();

    app.on('activate', () => {
        const existing = BrowserWindow.getAllWindows().find(win => !win.isDestroyed());
        if (existing) {
            existing.show();
        } else {
            createMainWindow().show();
        }
    });

    mainWindow.on('closed', () => {
        app.quit();
    });
});

app.on('will-quit', () => {
    unregisterShortcuts();
});

let isCleaningUp = false;

app.on('before-quit', async (event) => {
    if (isCleaningUp) return; // ⛔ prevent double cleanup
    isCleaningUp = true;

    console.log('[main] Running shutdown cleanup...');
    event.preventDefault();

    try {
        await stopFrontendServer();
        await stopLocalServers();
        await destroySecureProxyWindow();
        console.log('[main] Cleanup complete. Quitting now...');
        app.exit(); // use exit to avoid loop
    } catch (err) {
        console.error('[main] Cleanup error:', err);
        app.exit(1);
    }
});