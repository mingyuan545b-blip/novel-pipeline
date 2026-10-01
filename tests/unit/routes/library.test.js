'use strict';

/**
 * library 路由测试 —— 藏经阁索引/详情字段契约
 *
 * 回归背景（2026-10-01 用户反馈）：
 *   1) 「按来源」点开一本书，前端要按来源分组列出条目 → /index 必须带 sourceNovel
 *   2) 详情面板的"完整度横幅"直接读 detail.completeness；路由不返回该字段时
 *      前端回落 empty → 一条有 5 条实施规则的技法被标成"空壳条目"（用户可见的错误）
 *   3) 列表的"禁用"角标读 autoDisabled
 * 完整度判定是服务端 SSOT（services/libraryCompleteness.js），此处用真实模块验证接线。
 *
 * 文件位置：tests/unit/routes/library.test.js
 */

jest.mock('../../../server/shared/logger', () => ({
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(),
}));

jest.mock('express', () => {
    const routes = { get: [], post: [], put: [], delete: [] };
    const router = {
        get: (p, ...mw) => routes.get.push({ path: p, mw }),
        post: (p, ...mw) => routes.post.push({ path: p, mw }),
        put: (p, ...mw) => routes.put.push({ path: p, mw }),
        delete: (p, ...mw) => routes.delete.push({ path: p, mw }),
        use: jest.fn(),
        _routes: routes,
    };
    return { Router: () => router };
});

// 子路由：本文件不测它们的内容，避免连带加载 store/PG
jest.mock('../../../server/routes/libraryMetaRoutes', () => ({}));
jest.mock('../../../server/routes/libraryExtractRoutes', () => ({}));

const mockFull = {
    id: 'full-1', display_name: '创伤体验的战术化重构', department: '03_人物熔炉部', subcategory: '人物弧光',
    retrieval_tags: ['复盘'], applicable_modes: ['novel'], context_slot: 'L2', injection_point: 'writer',
    worldviewDepth: 'meso', implementation_rules: ['r1', 'r2', 'r3', 'r4', 'r5'], anti_patterns: [],
    source_novel: '全球死考：刚下刑场你让我去考试', source_type: 'extracted', auto_disabled: true,
    success_rate: 50, attempts: 0, description: 'd',
};
const mockEmpty = {
    id: 'empty-1', display_name: '白描', department: '05_文笔滤镜部', subcategory: '01_句式与节奏',
    retrieval_tags: [], applicable_modes: ['novel'], context_slot: 'L3', injection_point: 'polisher',
    worldviewDepth: 'micro', implementation_rules: [], anti_patterns: [], source_novel: '',
    source_type: 'curated', auto_disabled: false, success_rate: 50, attempts: 0, description: '',
};

jest.mock('../../../server/services/techIndex', () => ({
    getAll: jest.fn(() => [mockFull, mockEmpty]),
    getTechnique: jest.fn((id) => {
        if (id === 'full-1') return mockFull;
        if (id === 'empty-1') return mockEmpty;
        return null;
    }),
    search: jest.fn(() => []),
    getSource: jest.fn(() => 'pg'),
    getLoadedAt: jest.fn(() => '2026-10-01T00:00:00.000Z'),
    reload: jest.fn(async () => ({ source: 'pg', count: 2 })),
}));

jest.mock('../../../server/services/libraryStore', () => ({
    getStats: jest.fn(async () => ({ total: 2, departments: 2, disabled: 1, byDepartment: {} })),
}));

jest.mock('../../../server/services/validationEngine', () => ({
    ValidationEngine: class { validatePlatformCompliance() { return { ok: true }; } },
}));

const express = require('express');
require('../../../server/routes/library');
const { executeRoute } = require('./helpers/routeTestHelper');

const getRoutes = () => express.Router()._routes;

describe('GET /index（藏经阁索引条目字段契约）', () => {
    test('每条带 completeness / sourceNovel / autoDisabled，前端才能"优先展示有数据的"', async () => {
        const { res } = await executeRoute(getRoutes(), 'GET', '/index');
        const [full, empty] = res._body.entries;
        expect(res._body.total_entries).toBe(2);

        expect(full.completeness).toBe('full');
        expect(full.rulesCount).toBe(5);
        expect(full.sourceNovel).toBe('全球死考：刚下刑场你让我去考试');
        expect(full.autoDisabled).toBe(true);

        expect(empty.completeness).toBe('empty');
        expect(empty.sourceNovel).toBe('');            // 前端会归入"（未标注来源）"分组
        expect(empty.autoDisabled).toBe(false);
    });

    test('默认按"有内容优先"排序（空壳沉底）', async () => {
        const { res } = await executeRoute(getRoutes(), 'GET', '/index');
        expect(res._body.entries.map(e => e.id)).toEqual(['full-1', 'empty-1']);
    });
});

describe('GET /technique/:id（详情必须自带完整度）', () => {
    test('有实施规则的技法 → completeness=full（不得回落空壳）', async () => {
        const { res } = await executeRoute(getRoutes(), 'GET', '/technique/full-1');
        expect(res._body.completeness).toBe('full');
        expect(res._body.rulesCount).toBe(5);
        expect(res._body.source_novel).toBe('全球死考：刚下刑场你让我去考试');
        expect(res._body._meta.auto_disabled).toBe(true);
    });

    test('无规则的技法 → completeness=empty', async () => {
        const { res } = await executeRoute(getRoutes(), 'GET', '/technique/empty-1');
        expect(res._body.completeness).toBe('empty');
        expect(res._body.rulesCount).toBe(0);
    });

    test('技法不存在 → 404', async () => {
        const { res } = await executeRoute(getRoutes(), 'GET', '/technique/nope');
        expect(res._statusCode).toBe(404);
        expect(res._body.success).toBe(false);
    });
});
