'use strict';

/**
 * projects styleRoutes 路由测试（S5.2）
 *
 * 文件位置：tests/unit/routes/projectsStyle.test.js
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

jest.mock('../../../server/routes/projects/styleAnalysis', () => ({
    analyzeStyle: jest.fn()
}));

jest.mock('../../../server/services/reviewRemediation', () => ({
    analyzeAndRemediate: jest.fn()
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
const { registerStyleRoutes } = require('../../../server/routes/projects/styleRoutes');
const { executeRoute } = require('./helpers/routeTestHelper');
const { analyzeStyle } = require('../../../server/routes/projects/styleAnalysis');
const { analyzeAndRemediate } = require('../../../server/services/reviewRemediation');

function getRoutes() { return express.Router()._routes; }
registerStyleRoutes(express.Router());

describe('projects styleRoutes (S5.2)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStore.clear();
    });

    describe('POST /:id/analyze-style', () => {
        test('成功分析风格并保存 styleGuidance', async () => {
            mockStore.set('projects:p1', { id: 'p1', name: 'proj' });
            analyzeStyle.mockResolvedValue({ fullGuidance: '风格指引', analysis: { tone: 'serious' } });
            const { res } = await executeRoute(getRoutes(), 'POST', '/p1/analyze-style', { body: { suggestion: '建议' } });
            expect(res._body.success).toBe(true);
            expect(res._body.styleGuidance).toBe('风格指引');
            expect(analyzeStyle).toHaveBeenCalledWith('p1', '建议');
        });

        test('项目不存在返回 404', async () => {
            const { res } = await executeRoute(getRoutes(), 'POST', '/notexist/analyze-style', { body: {} });
            expect(res._statusCode).toBe(404);
        });

        test('analyzeStyle 抛错返回 500', async () => {
            mockStore.set('projects:p1', { id: 'p1', name: 'proj' });
            analyzeStyle.mockRejectedValue(new Error('分析失败'));
            const { res } = await executeRoute(getRoutes(), 'POST', '/p1/analyze-style', { body: {} });
            expect(res._statusCode).toBe(500);
        });
    });

    describe('PUT /:id/style-guidance', () => {
        test('直接更新 styleGuidance', async () => {
            mockStore.set('projects:p1', { id: 'p1', name: 'proj' });
            const { res } = await executeRoute(getRoutes(), 'PUT', '/p1/style-guidance', { body: { styleGuidance: '新风格' } });
            expect(res._body.success).toBe(true);
            expect(res._body.styleGuidance).toBe('新风格');
        });

        test('项目不存在返回 404', async () => {
            const { res } = await executeRoute(getRoutes(), 'PUT', '/notexist/style-guidance', { body: {} });
            expect(res._statusCode).toBe(404);
        });
    });

    describe('POST /:id/remediate', () => {
        test('成功调用 analyzeAndRemediate', async () => {
            analyzeAndRemediate.mockResolvedValue({ applied: 2 });
            const { res } = await executeRoute(getRoutes(), 'POST', '/p1/remediate', { body: { reviewText: '审阅文本', autoApply: true } });
            expect(res._body).toEqual({ applied: 2 });
            expect(analyzeAndRemediate).toHaveBeenCalledWith('p1', '审阅文本', { autoApply: true });
        });

        test('缺少 reviewText 返回 400', async () => {
            const { res } = await executeRoute(getRoutes(), 'POST', '/p1/remediate', { body: {} });
            expect(res._statusCode).toBe(400);
            expect(res._body.error.message).toContain('reviewText');
        });

        test('autoApply 默认为 true', async () => {
            analyzeAndRemediate.mockResolvedValue({ applied: 1 });
            await executeRoute(getRoutes(), 'POST', '/p1/remediate', { body: { reviewText: 'txt' } });
            expect(analyzeAndRemediate).toHaveBeenCalledWith('p1', 'txt', { autoApply: true });
        });

        test('analyzeAndRemediate 抛错返回 500', async () => {
            analyzeAndRemediate.mockRejectedValue(new Error('修复失败'));
            const { res } = await executeRoute(getRoutes(), 'POST', '/p1/remediate', { body: { reviewText: 'txt' } });
            expect(res._statusCode).toBe(500);
        });
    });

    describe('GET /:id/remediation-status', () => {
        test('返回修复状态', async () => {
            mockStore.set('projects:p1', {
                id: 'p1', writerPromptAdditions: ['r1'], reviewPromptAdditions: ['r2'],
                constraints: ['c1'], styleGuidance: 'guidance'
            });
            const { res } = await executeRoute(getRoutes(), 'GET', '/p1/remediation-status');
            expect(res._body.writerRules).toEqual(['r1']);
            expect(res._body.reviewRules).toEqual(['r2']);
            expect(res._body.constraints).toEqual(['c1']);
            expect(res._body.styleGuidance).toBe('guidance');
        });

        test('项目不存在返回 404', async () => {
            const { res } = await executeRoute(getRoutes(), 'GET', '/notexist/remediation-status');
            expect(res._statusCode).toBe(404);
        });

        test('无修复数据返回空数组/null', async () => {
            mockStore.set('projects:p1', { id: 'p1' });
            const { res } = await executeRoute(getRoutes(), 'GET', '/p1/remediation-status');
            expect(res._body.writerRules).toEqual([]);
            expect(res._body.styleGuidance).toBeNull();
        });
    });

    describe('DELETE /:id/remediation/:type', () => {
        test('删除 writer-rule', async () => {
            mockStore.set('projects:p1', { id: 'p1', writerPromptAdditions: ['r1', 'r2'] });
            const { res } = await executeRoute(getRoutes(), 'DELETE', '/p1/remediation/writer-rule', { body: { index: 0 } });
            expect(res._body.success).toBe(true);
        });

        test('删除 review-rule', async () => {
            mockStore.set('projects:p1', { id: 'p1', reviewPromptAdditions: ['r1'] });
            const { res } = await executeRoute(getRoutes(), 'DELETE', '/p1/remediation/review-rule', { body: { index: 0 } });
            expect(res._body.success).toBe(true);
        });

        test('删除 style-guidance', async () => {
            mockStore.set('projects:p1', { id: 'p1', styleGuidance: 'guidance' });
            const { res } = await executeRoute(getRoutes(), 'DELETE', '/p1/remediation/style-guidance', { body: {} });
            expect(res._body.success).toBe(true);
        });

        test('项目不存在返回 404', async () => {
            const { res } = await executeRoute(getRoutes(), 'DELETE', '/notexist/remediation/writer-rule', { body: {} });
            expect(res._statusCode).toBe(404);
        });
    });
});
