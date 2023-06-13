const { spawn } = require('child_process');

// Define your servers with their start commands
const servers = [
    { dir: './webscrape', cmd: 'npm', args: ['install', '&&', 'npm', 'start'] },
    { dir: './wikisearch', cmd: 'python', args: ['novelty.py'] },
    { dir: './wolfram-alpha', cmd: 'npm', args: ['install', '&&', 'npm', 'start'] },
];

// Start each server
servers.forEach(({ dir, cmd, args }) => {
    const server = spawn(cmd, args, { cwd: dir, shell: true });

    // Optional: Log server output to console
    server.stdout.on('data', data => console.log(`stdout: ${data}`));
    server.stderr.on('data', data => console.error(`stderr: ${data}`));
    server.on('error', error => console.error(`error: ${error.message}`));
});