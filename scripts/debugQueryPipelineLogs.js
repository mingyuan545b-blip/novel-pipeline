/**
 * 临时调试脚本：查询chapter的pipeline-logs，查看每轮每步骤的passed值
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const matches = envContent.match(/^REQUEST_SECRET=(.+)$/gm);
const token = matches[matches.length - 1].split('=')[1].trim();

const projectId = process.argv[2];
const chapterId = process.argv[3];

if (!projectId || !chapterId) {
    console.log('用法: node debugQueryPipelineLogs.js <projectId> <chapterId>');
    process.exit(1);
}

const req = http.request({
    hostname: '127.0.0.1',
    port: 3001,
    path: `/api/pipeline/pipeline-logs/${projectId}/${chapterId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
}, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        try {
            const j = JSON.parse(d);
            const entries = j.entries || [];
            console.log(`找到 ${entries.length} 条 pipeline-log 记录`);
            entries.forEach((e, i) => {
                console.log(`\n--- entry[${i}] ---`);
                console.log('step:', e.step, 'round:', e.round, 'passed:', e.passed);
                const fb = e.feedback || e.result?.feedback || {};
                if (fb.summary) console.log('summary:', String(fb.summary).substring(0, 200));
                if (fb._hardBlock) console.log('  ⚠️ _hardBlock=true');
                if (fb._criticalBlocker) console.log('  ⚠️ _criticalBlocker=true');
                if (fb._overridden) console.log('  ℹ️ _overridden=true');
                if (fb.issues && fb.issues.length > 0) {
                    fb.issues.forEach((iss, k) => {
                        console.log(`  issue[${k}]: severity=${iss.severity}, title=${iss.title || iss.desc || ''}`);
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
