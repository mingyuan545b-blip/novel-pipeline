'use strict';

/**
 * 持久化与归档端到端验证脚本
 *
 * 验证目标：
 * 1. stats 返回 persister 统计信息
 * 2. 日志自动持久化到 PG（触发请求后等待 flush）
 * 3. 清空内存后，归档查询能检索到历史日志
 * 4. includeArchive=true 合并内存与归档 traceId
 * 5. 归档日志详情包含 archived 标记
 *
 * 前置条件：服务器运行在 localhost:3001，v0007 迁移已应用
 * 运行：node scripts/verifyPersistence.js
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  持久化与归档端到端验证');
    console.log('═══════════════════════════════════════════════════\n');

    let pass = 0;
    let fail = 0;

    // 清空所有数据
    await request('DELETE', '/api/debug/logs');
    await sleep(500);

    // 测试 1: stats 返回 persister 信息
    try {
        const res = await request('GET', '/api/debug/stats');
        const p = res.body?.data?.persister;
        const ok = res.status === 200
            && p?.enabled === true
            && typeof p?.bufferLength === 'number'
            && typeof p?.retentionDays === 'number';
        console.log(`[${ok ? 'PASS' : 'FAIL'}] 1. GET /api/debug/stats 含 persister 统计`);
        console.log(`      enabled=${p?.enabled}, bufferLength=${p?.bufferLength}, retentionDays=${p?.retentionDays}`);
        ok ? pass++ : fail++;
    } catch (e) {
        console.log(`[FAIL] 1. stats — ${e.message}`);
        fail++;
    }

    // 测试 2: 触发请求生成日志，等待持久化
    let testTraceId = null;
    try {
        // 触发几个 400 请求（生成 warn 级别 summary 日志）
        for (let i = 0; i < 3; i++) {
            const r = await request('GET', '/api/debug/logs');
        }
        // 等待 flush（5 秒间隔）
        await sleep(6000);

        // 查询 trace-ids
        const listRes = await request('GET', '/api/debug/trace-ids?limit=5');
        const traces = listRes.body?.data || [];
        const ok = traces.length > 0;
        if (ok) testTraceId = traces[0].traceId;
        console.log(`[${ok ? 'PASS' : 'FAIL'}] 2. 触发请求后内存中有 traceId 记录`);
        console.log(`      traces=${traces.length}, first=${testTraceId}`);
        ok ? pass++ : fail++;
    } catch (e) {
        console.log(`[FAIL] 2. 触发请求 — ${e.message}`);
        fail++;
    }

    // 测试 3: 查询 stats 确认 persister.totalWritten > 0
    try {
        const res = await request('GET', '/api/debug/stats');
        const p = res.body?.data?.persister;
        const ok = p?.totalWritten > 0;
        console.log(`[${ok ? 'PASS' : 'FAIL'}] 3. persister.totalWritten > 0`);
        console.log(`      totalWritten=${p?.totalWritten}, totalErrors=${p?.totalErrors}`);
        ok ? pass++ : fail++;
    } catch (e) {
        console.log(`[FAIL] 3. persister 统计 — ${e.message}`);
        fail++;
    }

    // 测试 4: 清空内存后，归档查询能检索到日志
    if (testTraceId) {
        try {
            // 清空内存（不影响 PG）
            await request('DELETE', '/api/debug/logs');
            await sleep(200);

            // 内存列表中不应再包含 testTraceId（可能有其他请求产生的新 traceId）
            const memList = await request('GET', '/api/debug/trace-ids?limit=50');
            const memTraces = memList.body?.data || [];
            const memHasTestTrace = memTraces.some(t => t.traceId === testTraceId);

            // 通过 GET /api/debug/logs?traceId=xxx 应自动回退到 PG
            const res = await request('GET', `/api/debug/logs?traceId=${encodeURIComponent(testTraceId)}`);
            const archived = res.body?.data;
            const ok = !memHasTestTrace
                && res.status === 200
                && archived?.archived === true
                && archived?.traceId === testTraceId
                && Array.isArray(archived?.logs);
            console.log(`[${ok ? 'PASS' : 'FAIL'}] 4. 清空内存后 GET /api/debug/logs 自动回退 PG 归档`);
            console.log(`      testTraceInMem=${memHasTestTrace}, archived=${archived?.archived}, logs=${archived?.logs?.length}`);
            ok ? pass++ : fail++;
        } catch (e) {
            console.log(`[FAIL] 4. 归档回退 — ${e.message}`);
            fail++;
        }
    } else {
        console.log('[SKIP] 4. 无 testTraceId');
        fail++;
    }

    // 测试 5: includeArchive=true 合并归档 traceId
    try {
        const res = await request('GET', '/api/debug/trace-ids?limit=20&includeArchive=true');
        const traces = res.body?.data || [];
        const hasArchived = traces.some(t => t.archived === true);
        const ok = res.status === 200
            && Array.isArray(traces)
            && traces.length > 0
            && hasArchived;
        console.log(`[${ok ? 'PASS' : 'FAIL'}] 5. includeArchive=true 合并归档 traceId`);
        console.log(`      total=${traces.length}, archived=${traces.filter(t => t.archived).length}`);
        ok ? pass++ : fail++;
    } catch (e) {
        console.log(`[FAIL] 5. includeArchive — ${e.message}`);
        fail++;
    }

    // 清理
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
