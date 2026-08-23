/**
 * 大纲生成+全程监控脚本
 * 生成25章甜宠漫剧大纲，监控设定偏移和数据污染
 */
const http = require('http');
const REQUEST_SECRET = 'dev';

function apiRequest(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const postData = body ? JSON.stringify(body) : '';
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = 'Bearer ' + token;
        if (body) headers['Content-Length'] = Buffer.byteLength(postData);
        const req = http.request({ hostname: 'localhost', port: 3001, path, method, headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, data: data.substring(0, 5000) }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(postData);
        req.end();
    });
}

async function main() {
    const projectId = process.argv[2] || '49d5a6bf-0705-4b7b-a651-7142f1cf84a1';
    const targetChapters = parseInt(process.argv[3]) || 25;

    console.log('=== 甜宠漫剧大纲生成+监控 ===');
    console.log('Project ID:', projectId);
    console.log('Target chapters:', targetChapters);

    // 0. Auth
    const authRes = await apiRequest('POST', '/api/auth/token', { secret: REQUEST_SECRET });
    const token = authRes.data.token;

    // 1. Pre-check: verify project exists and has materials
    console.log('\n--- 预检查 ---');
    const projRes = await apiRequest('GET', '/api/projects/' + projectId, null, token);
    const proj = projRes.data;
    console.log('Project:', proj.name, '| Genre:', proj.genre, '| Mode:', proj.mode);

    const matRes = await apiRequest('GET', '/api/materials?projectId=' + projectId, null, token);
    const materials = Array.isArray(matRes.data) ? matRes.data : [];
    console.log('Materials count:', materials.length);

    if (materials.length === 0) {
        console.error('ERROR: No materials found. Generate materials first.');
        process.exit(1);
    }

    const charMats = materials.filter(m => m.type === 'character');
    console.log('Characters:', charMats.map(m => m.name).join(', '));

    // 2. Generate outlines
    console.log('\n--- 生成大纲 (target=' + targetChapters + ') ---');
    const startTime = Date.now();
    const olRes = await apiRequest('POST', '/api/pipeline/generate-outlines', {
        projectId,
        prompt: '甜宠匠心漫剧节奏：1章相遇→3章职业交集→5章首次心动→10章大甜→15章小虐→25章终极甜蜜。每章必须有画面感名场面，禁止狗血误会，糖虐比7:3',
        targetChapters
    }, token);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('Generation time:', elapsed + 's');
    console.log('Status:', olRes.status);

    if (olRes.status !== 200) {
        console.error('ERROR: Generation failed:', JSON.stringify(olRes.data).substring(0, 500));
        process.exit(1);
    }

    const result = olRes.data;
    console.log('Outlines generated:', result.count || 0);
    if (result.error) console.log('Error:', result.error);
    if (result.rhythmIssues) console.log('Rhythm issues:', result.rhythmIssues);

    // 3. Verify outlines were saved
    console.log('\n--- 验证大纲保存 ---');
    const savedOutlines = result.outlines || result.created || [];
    console.log('Saved outlines count:', savedOutlines.length);

    if (savedOutlines.length > 0) {
        // Check milestone chapters
        const milestones = [
            { ch: 1, label: '巷口相遇' },
            { ch: 3, label: '职业交集' },
            { ch: 5, label: '首次心动' },
            { ch: 10, label: '大甜+创作合作' },
            { ch: 15, label: '小虐转折' },
            { ch: 25, label: '终极甜蜜' }
        ];
        for (const ms of milestones) {
            const outline = savedOutlines.find(o => o.chapterNumber === ms.ch);
            if (outline) {
                console.log('  PASS | Ch' + ms.ch + ' (' + ms.label + '): ' + outline.title);
            } else {
                console.log('  WARN | Ch' + ms.ch + ' (' + ms.label + '): not found');
            }
        }

        // Check for forbidden patterns
        const forbiddenPatterns = ['霸总', '总裁', '黑卡', '恶毒女配', '失忆', '替身', '豪门', '契约婚姻'];
        let driftFound = false;
        savedOutlines.forEach(o => {
            const content = (o.title || '') + (o.outline || '');
            forbiddenPatterns.forEach(p => {
                if (content.includes(p)) {
                    console.log('  DRIFT | Forbidden pattern "' + p + '" in Ch' + o.chapterNumber + ': ' + o.title);
                    driftFound = true;
                }
            });
        });
        if (!driftFound) console.log('  PASS | No forbidden patterns (设定偏移检查通过)');

        // Check rhythm: first 5 chapters should be sweet/meeting, 15 should be conflict
        const ch1 = savedOutlines.find(o => o.chapterNumber === 1);
        const ch5 = savedOutlines.find(o => o.chapterNumber === 5);
        const ch15 = savedOutlines.find(o => o.chapterNumber === 15);
        const ch25 = savedOutlines.find(o => o.chapterNumber === 25);
        if (ch1) console.log('  RHYTHM | Ch1: ' + ch1.title + ' - ' + (ch1.outline || '').substring(0, 60));
        if (ch5) console.log('  RHYTHM | Ch5: ' + ch5.title + ' - ' + (ch5.outline || '').substring(0, 60));
        if (ch15) console.log('  RHYTHM | Ch15: ' + ch15.title + ' - ' + (ch15.outline || '').substring(0, 60));
        if (ch25) console.log('  RHYTHM | Ch25: ' + ch25.title + ' - ' + (ch25.outline || '').substring(0, 60));
    }

    // 4. Post-check: verify data integrity
    console.log('\n--- 后检查：数据完整性 ---');
    const postMatRes = await apiRequest('GET', '/api/materials?projectId=' + projectId, null, token);
    const postMaterials = Array.isArray(postMatRes.data) ? postMatRes.data : [];
    console.log('Materials after generation:', postMaterials.length, '(should be same as before:', materials.length + ')');
    if (postMaterials.length !== materials.length) {
        console.log('  WARN | Material count changed! Before=' + materials.length + ', After=' + postMaterials.length);
    }

    const entityRes = await apiRequest('GET', '/api/entity-center/entity-registry?projectId=' + projectId, null, token);
    const entities = Array.isArray(entityRes.data) ? entityRes.data : [];
    console.log('Entities:', entities.length);

    const kbRes = await apiRequest('GET', '/api/knowledge/facts/' + projectId, null, token);
    const facts = Array.isArray(kbRes.data) ? kbRes.data : [];
    console.log('Knowledge facts:', facts.length);

    console.log('\n=== 大纲生成完成 ===');
}

main().catch(e => console.error('Error:', e));
