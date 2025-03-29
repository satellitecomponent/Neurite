const { spawn } = require('child_process');
const axios = require('axios');
const path = require('path');
const treeKill = require('tree-kill');
const { app } = require('electron');

let childProcess = null;

function getLocalServersPath() {
    return app.isPackaged
        ? path.join(process.resourcesPath, 'app.asar.unpacked', 'localhost_servers')
        : path.join(__dirname, '../localhost_servers');
}

async function runNpmInstallSilently(workingDir) {
    return new Promise((resolve, reject) => {
        console.log(`[serverManager] Installing dependencies in ${workingDir}`);
        
        // Use cross-platform spawn arguments
        const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        const args = ['install'];
        
        const installProcess = spawn(cmd, args, {
            cwd: workingDir,
            stdio: 'ignore',
            windowsHide: true,
            shell: true // Critical fix for Windows
        });

        installProcess.on('exit', (code) => {
            code === 0 ? resolve() : reject(new Error(`npm install exited with code ${code}`));
        });

        installProcess.on('error', (err) => {
            reject(new Error(`npm install failed: ${err.message}`));
        });
    });
}

async function isLocalServerRunning() {
    try {
        const response = await axios.get('http://localhost:7070/check', { 
            timeout: 2000,
            validateStatus: () => true
        });
        return response.status === 200;
    } catch {
        return false;
    }
}

function startLocalServers() {
    return new Promise(async (resolve, reject) => {
        const serversFolder = getLocalServersPath();
        const scriptFullPath = path.join(serversFolder, 'start_servers.js');

        console.log(`[serverManager] Using server path: ${serversFolder}`);

        try {
            await runNpmInstallSilently(serversFolder);
        } catch (installErr) {
            return reject(new Error(`Dependency installation failed: ${installErr.message}`));
        }

        console.log(`[serverManager] Starting servers with: ${scriptFullPath}`);

        try {
            const nodeBinary = process.platform === 'win32' ? 'node.exe' : 'node';
            childProcess = spawn(nodeBinary, [scriptFullPath], {
                cwd: serversFolder,
                windowsHide: true,
                shell: true, // Required for Windows path resolution
                stdio: 'inherit' // Show server output
            });

            childProcess.on('exit', (code) => {
                if (code !== 0) {
                    console.error(`Server process crashed with code ${code}`);
                    childProcess = null;
                }
            });

            // Verify server startup
            let attempts = 0;
            const checkServer = async () => {
                if (await isLocalServerRunning()) {
                    console.log('Servers confirmed running');
                    resolve();
                } else if (attempts++ < 30) {
                    setTimeout(checkServer, 1000);
                } else {
                    reject(new Error('Server startup timed out'));
                }
            };

            checkServer();
        } catch (spawnError) {
            reject(new Error(`Failed to spawn server: ${spawnError.message}`));
        }
    });
}

function stopLocalServers() {
    if (!childProcess) return;
    
    console.log('Stopping servers...');
    treeKill(childProcess.pid, 'SIGKILL', (err) => {
        if (err) console.error('Kill error:', err);
        childProcess = null;
    });
}

module.exports = {
    isLocalServerRunning,
    startLocalServers,
    stopLocalServers,
};
