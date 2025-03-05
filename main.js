// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const { createLoadingWindow, closeLoadingWindow } = require('./modules/loadingwindow');
const { isLocalServerRunning, startLocalServers, stopLocalServers } = require('./modules/servermanager');
const { createMainWindow } = require('./modules/windowmanager');
const { initializeUpdater } = require('./modules/update');

app.whenReady().then(async () => {
    // Create the loading screen immediately
    createLoadingWindow();

    // Create the main window in hidden mode so it can load in the background.
    const mainWindow = createMainWindow();

    // Promise for server readiness: If the server is already running, this resolves immediately.
    const serversPromise = (async () => {
        const running = await isLocalServerRunning();
        if (!running) {
            console.log('Local server not running. Starting servers...');
            try {
                await startLocalServers();
                console.log('Local servers started.');
            } catch (err) {
                console.error('Failed to start local servers:', err);
            }
        } else {
            console.log('Local servers already running.');
        }
        return true;
    })();

    // Promise for renderer readiness
    const rendererPromise = new Promise((resolve) => {
        ipcMain.once('renderer-ready', () => {
            console.log('Renderer signaled ready');
            resolve(true);
        });
    });

    // Wait for both the servers and renderer to be ready.
    await Promise.all([serversPromise, rendererPromise]);

    // Once both are ready, close the loading window and show the main window.
    closeLoadingWindow();
    mainWindow.show();

    // Initialize updater functionality
    initializeUpdater(mainWindow);

    // macOS: Re-create window when dock icon is clicked and no windows are open
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow().show();
        }
    });
});

// Clean up when quitting the app
app.on('before-quit', () => {
    stopLocalServers();
});

app.on('window-all-closed', () => {
    app.quit();
});
