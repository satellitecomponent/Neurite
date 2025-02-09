const { BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { buildContextMenu } = require('./contextmenu');

function createMainWindow() {
    Menu.setApplicationMenu(null);

    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            devTools: true,
            nodeIntegration: false,
            contextIsolation: true,
            nodeIntegrationInWorker: false,
            nodeIntegrationInSubFrames: false,
            enableRemoteModule: false,
            disableBlinkFeatures: "Auxclick",
            webSecurity: true,
            preload: path.join(__dirname, "preload.js"),
        },
        icon: path.join(__dirname, '../build/icons/icon.png'),
    });

    mainWindow.loadURL('https://neurite.network');

    ipcMain.on('show-context-menu', (event, params) => {
        const { sender } = event;
        const bw = sender.getOwnerBrowserWindow();
        const menu = buildContextMenu(bw, params);
        menu.popup({ window: bw, x: params.x, y: params.y });
    });

    //mainWindow.webContents.openDevTools();
    return mainWindow;
}

module.exports = { createMainWindow };
