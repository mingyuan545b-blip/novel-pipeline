/**
 * servantDecisionEngine.test.js — 仆从决策引擎测试
 */
const { resolveServantLoad, resolveServantLoads } = require('../../server/services/pipeline/servantDecisionEngine');

describe('servantDecisionEngine', () => {
    const ownerEntity = { id: 'ent-1', name: '陆尘', roleLevel: 'protagonist' };
    const servantEntity = {
        id: 'ent-2', name: '小灰', roleLevel: 'servant',
        bindsSummary: [{ bindType: 'pet', ownerName: '陆尘', name: '小灰' }],
        genreState: { 修为: '筑基初期' },
    };
    const nonServantEntity = {
        id: 'ent-3', name: '路人甲', roleLevel: 'npc',
        bindsSummary: [],
    };

    test('resolveServantLoad: combat scene with owner present loads L3', () => {
        const result = resolveServantLoad(servantEntity, {
            chapter: { chapterNumber: 10 },
            entities: [ownerEntity, servantEntity],
            outlineText: '陆尘与敌人展开激烈战斗',
        });
        expect(result.shouldLoad).toBe(true);
        expect(result.depth).toBe('L3');
    });

    test('resolveServantLoad: owner present non-combat loads L2', () => {
        const result = resolveServantLoad(servantEntity, {
            chapter: { chapterNumber: 5 },
            entities: [ownerEntity, servantEntity],
            outlineText: '陆尘在山中修炼',
        });
        expect(result.shouldLoad).toBe(true);
        expect(result.depth).toBe('L2');
    });

    test('resolveServantLoad: protagonist servant owner absent loads L0', () => {
        const result = resolveServantLoad(servantEntity, {
            chapter: { chapterNumber: 5 },
            entities: [ownerEntity, servantEntity],
            outlineText: '王明独自探索秘境',
        });
        expect(result.shouldLoad).toBe(true);
        expect(result.depth).toBe('L0');
    });

    test('resolveServantLoad: non-protagonist servant owner absent returns false', () => {
        const npcOwner = { id: 'ent-4', name: '王明', roleLevel: 'supporting' };
        const npcServant = {
            id: 'ent-5', name: '小黑', roleLevel: 'servant',
            bindsSummary: [{ bindType: 'servant', ownerName: '王明', name: '小黑' }],
        };
        const result = resolveServantLoad(npcServant, {
            chapter: { chapterNumber: 5 },
            entities: [npcOwner, npcServant],
            outlineText: '陆尘独自探索秘境',
        });
        expect(result.shouldLoad).toBe(false);
    });

    test('resolveServantLoad: non-servant entity returns false', () => {
        const result = resolveServantLoad(nonServantEntity, {
            chapter: { chapterNumber: 5 },
            entities: [ownerEntity, nonServantEntity],
            outlineText: '陆尘遇到路人甲',
        });
        expect(result.shouldLoad).toBe(false);
    });

    test('resolveServantLoads: batch processes multiple entities', () => {
        const results = resolveServantLoads([servantEntity, nonServantEntity], {
            chapter: { chapterNumber: 5 },
            entities: [ownerEntity, servantEntity, nonServantEntity],
            outlineText: '陆尘带着小灰修炼',
        });
        expect(results.length).toBe(2);
        expect(results[0].shouldLoad).toBe(true);
        expect(results[1].shouldLoad).toBe(false);
    });
});
