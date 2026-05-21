const http = require('http');
const PROJECT_ID = 'ce877373-da85-4e09-bb30-e7a41a930d1e';

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
    console.log('=== 启动无限流水线 ===\n');
    const result = await apiCall('POST', '/api/pipeline/infinite', {
        projectId: PROJECT_ID,
        maxChapters: 10,
        maxRounds: 3
    });
    console.log('启动结果:', result.status, JSON.stringify(result.data));

    await new Promise(r => setTimeout(r, 5000));

    const status = await apiCall('GET', `/api/pipeline/infinite/status/${PROJECT_ID}`);
    console.log('\nPipeline状态:', JSON.stringify(status.data));
}

main().catch(e => console.error('Error:', e.message));
