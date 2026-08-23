const http = require('http');
const express = require('express');
const { traceIdMiddleware } = require('../../server/middleware/traceIdMiddleware');
const logger = require('../../server/shared/logger');
const { logStore } = require('../../server/shared/logStore');

// 注入 logStore 到 logger（确保 summary 日志进入 logStore）
logger.attachLogStore(logStore);

/**
 * 构建测试 app
 */
function buildTestApp() {
    const app = express();
    app.use(express.json());
    app.use(traceIdMiddleware);

    // 成功响应
    app.get('/api/test/success', (req, res) => {
        res.json({ data: 'ok' });
    });

    // 4xx 响应
    app.get('/api/test/client-error', (req, res) => {
        res.status(400).json({ error: 'bad request' });
    });

    // 5xx 响应
    app.get('/api/test/server-error', (req, res) => {
        res.status(500).json({ error: 'internal error' });
    });

    // 应被跳过的健康检查路径
    app.get('/api/health', (req, res) => {
        res.json({ status: 'ok' });
    });

    return app;
}

/**
 * 发送请求并等待 res.on('finish') 回调执行
 */
function makeRequest(app, path, method = 'GET') {
    return new Promise((resolve) => {
        const server = app.listen(0, () => {
            const port = server.address().port;
            const req = http.request({ port, path, method }, (res) => {
                let body = '';
                res.on('data', chunk => { body += chunk; });
                res.on('end', () => {
                    // 等待 res.on('finish') 回调执行（事件循环下一轮）
                    setImmediate(() => {
                        server.close();
                        let parsed;
                        try { parsed = JSON.parse(body); } catch { parsed = body; }
                        resolve({
                            status: res.statusCode,
                            headers: res.headers,
                            body: parsed,
                            traceId: res.headers['x-trace-id']
                        });
                    });
                });
            });
            req.on('error', () => { server.close(); resolve(null); });
            req.end();
        });
    });
}

describe('traceIdMiddleware - 请求 summary 日志', () => {
    beforeEach(() => {
        logStore.clear();
    });

    test('成功响应（2xx）记录 info 级别 summary 日志', async () => {
        const app = buildTestApp();
        const res = await makeRequest(app, '/api/test/success');
        expect(res.traceId).toBeTruthy();

        const record = logStore.getByTraceId(res.traceId);
        expect(record).not.toBeNull();
        expect(record.logs.length).toBeGreaterThanOrEqual(1);

        const summaryLog = record.logs.find(l => l.module === 'request');
        expect(summaryLog).toBeDefined();
        expect(summaryLog.level).toBe('info');
        expect(summaryLog.context.status).toBe(200);
        expect(summaryLog.context.method).toBe('GET');
        expect(summaryLog.context.path).toBe('/api/test/success');
        expect(typeof summaryLog.context.duration).toBe('number');
    });

    test('4xx 响应记录 warn 级别 summary 日志', async () => {
        const app = buildTestApp();
        const res = await makeRequest(app, '/api/test/client-error');
        expect(res.traceId).toBeTruthy();

        const record = logStore.getByTraceId(res.traceId);
        const summaryLog = record.logs.find(l => l.module === 'request');
        expect(summaryLog).toBeDefined();
        expect(summaryLog.level).toBe('warn');
        expect(summaryLog.context.status).toBe(400);
    });

    test('5xx 响应记录 error 级别 summary 日志', async () => {
        const app = buildTestApp();
        const res = await makeRequest(app, '/api/test/server-error');
        expect(res.traceId).toBeTruthy();

        const record = logStore.getByTraceId(res.traceId);
        const summaryLog = record.logs.find(l => l.module === 'request');
        expect(summaryLog).toBeDefined();
        expect(summaryLog.level).toBe('error');
        expect(summaryLog.context.status).toBe(500);
    });

    test('健康检查路径不记录 summary 日志', async () => {
        const app = buildTestApp();
        const res = await makeRequest(app, '/api/health');
        expect(res.traceId).toBeTruthy();

        // 等待事件循环
        await new Promise(resolve => setImmediate(resolve));

        const record = logStore.getByTraceId(res.traceId);
        expect(record).toBeNull();
    });

    test('summary 日志携带 traceId（可通过 logStore 检索）', async () => {
        const app = buildTestApp();
        const res = await makeRequest(app, '/api/test/success');

        // 验证 logStore 可按 traceId 检索到 summary 日志
        const record = logStore.getByTraceId(res.traceId);
        expect(record).not.toBeNull();
        expect(record.traceId).toBe(res.traceId);

        // 验证 listRecentTraces 也能列出该 traceId
        const list = logStore.listRecentTraces();
        const found = list.find(t => t.traceId === res.traceId);
        expect(found).toBeDefined();
    });

    test('前端传入的 traceId 被使用并记录', async () => {
        const app = buildTestApp();
        const customTraceId = 'tr-custom-12345';

        const res = await new Promise((resolve) => {
            const server = app.listen(0, () => {
                const port = server.address().port;
                const req = http.request({
                    port,
                    path: '/api/test/success',
                    method: 'GET',
                    headers: { 'x-trace-id': customTraceId }
                }, (res) => {
                    let body = '';
                    res.on('data', chunk => { body += chunk; });
                    res.on('end', () => {
                        setImmediate(() => {
                            server.close();
                            resolve({
                                status: res.statusCode,
                                traceId: res.headers['x-trace-id']
                            });
                        });
                    });
                });
                req.on('error', () => { server.close(); resolve(null); });
                req.end();
            });
        });

        expect(res.traceId).toBe(customTraceId);

        const record = logStore.getByTraceId(customTraceId);
        expect(record).not.toBeNull();
        expect(record.traceId).toBe(customTraceId);
    });
});
