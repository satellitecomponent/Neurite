const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const { app } = require('electron');

const owner = 'satellitecomponent';
const repo = 'neurite';
const assetName = 'servers.zip';

function getServerExtractBasePath() {
    return path.join(app.getPath('userData'), 'servers');
}

function getServerExtractPath(version) {
    return path.join(getServerExtractBasePath(), version);
}

function getVersionCacheFilePath() {
    return path.join(getServerExtractBasePath(), 'version.json');
}

function getCachedVersion() {
    try {
        const data = fs.readFileSync(getVersionCacheFilePath(), 'utf8');
        const parsed = JSON.parse(data);
        return parsed.version;
    } catch (err) {
        return null;
    }
}

function saveVersion(version) {
    fs.writeFileSync(getVersionCacheFilePath(), JSON.stringify({ version }), 'utf8');
}

function deleteOldVersionsExcept(versionToKeep) {
    const baseDir = getServerExtractBasePath();
    if (!fs.existsSync(baseDir)) {
        console.log(`[debug] No base directory to clean.`);
        return;
    }

    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== versionToKeep) {
            const fullPath = path.join(baseDir, entry.name);
            fs.rmSync(fullPath, { recursive: true, force: true });
        }
    }
}

function preservePathsBeforeUpdate(baseDir, patterns) {
    const preserved = [];

    if (!fs.existsSync(baseDir)) {
        console.log(`[debug] Base directory for preservation does not exist: ${baseDir}`);
        return preserved;
    }

    function recurse(current) {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);

            if (entry.isDirectory()) {
                if (patterns.includes(entry.name)) {
                    const relPath = path.relative(baseDir, fullPath);
                    preserved.push({ type: 'dir', relPath, src: fullPath });
                } else {
                    recurse(fullPath);
                }
            } else {
                if (patterns.includes(entry.name)) {
                    const relPath = path.relative(baseDir, fullPath);
                    const contents = fs.readFileSync(fullPath);
                    preserved.push({ type: 'file', relPath, contents });
                }
            }
        }
    }

    recurse(baseDir);
    return preserved;
}

function restorePreservedPaths(baseDir, preserved) {
    for (const item of preserved) {
        const targetPath = path.join(baseDir, item.relPath);

        if (item.type === 'file') {
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, item.contents);
        } else if (item.type === 'dir') {
            fs.cpSync(item.src, targetPath, { recursive: true });
        }
    }
}

async function getLatestReleaseAssetUrl() {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`;

    const response = await axios.get(apiUrl, {
        headers: { 'User-Agent': 'Neurite-Electron-Updater' }
    });

    const releases = response.data
        .filter(r => r.tag_name.startsWith('servers-') && !r.draft && !r.prerelease)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (releases.length === 0) {
        throw new Error(`No servers-* release found`);
    }

    const latest = releases[0];
    const asset = latest.assets.find(a => a.name === assetName);
    if (!asset) {
        throw new Error(`Asset "${assetName}" not found in latest servers release.`);
    }

    return {
        version: latest.tag_name,
        downloadUrl: asset.browser_download_url
    };
}

async function ensureServersDownloaded() {
    let latest;
    let wasDownloaded = false;
    let preservedItems = [];

    try {
        latest = await getLatestReleaseAssetUrl();
    } catch (err) {
        console.warn(`[downloader] Failed to fetch latest release info: ${err.message}`);
    }

    const cachedVersion = getCachedVersion();
    const versionToUse = latest?.version || cachedVersion;
    const versionRoot = getServerExtractPath(versionToUse);
    const serverRoot = path.join(versionRoot, 'localhost_servers');
    const checkFile = path.join(serverRoot, 'start_servers.js');

    const needsDownload = !fs.existsSync(checkFile);

    if (needsDownload) {
        if (!latest) {
            throw new Error('[downloader] No usable server version available.');
        }

        if (cachedVersion) {
            const oldServerRoot = path.join(getServerExtractPath(cachedVersion), 'localhost_servers');
            preservedItems = preservePathsBeforeUpdate(oldServerRoot, ['database.db', 'node_modules']);
        }

        fs.mkdirSync(versionRoot, { recursive: true });
        const zipPath = path.join(versionRoot, 'servers.zip');

        const writer = fs.createWriteStream(zipPath);
        const response = await axios.get(latest.downloadUrl, { responseType: 'stream' });
        await new Promise((resolve, reject) => {
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        const zip = new AdmZip(zipPath);
        zip.extractAllTo(versionRoot, true);
        fs.unlinkSync(zipPath);

        restorePreservedPaths(serverRoot, preservedItems);

        saveVersion(latest.version);
        deleteOldVersionsExcept(latest.version);

        wasDownloaded = true;
    }

    const summary = {
        status: wasDownloaded ? 'Downloaded new' : 'Using cached',
        version: versionToUse
    };

    console.log(`[updater] ${summary.status} localhost_${summary.version}`);

    return serverRoot;
}


module.exports = {
    ensureServersDownloaded
};
