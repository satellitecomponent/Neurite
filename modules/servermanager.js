// modules/servermanager.js
const { spawn } = require('child_process');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const treeKill = require('tree-kill');
const { app } = require('electron');

let childProcess = null;

async function isLocalServerRunning() {
    try {
        const { status, data } = await axios.get('http://localhost:7070/check', {
            timeout: 2000, validateStatus: () => true
        });
        return status === 200 && data?.status === 'ok';
    } catch { return false; }
}

async function startLocalServers(serversFolder) {
    if (await isLocalServerRunning()) {
        console.log('[serverManager] localhost_servers already running.');
        return;
    }

    const logPath = path.join(app.getPath('userData'), 'server-install.log');
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    const script = path.join(serversFolder, 'start_servers.js');

    logStream.write(`[serverManager] Spawning: ${script}\n`);

    childProcess = spawn(process.execPath, [script], {
        cwd: serversFolder,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    });

    childProcess.stdout.pipe(logStream);
    childProcess.stderr.pipe(logStream);

    childProcess.on('exit', code => {
        logStream.write(`[serverManager] start_servers.js exited (${code})\n`);
        childProcess = null;
    });

    childProcess.on('error', err => {
        logStream.write(`[serverManager] spawn error: ${err.message}\n`);
    });

    while (true) {
        if (await isLocalServerRunning()) {
            logStream.write('[serverManager] localhost_servers running\n');
            logStream.end();
            return;
        }
        await new Promise(r => setTimeout(r, 500));
    }
}

function stopLocalServers() {
    return new Promise(resolve => {
        if (!childProcess) return resolve();

        console.log('[serverManager] Stopping local servers…');
        treeKill(childProcess.pid, 'SIGKILL', err => {
            if (err) console.error('[serverManager] kill error:', err);
            else console.log('[serverManager] Local servers stopped.');
            childProcess = null;
            resolve();
        });
    });
}

module.exports = { startLocalServers, stopLocalServers };
