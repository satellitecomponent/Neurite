// modules/logging.js
const fs = require('fs');
const path = require('path');

let logStream = null;

function configureLogging(app) {
    const logDir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(logDir, { recursive: true });

    // Clean up old logs (keep 5 most recent)
    try {
        const files = fs.readdirSync(logDir)
            .filter(name => name.startsWith('main-log-') && name.endsWith('.log'))
            .map(name => ({
                name,
                time: fs.statSync(path.join(logDir, name)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);

        for (const file of files.slice(5)) {
            fs.unlinkSync(path.join(logDir, file.name));
        }
    } catch (err) {
        console.warn('[log cleanup] Failed to clean old logs:', err.message);
    }

    const logPath = path.join(logDir, `main-log-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
    logStream = fs.createWriteStream(logPath, { flags: 'a' });

    const origLog = console.log;
    const origErr = console.error;
    const origWarn = console.warn;

    console.log = (...args) => {
        const line = `[LOG ${new Date().toISOString()}] ${args.join(' ')}\n`;
        logStream.write(line);
        origLog(...args);
    };

    console.warn = (...args) => {
        const line = `[WARN ${new Date().toISOString()}] ${args.join(' ')}\n`;
        logStream.write(line);
        origWarn(...args);
    };

    console.error = (...args) => {
        const line = `[ERROR ${new Date().toISOString()}] ${args.join(' ')}\n`;
        logStream.write(line);
        origErr(...args);
    };

    process.on('uncaughtException', err => {
        console.error('[uncaughtException]', err.stack || err);
    });

    process.on('unhandledRejection', reason => {
        console.error('[unhandledRejection]', reason);
    });
}

function closeLogStream() {
    if (logStream) {
        logStream.end();
        logStream = null;
    }
}

module.exports = {
    configureLogging,
    closeLogStream
};
