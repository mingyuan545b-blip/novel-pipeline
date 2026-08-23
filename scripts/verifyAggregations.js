'use strict';

/**
 * 聚合与告警端到端验证脚本
 *
 * 验证目标：
 * 1. GET /api/debug/aggregations — 返回错误聚合数据
 * 2. GET /api/debug/alerts — 返回活跃告警列表
 * 3. POST /api/debug/alerts/evaluate — 手动触发告警评估
 * 4. POST /api/debug/alerts/:id/acknowledge — 确认告警
 * 5. GET /api/debug/alerts/rules — 返回告警规则列表
 * 6. DELETE /api/debug/logs — 清空聚合与告警
 *
 * 前置条件：服务器运行在 localhost:3001
 * 运行：node scripts/verifyAggregations.js
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

// 触发 module-error-spike 告警的最低请求数（规则阈值 5）
const ERROR_REQUEST_COUNT = 6;

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

// 等待 ms 毫秒
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  聚合与告警端到端验证');
    console.log('═══════════════════════════════════════════════════\n');

    let pass = 0;
    let fail = 0;

    // 前置：清空所有数据
    await request('DELETE', '/api/debug/logs');
    await sleep(100); // 等待清空生效

    // 测试 1: 清空后聚合应为空
    try {
        const res = await request('GET', '/api/debug/aggregations');
        const ok = res.status === 200
            && res.body?.success === true
            && Array.isArray(res.body?.data)
            && res.body.data.length === 0;
        console.log(`[${ok ? 'PASS' : 'FAIL'}] 1. 清空后 GET /api/debug/aggregations 返回空`);
        console.log(`      status=${res.status}, count=${res.body?.data?.length}`);
        ok ? pass++ : fail++;
    } catch (e) {
        console.log(`[FAIL] 1. GET /api/debug/aggregations — ${e.message}`);
        fail++;
    }

    // 测试 2: 触发多个错误请求生成聚合数据
    try {
        // 调用 /api/debug/logs（无 traceId）会返回 400，并记录 warn 级别 summary
        for (let i = 0; i < ERROR_REQUEST_COUNT; i++) {
            await request('GET', '/api/debug/logs');
        }
        await sleep(200); // 等待 res.on('finish') 回调写入 logStore
        const res = await request('GET', '/api/debug/aggregations');
        const hasLevelWarn = res.body?.data?.some(a => a.key === 'level:warn');
        const hasModuleRequest = res.body?.data?.some(a => a.key === 'module:request');
        const ok = res.status === 200
            && hasLevelWarn
            && hasModuleRequest;
        console.log(`[${ok ? 'PASS' : 'FAIL'}] 2. 触发 ${ERROR_REQUEST_COUNT} 个 400 请求后聚合出现 level:warn 与 module:request`);
        console.log(`      aggregations=${JSON.stringify(res.body?.data?.map(a => ({ key: a.key, count: a.count })))}`);
        ok ? pass++ : fail++;
    } catch (e) {
        console.log(`[FAIL] 2. 触发错误请求 — ${e.message}`);
        fail++;
    }

    // 测试 3: 告警规则列表
    try {
        const res = await request('GET', '/api/debug/alerts/rules');
        const ok = res.status === 200
            && res.body?.success === true
            && Array.isArray(res.body?.data)
            && res.body.data.length >= 3
            && res.body.data.every(r => r.id && r.name && r.threshold && r.keyPattern);
        console.log(`[${ok ? 'PASS' : 'FAIL'}] 3. GET /api/debug/alerts/rules 返回规则列表`);
        console.log(`      rules=${res.body?.data?.map(r => r.id).join(', ')}`);
        ok ? pass++ : fail++;
    } catch (e) {
        console.log(`[FAIL] 3. GET /api/debug/alerts/rules — ${e.message}`);
        fail++;
    }

    // 测试 4: 评估前告警应为空
    try {
        const res = await request('GET', '/api/debug/alerts');
        const ok = res.status === 200
            && Array.isArray(res.body?.data)
            && res.body.data.length === 0;
        console.log(`[${ok ? 'PASS' : 'FAIL'}] 4. 评估前 GET /api/debug/alerts 返回空`);
        console.log(`      alerts=${res.body?.data?.length}`);
        ok ? pass++ : fail++;
    } catch (e) {
        console.log(`[FAIL] 4. 评估前 GET /api/debug/alerts — ${e.message}`);
        fail++;
    }

    // 测试 5: 手动触发评估应产生 module-error-spike 告警
    let alertIdForAck = null;
    try {
        const res = await request('POST', '/api/debug/alerts/evaluate');
        const newAlerts = res.body?.data?.newAlerts || [];
        const hasModuleSpike = newAlerts.some(a => a.ruleId === 'module-error-spike');
        const ok = res.status === 200
            && res.body?.success === true
            && hasModuleSpike;
        console.log(`[${ok ? 'PASS' : 'FAIL'}] 5. POST /api/debug/alerts/evaluate 触发 module-error-spike 告警`);
        console.log(`      newAlerts=${newAlerts.length}, rules=${newAlerts.map(a => a.ruleId).join(', ')}`);
        if (hasModuleSpike) {
            alertIdForAck = newAlerts.find(a => a.ruleId === 'module-error-spike').id;
        }
        ok ? pass++ : fail++;
    } catch (e) {
        console.log(`[FAIL] 5. POST /api/debug/alerts/evaluate — ${e.message}`);
        fail++;
    }

    // 测试 6: 评估后告警列表应包含未确认告警
    try {
        const res = await request('GET', '/api/debug/alerts');
        const hasUnack = res.body?.data?.some(a => !a.acknowledged);
        const ok = res.status === 200
            && Array.isArray(res.body?.data)
            && res.body.data.length > 0
            && hasUnack;
        console.log(`[${ok ? 'PASS' : 'FAIL'}] 6. 评估后 GET /api/debug/alerts 返回未确认告警`);
        console.log(`      alerts=${res.body?.data?.length}, unack=${res.body?.data?.filter(a => !a.acknowledged).length}`);
        ok ? pass++ : fail++;
    } catch (e) {
        console.log(`[FAIL] 6. 评估后 GET /api/debug/alerts — ${e.message}`);
        fail++;
    }

    // 测试 7: 确认告警
    if (alertIdForAck) {
        try {
            const res = await request('POST', `/api/debug/alerts/${encodeURIComponent(alertIdForAck)}/acknowledge`);
            const ok = res.status === 200
                && res.body?.success === true
                && res.body?.data?.acknowledged === true;
            console.log(`[${ok ? 'PASS' : 'FAIL'}] 7. POST /api/debug/alerts/:id/acknowledge 确认告警`);
            console.log(`      alertId=${alertIdForAck}, acknowledged=${res.body?.data?.acknowledged}`);
            ok ? pass++ : fail++;
        } catch (e) {
            console.log(`[FAIL] 7. POST /api/debug/alerts/:id/acknowledge — ${e.message}`);
            fail++;
        }
    } else {
        console.log('[SKIP] 7. 无可确认的告警 ID');
        fail++;
    }

    // 测试 8: 确认不存在的告警返回 404
    try {
        const res = await request('POST', '/api/debug/alerts/non-existent-id/acknowledge');
        const ok = res.status === 404
            && res.body?.success === false
            && res.body?.code === 'NOT_FOUND';
        console.log(`[${ok ? 'PASS' : 'FAIL'}] 8. POST /api/debug/alerts/non-existent-id/acknowledge → 404 NOT_FOUND`);
        console.log(`      status=${res.status}, code=${res.body?.code}`);
        ok ? pass++ : fail++;
    } catch (e) {
        console.log(`[FAIL] 8. 确认不存在告警 — ${e.message}`);
        fail++;
    }

    // 清理：再次清空
    await request('DELETE', '/api/debug/logs');

    console.log('\n───────────────────────────────────────────────────');
    console.log(`  通过: ${pass}/${pass + fail}`);
    console.log('───────────────────────────────────────────────────\n');
    process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => {
    console.error('验证脚本异常:', e);
    process.exit(1);
});
