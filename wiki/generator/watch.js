import chokidar from 'chokidar';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const generatorDir = path.resolve(__dirname);
const buildScript = path.join(__dirname, 'build.js');

console.log('[watch] Watching:', generatorDir);
runBuild(); // Initial build

const validExtensions = ['.md', '.html', '.js', '.css', '.svg'];

// Watch all files in generator/, but exclude build.js and non-matching extensions
chokidar.watch(generatorDir, {
    ignoreInitial: true,
    usePolling: true,
    interval: 100,
    depth: 10
}).on('all', (event, filePath) => {
    const ext = path.extname(filePath);
    const isBuildScript = path.resolve(filePath) === buildScript;
    if (!validExtensions.includes(ext) || isBuildScript) return;

    console.log(`[watch] ${event}: ${filePath}`);
    runBuild();
});

function runBuild() {
    console.log('[watch] Running build...');
    exec(`node "${buildScript}"`, (err, stdout, stderr) => {
        if (stdout) process.stdout.write(stdout);
        if (stderr) process.stderr.write(stderr);
        if (err) console.error('[watch] Build error:', err);
    });
}
