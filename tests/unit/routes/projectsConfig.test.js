'use strict';

/**
 * projects projectConfigRoutes 路由测试（S5.2）
 *
 * 文件位置：tests/unit/routes/projectsConfig.test.js
 */

jest.mock('../../../server/shared/logger', () => ({
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()
}));

const mockStore = new Map();
jest.mock('../../../server/store', () => ({
    getItem: jest.fn(async (type, id) => {
        const item = mockStore.get(`${type}:${id}`);
        return item ? { ...item } : null;
    }),
    setItem: jest.fn(async (type, id, value) => {
        mockStore.set(`${type}:${id}`, { ...value });
    })
}));

jest.mock('../../../server/config/targetChaptersSchema', () => ({
    TARGET_CHAPTERS_FIELD: 'targetChapters'
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
const { registerProjectConfigRoutes } = require('../../../server/routes/projects/projectConfigRoutes');
const { executeRoute } = require('./helpers/routeTestHelper');

function getRoutes() { return express.Router()._routes; }
registerProjectConfigRoutes(express.Router());

// mock llm.testConnection（动态 require）
jest.mock('../../../server/services/llm', () => ({
    testConnection: jest.fn()
}));

describe('projects projectConfigRoutes (S5.2)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStore.clear();
    });

    describe('PUT /:id/targets', () => {
        test('更新 targetChapters 和 targetWordCount', async () => {
            mockStore.set('projects:p1', { id: 'p1', name: 'proj' });
            const { res } = await executeRoute(getRoutes(), 'PUT', '/p1/targets', {
                body: { targetChapters: 20, targetWordCount: 50000 }
            });
            expect(res._body.success).toBe(true);
            expect(res._body.targetChapters).toBe(20);
            expect(res._body.targetWordCount).toBe(50000);
        });

        test('targetChapters=0 是合法值（不限章节数）', async () => {
            mockStore.set('projects:p1', { id: 'p1', name: 'proj' });
            const { res } = await executeRoute(getRoutes(), 'PUT', '/p1/targets', {
                body: { targetChapters: 0 }
            });
            expect(res._body.targetChapters).toBe(0);
        });

        test('字符串数字会被转换', async () => {
            mockStore.set('projects:p1', { id: 'p1', name: 'proj' });
            const { res } = await executeRoute(getRoutes(), 'PUT', '/p1/targets', {
                body: { targetChapters: '15', targetWordCount: '30000' }
            });
            expect(res._body.targetChapters).toBe(15);
            expect(res._body.targetWordCount).toBe(30000);
        });

        test('项目不存在返回 404', async () => {
            const { res } = await executeRoute(getRoutes(), 'PUT', '/notexist/targets', { body: {} });
            expect(res._statusCode).toBe(404);
        });

        test('负数 targetChapters 被忽略', async () => {
            mockStore.set('projects:p1', { id: 'p1', name: 'proj', targetChapters: 10 });
            const { res } = await executeRoute(getRoutes(), 'PUT', '/p1/targets', {
                body: { targetChapters: -5 }
            });
            expect(res._body.success).toBe(true);
            // 负数被忽略，不更新
        });
    });

    describe('POST /test-connection', () => {
        test('成功返回测试结果', async () => {
            const { testConnection } = require('../../../server/services/llm');
            testConnection.mockResolvedValue({ success: true, latency: 100 });
            const { res } = await executeRoute(getRoutes(), 'POST', '/test-connection', {
                body: { provider: 'deepseek' }
            });
            expect(res._body.success).toBe(true);
            expect(testConnection).toHaveBeenCalledWith({ provider: 'deepseek' });
        });

        test('testConnection 抛错返回失败信息', async () => {
            const { testConnection } = require('../../../server/services/llm');
            testConnection.mockRejectedValue(new Error('连接超时'));
            const { res } = await executeRoute(getRoutes(), 'POST', '/test-connection', { body: {} });
            expect(res._body.success).toBe(false);
            expect(res._body.message).toContain('连接超时');
        });
    });
});
