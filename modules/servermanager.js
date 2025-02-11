const { spawn, execSync } = require('child_process');
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
            cwd: serversFolder,
            detached: true,
            stdio: 'ignore'
        });

        childProcess.unref(); // Allows process to run independently

        let attempts = 0;
        const maxAttempts = 1600;
        const checkInterval = 500;

        const checkServer = async () => {
            try {
                if (await isLocalServerRunning()) {
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

        setTimeout(checkServer, checkInterval);
    });
}

function stopLocalServers() {
    if (!childProcess) {
        console.log('No local server process found.');
        return;
    }

    console.log('Stopping local servers...');

    try {
        // First, try SIGTERM
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
        });

        // Ensure all subprocesses are terminated on macOS
        if (process.platform === 'darwin') {
            try {
                const pid = childProcess.pid;
                console.log(`Ensuring process tree for PID ${pid} is terminated on macOS...`);
                execSync(`pkill -P ${pid} || kill -9 ${pid}`);
                console.log('Successfully killed child processes on macOS.');
            } catch (killError) {
                console.error('Failed to kill processes on macOS:', killError);
            }
        }

    } catch (error) {
        console.error('Error stopping local servers:', error);
    }

    childProcess = null;
}

module.exports = {
    isLocalServerRunning,
    startLocalServers,
    stopLocalServers,
};
