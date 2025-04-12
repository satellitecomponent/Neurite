const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const { app } = require('electron');

const owner = 'satellitecomponent';
const repo = 'neurite';
const assetName = 'frontend.zip';

function getFrontendExtractBasePath() {
    return path.join(app.getPath('userData'), 'frontend');
}

function getFrontendExtractPath(version) {
    return path.join(getFrontendExtractBasePath(), version);
}

function getVersionCacheFilePath() {
    return path.join(getFrontendExtractBasePath(), 'version.json');
}

function getCachedVersion() {
    try {
        const data = fs.readFileSync(getVersionCacheFilePath(), 'utf8');
        const parsed = JSON.parse(data);
        return parsed.version;
    } catch {
        return null;
    }
}

function saveVersion(version) {
    fs.writeFileSync(getVersionCacheFilePath(), JSON.stringify({ version }), 'utf8');
}

function deleteOldVersionsExcept(versionToKeep) {
    const baseDir = getFrontendExtractBasePath();
    if (!fs.existsSync(baseDir)) return;

    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== versionToKeep) {
            const fullPath = path.join(baseDir, entry.name);
            fs.rmSync(fullPath, { recursive: true, force: true });
        }
    }
}

async function getLatestFrontendRelease() {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`;

    const response = await axios.get(apiUrl, {
        headers: { 'User-Agent': 'Neurite-Frontend-Updater' }
    });

    const releases = response.data
        .filter(r => r.tag_name.startsWith('frontend-') && !r.draft && !r.prerelease)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (!releases.length) {
        throw new Error('No frontend-* release found');
    }

    const latest = releases[0];
    const asset = latest.assets.find(a => a.name === assetName);
    if (!asset) {
        throw new Error(`Asset "${assetName}" not found in latest frontend release`);
    }

    return {
        version: latest.tag_name,
        downloadUrl: asset.browser_download_url
    };
}

async function ensureFrontendDownloaded() {
    let latest;
    const cachedVersion = getCachedVersion();
    let versionToUse = cachedVersion;

    try {
        latest = await getLatestFrontendRelease();
        versionToUse = latest.version;
    } catch (err) {
        console.warn(`[frontend] Failed to fetch latest release: ${err.message}`);
        if (cachedVersion) {
            console.log(`[frontend] Falling back to cached ${cachedVersion}`);
            return getFrontendExtractPath(cachedVersion);
        }
        console.warn(`[frontend] No cached version. Fallback required.`);
        return null;
    }

    const versionRoot = getFrontendExtractPath(versionToUse);
    const checkFile = path.join(versionRoot, 'index.html');

    if (fs.existsSync(checkFile)) {
        console.log(`[frontend] Using existing ${versionToUse}`);
        return versionRoot;
    }

    try {
        console.log(`[frontend] Downloading Neurite ${versionToUse}...`);

        fs.mkdirSync(versionRoot, { recursive: true });
        const zipPath = path.join(versionRoot, 'frontend.zip');

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

        saveVersion(versionToUse);
        deleteOldVersionsExcept(versionToUse);

        console.log(`[frontend] Neurite ${versionToUse} ready.`);
        return versionRoot;
    } catch (err) {
        console.warn(`[frontend] Failed to download or extract: ${err.message}`);
        if (cachedVersion && cachedVersion !== versionToUse) {
            console.log(`[frontend] Falling back to cached version: ${cachedVersion}`);
            return getFrontendExtractPath(cachedVersion);
        }
        console.warn(`[frontend] No usable frontend available.`);
        return null;
    }
}

module.exports = {
    ensureFrontendDownloaded
};
