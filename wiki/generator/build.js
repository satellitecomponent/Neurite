import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, 'pages');
const outRoot = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(__dirname, '_template.html'), 'utf-8');

// Preserve these entries in /wiki/
const PRESERVE = new Set(['generator', 'style.css', 'client.js']);

// Step 1: Clean old pages
fs.readdirSync(outRoot).forEach(entry => {
    const fullPath = path.join(outRoot, entry);
    if (fs.statSync(fullPath).isDirectory() && !PRESERVE.has(entry)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`✗ Removed outdated page: /wiki/${entry}/`);
    }
});

// Step 2: Build new pages from .md or .html
fs.readdirSync(srcDir).forEach(file => {
    const ext = path.extname(file);
    if (!['.md', '.html'].includes(ext)) return;

    const slug = path.basename(file, ext);
    const raw = fs.readFileSync(path.join(srcDir, file), 'utf-8');
    const content = ext === '.md' ? marked.parse(raw) : raw;

    const title = raw.match(/^#\s+(.*)/)?.[1]  // from Markdown
        || raw.match(/<h1[^>]*>(.*?)<\/h1>/i)?.[1]  // from HTML
        || slug;
    const desc = `Neurite Wiki page for ${title}`;

    const finalHtml = template
        .replace(/%%TITLE%%/g, `${title} – Neurite Wiki`)
        .replace(/%%DESCRIPTION%%/g, desc)
        .replace(/%%CONTENT%%/g, content);

    const targetDir = path.join(outRoot, slug);
    const outFile = path.join(targetDir, 'index.html');
    fs.mkdirSync(targetDir, { recursive: true });

    const prev = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf-8') : '';
    if (prev !== finalHtml) {
        fs.writeFileSync(outFile, finalHtml);
        console.log(`✓ Built /wiki/${slug}/`);
    } else {
        console.log(`↺ Unchanged: /wiki/${slug}/`);
    }
});

// Collect page slugs from all .md/.html files in pages/
const articles = fs.readdirSync(srcDir)
    .filter(file => ['.md', '.html'].includes(path.extname(file)))
    .map(file => path.basename(file, path.extname(file)));

// Write to wiki/articles.json
fs.writeFileSync(
    path.join(outRoot, 'articles.json'),
    JSON.stringify(articles, null, 2)
);