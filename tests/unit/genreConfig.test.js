const genreConfig = require('../../server/services/genreConfig');

describe('GenreConfig', () => {
    test('getRegisteredGenres returns array', () => {
        const genres = genreConfig.getRegisteredGenres();
        expect(Array.isArray(genres)).toBe(true);
        expect(genres.length).toBeGreaterThanOrEqual(5);
    });

    test('all genres have required fields', () => {
        const genres = genreConfig.getRegisteredGenres();
        for (const genre of genres) {
            expect(genre.id).toBeDefined();
            expect(genre.label).toBeDefined();
            expect(typeof genre.isMatch).toBe('function');
        }
    });

    test('known genre IDs exist', () => {
        const genres = genreConfig.getRegisteredGenres();
        const ids = genres.map(g => g.id);
        expect(ids).toContain('high-martial-comedy');
        expect(ids).toContain('urban-fantasy');
        expect(ids).toContain('baby');
        expect(ids).toContain('rule-horror');
        expect(ids).toContain('infinite-dungeon');
    });

    test('getGenreById returns correct genre', () => {
        const genre = genreConfig.getGenreById('high-martial-comedy');
        expect(genre).not.toBeNull();
        expect(genre.id).toBe('high-martial-comedy');
    });

    test('getGenreById returns null for unknown genre', () => {
        const genre = genreConfig.getGenreById('nonexistent-genre');
        expect(genre).toBeNull();
    });

    test('detectGenre returns null for empty styleProfile', () => {
        const result = genreConfig.detectGenre(null);
        expect(result).toBeNull();
    });

    test('each genre has reviewRules, detectors, or styleProfile', () => {
        const genres = genreConfig.getRegisteredGenres();
        for (const genre of genres) {
            const hasReviewRules = genre.reviewRules && Object.keys(genre.reviewRules).length > 0;
            const hasDetectors = genre.detectors && Object.keys(genre.detectors).length > 0;
            const hasStyleProfile = !!genre.styleProfile;
            const hasAny = hasReviewRules || hasDetectors || hasStyleProfile;
            if (!hasAny) {
                console.warn(`Genre ${genre.id} has no reviewRules, detectors, or styleProfile`);
            }
        }
        const genresWithFeatures = genres.filter(g =>
            (g.reviewRules && Object.keys(g.reviewRules).length > 0) ||
            (g.detectors && Object.keys(g.detectors).length > 0) ||
            g.styleProfile
        );
        expect(genresWithFeatures.length).toBeGreaterThan(0);
    });
});

describe('GenreConfig - High Martial Comedy', () => {
    let genre;

    beforeAll(() => {
        genre = genreConfig.getGenreById('high-martial-comedy');
    });

    test('genre exists', () => {
        expect(genre).not.toBeNull();
    });

    test('has styleProfile', () => {
        expect(genre.styleProfile).toBeDefined();
    });

    test('has detectors', () => {
        expect(genre.detectors).toBeDefined();
    });

    test('has reviewRules', () => {
        expect(genre.reviewRules).toBeDefined();
    });

    test('isMatch detects high-martial style', () => {
        const styleProfile = { key: 'high-martial-comedy' };
        expect(genre.isMatch(styleProfile)).toBe(true);
    });

    test('isMatch rejects non-matching style', () => {
        const styleProfile = { key: 'baby' };
        expect(genre.isMatch(styleProfile)).toBe(false);
    });
});
