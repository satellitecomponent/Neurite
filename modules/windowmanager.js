const { BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { buildContextMenu } = require('./contextmenu');

function createMainWindow() {
    Menu.setApplicationMenu(null);

    const isMac = process.platform === 'darwin'; // Check if macOS

    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        webPreferences: {
            devTools: true,
            nodeIntegration: false,
            contextIsolation: true,
            nodeIntegrationInWorker: false,
            nodeIntegrationInSubFrames: false,
            enableRemoteModule: false,
            disableBlinkFeatures: "Auxclick",
            webSecurity: true,
            webviewTag: true,
            preload: path.join(__dirname, "preload.js"),
        },
        icon: path.join(__dirname, '../build/icons/icon.png'),

        // macOS-specific settings
        titleBarStyle: isMac ? 'hiddenInset' : 'default', // Inset traffic lights on macOS
        trafficLightPosition: isMac ? { x: 6, y: 4 } : undefined, // Adjust inset position
    });

    mainWindow.loadURL('https://neurite.network');
    
    let pendingContextMenuRequest = null;

    mainWindow.webContents.on('context-menu', (event, params) => {
        // Always prevent the native menu
        event.preventDefault();
    
        // Cache full context
        if (pendingContextMenuRequest) {
            const { coords, sender } = pendingContextMenuRequest;
            const bw = sender.getOwnerBrowserWindow();
    
            const fullParams = {
                ...params,
                x: coords.x,
                y: coords.y,
            };
    
            const menu = buildContextMenu(bw, fullParams);
            menu.popup({ window: bw, x: fullParams.x, y: fullParams.y });
    
            pendingContextMenuRequest = null; // clear it
        }
    });
    
    ipcMain.on('show-context-menu', (event, coords) => {
        // Store the request for the next native context-menu event
        pendingContextMenuRequest = {
            coords,
            sender: event.sender
        };
    });
    

    // mainWindow.webContents.openDevTools();
    return mainWindow;
}

module.exports = { createMainWindow };
