/**
 * buildWorldScopePrompt 单测（B2/F7）
 * F7：startup 原调用 worldScope.getWorldScopeForPrompt（从未存在的幻觉函数）。
 * 真实可用的是 buildWorldScopePrompt，本测试锁定其行为，防止再次退回幻觉调用。
 */
jest.mock('../../server/store', () => ({
    queryItems: jest.fn(),
    getItem: jest.fn(),
}));

const store = require('../../server/store');
const { buildWorldScopePrompt } = require('../../server/services/worldScopeCrud');

describe('buildWorldScopePrompt（F7 补真）', () => {
    beforeEach(() => jest.clearAllMocks());

    test('public 可见域 → 注入实体名提示', async () => {
        store.queryItems.mockResolvedValue([{ id: 'ws1', entityId: 'm1', scope: 'public' }]);
        store.getItem.mockResolvedValue({ id: 'm1', name: '苍梧城', archived: false });
        const hint = await buildWorldScopePrompt('p1', null, null);
        expect(hint).toContain('苍梧城');
        expect(hint).toContain('可见范围');
    });

    test('private 可见域 + 无 reader → 不注入（安全下限）', async () => {
        store.queryItems.mockResolvedValue([{ id: 'ws1', entityId: 'm1', scope: 'private', characterId: 'c1' }]);
        store.getItem.mockResolvedValue({ id: 'm1', name: '密辛', archived: false });
        expect(await buildWorldScopePrompt('p1', null, null)).toBe('');
    });

    test('无 scope 记录 → 空串', async () => {
        store.queryItems.mockResolvedValue([]);
        expect(await buildWorldScopePrompt('p1', null, null)).toBe('');
    });

    test('实体已归档 → 跳过', async () => {
        store.queryItems.mockResolvedValue([{ id: 'ws1', entityId: 'm1', scope: 'public' }]);
        store.getItem.mockResolvedValue({ id: 'm1', name: '旧物', archived: true });
        expect(await buildWorldScopePrompt('p1', null, null)).toBe('');
    });
});
