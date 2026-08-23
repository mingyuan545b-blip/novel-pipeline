const {
    getCharacterStateSchema,
    getAllGenres,
    formatStateForPrompt,
    createStateDelta,
    applyStateDelta,
    GENRE_SCHEMAS
} = require('../../server/config/characterStateSchemas');

describe('characterStateSchemas - getCharacterStateSchema', () => {
    test('returns high-martial-comedy schema with extra fields', () => {
        const schema = getCharacterStateSchema('high-martial-comedy');
        expect(schema.fields.mp).toBeDefined();
        expect(schema.fields.cultivationStage).toBeDefined();
        expect(schema.fields.magicTreasures).toBeDefined();
        expect(schema.fields.spiritualRoot).toBeDefined();
        expect(schema.thresholds.hpLow).toBe(30);
        expect(schema.thresholds.mpLow).toBe(20);
    });

    test('returns baby schema with extra fields', () => {
        const schema = getCharacterStateSchema('baby');
        expect(schema.fields.affectionLevel).toBeDefined();
        expect(schema.fields.relationshipStatus).toBeDefined();
        expect(schema.fields.guardianStatus).toBeDefined();
        expect(schema.thresholds.hpLow).toBe(30);
        expect(schema.thresholds.affectionLow).toBe(20);
    });

    test('returns base schema for unknown genre', () => {
        const schema = getCharacterStateSchema('unknown-genre');
        expect(schema.fields.hp).toBeDefined();
        expect(schema.fields.combatPower).toBeDefined();
        expect(schema.fields.mp).toBeUndefined();
        expect(schema.genre).toBeNull();
    });
});

describe('characterStateSchemas - getAllGenres', () => {
    test('returns all genre labels', () => {
        const genres = getAllGenres();
        expect(genres.length).toBeGreaterThanOrEqual(2);
        expect(genres.map(g => g.id)).toContain('high-martial-comedy');
        expect(genres.map(g => g.id)).toContain('baby');
    });
});

describe('characterStateSchemas - formatStateForPrompt', () => {
    test('brief mode shows only important changed fields', () => {
        const schema = getCharacterStateSchema('high-martial-comedy');
        const state = {
            hp: 80, mp: 60, combatPower: 1200, cultivationStage: '筑基三层',
            equipment: ['青锋剑']
        };
        const formatted = formatStateForPrompt(state, schema, 'brief');
        expect(formatted).toContain('生命值');
        expect(formatted).toContain('灵力/内力');
        expect(formatted).toContain('战力');
        expect(formatted).toContain('修炼境界');
    });

    test('detailed mode shows all non-default fields', () => {
        const schema = getCharacterStateSchema('high-martial-comedy');
        const state = {
            hp: 80, mp: 60, combatPower: 1200, cultivationStage: '筑基三层',
            spiritualRoot: '天品', magicTreasures: ['乾坤袋'], equipment: ['青锋剑']
        };
        const formatted = formatStateForPrompt(state, schema, 'detailed');
        expect(formatted).toContain('生命值');
        expect(formatted).toContain('灵力/内力');
        expect(formatted).toContain('灵根');
        expect(formatted).toContain('乾坤袋');
        expect(formatted).toContain('青锋剑');
    });

    test('empty state returns empty string', () => {
        const schema = getCharacterStateSchema('high-martial-comedy');
        const formatted = formatStateForPrompt({}, schema, 'brief');
        expect(formatted).toBe('');
    });
});

describe('characterStateSchemas - createStateDelta', () => {
    test('detects changed fields', () => {
        const schema = getCharacterStateSchema('high-martial-comedy');
        const oldState = { hp: 100, mp: 100, combatPower: 500 };
        const newState = { hp: 80, mp: 100, combatPower: 800 };

        const { delta, changedFields } = createStateDelta(oldState, newState, schema);

        expect(delta.hp.from).toBe(100);
        expect(delta.hp.to).toBe(80);
        expect(changedFields).toContain('hp');
        expect(changedFields).toContain('combatPower');
        expect(changedFields).not.toContain('mp');
    });

    test('no changes returns empty delta', () => {
        const schema = getCharacterStateSchema('high-martial-comedy');
        const state = { hp: 100, mp: 100 };

        const { delta, changedFields } = createStateDelta(state, state, schema);

        expect(Object.keys(delta)).toHaveLength(0);
        expect(changedFields).toHaveLength(0);
    });
});

describe('characterStateSchemas - applyStateDelta', () => {
    test('applies delta to base state', () => {
        const baseState = { hp: 100, mp: 100, combatPower: 500 };
        const delta = { hp: { from: 100, to: 80 }, combatPower: { from: 500, to: 800 } };

        const newState = applyStateDelta(baseState, delta);

        expect(newState.hp).toBe(80);
        expect(newState.mp).toBe(100);
        expect(newState.combatPower).toBe(800);
    });

    test('adds new fields not in base', () => {
        const baseState = { hp: 100 };
        const delta = { hp: { from: 100, to: 80 }, mp: { from: 0, to: 60 } };

        const newState = applyStateDelta(baseState, delta);

        expect(newState.hp).toBe(80);
        expect(newState.mp).toBe(60);
    });

    test('handles empty delta', () => {
        const baseState = { hp: 100, mp: 100 };
        const newState = applyStateDelta(baseState, {});

        expect(newState.hp).toBe(100);
        expect(newState.mp).toBe(100);
    });
});
