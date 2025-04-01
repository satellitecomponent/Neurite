const { Menu, MenuItem } = require('electron');

function buildContextMenu(browserWindow, params) {
    const menu = new Menu();

    // 🧠 Add spelling suggestions if available
    if (params.misspelledWord && params.dictionarySuggestions.length > 0) {
        for (const suggestion of params.dictionarySuggestions) {
            menu.append(new MenuItem({
                label: suggestion,
                click: () => {
                    browserWindow.webContents.replaceMisspelling(suggestion);
                }
            }));
        }
        menu.append(new MenuItem({ type: 'separator' }));
    }

    // Standard edit menu
    menu.append(new MenuItem({ label: 'Cut', role: 'cut' }));
    menu.append(new MenuItem({ label: 'Copy', role: 'copy' }));
    menu.append(new MenuItem({ label: 'Paste', role: 'paste' }));
    menu.append(new MenuItem({ type: 'separator' }));

    // Dev tools
    menu.append(new MenuItem({ label: 'Reload', role: 'reload' }));
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({
        label: 'Inspect',
        click: () => {
            browserWindow.webContents.inspectElement(params.x, params.y);
        }
    }));

    return menu;
}

module.exports = { buildContextMenu };
