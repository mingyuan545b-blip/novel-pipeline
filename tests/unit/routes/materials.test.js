'use strict';

/**
 * materials 路由测试（S5.3）
 *
 * 测试策略：mock express + 所有依赖，通过 express.Router()._routes 访问路由
 * 文件位置：tests/unit/routes/materials.test.js
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
    }),
    isFoundationMaterial: jest.fn(async () => false)
}));

jest.mock('../../../server/services/memory', () => ({
    invalidateCache: jest.fn()
}));

jest.mock('../../../server/services/materialValidator', () => ({
    validateHierarchy: jest.fn(async () => ({ valid: true })),
    HIERARCHY_RULES: {
        faction: { description: '势力规则' },
        character: { description: '人物规则' },
        institution: { description: '机构规则' }
    }
}));

jest.mock('../../../server/services/materialIntegrity', () => ({
    checkIntegrity: jest.fn(() => ({ valid: true, issues: [] })),
    autoFix: jest.fn(() => ({ fixed: 0, details: [] })),
    normalizeMaterial: jest.fn((refs) => refs)
}));

jest.mock('../../../server/middleware/validators', () => ({
    createMaterial: (req, res, next) => next(),
    updateMaterial: (req, res, next) => next(),
    materialIdParam: (req, res, next) => next()
}));

jest.mock('../../../server/config/materialTypes', () => ({
    VALID_MATERIAL_TYPES: ['character', 'faction', 'plane', 'other']
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
const materialsRouter = require('../../../server/routes/materials');
const { executeRoute } = require('./helpers/routeTestHelper');
const store = require('../../../server/store');
const { validateHierarchy } = require('../../../server/services/materialValidator');
const { checkIntegrity, autoFix, normalizeMaterial } = require('../../../server/services/materialIntegrity');
const memory = require('../../../server/services/memory');

function stripType(obj) { const { _type, ...rest } = obj; return rest; }
function getRoutes() { return express.Router()._routes; }

describe('materials 路由 (S5.3)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStore.clear();
        validateHierarchy.mockResolvedValue({ valid: true });
        store.isFoundationMaterial.mockResolvedValue(false);
    });

    describe('GET /integrity/:projectId', () => {
        test('返回完整性报告', async () => {
            checkIntegrity.mockReturnValue({ valid: false, issues: ['issue1'] });
            const { res } = await executeRoute(getRoutes(), 'GET', '/integrity/p1');
            expect(res._body.issues).toEqual(['issue1']);
            expect(checkIntegrity).toHaveBeenCalledWith('p1');
        });
    });

    describe('POST /integrity/:projectId/fix', () => {
        test('执行自动修复（默认参数）', async () => {
            autoFix.mockReturnValue({ fixed: 3, details: [] });
            const { res } = await executeRoute(getRoutes(), 'POST', '/integrity/p1/fix', { body: {} });
            expect(res._body.fixed).toBe(3);
            expect(autoFix).toHaveBeenCalledWith('p1', { dryRun: true, fixBroken: true, fixNameRefs: true, fixDuplicates: true });
        });

        test('dryRun=false 执行实际修复', async () => {
            await executeRoute(getRoutes(), 'POST', '/integrity/p1/fix', { body: { dryRun: false } });
            expect(autoFix).toHaveBeenCalledWith('p1', expect.objectContaining({ dryRun: false }));
        });
    });

    describe('GET /', () => {
        test('返回所有素材', async () => {
            mockStore.set('materials:m1', { id: 'm1', _type: 'materials', projectId: 'p1', type: 'character' });
            mockStore.set('materials:m2', { id: 'm2', _type: 'materials', projectId: 'p2', type: 'faction' });
            const { res } = await executeRoute(getRoutes(), 'GET', '/');
            expect(res._body).toHaveLength(2);
        });

        test('按 projectId 过滤', async () => {
            mockStore.set('materials:m1', { id: 'm1', _type: 'materials', projectId: 'p1' });
            mockStore.set('materials:m2', { id: 'm2', _type: 'materials', projectId: 'p2' });
            const { res } = await executeRoute(getRoutes(), 'GET', '/', { query: { projectId: 'p1' } });
            expect(res._body).toHaveLength(1);
            expect(res._body[0].projectId).toBe('p1');
        });

        test('按 type 过滤', async () => {
            mockStore.set('materials:m1', { id: 'm1', _type: 'materials', type: 'character' });
            mockStore.set('materials:m2', { id: 'm2', _type: 'materials', type: 'faction' });
            const { res } = await executeRoute(getRoutes(), 'GET', '/', { query: { type: 'faction' } });
            expect(res._body).toHaveLength(1);
            expect(res._body[0].type).toBe('faction');
        });
    });

    describe('GET /types', () => {
        test('返回有效素材类型', async () => {
            const { res } = await executeRoute(getRoutes(), 'GET', '/types');
            expect(res._body).toContain('character');
            expect(res._body).toContain('faction');
        });
    });

    describe('GET /:id', () => {
        test('素材存在返回详情', async () => {
            mockStore.set('materials:m1', { id: 'm1', _type: 'materials', name: 'mat1' });
            const { res } = await executeRoute(getRoutes(), 'GET', '/m1');
            expect(res._body.id).toBe('m1');
        });

        test('素材不存在返回 404', async () => {
            const { res } = await executeRoute(getRoutes(), 'GET', '/notexist');
            expect(res._statusCode).toBe(404);
        });
    });

    describe('POST /', () => {
        test('创建素材返回 201', async () => {
            const { res } = await executeRoute(getRoutes(), 'POST', '/', {
                body: { projectId: 'p1', type: 'character', name: '角色1', currentContent: '内容' }
            });
            expect(res._statusCode).toBe(201);
            expect(res._body.success).toBe(true);
            expect(res._body.data.name).toBe('角色1');
            expect(res._body.data.type).toBe('character');
            expect(res._body.data.version).toBe(1);
            expect(store.setItem).toHaveBeenCalled();
        });

        test('层级校验失败返回 400', async () => {
            validateHierarchy.mockResolvedValue({ valid: false, message: '缺少 parentFaction', missing: ['parentFaction'] });
            const { res } = await executeRoute(getRoutes(), 'POST', '/', {
                body: { projectId: 'p1', type: 'character' }
            });
            expect(res._statusCode).toBe(400);
            expect(res._body.error.hint).toBeDefined();
        });

        test('缺省 type 默认 other', async () => {
            const { res } = await executeRoute(getRoutes(), 'POST', '/', { body: { projectId: 'p1' } });
            expect(res._body.data.type).toBe('other');
        });

        test('changeLog 记录初始创建', async () => {
            const { res } = await executeRoute(getRoutes(), 'POST', '/', {
                body: { projectId: 'p1', currentContent: '初始' }
            });
            expect(res._body.data.changeLog).toHaveLength(1);
            expect(res._body.data.changeLog[0].reason).toBe('Initial creation');
        });
    });

    describe('PUT /:id', () => {
        test('更新素材内容并记录 changeLog', async () => {
            mockStore.set('materials:m1', { id: 'm1', _type: 'materials', projectId: 'p1', currentContent: 'old', version: 1, changeLog: [] });
            const { res } = await executeRoute(getRoutes(), 'PUT', '/m1', {
                body: { currentContent: 'new', changeReason: '修改' }
            });
            expect(res._body.currentContent).toBe('new');
            expect(res._body.version).toBe(2);
            expect(res._body.changeLog).toHaveLength(1);
            expect(res._body.changeLog[0].reason).toBe('修改');
            expect(memory.invalidateCache).toHaveBeenCalledWith('p1');
        });

        test('保护字段不被覆盖', async () => {
            mockStore.set('materials:m1', { id: 'm1', _type: 'materials', projectId: 'p1', version: 1, createdAt: '2024-01-01' });
            const { res } = await executeRoute(getRoutes(), 'PUT', '/m1', {
                body: { id: 'hacked', projectId: 'hacked', version: 999, createdAt: '2099-01-01', name: 'newname' }
            });
            expect(res._body.id).toBe('m1');
            expect(res._body.projectId).toBe('p1');
            expect(res._body.version).toBe(2);
            expect(res._body.createdAt).toBe('2024-01-01');
        });

        test('素材不存在返回 404', async () => {
            const { res } = await executeRoute(getRoutes(), 'PUT', '/notexist', { body: {} });
            expect(res._statusCode).toBe(404);
        });

        test('内容未变化时不记录 changeLog', async () => {
            mockStore.set('materials:m1', { id: 'm1', _type: 'materials', projectId: 'p1', currentContent: 'same', version: 1, changeLog: [] });
            const { res } = await executeRoute(getRoutes(), 'PUT', '/m1', { body: { currentContent: 'same' } });
            expect(res._body.changeLog).toHaveLength(0);
        });
    });

    describe('DELETE /:id', () => {
        test('删除普通素材', async () => {
            mockStore.set('materials:m1', { id: 'm1', _type: 'materials', name: 'mat' });
            const { res } = await executeRoute(getRoutes(), 'DELETE', '/m1');
            expect(res._body.success).toBe(true);
            expect(store.deleteItem).toHaveBeenCalledWith('materials', 'm1');
        });

        test('基底素材不可删除返回 403', async () => {
            mockStore.set('materials:m1', { id: 'm1', _type: 'materials', name: 'foundation' });
            store.isFoundationMaterial.mockResolvedValue(true);
            const { res } = await executeRoute(getRoutes(), 'DELETE', '/m1');
            expect(res._statusCode).toBe(403);
            expect(res._body.error.message).toContain('基底素材');
        });

        test('素材不存在返回 404', async () => {
            const { res } = await executeRoute(getRoutes(), 'DELETE', '/notexist');
            expect(res._statusCode).toBe(404);
        });
    });
});

// ── E3b 覆盖补齐：深度校验端点 + 位面/势力归一化分支 ──
describe('materials 路由 (S5.3) — 覆盖补齐', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStore.clear();
        validateHierarchy.mockResolvedValue({ valid: true });
        store.isFoundationMaterial.mockResolvedValue(false);
    });

    describe('GET /depth/:projectId', () => {
        test('批量校验项目下未归档素材的深度', async () => {
            mockStore.set('materials:m1', { id: 'm1', _type: 'materials', projectId: 'p1', archived: false });
            mockStore.set('materials:m2', { id: 'm2', _type: 'materials', projectId: 'p1', archived: true });
            mockStore.set('materials:m3', { id: 'm3', _type: 'materials', projectId: 'p2', archived: false });
            const { res } = await executeRoute(getRoutes(), 'GET', '/depth/p1');
            expect(res._body).toHaveProperty('passed');
            expect(res._body.total).toBe(1);
        });
    });

    describe('GET /depth/:projectId/:materialId', () => {
        test('单素材深度校验带上 id/name/type', async () => {
            mockStore.set('materials:m1', { id: 'm1', _type: 'materials', projectId: 'p1', type: 'character', name: '甲' });
            const { res } = await executeRoute(getRoutes(), 'GET', '/depth/p1/m1');
            expect(res._body).toMatchObject({ id: 'm1', name: '甲', type: 'character' });
        });

        test('素材归属不符时返回 404', async () => {
            mockStore.set('materials:m1', { id: 'm1', _type: 'materials', projectId: 'p2' });
            const { res } = await executeRoute(getRoutes(), 'GET', '/depth/p1/m1');
            expect(res._statusCode).toBe(404);
        });
    });

    describe('POST / 位面与势力归一化', () => {
        test('projectId+parentPlane/parentFaction 时经 normalizeMaterial 归一', async () => {
            normalizeMaterial
                .mockReturnValueOnce({ parentPlane: 'plane-normalized' })
                .mockReturnValueOnce({ parentFaction: 'faction-normalized' });
            const { res } = await executeRoute(getRoutes(), 'POST', '/', {
                body: { projectId: 'p1', type: 'character', name: '甲', parentPlane: '小世界', parentFaction: '某势力' }
            });
            expect(res._statusCode).toBe(201);
            expect(res._body.data.parentPlane).toBe('plane-normalized');
            expect(res._body.data.parentFaction).toBe('faction-normalized');
        });
    });

    describe('PUT /:id 引用归一化', () => {
        test('projectId 存在时归一 parentPlane/parentFaction 并写入', async () => {
            mockStore.set('materials:m1', { id: 'm1', _type: 'materials', projectId: 'p1', version: 1 });
            normalizeMaterial
                .mockReturnValueOnce({ parentPlane: 'plane-ref' })
                .mockReturnValueOnce({ parentFaction: 'faction-ref' });
            const { res } = await executeRoute(getRoutes(), 'PUT', '/m1', {
                body: { parentPlane: '小世界', parentFaction: '某势力' }
            });
            expect(res._body.parentPlane).toBe('plane-ref');
            expect(res._body.parentFaction).toBe('faction-ref');
            expect(memory.invalidateCache).toHaveBeenCalledWith('p1');
        });
    });
});
