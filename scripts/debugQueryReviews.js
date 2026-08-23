/**
 * 临时调试脚本：查询chapter的reviews记录
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const matches = envContent.match(/^REQUEST_SECRET=(.+)$/gm);
const token = matches[matches.length - 1].split('=')[1].trim();

const chapterId = process.argv[2];

const req = http.request({
    hostname: '127.0.0.1',
    port: 3001,
    path: `/api/reviews?chapterId=${chapterId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
}, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        try {
            const j = JSON.parse(d);
            const reviews = Array.isArray(j) ? j : (j.reviews || j.data || []);
            console.log(`找到 ${reviews.length} 条 review 记录`);
            reviews.forEach((r, i) => {
                console.log(`\n--- review[${i}] ---`);
                console.log('step:', r.step, 'round:', r.round, 'passed:', r.passed);
                console.log('summary:', (r.content || r.result?.summary || '').substring(0, 200));
                if (r.issues && r.issues.length > 0) {
                    r.issues.forEach((iss, j) => {
                        console.log(`  issue[${j}]: severity=${iss.severity}, title=${iss.title || iss.desc || ''}`);
                    });
                }
            });
        } catch (e) {
            console.log('Error:', e.message);
            console.log('response:', d.substring(0, 500));
        }
    });
});

req.on('error', e => console.log('Error:', e.message));
req.end();
