const http = require('http');
const PROJECT_ID = 'ce877373-da85-4e09-bb30-e7a41a930d1e';
const CH1_ID = '486f40a6-807e-491a-b95c-b82ae2f7b55f';

function apiCall(method, path, body) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : '';
        const options = {
            hostname: 'localhost', port: 3001, path, method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
        const req = http.request(options, (res) => {
            let responseBody = '';
            res.on('data', chunk => responseBody += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(responseBody) }); }
                catch (_) { resolve({ status: res.statusCode, data: responseBody }); }
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function main() {
    console.log('=== 停止无限流水线 ===');
    await apiCall('POST', `/api/pipeline/infinite/stop`, { projectId: PROJECT_ID });

    console.log('\n=== 单章测试：第1章 ===');
    const result = await apiCall('POST', '/api/pipeline/full', {
        projectId: PROJECT_ID,
        chapterId: CH1_ID,
        maxRounds: 3
    });
    console.log('Pipeline结果:', JSON.stringify(result.data, null, 2).substring(0, 2000));
}

main().catch(e => console.error('Error:', e.message));
