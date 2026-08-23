/**
 * 临时调试脚本：查询pipeline task完整结构（顶层字段+feedback详情）
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const matches = envContent.match(/^REQUEST_SECRET=(.+)$/gm);
const token = matches[matches.length - 1].split('=')[1].trim();

const taskId = process.argv[2] || 'task_1782174835645_3sstnc';

const req = http.request({
    hostname: '127.0.0.1',
    port: 3001,
    path: `/api/pipeline/task/${taskId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
}, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        try {
            const body = JSON.parse(d);
            if (body.result && body.result.log) {
                console.log('task status:', body.status);
                console.log('task error:', body.error || 'N/A');
                console.log('log entries:', body.result.log.length);
                body.result.log.forEach((entry, i) => {
                    console.log(`\n=== Step ${i}: ${entry.step} ===`);
                    console.log('  passed:', entry.passed);
                    console.log('  topKeys:', Object.keys(entry).join(','));
                    if (entry.feedback) {
                        console.log('  feedback.passed:', entry.feedback.passed);
                        console.log('  feedback.summary:', (entry.feedback.summary || '').substring(0, 200));
                        console.log('  feedback._hardBlock:', entry.feedback._hardBlock || false);
                        console.log('  feedback._criticalBlocker:', entry.feedback._criticalBlocker || false);
                        console.log('  feedback._autoCorrected:', entry.feedback._autoCorrected || false);
                        if (entry.feedback.issues && entry.feedback.issues.length > 0) {
                            console.log('  issues count:', entry.feedback.issues.length);
                            entry.feedback.issues.forEach((iss, ii) => {
                                const title = iss.title || iss.description || '';
                                console.log(`    issue[${ii}]: severity=${iss.severity}, title=${title.substring(0, 120)}`);
                            });
                        }
                    }
                });
            } else {
                console.log('no log found, body keys:', Object.keys(body).join(','));
            }
        } catch (e) {
            console.log('Parse error:', e.message);
            console.log('raw:', d.substring(0, 500));
        }
    });
});

req.on('error', e => console.log('Error:', e.message));
req.end();
