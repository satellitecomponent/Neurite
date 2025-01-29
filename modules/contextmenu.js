const { Menu } = require('electron');

function buildContextMenu(browserWindow, { x, y }) {
    return Menu.buildFromTemplate([
        { label: 'Cut', role: 'cut' },
        { label: 'Copy', role: 'copy' },
        { label: 'Paste', role: 'paste' },
        { type: 'separator' },
        { label: 'Reload', role: 'reload' },
        { type: 'separator' },
        {
            label: 'Inspect',
            click: () => {
                browserWindow.webContents.inspectElement(x, y);
            },
        },
    ]);
}

module.exports = { buildContextMenu };
