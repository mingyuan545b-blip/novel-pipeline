/**
 * craftDesigner 单元测试 — 工艺缺口判定 / 目标筛选 / 补丁合并（不打真实 LLM）
 */
jest.mock('../../server/services/llm', () => ({ chat: jest.fn() }));
jest.mock('../../server/services/entityCenter', () => ({ getEntitiesForProject: jest.fn(), updateEntity: jest.fn() }));
jest.mock('../../server/store', () => ({ getItem: jest.fn() }));

const { needsCraft, selectCraftTargets, buildCraftPatchFromItem } = require('../../server/services/craftDesigner');

const full = {
    roleLevel: 'protagonist',
    charisma: '当有人赖账时，他宁可撕破脸，也不肯留一笔糊涂账',
    philosophy: '账平了人才能安稳',
    entranceDesign: '雨夜提灯走进当铺，先把灯芯剪到最短',
    quoteLibrary: [{ scene: '绝境', quote: '人生如棋，落子无悔', why: '因为他一生都在替别人算账，所以宁可认命，也不回头' }],
    highlightScenes: [{ scene: '当铺对峙', what: '把账本摔在柜台上', cost: '断了这条线的退路', why: '因为他要的是账平，所以宁可撕破脸，也不留糊涂账' }],
    catchphrases: [{ text: '这账，平了才叫结', trigger: '面对赖账的人时', why: '因为他是记账人，所以宁可当恶人，也不肯留一笔糊涂账' }],
};

describe('needsCraft', () => {
    test('工艺齐备 → 无缺口', () => {
        expect(needsCraft(full)).toEqual([]);
    });
    test('空角色 → 六项全缺', () => {
        expect(needsCraft({})).toEqual(['人格魅力', '哲学观', '出场设计', '金句库', '高光场景', '口头禅']);
    });
    test('评论腔 why 视为不达标（要有合格项才算达标）', () => {
        const bad = { ...full, quoteLibrary: [{ scene: '绝境', quote: '人生如棋', why: '体现了他的哲学观' }] };
        expect(needsCraft(bad)).toContain('金句库');
    });
});

describe('selectCraftTargets', () => {
    test('只挑主角/配角且有缺口的前 N 个', () => {
        const list = [
            full,                                                    // 无缺口 → 不挑
            { roleLevel: 'npc', name: '路人' },                      // NPC → 不挑
            { roleLevel: 'supporting', name: '甲' },
            { roleLevel: 'protagonist', name: '乙' },
        ];
        const t = selectCraftTargets(list, 2);
        expect(t).toHaveLength(2);
        expect(t.map(x => x.entity.name)).toEqual(['甲', '乙']);
    });
});

describe('buildCraftPatchFromItem', () => {
    test('只填空缺项，不覆盖已有值', () => {
        const entity = { charisma: '已有的魅力描述', quoteLibrary: [] };
        const patch = buildCraftPatchFromItem(entity, {
            charisma: '新的魅力描述',
            philosophy: '信念：账平了才算结',
            quoteLibrary: [{ scene: '绝境', quote: '人生如棋，落子无悔', why: '因为他一生都在替别人算账，所以宁可认命，也不回头' }],
        });
        expect(patch.charisma).toBeUndefined();
        expect(patch.philosophy).toBe('信念：账平了才算结');
        expect(patch.quoteLibrary).toHaveLength(1);
    });
    test('评论腔/过场句被闸门拦下，不进补丁', () => {
        const patch = buildCraftPatchFromItem({}, {
            quoteLibrary: [{ scene: '绝境', quote: '上车。', why: '体现了他的急' }],
            highlights: [{ scene: '雨夜', what: '立誓', why: '展现了高光' }],
            catchphrases: [{ text: 'yyds', trigger: '夸人', why: '因为他是铁粉，所以宁可吹也不黑' }],
        });
        expect(patch).toEqual({});
    });
    test('数组按 key 合并去重', () => {
        const entity = { quoteLibrary: [{ scene: '绝境', quote: '人生如棋，落子无悔', why: 'x'.repeat(8) }] };
        const patch = buildCraftPatchFromItem(entity, {
            quoteLibrary: [{ scene: '别处', quote: '人生如棋，落子无悔。', why: '因为他一生都在替别人算账，所以宁可认命，也不回头' }],
        });
        expect(patch.quoteLibrary).toHaveLength(1);
    });
});
