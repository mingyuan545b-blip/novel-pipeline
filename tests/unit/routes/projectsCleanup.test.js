'use strict';

/**
 * projects cleanupRoutes 路由测试（S5.2）
 *
 * 文件位置：tests/unit/routes/projectsCleanup.test.js
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
    }),
    queryItems: jest.fn(async (type, query) => {
        const items = [];
        for (const [, v] of mockStore.entries()) {
            if (v._type === type) {
                const { _type, ...rest } = v;
                if (!query || Object.entries(query).every(([k, val]) => rest[k] === val)) items.push(rest);
            }
        }
        return items;
    }),
    DATA_DIR: '/fake/data'
}));

jest.mock('../../../server/routes/projects/cleanupHandlers', () => ({
    cleanupChapters: jest.fn(async () => ({ chapters: 5 })),
    cleanupTimelines: jest.fn(async () => ({ timelines: 2 })),
    cleanupMaterials: jest.fn(async () => ({ materials: 3 })),
    cleanupKnowledge: jest.fn(async () => ({ knowledge: 1 })),
    cleanupOutlines: jest.fn(async () => ({ outlines: 4 })),
    cleanupLogs: jest.fn(async () => ({ logs: 10 })),
    cleanupRemediation: jest.fn(() => ({ remediation: 2 }))
}));

// mock fs 避免 cleanup-stats 中的实际文件系统操作
jest.mock('fs', () => ({
    readdirSync: jest.fn(() => []),
    statSync: jest.fn(() => ({ size: 0, isDirectory: () => false })),
    existsSync: jest.fn(() => false)
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
const { registerCleanupRoutes } = require('../../../server/routes/projects/cleanupRoutes');
const { executeRoute } = require('./helpers/routeTestHelper');
const handlers = require('../../../server/routes/projects/cleanupHandlers');

function getRoutes() { return express.Router()._routes; }
registerCleanupRoutes(express.Router());

describe('projects cleanupRoutes (S5.2)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStore.clear();
    });

    describe('POST /:id/cleanup', () => {
        test('清理 chapters + materials', async () => {
            mockStore.set('projects:p1', { id: 'p1', _type: 'projects', name: 'proj' });
            const { res } = await executeRoute(getRoutes(), 'POST', '/p1/cleanup', {
                body: { targets: ['chapters', 'materials'], keepLocked: true }
            });
            expect(res._body.success).toBe(true);
            expect(res._body.cleaned.chapters).toBe(5);
            expect(res._body.cleaned.materials).toBe(3);
            expect(handlers.cleanupChapters).toHaveBeenCalledWith('p1', expect.any(Object));
            expect(handlers.cleanupMaterials).toHaveBeenCalledWith('p1', true);
        });

        test('keepLocked 默认为 true', async () => {
            mockStore.set('projects:p1', { id: 'p1', _type: 'projects', name: 'proj' });
            await executeRoute(getRoutes(), 'POST', '/p1/cleanup', {
                body: { targets: ['materials'] }
            });
            expect(handlers.cleanupMaterials).toHaveBeenCalledWith('p1', true);
        });

        test('keepLocked=false 传递', async () => {
            mockStore.set('projects:p1', { id: 'p1', _type: 'projects', name: 'proj' });
            await executeRoute(getRoutes(), 'POST', '/p1/cleanup', {
                body: { targets: ['materials'], keepLocked: false }
            });
            expect(handlers.cleanupMaterials).toHaveBeenCalledWith('p1', false);
        });

        test('清理所有 targets', async () => {
            mockStore.set('projects:p1', { id: 'p1', _type: 'projects', name: 'proj' });
            const { res } = await executeRoute(getRoutes(), 'POST', '/p1/cleanup', {
                body: { targets: ['chapters', 'timelines', 'materials', 'knowledge', 'outlines', 'logs', 'remediation'] }
            });
            expect(handlers.cleanupChapters).toHaveBeenCalled();
            expect(handlers.cleanupTimelines).toHaveBeenCalled();
            expect(handlers.cleanupMaterials).toHaveBeenCalled();
            expect(handlers.cleanupKnowledge).toHaveBeenCalled();
            expect(handlers.cleanupOutlines).toHaveBeenCalled();
            expect(handlers.cleanupLogs).toHaveBeenCalled();
            expect(handlers.cleanupRemediation).toHaveBeenCalled();
            expect(res._body.success).toBe(true);
        });

        test('项目不存在返回 404', async () => {
            const { res } = await executeRoute(getRoutes(), 'POST', '/notexist/cleanup', { body: { targets: [] } });
            expect(res._statusCode).toBe(404);
        });
    });

    describe('GET /:id/cleanup-stats', () => {
        test('返回清理统计', async () => {
            mockStore.set('projects:p1', { id: 'p1', _type: 'projects', name: 'proj', writerPromptAdditions: ['r1'] });
            mockStore.set('chapters:c1', { id: 'c1', _type: 'chapters', projectId: 'p1' });
            mockStore.set('materials:m1', { id: 'm1', _type: 'materials', projectId: 'p1', isLocked: true });
            mockStore.set('materials:m2', { id: 'm2', _type: 'materials', projectId: 'p1', isLocked: false });
            const { res } = await executeRoute(getRoutes(), 'GET', '/p1/cleanup-stats');
            expect(res._statusCode).toBe(200);
            expect(res._body.chapters.count).toBe(1);
            expect(res._body.materials.count).toBe(2);
            expect(res._body.materials.locked).toBe(1);
            expect(res._body.materials.unlocked).toBe(1);
            expect(res._body.remediation.hasWriterAdditions).toBe(true);
        });

        test('项目不存在返回 404', async () => {
            const { res } = await executeRoute(getRoutes(), 'GET', '/notexist/cleanup-stats');
            expect(res._statusCode).toBe(404);
        });
    });
});
