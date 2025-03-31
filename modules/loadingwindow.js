// modules/loadingWindow.js
const { BrowserWindow } = require('electron');

let loadingWindow;

function createLoadingWindow() {
    loadingWindow = new BrowserWindow({
        width: 300,            // Perfect square dimensions
        height: 300,
        frame: false,          // No window frame
        resizable: false,      // Prevent resizing
        webPreferences: {
            // Depending on your security requirements
            nodeIntegration: false,
            contextIsolation: true,
        }
    });

    // Load the loading screen HTML file
    loadingWindow.loadFile('loading.html');
    return loadingWindow;
}

function closeLoadingWindow() {
    if (loadingWindow) {
        loadingWindow.close();
        loadingWindow = null;
    }
}

module.exports = { createLoadingWindow, closeLoadingWindow };
