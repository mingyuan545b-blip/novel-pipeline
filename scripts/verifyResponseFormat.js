'use strict';

/**
 * 响应格式一致性端到端验证脚本
 *
 * 验证目标（方向 E：内联响应统一）：
 * 1. 成功响应（200）使用 res.apiOk 格式：{ success: true, data: ... }
 * 2. 错误响应（400/404/500）使用 res.apiError 格式：
 *    { success: false, error, code, traceId, timestamp }
 * 3. 201 创建响应使用 res.apiOk 格式：{ success: true, data: ... }
 * 4. 错误响应必须包含 traceId 和 timestamp 字段
 * 5. 验证中间件（validators/auth）错误响应格式统一
 *
 * 前置条件：服务器运行在 localhost:3001
 * 运行：node scripts/verifyResponseFormat.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

function loadRequestSecret() {
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return '';
    const content = fs.readFileSync(envPath, 'utf-8').replace(/^\uFEFF/, '');
    const match = content.match(/^REQUEST_SECRET=(.+)$/m);
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : '';
}

const SECRET = loadRequestSecret();
const BASE = 'http://localhost:3001';

function request(method, urlPath, body) {
    return new Promise((resolve, reject) => {
        const headers = {};
        if (SECRET) headers['Authorization'] = `Bearer ${SECRET}`;
        if (body) {
            headers['Content-Type'] = 'application/json';
        }
        const req = http.request(`${BASE}${urlPath}`, { method, headers }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                let json;
                try { json = JSON.parse(data); } catch { json = data; }
                resolve({ status: res.statusCode, headers: res.headers, body: json });
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function isApiOkFormat(body) {
    return body && typeof body === 'object'
        && body.success === true
        && 'data' in body;
}

function isApiErrorFormat(body) {
    return body && typeof body === 'object'
        && body.success === false
        && typeof body.error === 'string'
        && typeof body.code === 'string'
        && typeof body.traceId === 'string'
        && typeof body.timestamp === 'string';
}

async function main() {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  响应格式一致性端到端验证（方向 E）');
    console.log('═══════════════════════════════════════════════════\n');

    let pass = 0;
    let fail = 0;

    function assert(name, condition, detail) {
        console.log(`[${condition ? 'PASS' : 'FAIL'}] ${name}`);
        if (detail) console.log(`      ${detail}`);
        condition ? pass++ : fail++;
    }

    // 测试 1: 成功响应使用 res.apiOk 格式
    try {
        const res = await request('GET', '/api/debug/stats');
        const ok = res.status === 200 && isApiOkFormat(res.body);
        assert('1. GET /api/debug/stats 使用 res.apiOk 格式', ok,
            `status=${res.status}, success=${res.body?.success}, hasData=${'data' in (res.body || {})}`);
    } catch (e) {
        assert('1. GET /api/debug/stats — ' + e.message, false);
        fail++;
    }

    // 测试 2: 404 错误响应使用 res.apiError 格式
    try {
        const res = await request('GET', '/api/projects/nonexistent-id-12345');
        const ok = res.status === 404 && isApiErrorFormat(res.body);
        assert('2. GET /api/projects/nonexistent 使用 res.apiError 格式', ok,
            `status=${res.status}, code=${res.body?.code}, traceId=${res.body?.traceId ? 'present' : 'missing'}`);
    } catch (e) {
        assert('2. 404 错误响应 — ' + e.message, false);
        fail++;
    }

    // 测试 3: 400 验证错误响应（validators.js handleValidation）
    try {
        const res = await request('POST', '/api/projects', {});
        const ok = res.status === 400 && isApiErrorFormat(res.body);
        assert('3. POST /api/projects (空body) 触发 validators 验证错误', ok,
            `status=${res.status}, code=${res.body?.code}, error=${res.body?.error}`);
    } catch (e) {
        assert('3. 400 验证错误 — ' + e.message, false);
        fail++;
    }

    // 测试 4: 404 错误响应（style-templates，挂载 /api/style-templates + 内部 /templates/:id）
    try {
        const res = await request('GET', '/api/style-templates/templates/nonexistent-template-id');
        const ok = res.status === 404 && isApiErrorFormat(res.body);
        assert('4. GET /api/style-templates/templates/nonexistent 使用 res.apiError 格式', ok,
            `status=${res.status}, code=${res.body?.code}`);
    } catch (e) {
        assert('4. style-templates 404 错误响应 — ' + e.message, false);
        fail++;
    }

    // 测试 5: 错误响应包含 traceId 和 timestamp
    try {
        const res = await request('GET', '/api/projects/another-nonexistent-id');
        const hasTraceId = typeof res.body?.traceId === 'string' && res.body.traceId.length > 0;
        const hasTimestamp = typeof res.body?.timestamp === 'string' && !isNaN(Date.parse(res.body.timestamp));
        const ok = hasTraceId && hasTimestamp;
        assert('5. 错误响应包含 traceId 和 timestamp 字段', ok,
            `traceId=${res.body?.traceId}, timestamp=${res.body?.timestamp}`);
    } catch (e) {
        assert('5. traceId/timestamp — ' + e.message, false);
        fail++;
    }

    // 测试 6: 400 验证错误包含 details 字段
    try {
        const res = await request('POST', '/api/projects', { name: 'x' }); // name 太短会触发验证
        const hasDetails = res.body?.details && typeof res.body.details === 'object';
        const ok = res.status === 400 && isApiErrorFormat(res.body) && hasDetails;
        assert('6. 验证错误响应包含 details 字段', ok,
            `status=${res.status}, hasDetails=${!!hasDetails}`);
    } catch (e) {
        assert('6. details 字段 — ' + e.message, false);
        fail++;
    }

    // 测试 7: prompt-config 路由 400 验证错误格式（res.apiError）
    try {
        const res = await request('POST', '/api/style-templates/import-direct', { text: 'short', name: '' });
        const ok = res.status === 400 && isApiErrorFormat(res.body);
        assert('7. POST /api/style-templates/import-direct (验证失败) 使用 res.apiError 格式', ok,
            `status=${res.status}, code=${res.body?.code}, error=${res.body?.error}`);
    } catch (e) {
        assert('7. import-direct 验证错误 — ' + e.message, false);
        fail++;
    }

    // 测试 8: 404 错误响应（projects pipeline-config，crudRoutes 有 404 检查）
    try {
        const res = await request('GET', '/api/projects/nonexistent-id/pipeline-config');
        const ok = res.status === 404 && isApiErrorFormat(res.body);
        assert('8. GET /api/projects/:id/pipeline-config (不存在) 使用 res.apiError 格式', ok,
            `status=${res.status}, code=${res.body?.code}`);
    } catch (e) {
        assert('8. pipeline-config 404 — ' + e.message, false);
        fail++;
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log(`  结果: ${pass} passed, ${fail} failed`);
    console.log('═══════════════════════════════════════════════════\n');

    process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('验证脚本异常:', err);
    process.exit(1);
});
