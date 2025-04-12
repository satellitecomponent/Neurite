const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

let server = null;
let connections = new Set();

function startFrontendServer(distPath, port = 8080) {
    return new Promise((resolve, reject) => {
        server = http.createServer((req, res) => {
            if (!['GET', 'HEAD'].includes(req.method)) {
                res.writeHead(405, {
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': 'http://localhost:8080'
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
                            'Access-Control-Allow-Origin': 'http://localhost:8080'
                        });
                        res.end(data);
                        return;
                    }

                    const acceptsHTML = req.headers.accept?.includes('text/html');
                    if (acceptsHTML || !ext) {
                        const fallback = path.join(distPath, 'index.html');
                        fs.readFile(fallback, (errFallback, html) => {
                            if (errFallback) {
                                res.writeHead(500, {
                                    'Content-Type': 'text/plain',
                                    'Access-Control-Allow-Origin': 'http://localhost:8080'
                                });
                                res.end('Failed to load fallback');
                            } else {
                                res.writeHead(200, {
                                    'Content-Type': 'text/html',
                                    'Access-Control-Allow-Origin': 'http://localhost:8080'
                                });
                                res.end(html);
                            }
                        });
                    } else {
                        res.writeHead(404, {
                            'Content-Type': 'text/plain',
                            'Access-Control-Allow-Origin': 'http://localhost:8080'
                        });
                        res.end('Not Found');
                    }
                });
            } catch {
                res.writeHead(500, {
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': 'http://localhost:8080'
                });
                res.end('Internal Server Error');
            }
        });

        server.on('connection', (socket) => {
            connections.add(socket);
            socket.on('close', () => connections.delete(socket));
        });

        server.listen(port, '127.0.0.1', () => {
            const url = `http://localhost:${server.address().port}`;
            console.log('[frontend] Static server running at', url);
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
