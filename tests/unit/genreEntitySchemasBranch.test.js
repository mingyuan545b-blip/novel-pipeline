/**
 * genreEntitySchemas.js branch coverage tests
 * Covers: validateGenreState type check, _getGenreById catch,
 *         buildGenreStateDefaults, getAllGenreSchemas, individual getters
 */
jest.mock('../../server/services/genreConfig', () => ({
    getRegisteredGenres: jest.fn()
}));

const { getRegisteredGenres } = require('../../server/services/genreConfig');
const schemas = require('../../server/config/genreEntitySchemas');

const MOCK_GENRES = [
    {
        id: 'test-genre',
        label: 'Test Genre',
        entitySchema: {
            entityTypes: ['character', 'location'],
            genreStateKeys: {
                powerLevel: { type: 'number', default: 1, label: '战力' },
                mood: { type: 'string', default: 'neutral', label: '心情' }
            },
            relationTypes: ['ally', 'enemy'],
            relationTypeKeywords: { ally: ['盟友'], enemy: ['敌人'] },
            narrativePhases: ['setup', 'climax'],
            milestones: { ch1: 'First step' }
        }
    },
    {
        id: 'minimal-genre',
        label: 'Minimal Genre'
        // no entitySchema
    }
];

describe('genreEntitySchemas', () => {
    beforeEach(() => {
        getRegisteredGenres.mockReturnValue(MOCK_GENRES);
    });

    describe('getGenreEntitySchema', () => {
        test('returns schema for genre with entitySchema', () => {
            const schema = schemas.getGenreEntitySchema('test-genre');
            expect(schema.id).toBe('test-genre');
            expect(schema.entityTypes).toEqual(['character', 'location']);
            expect(schema.genreStateKeys).toEqual(MOCK_GENRES[0].entitySchema.genreStateKeys);
        });

        test('returns DEFAULT_SCHEMA for genre without entitySchema', () => {
            const schema = schemas.getGenreEntitySchema('minimal-genre');
            expect(schema.id).toBe('default');
            expect(schema.entityTypes).toContain('character');
        });

        test('returns DEFAULT_SCHEMA for unknown genre', () => {
            const schema = schemas.getGenreEntitySchema('nonexistent');
            expect(schema.id).toBe('default');
        });
    });

    describe('getGenreStateKeys', () => {
        test('returns state keys for known genre', () => {
            const keys = schemas.getGenreStateKeys('test-genre');
            expect(keys).toHaveProperty('powerLevel');
            expect(keys).toHaveProperty('mood');
        });

        test('returns empty object for unknown genre', () => {
            const keys = schemas.getGenreStateKeys('nonexistent');
            expect(keys).toEqual({});
        });
    });

    describe('getGenreRelationTypes', () => {
        test('returns relation types for known genre', () => {
            const types = schemas.getGenreRelationTypes('test-genre');
            expect(types).toEqual(['ally', 'enemy']);
        });

        test('returns default relation types for unknown genre', () => {
            const types = schemas.getGenreRelationTypes('nonexistent');
            expect(types).toContain('ally');
            expect(types).toContain('enemy');
        });
    });

    describe('getGenreRelationTypeKeywords', () => {
        test('returns keywords for known genre', () => {
            const kw = schemas.getGenreRelationTypeKeywords('test-genre');
            expect(kw.ally).toEqual(['盟友']);
        });

        test('returns default keywords for unknown genre', () => {
            const kw = schemas.getGenreRelationTypeKeywords('nonexistent');
            // Falls back to DEFAULT_SCHEMA which has relationTypeKeywords
            expect(kw).toHaveProperty('ally');
            expect(kw).toHaveProperty('enemy');
        });
    });

    describe('getGenreNarrativePhases', () => {
        test('returns phases for known genre', () => {
            const phases = schemas.getGenreNarrativePhases('test-genre');
            expect(phases).toEqual(['setup', 'climax']);
        });

        test('returns default phases for unknown genre', () => {
            const phases = schemas.getGenreNarrativePhases('nonexistent');
            expect(phases).toContain('setup');
        });
    });

    describe('getGenreMilestones', () => {
        test('returns milestones for known genre', () => {
            const ms = schemas.getGenreMilestones('test-genre');
            expect(ms.ch1).toBe('First step');
        });

        test('returns empty object for unknown genre', () => {
            const ms = schemas.getGenreMilestones('nonexistent');
            expect(ms).toEqual({});
        });
    });

    describe('getAllGenreSchemas', () => {
        test('returns only genres with entitySchema', () => {
            const all = schemas.getAllGenreSchemas();
            expect(all).toHaveLength(1);
            expect(all[0].id).toBe('test-genre');
        });

        test('returns empty array when getRegisteredGenres throws', () => {
            getRegisteredGenres.mockImplementation(() => { throw new Error('boom'); });
            expect(schemas.getAllGenreSchemas()).toEqual([]);
        });
    });

    describe('buildGenreStateDefaults', () => {
        test('builds defaults from state keys', () => {
            const defaults = schemas.buildGenreStateDefaults('test-genre');
            expect(defaults.powerLevel).toBe(1);
            expect(defaults.mood).toBe('neutral');
        });

        test('returns empty object for genre with no state keys', () => {
            const defaults = schemas.buildGenreStateDefaults('nonexistent');
            expect(defaults).toEqual({});
        });
    });

    describe('validateGenreState', () => {
        test('returns no errors for valid state', () => {
            const errors = schemas.validateGenreState('test-genre', { powerLevel: 5, mood: 'happy' });
            expect(errors).toEqual([]);
        });

        test('returns error when number field has wrong type', () => {
            const errors = schemas.validateGenreState('test-genre', { powerLevel: 'high' });
            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('powerLevel');
            expect(errors[0]).toContain('number');
        });

        test('skips validation for undefined fields', () => {
            const errors = schemas.validateGenreState('test-genre', { mood: 'happy' });
            expect(errors).toEqual([]);
        });

        test('returns empty array for unknown genre', () => {
            const errors = schemas.validateGenreState('nonexistent', { foo: 'bar' });
            expect(errors).toEqual([]);
        });
    });

    describe('DEFAULT_SCHEMA', () => {
        test('has expected structure', () => {
            const ds = schemas.DEFAULT_SCHEMA;
            expect(ds.id).toBe('default');
            expect(ds.entityTypes).toContain('character');
            expect(ds.relationTypes).toContain('ally');
            expect(ds.narrativePhases).toContain('setup');
        });
    });
});
