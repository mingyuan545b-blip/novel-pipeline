/**
 * 甜宠漫剧大纲生成脚本（使用已有项目）
 */
const http = require('http');
const REQUEST_SECRET = 'dev';

function apiRequest(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const postData = body ? JSON.stringify(body) : '';
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (body) headers['Content-Length'] = Buffer.byteLength(postData);
        const req = http.request({ hostname: 'localhost', port: 3001, path, method, headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, data: data.substring(0, 3000) }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(postData);
        req.end();
    });
}

async function main() {
    const projectId = '49d5a6bf-0705-4b7b-a651-7142f1cf84a1';

    // Step 1: Get auth token
    const authRes = await apiRequest('POST', '/api/auth/token', { secret: REQUEST_SECRET });
    if (authRes.status !== 200) { console.error('Auth failed'); process.exit(1); }
    const token = authRes.data.token;
    console.log('Token obtained');

    // Step 2: Verify project
    const getRes = await apiRequest('GET', `/api/projects/${projectId}`, null, token);
    console.log('Project:', getRes.data?.name, '| Genre:', getRes.data?.genre, '| Mode:', getRes.data?.mode);

    // Step 3: Check existing materials
    const matRes = await apiRequest('GET', `/api/materials?projectId=${projectId}`, null, token);
    if (matRes.status === 200 && Array.isArray(matRes.data)) {
        console.log('Existing materials:', matRes.data.length);
        const types = {};
        matRes.data.forEach(m => { types[m.type] = (types[m.type] || 0) + 1; });
        console.log('Material types:', JSON.stringify(types));
    }

    // Step 4: Generate chapter outlines
    console.log('\nGenerating chapter outlines...');
    const outlineRes = await apiRequest('POST', '/api/pipeline/generate-outlines', {
        projectId,
        prompt: '生成25章完整大纲，严格遵循甜宠匠心节奏：1章巷口相遇，3章职业交集，5章首次心动，10章大甜+关系升级+创作合作确立，15章小虐转折（拆迁危机+旧伤复发），25章终极甜蜜。每章大纲必须包含1个可画面化的名场面。',
        targetChapters: 25
    }, token);
    console.log('Outlines Status:', outlineRes.status);
    if (outlineRes.data.error) {
        console.log('Outlines Error:', outlineRes.data.error);
    } else {
        console.log('Outlines Count:', outlineRes.data.count || outlineRes.data.outlines?.length || 'unknown');
        if (outlineRes.data.outlines) {
            outlineRes.data.outlines.forEach(o => {
                console.log(`  Ch${o.chapterNumber}: ${o.title}`);
            });
        }
    }

    // Step 5: Verify outlines in DB
    const olRes = await apiRequest('GET', `/api/chapter-outlines?projectId=${projectId}`, null, token);
    if (olRes.status === 200 && Array.isArray(olRes.data)) {
        console.log('\nSaved outlines:', olRes.data.length);
        olRes.data.slice(0, 5).forEach(o => console.log(`  Ch${o.chapterNumber}: ${o.title}`));
    }
}

main().catch(e => console.error('Error:', e));
