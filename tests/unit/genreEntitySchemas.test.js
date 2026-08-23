const {
    DEFAULT_SCHEMA, getGenreEntitySchema, getGenreStateKeys,
    getGenreRelationTypes, getGenreRelationTypeKeywords,
    getGenreNarrativePhases, getGenreMilestones,
    getAllGenreSchemas, buildGenreStateDefaults, validateGenreState
} = require('../../server/config/genreEntitySchemas');

describe('genreEntitySchemas', () => {
    describe('DEFAULT_SCHEMA', () => {
        test('has expected fields', () => {
            expect(DEFAULT_SCHEMA.id).toBe('default');
            expect(DEFAULT_SCHEMA.entityTypes).toContain('character');
            expect(DEFAULT_SCHEMA.relationTypes).toContain('ally');
            expect(DEFAULT_SCHEMA.narrativePhases).toContain('setup');
        });
    });

    describe('getGenreEntitySchema', () => {
        test('returns DEFAULT_SCHEMA for null genreId', () => {
            expect(getGenreEntitySchema(null)).toBe(DEFAULT_SCHEMA);
        });
        test('returns DEFAULT_SCHEMA for unknown genreId', () => {
            expect(getGenreEntitySchema('nonexistent')).toBe(DEFAULT_SCHEMA);
        });
        test('returns genre-specific schema for known genreId', () => {
            const schema = getGenreEntitySchema('high-martial-comedy');
            expect(schema.id).toBe('high-martial-comedy');
            expect(schema.entityTypes).toBeDefined();
        });
        test('returns schema with entitySchema from genre', () => {
            const schema = getGenreEntitySchema('high-martial-comedy');
            expect(schema.label).toBeTruthy();
        });
    });

    describe('getGenreStateKeys', () => {
        test('returns empty object for default schema', () => {
            expect(getGenreStateKeys(null)).toEqual({});
        });
        test('returns state keys for known genre', () => {
            const keys = getGenreStateKeys('high-martial-comedy');
            expect(typeof keys).toBe('object');
        });
    });

    describe('getGenreRelationTypes', () => {
        test('returns default relation types for null', () => {
            const types = getGenreRelationTypes(null);
            expect(types).toContain('ally');
        });
    });

    describe('getGenreRelationTypeKeywords', () => {
        test('returns default keywords for null', () => {
            const keywords = getGenreRelationTypeKeywords(null);
            expect(keywords.ally).toContain('盟友');
        });
    });

    describe('getGenreNarrativePhases', () => {
        test('returns default phases for null', () => {
            const phases = getGenreNarrativePhases(null);
            expect(phases).toContain('setup');
        });
    });

    describe('getGenreMilestones', () => {
        test('returns empty object for default', () => {
            expect(getGenreMilestones(null)).toEqual({});
        });
    });

    describe('getAllGenreSchemas', () => {
        test('returns array of genre schemas', () => {
            const schemas = getAllGenreSchemas();
            expect(Array.isArray(schemas)).toBe(true);
            expect(schemas.length).toBeGreaterThan(0);
        });
        test('each schema has required fields', () => {
            const schemas = getAllGenreSchemas();
            for (const schema of schemas) {
                expect(schema.id).toBeTruthy();
                expect(schema.entityTypes).toBeDefined();
            }
        });
    });

    describe('buildGenreStateDefaults', () => {
        test('returns empty object for default schema', () => {
            expect(buildGenreStateDefaults(null)).toEqual({});
        });
        test('builds defaults from genre state keys', () => {
            const defaults = buildGenreStateDefaults('high-martial-comedy');
            expect(typeof defaults).toBe('object');
        });
    });

    describe('validateGenreState', () => {
        test('returns no errors for valid state', () => {
            const errors = validateGenreState(null, {});
            expect(errors).toEqual([]);
        });
        test('returns errors for invalid number type', () => {
            const keys = getGenreStateKeys('high-martial-comedy');
            if (Object.keys(keys).length > 0) {
                const numKey = Object.entries(keys).find(([k, v]) => v.type === 'number');
                if (numKey) {
                    const errors = validateGenreState('high-martial-comedy', { [numKey[0]]: 'not-a-number' });
                    expect(errors.length).toBeGreaterThan(0);
                }
            }
        });
        test('returns no errors for undefined keys', () => {
            const errors = validateGenreState('high-martial-comedy', {});
            expect(errors).toEqual([]);
        });
    });
});
