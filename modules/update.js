const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Set up logging for auto-updater events
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

function initializeUpdater(mainWindow) {
    // Check for updates and notify
    autoUpdater.checkForUpdatesAndNotify();

    // Event: Update is available
    autoUpdater.on('update-available', (info) => {
        log.info('Update available:', info);
        mainWindow.webContents.send('update-available', info); // Notify renderer if needed
    });

    // Event: Update is not available
    autoUpdater.on('update-not-available', (info) => {
        log.info('No updates available:', info);
        mainWindow.webContents.send('update-not-available', info);
    });

    // Event: Download progress
    autoUpdater.on('download-progress', (progress) => {
        log.info(`Download speed: ${progress.bytesPerSecond} - ${progress.percent}% completed`);
        mainWindow.webContents.send('update-download-progress', progress);
    });

    // Event: Update downloaded
    autoUpdater.on('update-downloaded', (info) => {
        log.info('Update downloaded. Installing now...');
        mainWindow.webContents.send('update-ready', info);

        // Optional: Quit and install immediately
        autoUpdater.quitAndInstall();
    });

    // Event: Error
    autoUpdater.on('error', (err) => {
        log.error('Error during update:', err);
        mainWindow.webContents.send('update-error', err.message);
    });
}

module.exports = { initializeUpdater };
