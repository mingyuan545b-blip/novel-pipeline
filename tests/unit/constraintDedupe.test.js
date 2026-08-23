const { dedupeConstraints, buildTierOutput, formatConstraintOutput, BASE_STYLE_COVERED_CONSTRAINTS } = require('../../server/services/prompts/constraintDedupe');

describe('constraintDedupe', () => {
    describe('BASE_STYLE_COVERED_CONSTRAINTS', () => {
        test('has expected constraint mappings', () => {
            expect(BASE_STYLE_COVERED_CONSTRAINTS['hook-every-chapter']).toBeDefined();
            expect(BASE_STYLE_COVERED_CONSTRAINTS['simple-readable-style']).toBeDefined();
            expect(BASE_STYLE_COVERED_CONSTRAINTS['worldview-consistency']).toBeDefined();
            expect(BASE_STYLE_COVERED_CONSTRAINTS['character-consistency']).toBeDefined();
        });

        test('each mapping has profileFields and keywords', () => {
            for (const [id, mapping] of Object.entries(BASE_STYLE_COVERED_CONSTRAINTS)) {
                expect(Array.isArray(mapping.profileFields)).toBe(true);
                expect(Array.isArray(mapping.keywords)).toBe(true);
                expect(mapping.profileFields.length).toBeGreaterThan(0);
                expect(mapping.keywords.length).toBeGreaterThan(0);
            }
        });
    });

    describe('dedupeConstraints', () => {
        test('keeps all constraints when no style profile', () => {
            const result = dedupeConstraints(['hook-every-chapter', 'no-derailment'], null, {});
            expect(result.dedupedConstraints).toEqual(['hook-every-chapter', 'no-derailment']);
            expect(result.dedupedReasons).toEqual([]);
        });

        test('dedupes constraint covered by style profile', () => {
            const profile = { toneRule: '章末钩子必须有悬念', behaviorRule: '' };
            const result = dedupeConstraints(['hook-every-chapter'], profile, {});
            expect(result.dedupedConstraints).toEqual([]);
            expect(result.dedupedReasons.length).toBe(1);
            expect(result.dedupedReasons[0]).toContain('hook-every-chapter');
        });

        test('keeps constraint not covered by style profile', () => {
            const profile = { toneRule: '简洁风格', behaviorRule: '' };
            const result = dedupeConstraints(['hook-every-chapter'], profile, {});
            expect(result.dedupedConstraints).toEqual(['hook-every-chapter']);
        });

        test('dedupes multiple covered constraints', () => {
            const profile = { toneRule: '章末钩子必须有悬念，句子短段落短', behaviorRule: '世界观设定自洽' };
            const result = dedupeConstraints(['hook-every-chapter', 'simple-readable-style', 'worldview-consistency'], profile, {});
            expect(result.dedupedConstraints).toEqual([]);
            expect(result.dedupedReasons.length).toBe(3);
        });

        test('handles empty constraints array', () => {
            const result = dedupeConstraints([], null, {});
            expect(result.dedupedConstraints).toEqual([]);
            expect(result.dedupedReasons).toEqual([]);
        });

        test('keeps unknown constraints (not in BASE_STYLE_COVERED_CONSTRAINTS)', () => {
            const profile = { toneRule: '章末钩子' };
            const result = dedupeConstraints(['custom-constraint'], profile, {});
            expect(result.dedupedConstraints).toEqual(['custom-constraint']);
        });
    });

    describe('buildTierOutput', () => {
        const MOCK_PRESETS = {
            'no-derailment': { label: '不降智', desc: '角色不得出现智商断崖式下降' },
            'character-depth': { label: '人物立体刻画', desc: '人物必须具备独立动机' }
        };

        test('categorizes constraints into tiers', () => {
            const result = buildTierOutput(['no-derailment'], MOCK_PRESETS, null, {});
            expect(result.tier1Items.length + result.tier2Labels.length + result.tier3Labels.length).toBeGreaterThan(0);
        });

        test('skips unknown constraint IDs', () => {
            const result = buildTierOutput(['nonexistent-id'], MOCK_PRESETS, null, {});
            expect(result.tier1Items).toEqual([]);
            expect(result.tier2Labels).toEqual([]);
            expect(result.tier3Labels).toEqual([]);
        });

        test('includes genre constraint presets in allowed IDs', () => {
            const genrePresets = { 'custom-genre-rule': { label: 'Custom', desc: 'Genre specific' } };
            const result = buildTierOutput(['custom-genre-rule'], { ...MOCK_PRESETS, ...genrePresets }, null, genrePresets);
            expect(result.tier1Items.length).toBeGreaterThan(0);
        });

        test('handles empty constraints', () => {
            const result = buildTierOutput([], MOCK_PRESETS, null, {});
            expect(result.tier1Items).toEqual([]);
            expect(result.tier2Labels).toEqual([]);
            expect(result.tier3Labels).toEqual([]);
        });
    });

    describe('formatConstraintOutput', () => {
        test('formats output with all tiers', () => {
            const result = formatConstraintOutput(['● 不降智：角色不得出现智商断崖式下降'], ['章末钩子'], ['简单好读'], null);
            expect(result).toContain('不降智');
            expect(result).toContain('遵守：章末钩子');
            expect(result).toContain('注意：简单好读');
        });

        test('formats output with only tier1', () => {
            const result = formatConstraintOutput(['● 不降智：desc'], [], [], null);
            expect(result).toContain('不降智');
            expect(result).not.toContain('遵守：');
            expect(result).not.toContain('注意：');
        });

        test('uses custom header for agentType', () => {
            const result = formatConstraintOutput([], [], [], 'review');
            expect(result).toContain('【');
            expect(result).toContain('】');
        });

        test('handles empty all tiers', () => {
            const result = formatConstraintOutput([], [], [], null);
            expect(result).toContain('写作约束');
        });
    });
});
