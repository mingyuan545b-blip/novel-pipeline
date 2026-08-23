/**
 * genreConfig.js branch coverage tests
 * Covers: detectGenre label matching, resolveGenreFromProject subGenre/styleProfile/genre paths,
 *         getGenrePlugin Proxy paths, getGenreRegistry, getRegisteredGenres
 */
jest.mock('../../server/services/genreLoader', () => ({
    getRegistry: jest.fn(),
    getMap: jest.fn(),
    reloadGenres: jest.fn(),
    getGenreDir: jest.fn()
}));

const { getRegistry, getMap } = require('../../server/services/genreLoader');
const gc = require('../../server/services/genreConfig');

const MOCK_GENRES = [
    {
        id: 'high-martial-comedy',
        label: '高武穿越',
        genreProfileIds: ['urban', 'fantasy'],
        isMatch: jest.fn(s => s?.key === 'high-martial-comedy'),
        entitySchema: { entityTypes: ['character'] },
        reviewRules: { minWordCount: 2000 },
        foundation: { style: 'modern' },
        constraintPresets: { maxPace: 'fast' },
        dedupRules: { threshold: 0.5 },
        materialTemplates: { character: 'template' },
        newContentValidation: { checkConsistency: true }
    },
    {
        id: 'high-martial-comedy',
        label: '高武穿越',
        genreProfileIds: ['sweet', 'romance'],
        isMatch: jest.fn(() => false),
        entitySchema: { entityTypes: ['character'] }
    }
];

const MOCK_MAP = {
    'high-martial-comedy': MOCK_GENRES[0],
    'high-martial-comedy': MOCK_GENRES[1]
};

describe('genreConfig.detectGenre', () => {
    beforeEach(() => {
        getRegistry.mockReturnValue(MOCK_GENRES);
        getMap.mockReturnValue(MOCK_MAP);
        MOCK_GENRES[0].isMatch.mockClear();
        MOCK_GENRES[1].isMatch.mockClear();
    });

    test('returns null for null input', () => {
        expect(gc.detectGenre(null)).toBeNull();
    });

    test('matches by key/id', () => {
        const result = gc.detectGenre({ key: 'high-martial-comedy' });
        expect(result).toBeDefined();
        expect(result.id).toBe('high-martial-comedy');
    });

    test('matches by genreProfile', () => {
        const result = gc.detectGenre({ genreProfile: 'high-martial-comedy' });
        expect(result).toBeDefined();
        expect(result.id).toBe('high-martial-comedy');
    });

    test('matches by _genreId', () => {
        const result = gc.detectGenre({ _genreId: 'high-martial-comedy' });
        expect(result).toBeDefined();
        expect(result.id).toBe('high-martial-comedy');
    });

    test('matches by genreProfileIds exact match', () => {
        const result = gc.detectGenre({ label: 'urban' });
        expect(result).toBeDefined();
        expect(result.id).toBe('high-martial-comedy');
    });

    test('matches by genreProfileIds fuzzy match', () => {
        const result = gc.detectGenre({ label: 'sweet-romance' });
        expect(result).toBeDefined();
        expect(result.id).toBe('high-martial-comedy');
    });

    test('falls back to isMatch', () => {
        MOCK_GENRES[0].isMatch.mockReturnValue(true);
        const result = gc.detectGenre({ key: 'custom-key', custom: true });
        expect(result).toBeDefined();
        expect(result.id).toBe('high-martial-comedy');
    });

    test('returns null when no match found', () => {
        MOCK_GENRES[0].isMatch.mockReturnValue(false);
        MOCK_GENRES[1].isMatch.mockReturnValue(false);
        const result = gc.detectGenre({ key: 'nonexistent' });
        expect(result).toBeNull();
    });
});

describe('genreConfig.getGenreById', () => {
    beforeEach(() => {
        getRegistry.mockReturnValue(MOCK_GENRES);
        getMap.mockReturnValue(MOCK_MAP);
    });

    test('returns genre from map', () => {
        const result = gc.getGenreById('high-martial-comedy');
        expect(result).toBeDefined();
        expect(result.id).toBe('high-martial-comedy');
    });

    test('returns null for unknown id', () => {
        const result = gc.getGenreById('nonexistent');
        expect(result).toBeNull();
    });
});

describe('genreConfig.resolveGenreFromProject', () => {
    beforeEach(() => {
        getRegistry.mockReturnValue(MOCK_GENRES);
        getMap.mockReturnValue(MOCK_MAP);
    });

    test('returns null for null project', () => {
        expect(gc.resolveGenreFromProject(null)).toBeNull();
    });

    test('resolves by subGenre', () => {
        const result = gc.resolveGenreFromProject({ subGenre: 'high-martial-comedy' });
        expect(result).toBeDefined();
        expect(result.id).toBe('high-martial-comedy');
    });

    test('resolves by subgenre (alternate key)', () => {
        const result = gc.resolveGenreFromProject({ subgenre: 'high-martial-comedy' });
        expect(result).toBeDefined();
        expect(result.id).toBe('high-martial-comedy');
    });

    test('resolves by styleProfile', () => {
        const result = gc.resolveGenreFromProject({ styleProfile: { key: 'high-martial-comedy' } });
        expect(result).toBeDefined();
        expect(result.id).toBe('high-martial-comedy');
    });

    test('resolves by genre field', () => {
        const result = gc.resolveGenreFromProject({ genre: 'high-martial-comedy' });
        expect(result).toBeDefined();
        expect(result.id).toBe('high-martial-comedy');
    });

    test('returns null when nothing matches', () => {
        const result = gc.resolveGenreFromProject({ genre: 'nonexistent' });
        expect(result).toBeNull();
    });
});

describe('genreConfig.getGenrePlugin', () => {
    beforeEach(() => {
        getRegistry.mockReturnValue(MOCK_GENRES);
        getMap.mockReturnValue(MOCK_MAP);
    });

    test('returns null for no matching genre', () => {
        MOCK_GENRES[0].isMatch.mockReturnValue(false);
        MOCK_GENRES[1].isMatch.mockReturnValue(false);
        const result = gc.getGenrePlugin({ key: 'nonexistent' });
        expect(result).toBeNull();
    });

    test('returns genre when no rulesLoader data', () => {
        // If rulesLoader.getGenreRules returns null, should return genre directly
        const result = gc.getGenrePlugin({ key: 'high-martial-comedy' });
        expect(result).toBeDefined();
        expect(result.id).toBe('high-martial-comedy');
    });
});

describe('genreConfig.getGenreRegistry / getRegisteredGenres', () => {
    test('returns registry', () => {
        getRegistry.mockReturnValue(MOCK_GENRES);
        expect(gc.getGenreRegistry()).toBe(MOCK_GENRES);
        expect(gc.getRegisteredGenres()).toBe(MOCK_GENRES);
    });
});
