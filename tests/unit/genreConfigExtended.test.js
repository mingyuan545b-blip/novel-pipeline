const {
    detectGenre, getGenreById, resolveGenreFromProject, getGenrePlugin
} = require('../../server/services/genreConfig');

describe('genreConfig - extended', () => {
    describe('detectGenre', () => {
        test('returns null for null styleProfile', () => {
            expect(detectGenre(null)).toBeNull();
        });
        test('returns null for empty styleProfile', () => {
            expect(detectGenre({})).toBeNull();
        });
        test('detects by key', () => {
            const result = detectGenre({ key: 'high-martial-comedy' });
            expect(result).toBeTruthy();
            expect(result.id).toBe('high-martial-comedy');
        });
        test('detects by genreProfile field', () => {
            const result = detectGenre({ genreProfile: 'high-martial-comedy' });
            expect(result).toBeTruthy();
        });
        test('detects by genre field', () => {
            const result = detectGenre({ genre: 'high-martial-comedy' });
            expect(result).toBeTruthy();
        });
        test('detects by _genreId field', () => {
            const result = detectGenre({ _genreId: 'high-martial-comedy' });
            expect(result).toBeTruthy();
        });
        test('detects by genreProfileIds match', () => {
            const result = detectGenre({ label: '高武穿越' });
            expect(result).toBeTruthy();
        });
        test('returns null for unrecognized profile', () => {
            expect(detectGenre({ key: 'nonexistent-genre' })).toBeNull();
        });
    });

    describe('getGenreById', () => {
        test('returns genre by id', () => {
            const result = getGenreById('high-martial-comedy');
            expect(result).toBeTruthy();
            expect(result.id).toBe('high-martial-comedy');
        });
        test('returns null for unknown id', () => {
            expect(getGenreById('nonexistent')).toBeNull();
        });
    });

    describe('resolveGenreFromProject', () => {
        test('returns null for null project', () => {
            expect(resolveGenreFromProject(null)).toBeNull();
        });
        test('resolves from subGenre', () => {
            const result = resolveGenreFromProject({ subGenre: 'high-martial-comedy' });
            expect(result).toBeTruthy();
            expect(result.id).toBe('high-martial-comedy');
        });
        test('resolves from subgenre (alternate key)', () => {
            const result = resolveGenreFromProject({ subgenre: 'high-martial-comedy' });
            expect(result).toBeTruthy();
        });
        test('resolves from styleProfile', () => {
            const result = resolveGenreFromProject({ styleProfile: { key: 'high-martial-comedy' } });
            expect(result).toBeTruthy();
        });
        test('resolves from genre field', () => {
            const result = resolveGenreFromProject({ genre: 'high-martial-comedy' });
            expect(result).toBeTruthy();
        });
        test('returns null when no genre info', () => {
            expect(resolveGenreFromProject({ name: 'Test' })).toBeNull();
        });
    });

    describe('getGenrePlugin', () => {
        test('returns null for null styleProfile', () => {
            expect(getGenrePlugin(null)).toBeNull();
        });
        test('returns genre object for valid styleProfile', () => {
            const result = getGenrePlugin({ key: 'high-martial-comedy' });
            expect(result).toBeTruthy();
        });
        test('proxy returns reviewRules when available', () => {
            const result = getGenrePlugin({ key: 'high-martial-comedy' });
            if (result?.reviewRules) {
                expect(typeof result.reviewRules).toBe('object');
            }
        });
    });
});
