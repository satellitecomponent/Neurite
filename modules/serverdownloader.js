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
        return JSON.parse(data).version;
    } catch {
        return null;
    }
}

function saveVersion(version) {
    fs.writeFileSync(getVersionCacheFilePath(), JSON.stringify({ version }), 'utf8');
}

function deleteOldVersionsExcept(versionToKeep) {
    const baseDir = getServerExtractBasePath();
    if (!fs.existsSync(baseDir)) return;

    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== versionToKeep) {
            const fullPath = path.join(baseDir, entry.name);
            console.log(`[downloader] Removing old server version: ${entry.name}`);
            fs.rmSync(fullPath, { recursive: true, force: true });
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
    const { version, downloadUrl } = await getLatestReleaseAssetUrl();
    const cachedVersion = getCachedVersion();
    const versionRoot = getServerExtractPath(version);
    const serverRoot = path.join(versionRoot, 'localhost_servers');
    const checkFile = path.join(serverRoot, 'start_servers.js');

    if (version === cachedVersion && fs.existsSync(checkFile)) {
        console.log(`[downloader] Server version '${version}' already downloaded at ${serverRoot}`);
        return serverRoot;
    }

    console.log(`[downloader] Downloading new server version '${version}' from ${downloadUrl}`);
    fs.mkdirSync(versionRoot, { recursive: true });
    const zipPath = path.join(versionRoot, 'servers.zip');

    const writer = fs.createWriteStream(zipPath);
    const response = await axios.get(downloadUrl, { responseType: 'stream' });
    await new Promise((resolve, reject) => {
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
    });

    console.log('[downloader] Extracting...');
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(versionRoot, true); // true = overwrite

    fs.unlinkSync(zipPath); // clean up

    saveVersion(version);
    deleteOldVersionsExcept(version);

    return serverRoot;
}

module.exports = {
    ensureServersDownloaded
};
