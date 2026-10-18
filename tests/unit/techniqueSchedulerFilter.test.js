/**
 * techniqueScheduler 源头过滤单测（D 增量）
 * 缺陷：调度未过滤 auto_disabled → 被"自动禁用"的技法仍注入 writer prompt。
 */
jest.mock('../../server/services/techIndex', () => ({
    getTechniquesByInjectionPoint: jest.fn(),
    formatTechniquesForPrompt: jest.fn(() => ''),
}));
jest.mock('../../server/services/pipeline/contextDecisionRules', () => ({
    detectSceneTypes: jest.fn(() => []),
    getDepthAdjustment: jest.fn(() => ({ depthBoost: 0 })),
}));

const techIndex = require('../../server/services/techIndex');
const { scheduleTechniques } = require('../../server/services/pipeline/techniqueScheduler');

const tech = (id, extra = {}) => ({ id, department: '文笔滤镜部', worldviewDepth: 'meso', success_rate: 50, tags: [], ...extra });

describe('scheduleTechniques 源头过滤', () => {
    beforeEach(() => jest.clearAllMocks());

    test('auto_disabled 技法不进入注入候选', () => {
        techIndex.getTechniquesByInjectionPoint.mockReturnValue([
            tech('t1', { auto_disabled: true }),
            tech('t2', { auto_disabled: false }),
        ]);
        const r = scheduleTechniques({ agentType: 'writer', mode: 'novel', sceneTypes: [] });
        const ids = r.techniques.map(t => t.id);
        expect(ids).not.toContain('t1');
        expect(ids).toContain('t2');
    });

    test('全部被禁用 → 空结果，不报错', () => {
        techIndex.getTechniquesByInjectionPoint.mockReturnValue([tech('t1', { auto_disabled: true })]);
        const r = scheduleTechniques({ agentType: 'writer', mode: 'novel', sceneTypes: [] });
        expect(r.techniques).toEqual([]);
        expect(r.formattedPrompt).toBe('');
    });
});
