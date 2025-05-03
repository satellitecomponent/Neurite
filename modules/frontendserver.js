const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const net = require('net');

let server = null;
let connections = new Set();

async function findNextFreePort(startPort, host = '127.0.0.1') {
    let port = startPort;
    while (await isPortInUse(port, host)) {
        port++;
        if (port > 65535) throw new Error('No free port found');
    }
    return port;
}

function isPortInUse(port, host = '127.0.0.1') {
    return new Promise((resolve) => {
        const req = http.get({ host, port, path: '/index.html', timeout: 1500 }, (res) => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                const isValid = /<title>\s*Neurite\s*<\/title>/i.test(data);
                resolve(isValid);
            });
        });

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
    });
}

async function startFrontendServer(distPath, port = 8080) {
    const alreadyRunning = await isPortInUse(port);
    if (alreadyRunning) {
        const url = `http://localhost:${port}`;
        console.log('[frontend] Using existing server at', url);
        return url;
    }

    // If port is in use but not valid, find another
    const portFree = await new Promise((resolve) => {
        const tester = net.createConnection({ port, host: '127.0.0.1' }, () => {
            tester.end();
            resolve(false); // something else is using it
        });
        tester.on('error', () => resolve(true));
    });

    if (!portFree) {
        const fallbackPort = await findNextFreePort(port + 1);
        console.warn(`[frontend] Port ${port} was occupied by non-Neurite process. Using port ${fallbackPort} instead.`);
        port = fallbackPort;
    }

    return new Promise((resolve, reject) => {
        server = http.createServer((req, res) => {
            if (!['GET', 'HEAD'].includes(req.method)) {
                res.writeHead(405, {
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': `http://localhost:${port}`
                });
                return res.end('Method Not Allowed');
            }

            try {
                const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
                let pathname = decodeURIComponent(parsedUrl.pathname);
                if (pathname === '/') pathname = '/index.html';

                const filePath = path.join(distPath, pathname);
                const ext = path.extname(filePath).toLowerCase();

                const contentTypes = {
                    '.html': 'text/html',
                    '.js': 'application/javascript',
                    '.mjs': 'application/javascript',
                    '.css': 'text/css',
                    '.json': 'application/json',
                    '.svg': 'image/svg+xml',
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp',
                    '.ico': 'image/x-icon',
                    '.woff': 'font/woff',
                    '.woff2': 'font/woff2',
                    '.ttf': 'font/ttf',
                    '.eot': 'application/vnd.ms-fontobject',
                    '.otf': 'font/otf',
                    '.map': 'application/json',
                    '.txt': 'text/plain',
                    '.xml': 'application/xml',
                    '.wasm': 'application/wasm',
                    '.csv': 'text/csv',
                    '.pdf': 'application/pdf',
                    '.mp4': 'video/mp4',
                    '.webm': 'video/webm',
                    '.mp3': 'audio/mpeg',
                    '.wav': 'audio/wav',
                    '.zip': 'application/zip'
                };

                const contentType = contentTypes[ext] || 'application/octet-stream';

                fs.readFile(filePath, (err, data) => {
                    if (!err) {
                        res.writeHead(200, {
                            'Content-Type': contentType,
                            'Access-Control-Allow-Origin': `http://localhost:${port}`
                        });
                        return res.end(data);
                    }

                    const acceptsHTML = req.headers.accept?.includes('text/html');
                    if (acceptsHTML || !ext) {
                        const fallback = path.join(distPath, 'index.html');
                        fs.readFile(fallback, (errFallback, html) => {
                            if (errFallback) {
                                res.writeHead(500, {
                                    'Content-Type': 'text/plain',
                                    'Access-Control-Allow-Origin': `http://localhost:${port}`
                                });
                                return res.end('Failed to load fallback');
                            }
                            res.writeHead(200, {
                                'Content-Type': 'text/html',
                                'Access-Control-Allow-Origin': `http://localhost:${port}`
                            });
                            res.end(html);
                        });
                    } else {
                        res.writeHead(404, {
                            'Content-Type': 'text/plain',
                            'Access-Control-Allow-Origin': `http://localhost:${port}`
                        });
                        res.end('Not Found');
                    }
                });
            } catch {
                res.writeHead(500, {
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': `http://localhost:${port}`
                });
                res.end('Internal Server Error');
            }
        });

        server.on('connection', (socket) => {
            connections.add(socket);
            socket.on('close', () => connections.delete(socket));
        });

        server.listen(port, '127.0.0.1', () => {
            const url = `http://localhost:${port}`;
            console.log('[frontend] Static server started at', url);
            resolve(url);
        });

        server.on('error', reject);
    });
}


function stopFrontendServer() {
    return new Promise((resolve) => {
        if (!server) return resolve();

        for (const socket of connections) {
            socket.destroy(); // force shutdown
        }
        connections.clear();

        server.close(() => {
            console.log('[frontend] Static server stopped.');
            server = null;
            resolve();
        });
    });
}


module.exports = {
    startFrontendServer,
    stopFrontendServer
};
