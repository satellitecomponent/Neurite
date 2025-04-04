const { globalShortcut, BrowserWindow, screen } = require('electron');

function registerShortcuts() {
    globalShortcut.register('CommandOrControl+R', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) win.webContents.reload();
    });

    globalShortcut.register('CommandOrControl+Shift+I', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) {
            win.webContents.toggleDevTools();
            win.focus();
        }
    });

    globalShortcut.register('CommandOrControl+Shift+C', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) {
            const { x, y } = screen.getCursorScreenPoint();
            win.webContents.inspectElement(x, y);
        }
    });
}

function unregisterShortcuts() {
    globalShortcut.unregisterAll();
}

module.exports = {
    registerShortcuts,
    unregisterShortcuts
};
