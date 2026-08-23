'use strict';

/**
 * chapters 路由测试（S5.1）
 *
 * 测试策略：
 * - mock express Router（工厂函数内闭包存储 routes）
 * - mock store/pipeline/validators/chapterCascade/metricsCollector/reviewCircuitBreaker
 * - 覆盖 GET/POST/PUT/DELETE/reset/download-novel
 *
 * 文件位置：tests/unit/routes/chapters.test.js
 */

jest.mock('../../../server/shared/logger', () => ({
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()
}));

// mock store
const mockStore = new Map();
jest.mock('../../../server/store', () => ({
    listItems: jest.fn(async (type) => {
        const items = [];
        for (const [, v] of mockStore.entries()) {
            if (v._type === type) items.push(stripType(v));
        }
        return items;
    }),
    getItem: jest.fn(async (type, id) => {
        const item = mockStore.get(`${type}:${id}`);
        return item ? stripType(item) : null;
    }),
    setItem: jest.fn(async (type, id, value) => {
        mockStore.set(`${type}:${id}`, { ...value, _type: type });
    }),
    deleteItem: jest.fn(async (type, id) => {
        mockStore.delete(`${type}:${id}`);
    })
}));

// mock pipeline
jest.mock('../../../server/services/pipeline', () => ({
    saveFinalContent: jest.fn()
}));

// mock validators（直通中间件）
jest.mock('../../../server/middleware/validators', () => ({
    createChapter: (req, res, next) => next(),
    updateChapter: (req, res, next) => next(),
    chapterIdParam: (req, res, next) => next(),
    projectIdParam: (req, res, next) => next()
}));

// mock chapterCascade
jest.mock('../../../server/routes/chapterCascade', () => ({
    cascadeCleanup: jest.fn(async () => ({ cleaned: true }))
}));

// mock metricsCollector
jest.mock('../../../server/services/metricsCollector', () => ({
    getMetrics: jest.fn(() => ({ resetAgentPassRates: jest.fn().mockResolvedValue() }))
}));

// mock reviewCircuitBreaker
jest.mock('../../../server/services/reviewCircuitBreaker', () => ({
    getCircuitBreaker: jest.fn(() => ({ reset: jest.fn().mockResolvedValue() }))
}));

// mock express — 工厂函数内闭包存储 routes，避免 hoisting 问题
jest.mock('express', () => {
    const routes = { get: [], post: [], put: [], delete: [] };
    const router = {
        get: (path, ...mw) => routes.get.push({ path, mw }),
        post: (path, ...mw) => routes.post.push({ path, mw }),
        put: (path, ...mw) => routes.put.push({ path, mw }),
        delete: (path, ...mw) => routes.delete.push({ path, mw }),
        use: jest.fn(),
        _routes: routes
    };
    return { Router: () => router };
});

const chaptersRouter = require('../../../server/routes/chapters');
const express = require('express');
const store = require('../../../server/store');
const { saveFinalContent } = require('../../../server/services/pipeline');
const { cascadeCleanup } = require('../../../server/routes/chapterCascade');

function stripType(obj) {
    const { _type, ...rest } = obj;
    return rest;
}

function getRoutes() {
    return express.Router()._routes;
}

function matchPath(pattern, actual) {
    const p = pattern.split('/').filter(Boolean);
    const a = actual.split('/').filter(Boolean);
    if (p.length !== a.length) return false;
    return p.every((pp, i) => pp.startsWith(':') || pp === a[i]);
}

function extractParams(pattern, actual) {
    const params = {};
    const p = pattern.split('/').filter(Boolean);
    const a = actual.split('/').filter(Boolean);
    p.forEach((pp, i) => { if (pp.startsWith(':')) params[pp.slice(1)] = a[i]; });
    return params;
}

async function executeRoute(method, path, req = {}) {
    const routes = getRoutes();
    const list = routes[method.toLowerCase()];
    const route = list.find(r => matchPath(r.path, path));
    if (!route) throw new Error(`Route not found: ${method} ${path}`);
    const params = extractParams(route.path, path);
    const fullReq = {
        method, path,
        query: req.query || {},
        params: { ...params, ...(req.params || {}) },
        body: req.body || {},
        ...req
    };
    const res = {
        _statusCode: 200, _body: null, _ended: false, _headers: {},
        status(code) { this._statusCode = code; return this; },
        json(data) { this._body = data; this._ended = true; return this; },
        send(data) { this._body = data; this._ended = true; return this; },
        end() { this._ended = true; return this; },
        setHeader(k, v) { this._headers[k] = v; return this; },
        apiOk(data, msg, status) { this._statusCode = status || 200; this._body = { success: true, data, message: msg || null }; this._ended = true; return this; },
        apiError(sc, msg, code, extra) { this._statusCode = sc; this._body = { success: false, error: { code, message: msg, ...extra } }; this._ended = true; return this; }
    };
    for (const mw of route.mw) {
        let nextCalled = false;
        const next = () => { nextCalled = true; };
        const result = mw(fullReq, res, next);
        // async 中间件返回 Promise，需 await 让 handler 完成 res 操作
        if (result && typeof result.then === 'function') {
            await result;
        }
        if (res._ended) break;
        if (nextCalled) continue;
        // 同步中间件既没 next 也没 end，等待一轮事件循环
        await new Promise(resolve => setImmediate(resolve));
    }
    return { req: fullReq, res };
}

describe('chapters 路由 (S5.1)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStore.clear();
    });

    describe('GET /', () => {
        test('返回所有章节（按 chapterNumber 排序）', async () => {
            mockStore.set('chapters:c2', { id: 'c2', _type: 'chapters', projectId: 'p1', chapterNumber: 2, status: 'outlined' });
            mockStore.set('chapters:c1', { id: 'c1', _type: 'chapters', projectId: 'p1', chapterNumber: 1, status: 'approved' });
            const { res } = await executeRoute('GET', '/');
            expect(res._statusCode).toBe(200);
            expect(res._body).toHaveLength(2);
            expect(res._body[0].chapterNumber).toBe(1);
            expect(res._body[1].chapterNumber).toBe(2);
        });

        test('按 projectId 过滤', async () => {
            mockStore.set('chapters:c1', { id: 'c1', _type: 'chapters', projectId: 'p1', chapterNumber: 1 });
            mockStore.set('chapters:c2', { id: 'c2', _type: 'chapters', projectId: 'p2', chapterNumber: 1 });
            const { res } = await executeRoute('GET', '/', { query: { projectId: 'p1' } });
            expect(res._body).toHaveLength(1);
            expect(res._body[0].projectId).toBe('p1');
        });

        test('按 status 过滤', async () => {
            mockStore.set('chapters:c1', { id: 'c1', _type: 'chapters', projectId: 'p1', chapterNumber: 1, status: 'outlined' });
            mockStore.set('chapters:c2', { id: 'c2', _type: 'chapters', projectId: 'p1', chapterNumber: 2, status: 'approved' });
            const { res } = await executeRoute('GET', '/', { query: { status: 'approved' } });
            expect(res._body).toHaveLength(1);
            expect(res._body[0].status).toBe('approved');
        });

        test('空 store 返回空数组', async () => {
            const { res } = await executeRoute('GET', '/');
            expect(res._body).toEqual([]);
        });
    });

    describe('POST /', () => {
        test('创建章节返回 201', async () => {
            const { res } = await executeRoute('POST', '/', { body: { projectId: 'p1', chapterNumber: 1, title: 'ch1', content: 'hello' } });
            expect(res._statusCode).toBe(201);
            expect(res._body.success).toBe(true);
            expect(res._body.data.projectId).toBe('p1');
            expect(res._body.data.wordCount).toBe(5);
            expect(store.setItem).toHaveBeenCalled();
        });

        test('缺省 chapterNumber 默认为 1', async () => {
            const { res } = await executeRoute('POST', '/', { body: { projectId: 'p1' } });
            expect(res._body.data.chapterNumber).toBe(1);
            expect(res._body.data.title).toContain('1');
        });

        test('无 content 时 wordCount=0', async () => {
            const { res } = await executeRoute('POST', '/', { body: { projectId: 'p1' } });
            expect(res._body.data.wordCount).toBe(0);
        });
    });

    describe('GET /:id', () => {
        test('章节存在返回详情', async () => {
            mockStore.set('chapters:c1', { id: 'c1', _type: 'chapters', chapterNumber: 1, title: 'ch1' });
            const { res } = await executeRoute('GET', '/c1');
            expect(res._statusCode).toBe(200);
            expect(res._body.id).toBe('c1');
        });

        test('章节不存在返回 404', async () => {
            const { res } = await executeRoute('GET', '/notexist');
            expect(res._statusCode).toBe(404);
            expect(res._body.success).toBe(false);
        });
    });

    describe('PUT /:id', () => {
        test('更新章节内容并记录 history', async () => {
            mockStore.set('chapters:c1', { id: 'c1', _type: 'chapters', chapterNumber: 1, content: 'old', history: [], status: 'outlined' });
            const { res } = await executeRoute('PUT', '/c1', { body: { content: 'new content' } });
            expect(res._body.content).toBe('new content');
            expect(res._body.wordCount).toBe(11);
            expect(res._body.history).toHaveLength(1);
            expect(res._body.history[0].content).toBe('old');
        });

        test('status=approved 且有 content 时调用 saveFinalContent', async () => {
            mockStore.set('chapters:c1', { id: 'c1', _type: 'chapters', chapterNumber: 1, content: 'old', history: [], status: 'outlined', projectId: 'p1' });
            await executeRoute('PUT', '/c1', { body: { content: 'new', status: 'approved' } });
            expect(saveFinalContent).toHaveBeenCalled();
        });

        test('章节不存在返回 404', async () => {
            const { res } = await executeRoute('PUT', '/notexist', { body: {} });
            expect(res._statusCode).toBe(404);
        });

        test('内容未变化时不记录 history', async () => {
            mockStore.set('chapters:c1', { id: 'c1', _type: 'chapters', chapterNumber: 1, content: 'same', history: [], status: 'outlined' });
            const { res } = await executeRoute('PUT', '/c1', { body: { content: 'same' } });
            expect(res._body.history).toHaveLength(0);
        });
    });

    describe('DELETE /:id', () => {
        test('删除章节并触发 cascade', async () => {
            mockStore.set('chapters:c1', { id: 'c1', _type: 'chapters', chapterNumber: 1, projectId: 'p1' });
            const { res } = await executeRoute('DELETE', '/c1');
            expect(res._body.success).toBe(true);
            expect(res._body.deletedChapter).toBe('c1');
            expect(cascadeCleanup).toHaveBeenCalled();
            expect(store.deleteItem).toHaveBeenCalledWith('chapters', 'c1');
        });

        test('章节不存在返回 404', async () => {
            const { res } = await executeRoute('DELETE', '/notexist');
            expect(res._statusCode).toBe(404);
        });
    });

    describe('POST /:id/reset', () => {
        test('重置章节状态为 outlined', async () => {
            mockStore.set('chapters:c1', { id: 'c1', _type: 'chapters', chapterNumber: 1, projectId: 'p1', status: 'approved', content: 'xxx', round: 3, history: [{ x: 1 }] });
            const { res } = await executeRoute('POST', '/c1/reset');
            expect(res._body.success).toBe(true);
            expect(res._body.resetChapter).toBe('c1');
            const updated = mockStore.get('chapters:c1');
            expect(updated.status).toBe('outlined');
            expect(updated.content).toBe('');
            expect(updated.round).toBe(0);
            expect(updated.history).toEqual([]);
        });

        test('章节不存在返回 404', async () => {
            const { res } = await executeRoute('POST', '/notexist/reset');
            expect(res._statusCode).toBe(404);
        });

        test('重置时调用 metrics 和 circuitBreaker reset', async () => {
            mockStore.set('chapters:c1', { id: 'c1', _type: 'chapters', chapterNumber: 1, projectId: 'p1', status: 'approved' });
            await executeRoute('POST', '/c1/reset');
            const { getMetrics } = require('../../../server/services/metricsCollector');
            const { getCircuitBreaker } = require('../../../server/services/reviewCircuitBreaker');
            expect(getMetrics).toHaveBeenCalledWith('p1');
            expect(getCircuitBreaker).toHaveBeenCalledWith('p1');
        });
    });

    describe('GET /download-novel/:projectId', () => {
        test('下载小说返回文本', async () => {
            mockStore.set('projects:p1', { id: 'p1', _type: 'projects', name: '测试小说' });
            mockStore.set('chapters:c1', { id: 'c1', _type: 'chapters', projectId: 'p1', chapterNumber: 1, status: 'approved', title: 'ch1', content: '正文内容' });
            const { res } = await executeRoute('GET', '/download-novel/p1');
            expect(res._statusCode).toBe(200);
            expect(res._headers['Content-Type']).toContain('text/plain');
            expect(res._body).toContain('测试小说');
            expect(res._body).toContain('ch1');
            expect(res._body).toContain('正文内容');
        });

        test('项目不存在返回 404', async () => {
            const { res } = await executeRoute('GET', '/download-novel/notexist');
            expect(res._statusCode).toBe(404);
        });

        test('无已完成章节返回 404', async () => {
            mockStore.set('projects:p1', { id: 'p1', _type: 'projects', name: '小说' });
            mockStore.set('chapters:c1', { id: 'c1', _type: 'chapters', projectId: 'p1', chapterNumber: 1, status: 'outlined' });
            const { res } = await executeRoute('GET', '/download-novel/p1');
            expect(res._statusCode).toBe(404);
        });

        test('polishedContent 优先于 content', async () => {
            mockStore.set('projects:p1', { id: 'p1', _type: 'projects', name: '小说' });
            mockStore.set('chapters:c1', { id: 'c1', _type: 'chapters', projectId: 'p1', chapterNumber: 1, status: 'approved', title: 'ch1', content: '原始', polishedContent: '润色版' });
            const { res } = await executeRoute('GET', '/download-novel/p1');
            expect(res._body).toContain('润色版');
            expect(res._body).not.toContain('原始');
        });
    });
});
