const { spawn } = require('child_process');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const treeKill = require('tree-kill');
const { pathToFileURL } = require('url');
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
        const install = spawn(npmCmd, ['install', '--prefer-offline', '--no-audit'], {
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

function installNeeded(folder) {
    const modulesPath = path.join(folder, 'node_modules');
    const lockPath = path.join(folder, 'package-lock.json');
    const expectedModule = path.join(modulesPath, 'express');

    return !fs.existsSync(modulesPath) ||
        !fs.existsSync(expectedModule) ||
        !fs.existsSync(lockPath);
}


async function startLocalServers(serversFolder) {
    if (await isLocalServerRunning()) {
        console.log('[serverManager] localhost_servers already running.');
        return;
    }

    const logPath = path.join(app.getPath('userData'), 'server-install.log');
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    const scriptFullPath = path.join(serversFolder, 'start_servers.js');

    if (installNeeded(serversFolder)) {
        try {
            await runNpmInstall(serversFolder, logStream);
        } catch (err) {
            logStream.write(`[serverManager] npm install error: ${err.message}\n`);
            logStream.end();
            throw new Error(`[serverManager] Failed to install root dependencies: ${err.message}`);
        }
    } else {
        logStream.write(`[serverManager] Skipping npm install\n`);
    }

    logStream.write(`[serverManager] Importing and running: ${scriptFullPath}\n`);

    try {
        const moduleUrl = pathToFileURL(scriptFullPath).href;
        await import(moduleUrl);
    } catch (err) {
        logStream.write(`[serverManager] Failed to import start_servers.js: ${err.message}\n`);
        logStream.end();
        throw err;
    }

    const checkServer = async () => {
        if (await isLocalServerRunning()) {
            logStream.write(`[serverManager] localhost_servers running\n`);
            logStream.end();
            return;
        }
        setTimeout(checkServer, 500);
    };

    checkServer();
}

function stopLocalServers() {
    return new Promise((resolve) => {
        if (!childProcess) return resolve();

        console.log('[serverManager] Stopping servers...');
        treeKill(childProcess.pid, 'SIGKILL', err => {
            if (err) console.error('Kill error:', err);
            else console.log('[serverManager] Local server process killed.');
            childProcess = null;
            resolve();
        });
    });
}

module.exports = {
    startLocalServers,
    stopLocalServers
};
