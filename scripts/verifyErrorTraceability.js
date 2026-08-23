'use strict';

/**
 * 错误定位体系端到端验证脚本
 *
 * 验证目标：证明 traceId/errorCode 在真实 HTTP 请求链路中有效，
 * 并暴露 514 处内联响应绕过统一 shape 的盲点。
 *
 * 运行：node scripts/verifyErrorTraceability.js
 *
 * 文件位置：scripts/verifyErrorTraceability.js
 */

const http = require('http');
const express = require('express');
const { traceIdMiddleware } = require('../server/middleware/traceIdMiddleware');
const { apiResponse } = require('../server/middleware/apiResponse');
const { errorHandler } = require('../server/middleware/errorHandler');
const { AppError, ContractViolationError } = require('../server/shared/errors');
const logger = require('../server/shared/logger');
const { logStore } = require('../server/shared/logStore');

// 注入 logStore 到 logger（确保 summary 日志进入 logStore）
logger.attachLogStore(logStore);

// 捕获 logger 输出，验证 traceId 是否注入日志
let lastLogOutput = '';
const origError = console.error;
const origWarn = console.warn;
console.error = (msg) => { lastLogOutput = String(msg); };
console.warn = (msg) => { lastLogOutput = String(msg); };

function buildTestApp() {
    const app = express();
    app.use(express.json());
    app.use(traceIdMiddleware);
    app.use(apiResponse);

    // 场景1：成功请求，验证响应头 traceId
    app.get('/test/success', (req, res) => {
        res.json({ success: true, data: 'ok' });
    });

    // 场景2：AppError 经 errorHandler，验证响应体含 traceId
    app.get('/test/app-error', (req, res, next) => {
        next(new AppError('测试错误', 'TEST_ERROR', 400));
    });

    // 场景3：res.apiError，验证便捷方法含 traceId
    app.get('/test/api-error', (req, res) => {
        res.apiError(400, 'apiError 测试', 'API_TEST_CODE');
    });

    // 场景4：内联响应（模拟 514 处盲点），预期无 traceId
    app.get('/test/inline', (req, res) => {
        res.status(400).json({ error: '内联响应无 traceId' });
    });

    // 场景5：异步错误经 errorHandler
    app.get('/test/async-error', async (req, res, next) => {
        try {
            throw new ContractViolationError('契约失败', ['field1 missing']);
        } catch (e) { next(e); }
    });

    // 场景6：logger 在请求上下文内输出，验证日志含 traceId
    app.get('/test/log', (req, res) => {
        logger.error('testModule', '测试日志输出', { errorCode: 'TEST_LOG' });
        res.json({ success: true, logOutput: lastLogOutput });
    });

    app.use(errorHandler);
    return app;
}

function makeRequest(app, path, method = 'GET', headers = {}) {
    return new Promise((resolve) => {
        const server = app.listen(0, () => {
            const port = server.address().port;
            const req = http.request({ port, path, method, headers }, (res) => {
                let body = '';
                res.on('data', chunk => { body += chunk; });
                res.on('end', () => {
                    server.close();
                    let parsed;
                    try { parsed = JSON.parse(body); } catch { parsed = body; }
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: parsed
                    });
                });
            });
            req.on('error', () => { server.close(); resolve(null); });
            req.end();
        });
    });
}

async function run() {
    const results = [];
    const app = buildTestApp();

    // 场景1：响应头 traceId
    const r1 = await makeRequest(app, '/test/success');
    results.push({
        scenario: '1. 成功请求响应头',
        passed: !!r1?.headers['x-trace-id'],
        detail: r1 ? `X-Trace-Id: ${r1.headers['x-trace-id'] || '(缺失)'}` : '请求失败'
    });

    // 场景2：AppError 响应体 traceId
    const r2 = await makeRequest(app, '/test/app-error');
    const r2HasTrace = r2?.body?.traceId;
    const r2HasCode = r2?.body?.code === 'TEST_ERROR';
    results.push({
        scenario: '2. AppError 响应体（errorHandler 路径）',
        passed: r2HasTrace && r2HasCode,
        detail: `traceId: ${r2?.body?.traceId || '(缺失)'}, code: ${r2?.body?.code || '(缺失)'}, timestamp: ${r2?.body?.timestamp ? '有' : '(缺失)'}`
    });

    // 场景3：res.apiError 响应体
    const r3 = await makeRequest(app, '/test/api-error');
    results.push({
        scenario: '3. res.apiError 响应体',
        passed: !!r3?.body?.traceId && r3?.body?.code === 'API_TEST_CODE',
        detail: `traceId: ${r3?.body?.traceId || '(缺失)'}, code: ${r3?.body?.code || '(缺失)'}`
    });

    // 场景4：内联响应盲点已消除（请求 summary 日志进入 logStore）
    logStore.clear();
    const r4 = await makeRequest(app, '/test/inline');
    const r4TraceId = r4?.headers['x-trace-id'];
    // 等待 res.on('finish') 回调执行（事件循环下一轮）
    await new Promise(resolve => setImmediate(resolve));
    const r4Record = logStore.getByTraceId(r4TraceId);
    const r4HasSummary = r4Record?.logs?.some(l => l.module === 'request' && l.context?.status === 400);
    results.push({
        scenario: '4. 内联响应请求 summary 已记录（盲点消除）',
        passed: r4HasSummary,
        detail: r4HasSummary
            ? `✅ 盲点消除：内联响应虽无 traceId 响应体，但 logStore 已记录请求 summary（traceId: ${r4TraceId}）`
            : `❌ 盲点未消除：logStore 无该 traceId 的 summary 记录（traceId: ${r4TraceId}）`
    });

    // 场景5：ContractViolationError
    const r5 = await makeRequest(app, '/test/async-error');
    results.push({
        scenario: '5. ContractViolationError 类型化错误',
        passed: !!r5?.body?.traceId && r5?.body?.code === 'PIPELINE_CONTRACT_VIOLATION',
        detail: `traceId: ${r5?.body?.traceId || '(缺失)'}, code: ${r5?.body?.code || '(缺失)'}`
    });

    // 场景6：日志含 traceId
    const r6 = await makeRequest(app, '/test/log');
    const logHasTrace = r6?.body?.logOutput?.includes('tr-') || r6?.body?.logOutput?.includes('"traceId"');
    results.push({
        scenario: '6. logger 输出含 traceId',
        passed: !!logHasTrace,
        detail: logHasTrace ? '日志含 traceId，可按 traceId 检索' : `日志无 traceId: ${r6?.body?.logOutput?.slice(0, 80)}`
    });

    // 输出报告
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  错误定位体系端到端验证报告');
    console.log('═══════════════════════════════════════════════════\n');
    let passCount = 0;
    for (const r of results) {
        const mark = r.passed ? '[PASS]' : '[FAIL]';
        if (r.passed) passCount++;
        console.log(`${mark} ${r.scenario}`);
        console.log(`      ${r.detail}\n`);
    }
    console.log('───────────────────────────────────────────────────');
    console.log(`  通过: ${passCount}/${results.length}`);
    console.log('───────────────────────────────────────────────────\n');

    // 恢复 console
    console.error = origError;
    console.warn = origWarn;

    process.exit(results.every(r => r.passed) ? 0 : 1);
}

run().catch(err => {
    console.error = origError;
    console.error('验证脚本执行失败:', err.message);
    process.exit(1);
});
