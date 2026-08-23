/**
 * genreDetectorHelpers.test.js
 * 覆盖所有genreDetectorHelpers导出函数
 */
jest.mock('../../server/services/genreDetection', () => ({
    detectGenre: jest.fn(),
    GENRE_REGISTRY: [
        { id: 'test-genre', constraintPresets: { preset1: 'value1' }, dedupRules: [{ rule: 'r1' }], detectors: { modernSlang: jest.fn(), perspective: jest.fn(), terminology: jest.fn(), onomatopoeia: jest.fn() }, interceptors: { firstReview: jest.fn(), secondReview: jest.fn() }, writerHints: { terminologyDimming: 'dim hint' }, reviewRules: { rule: 'test' }, qualityChecks: { onomatopoeia: { enabled: true }, visualAnchors: { enabled: false }, motherChildDialogue: { enabled: false } }, perspectiveSchema: { fields: '"perspective":"first"', label: '第一人称', values: ['first'] } },
        { id: 'minimal-genre' }
    ]
}));

const { detectGenre } = require('../../server/services/genreDetection');
const {
    getGenreDetectors, getGenreInterceptors, getGenreConstraintPresets,
    getGenreDedupRules, getGenreReviewRules, getAllGenreConstraintPresets,
    getAllGenreDedupRules, runGenreFirstReviewIntercept,
    runGenreSecondReviewIntercept, getGenreWriterInjection,
    getGenreModernSlangResult, getGenrePerspectiveResult,
    getGenreTerminologyResult, getGenreQualityResults, getGenrePerspectiveSchema
} = require('../../server/services/genreDetectorHelpers');

describe('genreDetectorHelpers', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('getGenreDetectors', () => {
        test('returns detectors from genre', () => {
            const genre = { detectors: { modernSlang: jest.fn() } };
            expect(getGenreDetectors(genre)).toEqual(genre.detectors);
        });
        test('returns null for null genre', () => {
            expect(getGenreDetectors(null)).toBeNull();
        });
        test('returns null for genre without detectors', () => {
            expect(getGenreDetectors({})).toBeNull();
        });
    });

    describe('getGenreInterceptors', () => {
        test('returns interceptors from genre', () => {
            const genre = { interceptors: { firstReview: jest.fn() } };
            expect(getGenreInterceptors(genre)).toEqual(genre.interceptors);
        });
        test('returns null for null genre', () => {
            expect(getGenreInterceptors(null)).toBeNull();
        });
    });

    describe('getGenreConstraintPresets', () => {
        test('returns presets from genre', () => {
            const genre = { constraintPresets: { key: 'val' } };
            expect(getGenreConstraintPresets(genre)).toEqual({ key: 'val' });
        });
        test('returns empty object for null genre', () => {
            expect(getGenreConstraintPresets(null)).toEqual({});
        });
    });

    describe('getGenreDedupRules', () => {
        test('returns rules from genre', () => {
            const genre = { dedupRules: ['rule1'] };
            expect(getGenreDedupRules(genre)).toEqual(['rule1']);
        });
        test('returns empty array for null genre', () => {
            expect(getGenreDedupRules(null)).toEqual([]);
        });
    });

    describe('getGenreReviewRules', () => {
        test('returns rules from genre', () => {
            const genre = { reviewRules: { rule: 'test' } };
            expect(getGenreReviewRules(genre)).toEqual({ rule: 'test' });
        });
        test('returns null for null genre', () => {
            expect(getGenreReviewRules(null)).toBeNull();
        });
    });

    describe('getAllGenreConstraintPresets', () => {
        test('aggregates presets from all genres', () => {
            const result = getAllGenreConstraintPresets();
            expect(result.preset1).toBe('value1');
        });
    });

    describe('getAllGenreDedupRules', () => {
        test('aggregates rules from all genres', () => {
            const result = getAllGenreDedupRules();
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe('runGenreFirstReviewIntercept', () => {
        test('returns empty result when no interceptors', () => {
            detectGenre.mockReturnValue({ interceptors: {} });
            const result = runGenreFirstReviewIntercept('content', {}, 'outline');
            expect(result.hardBlockIssues).toEqual([]);
        });
        test('calls interceptor when available', () => {
            const mockInterceptor = jest.fn().mockReturnValue({ hardBlockIssues: ['issue1'], warningIssues: [], hints: [] });
            detectGenre.mockReturnValue({ interceptors: { firstReview: mockInterceptor } });
            const result = runGenreFirstReviewIntercept('content', {}, 'outline');
            expect(result.hardBlockIssues).toEqual(['issue1']);
        });
        test('returns empty when genre is null', () => {
            detectGenre.mockReturnValue(null);
            const result = runGenreFirstReviewIntercept('content', {}, 'outline');
            expect(result.hardBlockIssues).toEqual([]);
        });
    });

    describe('runGenreSecondReviewIntercept', () => {
        test('returns empty result when no interceptors', () => {
            detectGenre.mockReturnValue({ interceptors: {} });
            const result = runGenreSecondReviewIntercept('content', {}, 'outline');
            expect(result.hardBlockIssues).toEqual([]);
        });
    });

    describe('getGenreWriterInjection', () => {
        test('returns terminologyDimming', () => {
            const genre = { writerHints: { terminologyDimming: 'dim' } };
            expect(getGenreWriterInjection(genre)).toBe('dim');
        });
        test('returns empty string for null genre', () => {
            expect(getGenreWriterInjection(null)).toBe('');
        });
    });

    describe('getGenreModernSlangResult', () => {
        test('returns default when no detectors', () => {
            detectGenre.mockReturnValue({ detectors: {} });
            const result = getGenreModernSlangResult('content', {});
            expect(result.count).toBe(0);
        });
        test('returns default when genre is null', () => {
            detectGenre.mockReturnValue(null);
            const result = getGenreModernSlangResult('content', {});
            expect(result.count).toBe(0);
        });
    });

    describe('getGenrePerspectiveResult', () => {
        test('returns default when no detectors', () => {
            detectGenre.mockReturnValue({ detectors: {} });
            const result = getGenrePerspectiveResult('content', {});
            expect(result.isViolation).toBe(false);
        });
    });

    describe('getGenreTerminologyResult', () => {
        test('returns default when no detectors', () => {
            detectGenre.mockReturnValue({ detectors: {} });
            const result = getGenreTerminologyResult('content', {});
            expect(result.count).toBe(0);
        });
    });

    describe('getGenreQualityResults', () => {
        test('returns default when no detectors', () => {
            detectGenre.mockReturnValue({ detectors: {} });
            const result = getGenreQualityResults('content', {});
            expect(result).toBeDefined();
        });
        test('returns default when genre is null', () => {
            detectGenre.mockReturnValue(null);
            const result = getGenreQualityResults('content', {});
            expect(result.onomatopoeia).toBeNull();
        });
        test('runs enabled quality checks', () => {
            const mockOnomatopoeia = jest.fn().mockReturnValue({ count: 5 });
            detectGenre.mockReturnValue({
                detectors: { onomatopoeia: mockOnomatopoeia },
                qualityChecks: { onomatopoeia: { enabled: true }, visualAnchors: { enabled: false }, motherChildDialogue: { enabled: false } }
            });
            const result = getGenreQualityResults('content', {});
            expect(result.onomatopoeia).toEqual({ count: 5 });
        });
    });

    describe('getGenrePerspectiveSchema', () => {
        test('returns custom schema from genre', () => {
            const genre = { perspectiveSchema: { fields: 'test', label: 'Test', values: ['v1'] } };
            const result = getGenrePerspectiveSchema(genre);
            expect(result.fields).toBe('test');
        });
        test('returns default schema for null genre', () => {
            const result = getGenrePerspectiveSchema(null);
            expect(result.values).toContain('protagonist');
        });
    });
});
