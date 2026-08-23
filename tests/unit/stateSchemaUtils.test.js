const {
    formatStateForPrompt,
    createStateDelta,
    applyStateDelta,
    buildLabelToKeyMap,
    normalizeDeltaKeys
} = require('../../server/config/stateSchemaUtils');

describe('stateSchemaUtils', () => {
    const schema = {
        fields: {
            hp: { label: '生命值', defaultValue: 100, unit: '' },
            mp: { label: '魔力值', defaultValue: 50, unit: '' },
            energy: { label: '精力', defaultValue: 10, unit: '' },
            personality: { label: '性格', defaultValue: '温和' },
            speakingTone: { label: '语气', defaultValue: '平静' },
            skills: { label: '技能', defaultValue: [] },
            stateChangedFields: { label: '变更字段', defaultValue: [] }
        }
    };

    describe('formatStateForPrompt', () => {
        test('returns empty string for null state', () => {
            expect(formatStateForPrompt(null, schema)).toBe('');
        });

        test('returns empty string for null schema', () => {
            expect(formatStateForPrompt({ hp: 80 }, null)).toBe('');
        });

        test('brief mode shows only changed important fields', () => {
            const state = { hp: 80, mp: 50, personality: '暴躁' };
            const result = formatStateForPrompt(state, schema, 'brief');
            expect(result).toContain('80');
            expect(result).toContain('暴躁');
        });

        test('brief mode skips default values', () => {
            const state = { hp: 100, mp: 50 };
            const result = formatStateForPrompt(state, schema, 'brief');
            // hp=100 is default, mp=50 is default, should not appear
            expect(result).not.toContain('生命值');
        });

        test('full mode shows all changed fields', () => {
            const state = { hp: 80, personality: '暴躁', skills: ['剑术', '魔法'] };
            const result = formatStateForPrompt(state, schema, 'full');
            expect(result).toContain('80');
            expect(result).toContain('暴躁');
            expect(result).toContain('剑术');
        });

        test('full mode skips stateChangedFields', () => {
            const state = { hp: 80, stateChangedFields: ['hp'] };
            const result = formatStateForPrompt(state, schema, 'full');
            expect(result).not.toContain('变更字段');
        });
    });

    describe('createStateDelta', () => {
        test('detects changed fields', () => {
            const oldState = { hp: 100, mp: 50 };
            const newState = { hp: 80, mp: 50 };
            const { delta, changedFields } = createStateDelta(oldState, newState, schema);
            expect(delta.hp).toEqual({ from: 100, to: 80 });
            expect(changedFields).toContain('hp');
            expect(changedFields).not.toContain('mp');
        });

        test('detects no changes', () => {
            const oldState = { hp: 100, mp: 50 };
            const newState = { hp: 100, mp: 50 };
            const { delta, changedFields } = createStateDelta(oldState, newState, schema);
            expect(changedFields.length).toBe(0);
        });

        test('handles null oldState', () => {
            const newState = { hp: 80 };
            const { delta, changedFields } = createStateDelta(null, newState, schema);
            expect(delta.hp).toBeDefined();
        });
    });

    describe('applyStateDelta', () => {
        test('applies delta with to field', () => {
            const base = { hp: 100, mp: 50 };
            const delta = { hp: { from: 100, to: 80 } };
            const result = applyStateDelta(base, delta);
            expect(result.hp).toBe(80);
            expect(result.mp).toBe(50);
        });

        test('applies delta with direct value', () => {
            const base = { hp: 100 };
            const delta = { hp: 80 };
            const result = applyStateDelta(base, delta);
            expect(result.hp).toBe(80);
        });

        test('skips null/undefined values', () => {
            const base = { hp: 100 };
            const delta = { hp: null, mp: undefined };
            const result = applyStateDelta(base, delta);
            expect(result.hp).toBe(100);
        });
    });

    describe('buildLabelToKeyMap', () => {
        test('maps labels to keys', () => {
            const map = buildLabelToKeyMap(schema);
            expect(map['生命值']).toBe('hp');
            expect(map['魔力值']).toBe('mp');
        });

        test('maps keys to themselves', () => {
            const map = buildLabelToKeyMap(schema);
            expect(map['hp']).toBe('hp');
        });
    });

    describe('normalizeDeltaKeys', () => {
        test('converts label keys to field keys', () => {
            const delta = { '生命值': 80, 'mp': 30 };
            const result = normalizeDeltaKeys(delta, schema);
            expect(result['hp']).toBe(80);
            expect(result['mp']).toBe(30);
        });

        test('keeps unknown keys as-is', () => {
            const delta = { 'unknown': 42 };
            const result = normalizeDeltaKeys(delta, schema);
            expect(result['unknown']).toBe(42);
        });
    });
});
