const { app, BrowserWindow } = require('electron');
const { isLocalServerRunning, startLocalServers, stopLocalServers } = require('./modules/servermanager');
const { createMainWindow } = require('./modules/windowmanager');
const { initializeUpdater } = require('./modules/update');

let mainWindow;

app.whenReady().then(async () => {
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

    mainWindow = createMainWindow();

    // Initialize updater
    initializeUpdater(mainWindow);

    // macOS: Re-create window when dock icon is clicked and no windows are open
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            mainWindow = createMainWindow();
        }
    });
});

app.on('before-quit', () => {
    stopLocalServers();
});

app.on('window-all-closed', () => {
    app.quit();
});
