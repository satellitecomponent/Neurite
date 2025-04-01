const { spawn } = require('child_process');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const treeKill = require('tree-kill');
const { app } = require('electron');

let childProcess = null;

async function isLocalServerRunning() {
    try {
        const response = await axios.get('http://localhost:7070/check', {
            timeout: 2000,
            validateStatus: () => true
        });
        return response.status === 200 && response.data.status === 'ok';
    } catch {
        return false;
    }
}

async function runNpmInstall(folder, logStream) {
    console.log(`[serverManager] Installing localhost_servers`);
    return new Promise((resolve, reject) => {
        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        const install = spawn(npmCmd, ['install'], {
            cwd: folder,
            env: { ...process.env },
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
        });

        install.stdout.pipe(logStream);
        install.stderr.pipe(logStream);

        install.on('exit', code => {
            code === 0
                ? resolve()
                : reject(new Error(`npm install exited with code ${code}`));
        });

        install.on('error', err => {
            reject(new Error(`npm install failed: ${err.message}`));
        });
    });
}

async function startLocalServers(serversFolder) {
    return new Promise(async (resolve, reject) => {
        const scriptFullPath = path.join(serversFolder, 'start_servers.js');
        const logPath = path.join(app.getPath('userData'), 'server-install.log');
        const logStream = fs.createWriteStream(logPath, { flags: 'a' });

        try {
            await runNpmInstall(serversFolder, logStream);
        } catch (err) {
            logStream.write(`[serverManager] npm install error: ${err.message}\n`);
            logStream.end();
            return reject(new Error(`[serverManager] Failed to install root dependencies: ${err.message}`));
        }

        logStream.write(`[serverManager] Launching server: ${scriptFullPath}\n`);
        logStream.write(`[serverManager] Logs streaming to this file...\n`);

        const nodeBinary = process.platform === 'win32' ? 'node.exe' : 'node';

        childProcess = spawn(nodeBinary, [scriptFullPath], {
            cwd: serversFolder,
            env: { ...process.env },
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
        });

        childProcess.stdout.pipe(logStream);
        childProcess.stderr.pipe(logStream);

        childProcess.on('exit', (code) => {
            if (code !== 0) {
                logStream.write(`[serverManager] Server process exited with code ${code}\n`);
                childProcess = null;
            }
            logStream.end(); // finalize log
        });

        const checkServer = async () => {
            if (await isLocalServerRunning()) {
                logStream.write(`[serverManager] localhost_servers running\n`);
                return resolve();
            }
            setTimeout(checkServer, 1000);
        };

        checkServer();
    });
}

function stopLocalServers() {
    if (!childProcess) return;
    console.log('Stopping servers...');
    treeKill(childProcess.pid, 'SIGKILL', err => {
        if (err) console.error('Kill error:', err);
        childProcess = null;
    });
}

module.exports = {
    isLocalServerRunning,
    startLocalServers,
    stopLocalServers
};
