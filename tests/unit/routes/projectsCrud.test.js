'use strict';

/**
 * projects crudRoutes 路由测试（S5.2）
 *
 * 测试策略：
 * - mock express（factory 闭包存储 routes，通过 express.Router()._routes 访问）
 * - mock store/validators/genreConfig/config/projectCreateHandler/projectCreateVerify/auditLog/projectDeleteHandler/logger
 * - 调用 registerCrudRoutes(router) 注册路由
 * - 使用 routeTestHelper.executeRoute 测试各路由
 *
 * 文件位置：tests/unit/routes/projectsCrud.test.js
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
        mockStore.delete(`${type}:${id}`);
    })
}));

jest.mock('../../../server/middleware/validators', () => ({
    createProject: (req, res, next) => next(),
    updateProject: (req, res, next) => next()
}));

const mockGenre = { id: 'test-genre', label: '测试题材', reviewFocus: ['focus1'], characterProfile: { behaviorTemplate: 'tpl' }, constraintPresets: {}, requiredConstraints: [], foundation: { additionalConstraints: [] } };
jest.mock('../../../server/services/genreConfig', () => ({
    resolveGenreFromProject: jest.fn(() => mockGenre)
}));

jest.mock('../../../server/config', () => ({
    resolveConfig: jest.fn(() => ({
        flow: { skipSecondReview: false },
        reader: { triggers: ['t1'] }
    }))
}));

jest.mock('../../../server/routes/projects/projectCreateHandler', () => ({
    createProjectData: jest.fn((req) => ({ id: 'new-pid', name: req.body.name, genre: req.body.genre, mode: 'long', createdAt: new Date().toISOString() }))
}));

jest.mock('../../../server/routes/projects/projectCreateVerify', () => ({
    verifyProject: jest.fn(async () => ({ ok: true, errors: [] }))
}));

jest.mock('../../../server/services/auditLog', () => ({
    log: jest.fn(),
    ACTIONS: { PROJECT_CREATE: 'project_create', PROJECT_DELETE: 'project_delete' }
}));

jest.mock('../../../server/routes/projects/projectDeleteHandler', () => ({
    cascadeDeleteProject: jest.fn(async () => ({ deletedCounts: { chapters: 1 }, failedCounts: {} }))
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
const { registerCrudRoutes } = require('../../../server/routes/projects/crudRoutes');
const { executeRoute } = require('./helpers/routeTestHelper');
const store = require('../../../server/store');
const auditLog = require('../../../server/services/auditLog');
const { cascadeDeleteProject } = require('../../../server/routes/projects/projectDeleteHandler');
const { verifyProject } = require('../../../server/routes/projects/projectCreateVerify');

function stripType(obj) { const { _type, ...rest } = obj; return rest; }
function getRoutes() { return express.Router()._routes; }

// 注册路由（只执行一次）
registerCrudRoutes(express.Router());

describe('projects crudRoutes (S5.2)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStore.clear();
    });

    describe('GET /', () => {
        test('返回所有项目（按 createdAt 降序）', async () => {
            mockStore.set('projects:p1', { id: 'p1', _type: 'projects', name: 'old', createdAt: '2024-01-01T00:00:00Z' });
            mockStore.set('projects:p2', { id: 'p2', _type: 'projects', name: 'new', createdAt: '2025-01-01T00:00:00Z' });
            const { res } = await executeRoute(getRoutes(), 'GET', '/');
            expect(res._statusCode).toBe(200);
            expect(res._body).toHaveLength(2);
            expect(res._body[0].id).toBe('p2');
            expect(res._body[1].id).toBe('p1');
            expect(res._body[0].pipelineConfig).toBeDefined();
        });

        test('空 store 返回空数组', async () => {
            const { res } = await executeRoute(getRoutes(), 'GET', '/');
            expect(res._body).toEqual([]);
        });
    });

    describe('GET /constraints', () => {
        test('返回 constraint-presets 列表', async () => {
            mockStore.set('constraint-presets:c1', { id: 'c1', _type: 'constraint-presets', label: '预设1', desc: '描述1' });
            const { res } = await executeRoute(getRoutes(), 'GET', '/constraints');
            expect(res._body).toHaveLength(1);
            expect(res._body[0]).toEqual({ id: 'c1', label: '预设1', desc: '描述1' });
        });
    });

    describe('GET /:id', () => {
        test('项目存在返回详情（含 pipelineConfig）', async () => {
            mockStore.set('projects:p1', { id: 'p1', _type: 'projects', name: 'proj1' });
            const { res } = await executeRoute(getRoutes(), 'GET', '/p1');
            expect(res._statusCode).toBe(200);
            expect(res._body.id).toBe('p1');
            expect(res._body.pipelineConfig).toBeDefined();
        });

        test('项目不存在返回 404', async () => {
            const { res } = await executeRoute(getRoutes(), 'GET', '/notexist');
            expect(res._statusCode).toBe(404);
            expect(res._body.success).toBe(false);
        });
    });

    describe('GET /:id/pipeline-config', () => {
        test('返回 pipeline 配置', async () => {
            mockStore.set('projects:p1', { id: 'p1', _type: 'projects', name: 'proj1' });
            const { res } = await executeRoute(getRoutes(), 'GET', '/p1/pipeline-config');
            expect(res._body.skipSecondReview).toBe(false);
            expect(res._body.steps).toContain('writer');
            expect(res._body.readerTriggers).toEqual(['t1']);
        });

        test('项目不存在返回 404', async () => {
            const { res } = await executeRoute(getRoutes(), 'GET', '/notexist/pipeline-config');
            expect(res._statusCode).toBe(404);
        });
    });

    describe('GET /:id/genre-constraints', () => {
        test('返回题材约束', async () => {
            mockStore.set('projects:p1', { id: 'p1', _type: 'projects', name: 'proj1' });
            const { res } = await executeRoute(getRoutes(), 'GET', '/p1/genre-constraints');
            expect(res._body.genreId).toBe('test-genre');
            expect(res._body.reviewFocus).toEqual(['focus1']);
        });

        test('项目不存在返回 404', async () => {
            const { res } = await executeRoute(getRoutes(), 'GET', '/notexist/genre-constraints');
            expect(res._statusCode).toBe(404);
        });
    });

    describe('GET /:id/agent-model-config', () => {
        test('返回 agentModelConfig', async () => {
            mockStore.set('projects:p1', { id: 'p1', _type: 'projects', agentModelConfig: { writer: 'deepseek' } });
            const { res } = await executeRoute(getRoutes(), 'GET', '/p1/agent-model-config');
            expect(res._body).toEqual({ writer: 'deepseek' });
        });

        test('无 agentModelConfig 返回空对象', async () => {
            mockStore.set('projects:p1', { id: 'p1', _type: 'projects' });
            const { res } = await executeRoute(getRoutes(), 'GET', '/p1/agent-model-config');
            expect(res._body).toEqual({});
        });
    });

    describe('PUT /:id/agent-model-config', () => {
        test('更新 agentModelConfig', async () => {
            mockStore.set('projects:p1', { id: 'p1', _type: 'projects' });
            const { res } = await executeRoute(getRoutes(), 'PUT', '/p1/agent-model-config', { body: { writer: 'gpt4' } });
            expect(res._body).toEqual({ writer: 'gpt4' });
            expect(store.setItem).toHaveBeenCalled();
        });

        test('项目不存在返回 404', async () => {
            const { res } = await executeRoute(getRoutes(), 'PUT', '/notexist/agent-model-config', { body: {} });
            expect(res._statusCode).toBe(404);
        });
    });

    describe('POST /', () => {
        test('创建项目返回 201 并触发 verify', async () => {
            const { res } = await executeRoute(getRoutes(), 'POST', '/', { body: { name: '新项目', genre: 'fantasy' } });
            expect(res._statusCode).toBe(201);
            expect(res._body.success).toBe(true);
            expect(res._body.data.id).toBe('new-pid');
            expect(verifyProject).toHaveBeenCalledWith('new-pid');
            expect(auditLog.log).toHaveBeenCalled();
        });
    });

    describe('PUT /:id', () => {
        test('更新项目', async () => {
            mockStore.set('projects:p1', { id: 'p1', _type: 'projects', name: 'old' });
            const { res } = await executeRoute(getRoutes(), 'PUT', '/p1', { body: { name: 'new' } });
            expect(res._body.name).toBe('new');
            expect(res._body.id).toBe('p1');
        });

        test('项目不存在返回 404', async () => {
            const { res } = await executeRoute(getRoutes(), 'PUT', '/notexist', { body: {} });
            expect(res._statusCode).toBe(404);
        });
    });

    describe('DELETE /:id', () => {
        test('删除项目并触发 cascade', async () => {
            mockStore.set('projects:p1', { id: 'p1', _type: 'projects', name: 'del' });
            const { res } = await executeRoute(getRoutes(), 'DELETE', '/p1');
            expect(res._body.success).toBe(true);
            expect(res._body.deletedCounts.chapters).toBe(1);
            expect(cascadeDeleteProject).toHaveBeenCalledWith('p1');
            expect(auditLog.log).toHaveBeenCalled();
        });

        test('项目不存在返回 404', async () => {
            const { res } = await executeRoute(getRoutes(), 'DELETE', '/notexist');
            expect(res._statusCode).toBe(404);
        });
    });
});
