/**
 * genreConfig tests - 题材配置
 */
jest.mock('../../server/services/genreLoader', () => ({
    getRegistry: jest.fn(() => [
        { id: 'high-martial-comedy', genreProfileIds: ['高武穿越'], isMatch: jest.fn(() => false) },
        { id: 'high-martial-comedy', genreProfileIds: ['高武穿越'], isMatch: jest.fn(() => false) },
        { id: 'high-martial-comedy', genreProfileIds: ['高武'], isMatch: jest.fn(() => false) }
    ]),
    getMap: jest.fn(() => ({
        'high-martial-comedy': { id: 'high-martial-comedy', genreProfileIds: ['高武穿越'], isMatch: jest.fn(() => false) },
        'high-martial-comedy': { id: 'high-martial-comedy', genreProfileIds: ['高武穿越'], isMatch: jest.fn(() => false) },
        'high-martial-comedy': { id: 'high-martial-comedy', genreProfileIds: ['高武'], isMatch: jest.fn(() => false) }
    })),
    reloadGenres: jest.fn(),
    getGenreDir: jest.fn()
}));

const { detectGenre, getGenreById, resolveGenreFromProject } = require('../../server/services/genreConfig');

describe('genreConfig', () => {
    describe('detectGenre', () => {
        it('should return null for null styleProfile', () => {
            expect(detectGenre(null)).toBeNull();
        });

        it('should detect genre by key', () => {
            const result = detectGenre({ key: 'high-martial-comedy' });
            expect(result).toBeDefined();
            expect(result.id).toBe('high-martial-comedy');
        });

        it('should detect genre by genreProfileIds match', () => {
            const result = detectGenre({ label: '高武穿越' });
            expect(result).toBeDefined();
            expect(result.id).toBe('high-martial-comedy');
        });

        it('should return null for unrecognized profile', () => {
            const result = detectGenre({ key: 'nonexistent-genre' });
            expect(result).toBeNull();
        });
    });

    describe('getGenreById', () => {
        it('should return genre by id', () => {
            const result = getGenreById('high-martial-comedy');
            expect(result).toBeDefined();
            expect(result.id).toBe('high-martial-comedy');
        });

        it('should return null for unknown id', () => {
            expect(getGenreById('nonexistent')).toBeNull();
        });
    });

    describe('resolveGenreFromProject', () => {
        it('should return null for null project', () => {
            expect(resolveGenreFromProject(null)).toBeNull();
        });

        it('should resolve from subGenre', () => {
            const result = resolveGenreFromProject({ subGenre: 'high-martial-comedy' });
            expect(result).toBeDefined();
            expect(result.id).toBe('high-martial-comedy');
        });

        it('should resolve from styleProfile', () => {
            const result = resolveGenreFromProject({ styleProfile: { key: 'high-martial-comedy' } });
            expect(result).toBeDefined();
            expect(result.id).toBe('high-martial-comedy');
        });

        it('should resolve from genre field', () => {
            const result = resolveGenreFromProject({ genre: 'high-martial-comedy' });
            expect(result).toBeDefined();
            expect(result.id).toBe('high-martial-comedy');
        });
    });
});
