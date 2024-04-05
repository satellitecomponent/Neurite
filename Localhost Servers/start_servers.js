import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import servers from './servers.json' assert { type: 'json' };

const startNeurite = process.argv.includes('neurite');

function checkDependencies(dir) {
    // Check for node_modules and a lock file
    return fs.existsSync(path.join(dir, 'node_modules')) && (fs.existsSync(path.join(dir, 'package-lock.json')) || fs.existsSync(path.join(dir, 'yarn.lock')));
}

function installDependencies(server) {
    const { name, dir } = server;
    if (!checkDependencies(dir)) {
        console.log(`Installing dependencies for ${name} server...`);
        execSync('npm install', { cwd: dir, stdio: 'inherit' });
    }
}

function startServer(server) {
    const { name, dir, main } = server;
    console.log(`Starting ${name} server...`);
    const serverProcess = spawn('node', [main], { cwd: dir, stdio: 'inherit' });

    serverProcess.on('error', (error) => {
        console.error(`Failed to start ${name} server:`, error);
    });

    serverProcess.on('exit', (code) => {
        console.log(`${name} server (PID: ${serverProcess.pid}) exited with code ${code}`);
    });
}

// Iterate over each server and decide on actions based on conditions
servers.forEach(server => {
    // Check if server requires the 'neurite' flag to start
    if (!server.startNeurite || (server.startNeurite && startNeurite)) {
        installDependencies(server); // Install dependencies if needed
        startServer(server); // Then start server
    } else {
        console.log(`Skipping ${server.name} server as it requires the 'neurite' flag.`);
    }
});