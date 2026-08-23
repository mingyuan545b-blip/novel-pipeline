/**
 * 临时调试：查找邪教上下文
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const matches = envContent.match(/^REQUEST_SECRET=(.+)$/gm);
const token = matches[matches.length - 1].split('=')[1].trim();

const req = http.request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/chapters/3c1a00b7-3c6d-466c-83a8-6b32a553a5a0',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
}, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        const j = JSON.parse(d);
        const chapter = j.chapter || j;
        const content = chapter.content || '';
        const idx = content.indexOf('邪教');
        if (idx >= 0) {
            console.log('找到邪教 at index', idx);
            const start = Math.max(0, idx - 150);
            const end = Math.min(content.length, idx + 200);
            console.log('context:', content.substring(start, end));
        } else {
            console.log('未找到邪教');
        }
    });
});
req.on('error', e => console.log('Error:', e.message));
req.end();
