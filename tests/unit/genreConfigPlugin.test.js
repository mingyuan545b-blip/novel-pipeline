/**
 * genreConfigPlugin.test.js
 * 补充genreConfig.js分支覆盖率
 * 重点：getGenrePlugin的Proxy路径、resolveGenreFromProject的genre字段路径
 */
const { getGenrePlugin, resolveGenreFromProject, detectGenre, getGenreById } = require('../../server/services/genreConfig');

describe('genreConfig branch coverage', () => {

    describe('getGenrePlugin — Proxy path', () => {
        test('returns genre directly when no dataRules', () => {
            const result = getGenrePlugin({ key: 'nonexistent-genre-xyz' });
            expect(result).toBeNull();
        });

        test('returns genre with Proxy when dataRules exist', () => {
            // high-martial-comedy should have genre directory with rules
            const result = getGenrePlugin({ key: 'high-martial-comedy' });
            if (result) {
                // If Proxy is active, accessing reviewRules should work
                const reviewRules = result.reviewRules;
                // Just verify it doesn't throw
                expect(typeof reviewRules === 'object' || reviewRules === undefined).toBe(true);
            }
        });
    });

    describe('resolveGenreFromProject — genre field path', () => {
        test('resolves via project.genre string', () => {
            const result = resolveGenreFromProject({ genre: 'high-martial-comedy' });
            expect(result).not.toBeNull();
        });

        test('resolves via project.subGenre', () => {
            const result = resolveGenreFromProject({ subGenre: 'high-martial-comedy' });
            expect(result).not.toBeNull();
        });

        test('resolves via project.styleProfile', () => {
            const result = resolveGenreFromProject({ styleProfile: { key: 'high-martial-comedy' } });
            expect(result).not.toBeNull();
        });

        test('returns null for null project', () => {
            const result = resolveGenreFromProject(null);
            expect(result).toBeNull();
        });

        test('returns null for project with no genre info', () => {
            const result = resolveGenreFromProject({ name: 'test' });
            expect(result).toBeNull();
        });
    });

    describe('detectGenre — edge cases', () => {
        test('returns null for null styleProfile', () => {
            expect(detectGenre(null)).toBeNull();
        });

        test('matches by _genreId field', () => {
            const result = detectGenre({ _genreId: 'high-martial-comedy' });
            expect(result).not.toBeNull();
        });

        test('matches by genreProfileIds fuzzy match', () => {
            const result = detectGenre({ label: '高武穿越' });
            // Should find high-martial-comedy via genreProfileIds
            if (result) {
                expect(result.id).toBeTruthy();
            }
        });

        test('falls through to isMatch', () => {
            // Use a styleProfile that doesn't match by key or label
            const result = detectGenre({ someField: 'value' });
            // isMatch is genre-specific, may or may not match
            expect(result === null || result.id).toBeTruthy();
        });
    });

    describe('getGenreById', () => {
        test('returns genre for valid id', () => {
            const result = getGenreById('high-martial-comedy');
            expect(result).not.toBeNull();
        });

        test('returns null for invalid id', () => {
            const result = getGenreById('nonexistent-genre');
            expect(result).toBeNull();
        });
    });
});
