'use strict';

/**
 * reviews 路由测试（S5.4）
 *
 * 文件位置：tests/unit/routes/reviews.test.js
 */

jest.mock('../../../server/shared/logger', () => ({
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()
}));

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
        const existed = mockStore.has(`${type}:${id}`);
        mockStore.delete(`${type}:${id}`);
        return existed;
    })
}));

jest.mock('express', () => {
    const routes = { get: [], post: [], put: [], delete: [] };
    const router = {
        get: (p, ...mw) => routes.get.push({ path: p, mw }),
        post: (p, ...mw) => routes.post.push({ path: p, mw }),
        put: (p, ...mw) => routes.put.push({ path: p, mw }),
        delete: (p, ...mw) => routes.delete.push({ path: p, mw }),
        use: jest.fn(),
        _routes: routes
    };
    return { Router: () => router };
});

const express = require('express');
const reviewsRouter = require('../../../server/routes/reviews');
const { executeRoute } = require('./helpers/routeTestHelper');
const store = require('../../../server/store');

function stripType(obj) { const { _type, ...rest } = obj; return rest; }
function getRoutes() { return express.Router()._routes; }

describe('reviews 路由 (S5.4)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStore.clear();
    });

    describe('GET /', () => {
        test('返回所有审阅（按 createdAt 降序）', async () => {
            mockStore.set('reviews:r1', { id: 'r1', _type: 'reviews', chapterId: 'c1', type: 'first', createdAt: '2024-01-01T00:00:00Z' });
            mockStore.set('reviews:r2', { id: 'r2', _type: 'reviews', chapterId: 'c1', type: 'second', createdAt: '2025-01-01T00:00:00Z' });
            const { res } = await executeRoute(getRoutes(), 'GET', '/');
            expect(res._body).toHaveLength(2);
            expect(res._body[0].id).toBe('r2');
            expect(res._body[1].id).toBe('r1');
        });

        test('按 chapterId 过滤', async () => {
            mockStore.set('reviews:r1', { id: 'r1', _type: 'reviews', chapterId: 'c1', createdAt: '2024-01-01' });
            mockStore.set('reviews:r2', { id: 'r2', _type: 'reviews', chapterId: 'c2', createdAt: '2024-01-02' });
            const { res } = await executeRoute(getRoutes(), 'GET', '/', { query: { chapterId: 'c1' } });
            expect(res._body).toHaveLength(1);
            expect(res._body[0].chapterId).toBe('c1');
        });

        test('按 type 过滤', async () => {
            mockStore.set('reviews:r1', { id: 'r1', _type: 'reviews', type: 'first', createdAt: '2024-01-01' });
            mockStore.set('reviews:r2', { id: 'r2', _type: 'reviews', type: 'second', createdAt: '2024-01-02' });
            const { res } = await executeRoute(getRoutes(), 'GET', '/', { query: { type: 'second' } });
            expect(res._body).toHaveLength(1);
            expect(res._body[0].type).toBe('second');
        });

        test('空 store 返回空数组', async () => {
            const { res } = await executeRoute(getRoutes(), 'GET', '/');
            expect(res._body).toEqual([]);
        });
    });

    describe('GET /:id', () => {
        test('审阅存在返回详情', async () => {
            mockStore.set('reviews:r1', { id: 'r1', _type: 'reviews', type: 'first' });
            const { res } = await executeRoute(getRoutes(), 'GET', '/r1');
            expect(res._body.id).toBe('r1');
        });

        test('审阅不存在返回 404', async () => {
            const { res } = await executeRoute(getRoutes(), 'GET', '/notexist');
            expect(res._statusCode).toBe(404);
            expect(res._body.success).toBe(false);
        });
    });

    describe('POST /', () => {
        test('创建审阅返回 201', async () => {
            const { res } = await executeRoute(getRoutes(), 'POST', '/', {
                body: { chapterId: 'c1', projectId: 'p1', type: 'first', content: '审阅内容', issues: ['issue1'] }
            });
            expect(res._statusCode).toBe(201);
            expect(res._body.success).toBe(true);
            expect(res._body.data.chapterId).toBe('c1');
            expect(res._body.data.type).toBe('first');
            expect(res._body.data.issues).toEqual(['issue1']);
            expect(store.setItem).toHaveBeenCalled();
        });

        test('缺省 reviewer 默认 system', async () => {
            const { res } = await executeRoute(getRoutes(), 'POST', '/', { body: { chapterId: 'c1' } });
            expect(res._body.data.reviewer).toBe('system');
        });

        test('缺省 result 默认 pending', async () => {
            const { res } = await executeRoute(getRoutes(), 'POST', '/', { body: { chapterId: 'c1' } });
            expect(res._body.data.result).toBe('pending');
        });

        test('缺省 round 默认 1', async () => {
            const { res } = await executeRoute(getRoutes(), 'POST', '/', { body: { chapterId: 'c1' } });
            expect(res._body.data.round).toBe(1);
        });

        test('缺省 issues/suggestions 默认空数组', async () => {
            const { res } = await executeRoute(getRoutes(), 'POST', '/', { body: { chapterId: 'c1' } });
            expect(res._body.data.issues).toEqual([]);
            expect(res._body.data.suggestions).toEqual([]);
        });
    });

    describe('PUT /:id', () => {
        test('更新审阅', async () => {
            mockStore.set('reviews:r1', { id: 'r1', _type: 'reviews', type: 'first', content: 'old' });
            const { res } = await executeRoute(getRoutes(), 'PUT', '/r1', { body: { content: 'new', result: 'approved' } });
            expect(res._body.content).toBe('new');
            expect(res._body.result).toBe('approved');
            expect(res._body.id).toBe('r1');
        });

        test('审阅不存在返回 404', async () => {
            const { res } = await executeRoute(getRoutes(), 'PUT', '/notexist', { body: {} });
            expect(res._statusCode).toBe(404);
        });
    });

    describe('DELETE /:id', () => {
        test('删除审阅', async () => {
            mockStore.set('reviews:r1', { id: 'r1', _type: 'reviews' });
            const { res } = await executeRoute(getRoutes(), 'DELETE', '/r1');
            expect(res._body.success).toBe(true);
            expect(store.deleteItem).toHaveBeenCalledWith('reviews', 'r1');
        });

        test('审阅不存在返回 404', async () => {
            const { res } = await executeRoute(getRoutes(), 'DELETE', '/notexist');
            expect(res._statusCode).toBe(404);
        });
    });
});
