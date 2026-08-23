'use strict';

/**
 * 调试日志路由端到端验证脚本
 *
 * 验证目标：
 * 1. GET /api/debug/stats — 返回 logStore 容量统计
 * 2. GET /api/debug/trace-ids — 返回最近 traceId 列表
 * 3. GET /api/debug/logs?traceId=xxx — 按 traceId 检索日志
 * 4. GET /api/debug/logs（无 traceId）— 返回 400 VALIDATION_ERROR
 * 5. GET /api/debug/logs?traceId=not-exist — 返回 404 NOT_FOUND
 *
 * 运行：node scripts/verifyDebugRoutes.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 从 .env 读取 REQUEST_SECRET 作为 Bearer token
function loadRequestSecret() {
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return '';
    const content = fs.readFileSync(envPath, 'utf-8').replace(/^\uFEFF/, '');
    const match = content.match(/^REQUEST_SECRET=(.+)$/m);
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : '';
}

const SECRET = loadRequestSecret();
const BASE = 'http://localhost:3001';

function request(method, urlPath) {
    return new Promise((resolve, reject) => {
        const headers = {};
        if (SECRET) headers['Authorization'] = `Bearer ${SECRET}`;
        const req = http.request(`${BASE}${urlPath}`, { method, headers }, (res) => {
            let body = '';
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => {
                let json;
                try { json = JSON.parse(body); } catch { json = body; }
                resolve({ status: res.statusCode, headers: res.headers, body: json });
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function main() {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  调试日志路由端到端验证');
    console.log('═══════════════════════════════════════════════════\n');

    let pass = 0;
    let fail = 0;

    // 测试 1: GET /api/debug/stats（阶段五后返回嵌套结构 logStore/aggregator/alerts）
    try {
        const res = await request('GET', '/api/debug/stats');
        const ls = res.body?.data?.logStore;
        const ok = res.status === 200
            && res.body?.success === true
            && typeof ls?.totalTraces === 'number'
            && typeof ls?.maxTraces === 'number';
        console.log(`[${ok ? 'PASS' : 'FAIL'}] 1. GET /api/debug/stats`);
        console.log(`      status=${res.status}, totalTraces=${ls?.totalTraces}, maxTraces=${ls?.maxTraces}`);
        ok ? pass++ : fail++;
    } catch (e) {
        console.log(`[FAIL] 1. GET /api/debug/stats — ${e.message}`);
        fail++;
    }

    // 测试 2: GET /api/debug/trace-ids
    try {
        const res = await request('GET', '/api/debug/trace-ids?limit=5');
        const ok = res.status === 200
            && res.body?.success === true
            && Array.isArray(res.body?.data);
        console.log(`[${ok ? 'PASS' : 'FAIL'}] 2. GET /api/debug/trace-ids`);
        console.log(`      status=${res.status}, items=${res.body?.data?.length}`);
        if (res.body?.data?.length > 0) {
            console.log(`      示例: traceId=${res.body.data[0].traceId}, hasError=${res.body.data[0].hasError}`);
        }
        ok ? pass++ : fail++;
    } catch (e) {
        console.log(`[FAIL] 2. GET /api/debug/trace-ids — ${e.message}`);
        fail++;
    }

    // 测试 3: GET /api/debug/logs（无 traceId）应返回 400
    try {
        const res = await request('GET', '/api/debug/logs');
        const ok = res.status === 400
            && res.body?.success === false
            && res.body?.code === 'VALIDATION_ERROR'
            && !!res.body?.traceId;
        console.log(`[${ok ? 'PASS' : 'FAIL'}] 3. GET /api/debug/logs (无 traceId) → 400 VALIDATION_ERROR`);
        console.log(`      status=${res.status}, code=${res.body?.code}, traceId=${res.body?.traceId}`);
        ok ? pass++ : fail++;
    } catch (e) {
        console.log(`[FAIL] 3. GET /api/debug/logs — ${e.message}`);
        fail++;
    }

    // 测试 4: GET /api/debug/logs?traceId=not-exist 应返回 404
    try {
        const res = await request('GET', '/api/debug/logs?traceId=tr-not-exist-xxx');
        const ok = res.status === 404
            && res.body?.success === false
            && res.body?.code === 'NOT_FOUND'
            && !!res.body?.traceId;
        console.log(`[${ok ? 'PASS' : 'FAIL'}] 4. GET /api/debug/logs?traceId=not-exist → 404 NOT_FOUND`);
        console.log(`      status=${res.status}, code=${res.body?.code}, traceId=${res.body?.traceId}`);
        ok ? pass++ : fail++;
    } catch (e) {
        console.log(`[FAIL] 4. GET /api/debug/logs?traceId=not-exist — ${e.message}`);
        fail++;
    }

    // 测试 5: 拿真实 traceId 检索日志
    try {
        const listRes = await request('GET', '/api/debug/trace-ids?limit=1');
        const firstTrace = listRes.body?.data?.[0];
        if (firstTrace) {
            const res = await request('GET', `/api/debug/logs?traceId=${encodeURIComponent(firstTrace.traceId)}`);
            const ok = res.status === 200
                && res.body?.success === true
                && res.body?.data?.traceId === firstTrace.traceId
                && Array.isArray(res.body?.data?.logs);
            console.log(`[${ok ? 'PASS' : 'FAIL'}] 5. GET /api/debug/logs?traceId=<真实>`);
            console.log(`      status=${res.status}, logs=${res.body?.data?.logs?.length}, logCount=${res.body?.data?.logCount}`);
            if (res.body?.data?.logs?.length > 0) {
                const log = res.body.data.logs[0];
                console.log(`      首条日志: level=${log.level}, module=${log.module}, message=${log.message.substring(0, 50)}`);
            }
            ok ? pass++ : fail++;
        } else {
            console.log('[SKIP] 5. 无 traceId 可测试（logStore 为空）');
        }
    } catch (e) {
        console.log(`[FAIL] 5. GET /api/debug/logs?traceId=<真实> — ${e.message}`);
        fail++;
    }

    console.log('\n───────────────────────────────────────────────────');
    console.log(`  通过: ${pass}/${pass + fail}`);
    console.log('───────────────────────────────────────────────────\n');
    process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => {
    console.error('验证脚本异常:', e);
    process.exit(1);
});
