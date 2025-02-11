// main.js
const { app, BrowserWindow } = require('electron');
const { createLoadingWindow, closeLoadingWindow } = require('./modules/loadingwindow');
const { isLocalServerRunning, startLocalServers, stopLocalServers } = require('./modules/servermanager');
const { createMainWindow } = require('./modules/windowmanager');
const { initializeUpdater } = require('./modules/update');

let mainWindow;

app.whenReady().then(async () => {
    // Create the loading screen immediately
    createLoadingWindow();

    // Check and start local servers if needed
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

    // Create the main application window
    mainWindow = createMainWindow();

    // Once the main window is ready, show it immediately
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();

        // Wait 1 second before closing the loading window
        setTimeout(() => {
            closeLoadingWindow();
        }, 1000);
    });

    // Initialize updater functionality
    initializeUpdater(mainWindow);

    // macOS: Re-create window when dock icon is clicked and no windows are open
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            mainWindow = createMainWindow();
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
