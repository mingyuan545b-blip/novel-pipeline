/**
 * 临时调试：查询项目的所有章节
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const matches = envContent.match(/^REQUEST_SECRET=(.+)$/gm);
const token = matches[matches.length - 1].split('=')[1].trim();

const projectId = process.argv[2];

if (!projectId) {
    console.log('用法: node debugQueryChapters.js <projectId>');
    process.exit(1);
}

const req = http.request({
    hostname: '127.0.0.1',
    port: 3001,
    path: `/api/chapters?projectId=${projectId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
}, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        try {
            const j = JSON.parse(d);
            const chapters = Array.isArray(j) ? j : (j.chapters || j.data || []);
            console.log(`找到 ${chapters.length} 个章节`);
            chapters.forEach((ch, i) => {
                console.log(`ch${ch.chapterNumber}: id=${ch.id}, status=${ch.status}, wordCount=${ch.wordCount}, round=${ch.round}`);
            });
        } catch (e) {
            console.log('Error:', e.message);
            console.log('response:', d.substring(0, 500));
        }
    });
});
req.on('error', e => console.log('Error:', e.message));
req.end();
