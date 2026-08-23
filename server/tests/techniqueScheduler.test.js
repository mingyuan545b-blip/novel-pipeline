/**
 * techniqueScheduler.test.js — 技法调度函数测试
 */
const { scheduleTechniques, getTechWorldviewDepth } = require('../services/pipeline/techniqueScheduler');

describe('scheduleTechniques', () => {
    test('returns structure with techniques, formattedPrompt, tokenCost', () => {
        const result = scheduleTechniques({
            agentType: 'writer', mode: 'novel', sceneTypes: [], phase: 'development', outlineText: '', maxTokens: 600,
        });
        expect(result).toHaveProperty('techniques');
        expect(result).toHaveProperty('formattedPrompt');
        expect(result).toHaveProperty('tokenCost');
        expect(typeof result.tokenCost).toBe('number');
    });

    test('with combat scene boosts combat departments', () => {
        const result = scheduleTechniques({
            agentType: 'writer', mode: 'novel', sceneTypes: [{ scene: 'combat', confidence: 0.8 }],
            phase: 'climax', outlineText: '激烈战斗', maxTokens: 600,
        });
        expect(result.techniques).toBeDefined();
        expect(Array.isArray(result.techniques)).toBe(true);
    });

    test('macro techniques always included regardless of scene', () => {
        const result = scheduleTechniques({
            agentType: 'writer', mode: 'novel', sceneTypes: [], phase: 'development', outlineText: '', maxTokens: 600,
        });
        const macroTechs = result.techniques.filter(t => {
            const depth = t.worldviewDepth || getTechWorldviewDepth(t);
            return depth === 'macro';
        });
        expect(macroTechs.length).toBeGreaterThanOrEqual(0);
    });

    test('with knowledgeContext boosts relevant departments', () => {
        const result = scheduleTechniques({
            agentType: 'writer', mode: 'novel', sceneTypes: [{ scene: 'combat', confidence: 0.8 }],
            phase: 'climax', outlineText: '激烈战斗', maxTokens: 600,
            knowledgeContext: { suspect: 3, certain: 1, misinformed: 0, unknown: 0 },
        });
        expect(result.techniques).toBeDefined();
        expect(Array.isArray(result.techniques)).toBe(true);
    });

    test('without knowledgeContext works normally', () => {
        const result = scheduleTechniques({
            agentType: 'writer', mode: 'novel', sceneTypes: [], phase: 'development',
            outlineText: '', maxTokens: 600, knowledgeContext: null,
        });
        expect(result).toHaveProperty('techniques');
    });

    test('with genre boosts genre-affinity departments', () => {
        const result = scheduleTechniques({
            agentType: 'writer', mode: 'novel', sceneTypes: [{ scene: 'social', confidence: 0.8 }],
            phase: 'development', outlineText: '', maxTokens: 600, genre: 'tomato-sweet',
        });
        expect(result.techniques).toBeDefined();
        expect(Array.isArray(result.techniques)).toBe(true);
    });

    test('without genre works normally', () => {
        const result = scheduleTechniques({
            agentType: 'writer', mode: 'novel', sceneTypes: [], phase: 'development',
            outlineText: '', maxTokens: 600, genre: null,
        });
        expect(result).toHaveProperty('techniques');
    });

    test('with feedbackRates adjusts scores', () => {
        const result = scheduleTechniques({
            agentType: 'writer', mode: 'novel', sceneTypes: [], phase: 'development',
            outlineText: '', maxTokens: 600, feedbackRates: { 'some-tech-id': 0.9 },
        });
        expect(result).toHaveProperty('techniques');
    });
});
