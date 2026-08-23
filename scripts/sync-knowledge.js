/**
 * 知识库同步补录脚本
 * 对已有项目执行syncFactsFromMaterials
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
                catch (e) { resolve({ status: res.statusCode, data: data.substring(0, 3000) }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(postData);
        req.end();
    });
}

async function main() {
    const projectId = process.argv[2] || '49d5a6bf-0705-4b7b-a651-7142f1cf84a1';

    console.log('=== 知识库同步补录 ===');
    console.log('Project ID:', projectId);

    // 0. Auth
    const authRes = await apiRequest('POST', '/api/auth/token', { secret: REQUEST_SECRET });
    const token = authRes.data.token;
    if (!token) { console.error('Auth failed:', JSON.stringify(authRes.data)); process.exit(1); }

    // 1. Sync facts
    console.log('\n--- 同步知识库事实 ---');
    const syncRes = await apiRequest('POST', '/api/knowledge/sync-facts/' + projectId, null, token);
    console.log('Sync result:', JSON.stringify(syncRes.data));

    // 2. Check facts count
    console.log('\n--- 检查知识库事实数量 ---');
    const factsRes = await apiRequest('GET', '/api/knowledge/facts/' + projectId, null, token);
    const facts = Array.isArray(factsRes.data) ? factsRes.data : (factsRes.data?.facts || []);
    console.log('Total facts:', facts.length);

    // 3. Show facts by level
    const levelCounts = {};
    facts.forEach(f => { levelCounts[f.level] = (levelCounts[f.level] || 0) + 1; });
    console.log('Level distribution:', JSON.stringify(levelCounts));

    // 4. Show sample facts
    if (facts.length > 0) {
        console.log('\nSample facts:');
        facts.slice(0, 10).forEach(f => {
            console.log('  L' + f.level + ' [' + f.category + '] ' + (f.factText || '').substring(0, 80));
        });
    }

    // 5. Verify
    const pass = facts.length > 0;
    console.log('\n' + (pass ? 'PASS' : 'FAIL') + ' | Knowledge base has ' + facts.length + ' facts');
}

main().catch(e => console.error('Error:', e));
