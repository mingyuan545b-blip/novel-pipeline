/**
 * 临时调试：查询chapter的firstReviewOutput
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const matches = envContent.match(/^REQUEST_SECRET=(.+)$/gm);
const token = matches[matches.length - 1].split('=')[1].trim();

const chapterId = process.argv[2];
const reviewType = process.argv[3] || 'first'; // first | second

if (!chapterId) {
    console.log('用法: node debugQueryReviewOutput.js <chapterId> [first|second]');
    process.exit(1);
}

const req = http.request({
    hostname: '127.0.0.1',
    port: 3001,
    path: `/api/chapters/${chapterId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
}, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        try {
            const j = JSON.parse(d);
            const chapter = j.chapter || j;
            const text = (reviewType === 'second' ? j.secondReviewOutput : j.firstReviewOutput) || chapter[reviewType === 'second' ? 'secondReviewOutput' : 'firstReviewOutput'] || '';
            console.log(`=== ${reviewType}ReviewOutput (length=${text.length}) ===`);
            console.log(text.substring(0, 5000));
        } catch (e) {
            console.log('Error:', e.message);
            console.log('response:', d.substring(0, 500));
        }
    });
});
req.on('error', e => console.log('Error:', e.message));
req.end();
