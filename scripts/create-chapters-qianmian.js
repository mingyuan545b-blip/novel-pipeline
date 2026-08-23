const outlines = require('./qianmianOutlines');
const http = require('http');

const projectId = 'd4808c1a-3378-4372-b672-9d0a6bd075f8';
const SECRET = 'novel-pipeline-2024-secure';

function createChapter(outline) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ projectId, chapterNumber: outline.chapterNumber, title: outline.title, outline: outline.outline, status: 'outlined' });
        const options = { hostname: 'localhost', port: 3001, path: '/api/chapters', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SECRET}`, 'Content-Length': Buffer.byteLength(data) } };
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 201) { const result = JSON.parse(body); console.log(`✓ Ch${outline.chapterNumber}: ${outline.title} (id=${result.id})`); resolve(result); }
                else { console.log(`✗ Ch${outline.chapterNumber}: ${outline.title} - HTTP ${res.statusCode}: ${body}`); reject(new Error(`HTTP ${res.statusCode}`)); }
            });
        });
        req.on('error', (e) => { console.log(`✗ Ch${outline.chapterNumber}: ${outline.title} - Error: ${e.message}`); reject(e); });
        req.write(data); req.end();
    });
}

async function main() {
    console.log(`Creating ${outlines.length} chapter outlines for project ${projectId}...\n`);
    let success = 0, failed = 0;
    for (const outline of outlines) { try { await createChapter(outline); success++; } catch (e) { failed++; } }
    console.log(`\nDone! Success: ${success}, Failed: ${failed}`);
}

main();
