const { app, dialog } = require('electron');
const axios = require('axios');
const os = require('os');
const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

const owner = 'satellitecomponent';
const repo = 'neurite';

function getEmbeddedVersion() {
    try {
        const versionPath = path.join(__dirname, 'build-version.json');
        const raw = fs.readFileSync(versionPath, 'utf8');
        return JSON.parse(raw).version || 'unknown';
    } catch {
        console.warn('[updater] Missing build-version.json');
        return 'unknown';
    }
}

function platformKey() {
    const map = {
        darwin: 'mac',
        win32: 'win',
        linux: 'linux'
    };
    return map[os.platform()] || 'unknown';
}

function getExtensionForPlatform(platform) {
    switch (platform) {
        case 'win': return '.exe';
        case 'mac': return '.dmg';
        case 'linux': return '.AppImage';
        default: throw new Error(`Unsupported platform: ${platform}`);
    }
}

async function getLatestRelease() {
    const res = await axios.get(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`, {
        headers: { 'User-Agent': 'Neurite-Updater' },
        timeout: 5000
    });

    const releases = res.data
        .filter(r => r.tag_name.startsWith('electron-') && !r.draft && !r.prerelease)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (!releases.length) throw new Error('No valid electron-* releases found.');
    return releases[0];
}

async function initializeUpdater() {
    let latest;
    try {
        latest = await getLatestRelease();
    } catch (err) {
        console.warn('[updater] Could not fetch release info:', err.message);
        return true;
    }

    const embeddedVersion = getEmbeddedVersion(); // e.g., "2025.04.01.123045"
    const latestTag = latest.tag_name.replace(/^electron-/, '');
    const platform = platformKey();
    const ext = getExtensionForPlatform(platform);

    if (embeddedVersion === latestTag) {
        console.log(`[updater] App is up to date (v${embeddedVersion})`);
        return true;
    }

    const asset = latest.assets.find(a => a.name.toLowerCase().endsWith(ext));
    if (!asset) {
        console.warn(`[updater] No matching asset found for platform "${platform}"`);
        return true;
    }

    const response = await dialog.showMessageBox({
        type: 'question',
        buttons: ['Update & Restart', 'Later'],
        defaultId: 0,
        cancelId: 1,
        title: 'Update Available',
        message: `A new version (${latestTag}) is available.`,
        detail: `Download and install Neurite now?`,
        noLink: true
    });

    if (response.response === 0) {
        await downloadAndInstall(asset.browser_download_url, platform, ext);
        return false;
    }

    return true;
}

async function downloadAndInstall(url, platform, ext) {
    const outPath = path.join(os.tmpdir(), `Neurite-${platform}${ext}`);
    const writer = fs.createWriteStream(outPath);

    const response = await axios.get(url, { responseType: 'stream' });
    await new Promise((resolve, reject) => {
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
    });

    console.log(`[updater] Downloaded update to: ${outPath}`);
    child_process.spawn(outPath, [], { detached: true, stdio: 'ignore' }).unref();
    app.quit();
}

module.exports = { initializeUpdater };
