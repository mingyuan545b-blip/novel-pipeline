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
    console.log('1. 停止无限流水线...');
    await apiCall('POST', `/api/pipeline/infinite/stop`, { projectId: PROJECT_ID });

    console.log('\n2. 重置第1章状态...');
    const ch = (await apiCall('GET', `/api/chapters/${CH1_ID}`)).data;
    ch.status = 'outlined';
    ch._reviewRounds = 0;
    ch._wordCountRetry = 0;
    delete ch._skipReason;
    delete ch.content;
    delete ch.firstReviewOutput;
    delete ch.secondReviewOutput;
    delete ch.round;
    await apiCall('PUT', `/api/chapters/${CH1_ID}`, ch);
    console.log('第1章已重置');

    console.log('\n3. 启动单章Pipeline（同步等待）...');
    const result = await apiCall('POST', '/api/pipeline/full', {
        projectId: PROJECT_ID,
        chapterId: CH1_ID,
        maxRounds: 3
    });
    console.log('Pipeline启动结果:', JSON.stringify(result.data).substring(0, 500));

    console.log('\n4. 等待120秒后检查结果...');
    await new Promise(r => setTimeout(r, 120000));

    const chResult = (await apiCall('GET', `/api/chapters/${CH1_ID}`)).data;
    console.log('\n=== 第1章结果 ===');
    console.log('状态:', chResult.status);
    console.log('字数:', chResult.content ? chResult.content.replace(/\s/g, '').length : 0);
    console.log('审核轮次:', chResult._reviewRounds);
    console.log('内容预览:', (chResult.content || '').substring(0, 500));

    if (chResult.firstReviewOutput) {
        console.log('\n初审输出预览:', chResult.firstReviewOutput.substring(0, 300));
    }
    if (chResult.materialManagerOutput) {
        console.log('\n素材管理输出预览:', chResult.materialManagerOutput.substring(0, 200));
    }
}

main().catch(e => console.error('Error:', e.message));
