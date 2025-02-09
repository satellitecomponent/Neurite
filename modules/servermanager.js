const { spawn } = require('child_process');
const axios = require('axios');
const path = require('path');
const treeKill = require('tree-kill');
const { app } = require('electron'); // Import Electron's `app` to get the correct path

let childProcess = null;

function getLocalServersPath() {
    // Check if we are running in a packaged Electron app
    if (app && app.isPackaged) {
        return path.join(process.resourcesPath, 'app.asar.unpacked', 'localhost_servers');
    } else {
        return path.join(__dirname, '../localhost_servers');
    }
}

async function isLocalServerRunning() {
    try {
        const response = await axios.get('http://localhost:7070/check', { timeout: 2000 });
        return response.status === 200;
    } catch {
        return false;
    }
}

function startLocalServers() {
    return new Promise((resolve, reject) => {
        const serversFolder = getLocalServersPath();
        const scriptFullPath = path.join(serversFolder, 'start_servers.js');

        console.log(`[serverManager] Using server path: ${serversFolder}`);
        console.log(`[serverManager] Attempting to start servers with: ${scriptFullPath}`);

        childProcess = spawn('node', [scriptFullPath], {
            cwd: serversFolder
        });

        childProcess.stdout.on('data', (data) => {
            console.log(`[start_servers.js]: ${data.toString().trim()}`);
        });

        childProcess.stderr.on('data', (data) => {
            console.error(`[start_servers.js ERR]: ${data.toString().trim()}`);
        });

        childProcess.on('error', (error) => {
            console.error('start_servers.js failed:', error);
            reject(error);
        });

        // Polling setup to check server status
        let attempts = 0;
        const maxAttempts = 160;
        const checkInterval = 500;

        const checkServer = async () => {
            try {
                const isRunning = await isLocalServerRunning();
                if (isRunning) {
                    console.log('Servers are confirmed running.');
                    resolve();
                } else {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        reject(new Error('Servers did not start within the allotted time.'));
                    } else {
                        setTimeout(checkServer, checkInterval);
                    }
                }
            } catch (error) {
                reject(error);
            }
        };

        // Start the initial check after a short delay
        setTimeout(checkServer, checkInterval);
    });
}

function stopLocalServers() {
    if (childProcess) {
        console.log('Stopping local servers...');
        treeKill(childProcess.pid, 'SIGTERM', (err) => {
            if (err) {
                console.error('SIGTERM failed, trying SIGKILL...');
                treeKill(childProcess.pid, 'SIGKILL', (killErr) => {
                    if (killErr) {
                        console.error('SIGKILL also failed:', killErr);
                    } else {
                        console.log('Local servers force-killed (SIGKILL).');
                    }
                });
            } else {
                console.log('Local servers stopped with SIGTERM.');
            }
            childProcess = null;
        });
    }
}

module.exports = {
    isLocalServerRunning,
    startLocalServers,
    stopLocalServers,
};
