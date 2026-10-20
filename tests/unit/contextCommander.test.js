/**
 * contextCommander.test.js — 上下文决策引擎测试
 */
const { resolveChapterPhase, detectSceneTypes, getDepthAdjustment, getScenePriorityBoost, allocateBudget } = require('../../server/services/pipeline/contextDecisionRules');
const { resolveContext } = require('../../server/services/pipeline/contextCommander');

describe('contextDecisionRules', () => {
    test('resolveChapterPhase: chapter 1 is opening', () => {
        expect(resolveChapterPhase(1)).toBe('opening');
    });

    test('resolveChapterPhase: chapter 20 is development', () => {
        expect(resolveChapterPhase(20)).toBe('development');
    });

    test('resolveChapterPhase: chapter 60 is climax', () => {
        expect(resolveChapterPhase(60)).toBe('climax');
    });

    test('detectSceneTypes: detects combat scene', () => {
        const scenes = detectSceneTypes('主角与敌人展开激烈战斗');
        expect(scenes.length).toBeGreaterThan(0);
        expect(scenes[0].scene).toBe('combat');
    });

    test('detectSceneTypes: empty outline returns empty', () => {
        expect(detectSceneTypes('')).toEqual([]);
    });

    test('getDepthAdjustment: opening phase boosts worldview', () => {
        const adj = getDepthAdjustment('opening', 'worldview');
        expect(adj.depthBoost).toBe(1);
    });

    test('getDepthAdjustment: climax phase reduces worldview', () => {
        const adj = getDepthAdjustment('climax', 'worldview');
        expect(adj.depthBoost).toBe(-1);
    });

    test('getScenePriorityBoost: combat boosts power-system', () => {
        const boost = getScenePriorityBoost([{ scene: 'combat', confidence: 0.5 }], 'power-system');
        expect(boost).toBe(2);
    });

    test('allocateBudget: distributes by ratios', () => {
        const alloc = allocateBudget(10000, ['character', 'worldview', 'power-system']);
        expect(alloc.character).toBe(3500);
        expect(alloc.worldview).toBe(1000);
        expect(alloc['power-system']).toBe(800);
    });
});

describe('contextCommander', () => {
    test('resolveContext returns empty for unknown agent', async () => {
        const result = await resolveContext('unknown-agent', {});
        expect(result.materialNeeds).toEqual([]);
        expect(result.totalBudget).toBe(0);
    });

    test('resolveContext returns resolved needs for writer', async () => {
        const result = await resolveContext('writer', {
            projectId: 'test-proj',
            chapter: { chapterNumber: 1, outline: '主角开始修炼' },
            materials: [],
            project: {},
        });
        expect(result.materialNeeds.length).toBeGreaterThan(0);
        expect(result.totalBudget).toBeGreaterThan(0);
        expect(result.meta.phase).toBe('opening');
    });

    test('resolveContext applies depth adjustments', async () => {
        const result = await resolveContext('writer', {
            projectId: 'test-proj',
            chapter: { chapterNumber: 1, outline: '' },
            materials: [],
            project: {},
        });
        const worldviewNeed = result.materialNeeds.find(n => n.type === 'worldview');
        expect(worldviewNeed.resolvedDepth).toBeTruthy();
        expect(worldviewNeed.depthAdjustment).toBeDefined();
    });

    test('resolveContext detects scenes from outline', async () => {
        const result = await resolveContext('writer', {
            projectId: 'test-proj',
            chapter: { chapterNumber: 10, outline: '主角与敌人展开激烈战斗' },
            materials: [],
            project: {},
        });
        expect(result.meta.sceneTypes).toContain('combat');
    });
});
