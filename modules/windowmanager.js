const { BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { buildContextMenu } = require('./contextmenu');
const { ensureFrontendDownloaded } = require('./frontendupdater');
const { startFrontendServer } = require('./frontendserver');

async function createMainWindow() {
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

    const frontendPath = await ensureFrontendDownloaded();

    try {
        if (frontendPath) {
            const frontendUrl = await startFrontendServer(frontendPath);
            await mainWindow.loadURL(frontendUrl); // await this!
        } else {
            await mainWindow.loadURL('https://neurite.network');
        }
    } catch (err) {
        console.error('[main] Failed to load frontend:', err);
        mainWindow.loadURL('https://neurite.network'); // fallback to web version
    }
    
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

    ipcMain.on('auth-message-from-proxy', (event, data) => {
        if (mainWindow) {
            console.log('[Electron Main] Forwarding auth message to frontend:', data);
            mainWindow.webContents.send('auth-message', data);
        } else {
            console.warn('[Electron Main] No frontend window to receive auth message');
        }
    });

    // mainWindow.webContents.openDevTools();
    return mainWindow;
}

module.exports = { createMainWindow };
