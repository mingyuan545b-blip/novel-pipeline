'use strict';

/**
 * 阶段四盲点消除验证脚本
 *
 * 验证目标：
 * 1. 成功请求（200）的 summary 日志进入 logStore
 * 2. 该 summary 日志携带 traceId
 * 3. summary 日志包含 method/path/status/duration
 *
 * 运行：node scripts/verifyRequestSummary.js
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

async function main() {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  阶段四盲点消除验证：成功请求 summary 日志');
    console.log('═══════════════════════════════════════════════════\n');

    let pass = 0;
    let fail = 0;

    // 测试 1: 发起一个成功请求（GET /api/debug/stats）
    const r1 = await request('GET', '/api/debug/stats');
    const traceId1 = r1.headers['x-trace-id'];
    const ok1 = r1.status === 200 && !!traceId1;
    console.log(`[${ok1 ? 'PASS' : 'FAIL'}] 1. 成功请求返回 200 + traceId`);
    console.log(`      status=${r1.status}, traceId=${traceId1}`);
    ok1 ? pass++ : fail++;

    // 等待 res.on('finish') 回调执行
    await new Promise(resolve => setTimeout(resolve, 100));

    // 测试 2: 该 traceId 在 logStore 中有 summary 日志
    const r2 = await request('GET', `/api/debug/logs?traceId=${encodeURIComponent(traceId1)}`);
    const record = r2.body?.data;
    const summaryLog = record?.logs?.find(l => l.module === 'request');
    const ok2 = r2.status === 200
        && record?.traceId === traceId1
        && summaryLog?.level === 'info'
        && summaryLog?.context?.method === 'GET'
        && summaryLog?.context?.status === 200
        && typeof summaryLog?.context?.duration === 'number';
    console.log(`[${ok2 ? 'PASS' : 'FAIL'}] 2. 成功请求 summary 日志已进入 logStore`);
    console.log(`      level=${summaryLog?.level}, status=${summaryLog?.context?.status}, duration=${summaryLog?.context?.duration}ms`);
    ok2 ? pass++ : fail++;

    // 测试 3: listRecentTraces 包含该 traceId
    const r3 = await request('GET', '/api/debug/trace-ids?limit=10');
    const list = r3.body?.data || [];
    const found = list.find(t => t.traceId === traceId1);
    const ok3 = !!found && found.logCount >= 1;
    console.log(`[${ok3 ? 'PASS' : 'FAIL'}] 3. listRecentTraces 包含该 traceId`);
    console.log(`      found=${!!found}, logCount=${found?.logCount}`);
    ok3 ? pass++ : fail++;

    // 测试 4: 健康检查路径不记录 summary（验证过滤逻辑）
    const r4 = await request('GET', '/api/health');
    const traceId4 = r4.headers['x-trace-id'];
    await new Promise(resolve => setTimeout(resolve, 100));
    const r4Logs = await request('GET', `/api/debug/logs?traceId=${encodeURIComponent(traceId4)}`);
    const ok4 = r4Logs.status === 404; // 健康检查不应进入 logStore
    console.log(`[${ok4 ? 'PASS' : 'FAIL'}] 4. 健康检查路径不记录 summary 日志`);
    console.log(`      health traceId=${traceId4}, logStore status=${r4Logs.status}（404=未记录）`);
    if (!ok4 && r4Logs.body?.data?.logs) {
        console.log(`      实际日志内容:`);
        r4Logs.body.data.logs.forEach((l, i) => {
            console.log(`        [${i}] level=${l.level}, module=${l.module}, message=${l.message}, context=${JSON.stringify(l.context)}`);
        });
    }
    ok4 ? pass++ : fail++;

    console.log('\n───────────────────────────────────────────────────');
    console.log(`  通过: ${pass}/${pass + fail}`);
    console.log('───────────────────────────────────────────────────\n');
    process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => {
    console.error('验证脚本异常:', e);
    process.exit(1);
});
