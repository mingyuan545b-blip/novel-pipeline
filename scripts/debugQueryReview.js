/**
 * 临时调试脚本：查询chapter的firstReviewOutput详情
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const matches = envContent.match(/^REQUEST_SECRET=(.+)$/gm);
const token = matches[matches.length - 1].split('=')[1].trim();

const chapterId = process.argv[2] || '37ad66f0-bc35-4787-907f-acbe7f05d388';
const reviewType = process.argv[3] || 'first'; // first | second

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
            const text = (reviewType === 'second' ? j.secondReviewOutput : j.firstReviewOutput) || '';
            // 提取JSON块
            const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[1]);
                console.log('=== first-review JSON ===');
                console.log('passed:', parsed.passed);
                console.log('summary:', parsed.summary);
                if (parsed.issues) {
                    parsed.issues.forEach((iss, i) => {
                        console.log(`\nissue[${i}]:`);
                        console.log('  severity:', iss.severity);
                        console.log('  title:', iss.title);
                        console.log('  originalText:', (iss.originalText || '').substring(0, 300));
                        console.log('  violationReason:', (iss.violationReason || '').substring(0, 300));
                        console.log('  howToFix:', (iss.howToFix || '').substring(0, 200));
                    });
                }
            } else {
                console.log('no json block found');
                console.log('first 2000 chars:', text.substring(0, 2000));
            }
        } catch (e) {
            console.log('Parse error:', e.message);
        }
    });
});

req.on('error', e => console.log('Error:', e.message));
req.end();
