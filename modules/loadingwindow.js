// modules/loadingWindow.js
const { BrowserWindow } = require('electron');
const path = require('path');

let loadingWindow;

function createLoadingWindow() {
    loadingWindow = new BrowserWindow({
        width: 300,
        height: 300,
        frame: false,
        resizable: false, 
        icon: path.join(__dirname, '../build/icons/icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        }
    });
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
