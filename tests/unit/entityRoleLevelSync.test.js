/**
 * 回归测试：entity_registry 的角色等级必须跟随源（entities / 素材），而不是"只升不降"
 * 背景：实测项目里素材与 entities 都是 supporting，但 registry 仍是 protagonist，
 *       实体中心因此显示 3 个"主角"。
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn(),
    queryItems: jest.fn(), listItems: jest.fn(), updateItem: jest.fn()
}));
jest.mock('../../server/shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const store = require('../../server/store');
const entityRegistry = require('../../server/services/entityRegistry');

const existingChar = (roleLevel, name = '阿雀') => ({
    id: 'character-1', projectId: 'p1', entityType: 'character', name,
    roleLevel, isActive: true, appearCount: 2, lastAppearChapter: 3
});

describe('entityRegistry.registerEntity — roleLevel 跟随同步源', () => {
    beforeEach(() => jest.clearAllMocks());

    it('角色被降级（protagonist→supporting）时，registry 同步降级', async () => {
        store.queryItems.mockResolvedValue([existingChar('protagonist')]);
        store.getItem.mockResolvedValue(existingChar('protagonist'));

        await entityRegistry.registerEntity('p1', 'character', '阿雀', { roleLevel: 'supporting' });

        const written = store.setItem.mock.calls.find(c => c[0] === 'entity-registry');
        expect(written).toBeTruthy();
        expect(written[2].roleLevel).toBe('supporting');
    });

    it('合法升级（npc→supporting）仍然生效', async () => {
        store.queryItems.mockResolvedValue([existingChar('npc')]);
        store.getItem.mockResolvedValue(existingChar('npc'));

        await entityRegistry.registerEntity('p1', 'character', '阿雀', { roleLevel: 'supporting' });

        const written = store.setItem.mock.calls.find(c => c[0] === 'entity-registry');
        expect(written[2].roleLevel).toBe('supporting');
    });

    it('非法角色等级不写入（防止脏值污染 UI 标签）', async () => {
        store.queryItems.mockResolvedValue([existingChar('npc')]);
        store.getItem.mockResolvedValue(existingChar('npc'));

        await entityRegistry.registerEntity('p1', 'character', '阿雀', { roleLevel: 'main-character' });

        const written = store.setItem.mock.calls.find(c => c[0] === 'entity-registry');
        expect(written[2].roleLevel).toBe('npc');
    });
});

describe('entityRegistry._findExistingEntity — 模糊匹配护栏', () => {
    beforeEach(() => jest.clearAllMocks());

    it('单字名不参与模糊匹配（精确匹配仍可用）', async () => {
        // 库里有个"甲乙"，新角色"甲"不应被模糊匹配吞并
        store.queryItems.mockResolvedValue([existingChar('npc', '甲乙')]);
        const found = await entityRegistry._findExistingEntity('p1', 'character', '甲');
        expect(found).toBeFalsy();
    });

    it('单字名精确匹配仍然生效', async () => {
        store.queryItems.mockResolvedValue([existingChar('npc', '甲')]);
        const found = await entityRegistry._findExistingEntity('p1', 'character', '甲');
        expect(found?.name).toBe('甲');
    });

    it('空名实体不会吞并新角色（原缺陷：空串 includes 恒真）', async () => {
        store.queryItems.mockResolvedValue([existingChar('npc', '')]);
        const found = await entityRegistry._findExistingEntity('p1', 'character', '阿雀');
        expect(found).toBeFalsy();
    });

    it('正常多字名仍可模糊匹配（阿雀 → 阿雀儿）', async () => {
        store.queryItems.mockResolvedValue([existingChar('npc', '阿雀儿')]);
        const found = await entityRegistry._findExistingEntity('p1', 'character', '阿雀');
        expect(found?.name).toBe('阿雀儿');
    });
});
