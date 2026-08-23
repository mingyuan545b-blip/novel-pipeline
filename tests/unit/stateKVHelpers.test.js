const {
    _hashStr, _makeKVId, _makeStateId, _inferType,
    getGenreImportantKeys, KV_STORE_TYPE, STATE_STORE_TYPE, HOT_WINDOW
} = require('../../server/services/stateKVHelpers');

describe('stateKVHelpers', () => {
    describe('_hashStr', () => {
        test('returns consistent hash for same input', () => {
            expect(_hashStr('test')).toBe(_hashStr('test'));
        });

        test('returns different hash for different input', () => {
            expect(_hashStr('abc')).not.toBe(_hashStr('xyz'));
        });

        test('handles empty string', () => {
            expect(typeof _hashStr('')).toBe('string');
        });
    });

    describe('_makeKVId', () => {
        test('creates deterministic ID from components', () => {
            const id1 = _makeKVId('proj1', 'character', 'char1', 'hp');
            const id2 = _makeKVId('proj1', 'character', 'char1', 'hp');
            expect(id1).toBe(id2);
        });

        test('different components produce different IDs', () => {
            const id1 = _makeKVId('proj1', 'character', 'char1', 'hp');
            const id2 = _makeKVId('proj1', 'character', 'char1', 'mp');
            expect(id1).not.toBe(id2);
        });

        test('handles Chinese characters in entityKey', () => {
            const id = _makeKVId('proj1', 'character', '沈默', 'hp');
            expect(id).toMatch(/^kv-/);
        });

        test('sanitizes special characters', () => {
            const id = _makeKVId('proj.1', 'scope/name', 'char1', 'key.1');
            expect(id).not.toMatch(/[./]/);
        });
    });

    describe('_makeStateId', () => {
        test('creates state ID from character and chapter', () => {
            expect(_makeStateId('char1', 5)).toBe('cs-char1-ch5');
        });

        test('handles chapter number 0', () => {
            expect(_makeStateId('char1', 0)).toBe('cs-char1-ch0');
        });
    });

    describe('_inferType', () => {
        test('infers number type', () => {
            expect(_inferType(42)).toBe('number');
        });

        test('infers string type', () => {
            expect(_inferType('hello')).toBe('string');
        });

        test('infers boolean type', () => {
            expect(_inferType(true)).toBe('boolean');
        });

        test('infers array type', () => {
            expect(_inferType([1, 2, 3])).toBe('array');
        });

        test('infers null type', () => {
            expect(_inferType(null)).toBe('null');
            expect(_inferType(undefined)).toBe('null');
        });
    });

    describe('getGenreImportantKeys', () => {
        test('returns default keys for unknown genre', () => {
            const keys = getGenreImportantKeys('unknown-genre');
            expect(keys).toContain('name');
            expect(keys).toContain('hp');
        });

        test('returns genre-specific keys for high-martial-comedy', () => {
            const keys = getGenreImportantKeys('high-martial-comedy');
            expect(keys).toContain('cultivationStage');
        });

        test('returns genre-specific keys for baby', () => {
            const keys = getGenreImportantKeys('baby');
            expect(keys).toContain('name');
            expect(keys.length).toBeGreaterThan(0);
        });
    });

    describe('constants', () => {
        test('exports required constants', () => {
            expect(KV_STORE_TYPE).toBe('state-kv-index');
            expect(STATE_STORE_TYPE).toBe('character-states');
            expect(typeof HOT_WINDOW).toBe('number');
        });
    });
});
