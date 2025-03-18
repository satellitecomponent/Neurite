// server.js

const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Helper function to get MIME type based on file extension
function getMimeType(extension) {
    const mimeTypes = {
        // Text files
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.ts': 'application/typescript',
        '.py': 'application/x-python-code',
        '.rb': 'application/x-ruby',
        '.php': 'application/x-httpd-php',
        '.java': 'text/x-java-source',
        '.c': 'text/x-csrc',
        '.cpp': 'text/x-c++src',
        '.cs': 'text/x-csharp',
        '.go': 'text/x-go',
        '.rs': 'application/x-rust',
        '.sh': 'application/x-sh',
        '.xml': 'application/xml',
        '.json': 'application/json',
        '.yml': 'text/yaml',
        '.yaml': 'text/yaml',
        '.csv': 'text/csv',
        // Images
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml',
        // Audio
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        // Video
        '.mp4': 'video/mp4',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.wmv': 'video/x-ms-wmv',
        '.flv': 'video/x-flv',
        '.mkv': 'video/x-matroska',
        // Documents
        '.pdf': 'application/pdf',
        // Archives
        '.zip': 'application/zip',
        '.rar': 'application/x-rar-compressed',
        '.7z': 'application/x-7z-compressed',
        '.tar': 'application/x-tar',
        '.gz': 'application/gzip',
        // Executables
        '.exe': 'application/vnd.microsoft.portable-executable',
        '.msi': 'application/x-msdownload',
        // Fonts
        '.ttf': 'font/ttf',
        '.otf': 'font/otf',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        // Add more MIME types as needed
    };
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

// API to navigate directories and get file structure
app.get('/api/navigate', (req, res) => {
    const dirPath = req.query.path ? path.resolve(req.query.path) : path.resolve('/'); // Root directory by default

    fs.stat(dirPath, (err, stats) => {
        if (err || !stats.isDirectory()) {
            return res.status(400).json({ error: 'Invalid directory path' });
        }

        fs.readdir(dirPath, { withFileTypes: true }, (err, items) => {
            if (err) {
                return res.status(500).json({ error: `Unable to navigate directory: ${err.message}` });
            }

            const response = items.map(item => ({
                name: item.name,
                type: item.isDirectory() ? 'directory' : 'file'
            }));

            res.json(response);
        });
    });
});

// API to stream file content (supports both text and binary files)
app.get('/api/read-file', (req, res) => {
    const filePath = req.query.path ? path.resolve(req.query.path) : null;

    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }

    // Check if file exists and is indeed a file
    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            return res.status(404).json({ error: 'File not found or is not a file' });
        }

        const fileExtension = path.extname(filePath).toLowerCase();
        const mimeType = getMimeType(fileExtension);

        // Set appropriate headers
        res.setHeader('Content-Type', mimeType);

        // Stream the file using fs.createReadStream
        const readStream = fs.createReadStream(filePath, { encoding: mimeType.startsWith('text/') ? 'utf8' : null });

        readStream.on('error', (err) => {
            res.status(500).json({ error: `Unable to read file: ${err.message}` });
        });

        readStream.pipe(res);
    });
});

module.exports = app;