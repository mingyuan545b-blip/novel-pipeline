/**
 * 临时调试脚本：查询第4次E2E第1章的pipeline task状态
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const matches = envContent.match(/^REQUEST_SECRET=(.+)$/gm);
const token = matches[matches.length - 1].split('=')[1].trim();

const taskId = 'task_1782174835645_3sstnc';

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
            console.log('=== Task status ===');
            console.log('status:', body.status);
            console.log('error:', body.error);
            console.log('result:', JSON.stringify(body.result, null, 2).substring(0, 3000));
        } catch (e) {
            console.log('Parse error:', e.message);
            console.log('Raw:', d.substring(0, 500));
        }
    });
});

req.on('error', e => console.log('Error:', e.message));
req.end();
