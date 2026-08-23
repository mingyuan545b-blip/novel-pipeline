'use strict';

/**
 * 错误栈追踪端到端验证脚本（方向 F）
 *
 * 验证目标：
 * 1. 触发错误后，GET /api/debug/errors 返回错误列表
 * 2. 错误条目包含 stack 和 context 字段
 * 3. GET /api/debug/errors/stats 返回按 code 聚合统计
 * 4. context 包含 method/path/query/body 等请求上下文
 *
 * 前置条件：服务器运行在 localhost:3001
 * 运行：node scripts/verifyErrorTracing.js
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
        if (body) headers['Content-Type'] = 'application/json';
        const req = http.request(`${BASE}${urlPath}`, { method, headers }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                let json;
                try { json = JSON.parse(data); } catch { json = data; }
                resolve({ status: res.statusCode, body: json });
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  错误栈追踪端到端验证（方向 F）');
    console.log('═══════════════════════════════════════════════════\n');

    let pass = 0;
    let fail = 0;

    function assert(name, condition, detail) {
        console.log(`[${condition ? 'PASS' : 'FAIL'}] ${name}`);
        if (detail) console.log(`      ${detail}`);
        condition ? pass++ : fail++;
    }

    // 触发几个错误请求
    await request('GET', '/api/projects/nonexistent-error-trace-1');
    await request('POST', '/api/projects', { name: 'x' });
    await request('GET', '/api/projects/nonexistent-error-trace-2/pipeline-config');
    await sleep(500);

    // 测试 1: GET /api/debug/errors 返回错误列表
    try {
        const res = await request('GET', '/api/debug/errors?limit=20');
        const errors = res.body?.data || [];
        const ok = res.status === 200 && Array.isArray(errors) && errors.length > 0;
        assert('1. GET /api/debug/errors 返回错误列表', ok,
            `status=${res.status}, count=${errors.length}`);
    } catch (e) {
        assert('1. GET /api/debug/errors — ' + e.message, false);
        fail++;
    }

    // 测试 2: 错误条目包含 code 和 context 字段
    //   - res.apiError 路径（4xx）：有 code + context，无 stack（客户端错误）
    //   - errorHandler 路径（5xx/异常）：有 code + context + stack
    try {
        const res = await request('GET', '/api/debug/errors?limit=5');
        const errors = res.body?.data || [];
        const first = errors[0];
        const hasCode = first && typeof first.code === 'string' && first.code !== null;
        const hasContext = first && first.context && typeof first.context === 'object';
        const ok = hasCode && hasContext;
        assert('2. 错误条目包含 code 和 context 字段', ok,
            `hasCode=${!!hasCode}, hasContext=${!!hasContext}`);
    } catch (e) {
        assert('2. code/context 字段 — ' + e.message, false);
        fail++;
    }

    // 测试 3: context 包含 method/path 等请求上下文
    try {
        const res = await request('GET', '/api/debug/errors?limit=10');
        const errors = res.body?.data || [];
        const first = errors[0];
        const ctx = first?.context;
        const hasMethod = ctx && typeof ctx.method === 'string';
        const hasPath = ctx && typeof ctx.path === 'string';
        const ok = hasMethod && hasPath;
        assert('3. context 包含 method/path 请求上下文', ok,
            `method=${ctx?.method}, path=${ctx?.path}`);
    } catch (e) {
        assert('3. 请求上下文 — ' + e.message, false);
        fail++;
    }

    // 测试 4: GET /api/debug/errors/stats 返回聚合统计
    try {
        const res = await request('GET', '/api/debug/errors/stats');
        const stats = res.body?.data;
        const ok = res.status === 200
            && stats
            && typeof stats.total === 'number'
            && Array.isArray(stats.topCodes);
        assert('4. GET /api/debug/errors/stats 返回聚合统计', ok,
            `total=${stats?.total}, topCodes=${stats?.topCodes?.length}`);
    } catch (e) {
        assert('4. errors/stats — ' + e.message, false);
        fail++;
    }

    // 测试 5: stats topCodes 包含 NOT_FOUND 错误码
    try {
        const res = await request('GET', '/api/debug/errors/stats');
        const stats = res.body?.data;
        const codes = stats?.topCodes || [];
        const hasNotFound = codes.some(c => c.code === 'NOT_FOUND');
        const ok = hasNotFound;
        assert('5. stats 包含 NOT_FOUND 错误码', ok,
            `codes=${codes.map(c => c.code).join(', ')}`);
    } catch (e) {
        assert('5. NOT_FOUND 错误码 — ' + e.message, false);
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
