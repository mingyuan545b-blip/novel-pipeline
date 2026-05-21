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
    console.log('=== 获取章节列表 ===\n');
    const result = await apiCall('GET', `/api/chapters?projectId=${PROJECT_ID}`);
    if (Array.isArray(result.data)) {
        const chapters = result.data.sort((a, b) => a.chapterNumber - b.chapterNumber);
        for (const ch of chapters.slice(0, 10)) {
            console.log(`Ch${ch.chapterNumber}: ${ch.title} | ID=${ch.id} | Status=${ch.status}`);
        }
        console.log(`\n共 ${chapters.length} 章`);

        console.log('\n=== 启动无限流水线（前10章）===');
        const pipelineResult = await apiCall('POST', '/api/pipeline/infinite', {
            projectId: PROJECT_ID,
            maxChapters: 10,
            maxRounds: 3
        });
        console.log('Pipeline启动结果:', JSON.stringify(pipelineResult.data));
    } else {
        console.error('获取章节失败:', result.data);
    }
}

main().catch(e => console.error('Error:', e.message));
