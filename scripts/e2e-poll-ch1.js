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
    console.log('1. 重置第1章...');
    const ch = (await apiCall('GET', `/api/chapters/${CH1_ID}`)).data;
    ch.status = 'outlined';
    ch._reviewRounds = 0;
    ch._wordCountRetry = 0;
    delete ch._skipReason;
    delete ch.content;
    delete ch.firstReviewOutput;
    delete ch.secondReviewOutput;
    delete ch.round;
    delete ch.skipUntil;
    await apiCall('PUT', `/api/chapters/${CH1_ID}`, ch);
    console.log('第1章已重置');

    console.log('\n2. 启动单章Pipeline...');
    const result = await apiCall('POST', '/api/pipeline/full', {
        projectId: PROJECT_ID,
        chapterId: CH1_ID,
        maxRounds: 3
    });
    console.log('启动:', JSON.stringify(result.data));

    console.log('\n3. 每30秒轮询一次状态，最多等5分钟...');
    for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 30000));
        const chResult = (await apiCall('GET', `/api/chapters/${CH1_ID}`)).data;
        const wc = chResult.content ? chResult.content.replace(/\s/g, '').length : 0;
        console.log(`[${(i+1)*30}s] 状态=${chResult.status} 字数=${wc} 轮次=${chResult._reviewRounds || 0}`);
        if (chResult.status === 'material-updated' || chResult.status === 'approved') {
            console.log('\n=== Pipeline完成！===');
            console.log('最终字数:', wc);
            console.log('内容预览:', (chResult.content || '').substring(0, 500));
            if (chResult.firstReviewOutput) console.log('\n初审:', chResult.firstReviewOutput.substring(0, 300));
            if (chResult.materialManagerOutput) console.log('\n素材管理:', chResult.materialManagerOutput.substring(0, 200));
            break;
        }
        if (['failed-skipped', 'timeout-skipped', 'permanently-skipped', 'pipeline-failed', 'context-error'].includes(chResult.status)) {
            console.log('\n=== Pipeline失败 ===');
            console.log('失败状态:', chResult.status);
            console.log('跳过原因:', chResult._skipReason || 'unknown');
            break;
        }
    }
}

main().catch(e => console.error('Error:', e.message));
