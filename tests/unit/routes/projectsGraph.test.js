'use strict';

/**
 * projects graphRoutes 路由测试（S5.2）
 *
 * 文件位置：tests/unit/routes/projectsGraph.test.js
 */

jest.mock('../../../server/shared/logger', () => ({
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()
}));

jest.mock('../../../server/routes/knowledge/relationshipGraphBuilder', () => ({
    buildRelationshipGraph: jest.fn()
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
const { registerGraphRoutes } = require('../../../server/routes/projects/graphRoutes');
const { executeRoute } = require('./helpers/routeTestHelper');
const { buildRelationshipGraph } = require('../../../server/routes/knowledge/relationshipGraphBuilder');

function getRoutes() { return express.Router()._routes; }
registerGraphRoutes(express.Router());

describe('projects graphRoutes (S5.2)', () => {
    beforeEach(() => { jest.clearAllMocks(); });

    describe('GET /:id/relationship-graph', () => {
        test('成功返回关系图', async () => {
            const mockGraph = { nodes: [{ id: 'n1' }], edges: [] };
            buildRelationshipGraph.mockResolvedValue(mockGraph);
            const { res } = await executeRoute(getRoutes(), 'GET', '/p1/relationship-graph');
            expect(res._statusCode).toBe(200);
            expect(res._body).toEqual(mockGraph);
            expect(buildRelationshipGraph).toHaveBeenCalledWith('p1');
        });

        test('buildRelationshipGraph 抛错返回 500', async () => {
            buildRelationshipGraph.mockRejectedValue(new Error('构建失败'));
            const { res } = await executeRoute(getRoutes(), 'GET', '/p1/relationship-graph');
            expect(res._statusCode).toBe(500);
            expect(res._body.success).toBe(false);
            expect(res._body.error.message).toContain('构建失败');
        });
    });
});
