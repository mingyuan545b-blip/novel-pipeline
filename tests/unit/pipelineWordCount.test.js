/**
 * pipelineWordCount tests - 字数硬门禁
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    deleteItem: jest.fn(),
    queryItems: jest.fn(),
    listItems: jest.fn()
}));

jest.mock('../../server/services/genreConfig', () => ({
    resolveGenreFromProject: jest.fn()
}));

jest.mock('../../server/config', () => ({
    resolveConfig: jest.fn()
}));

const { formatFeedbackText, checkWordCountHardLimit } = require('../../server/services/pipeline/pipelineHelpers/pipelineWordCount');
const store = require('../../server/store');
const { resolveGenreFromProject } = require('../../server/services/genreConfig');
const { resolveConfig } = require('../../server/config');

describe('pipelineWordCount', () => {
    describe('formatFeedbackText', () => {
        it('should format feedback with summary, issues and suggestions', () => {
            const fb = {
                summary: 'Test summary',
                issues: [{ description: 'Issue 1', severity: 'critical' }, 'Issue 2'],
                suggestions: ['Suggestion 1', { description: 'Suggestion 2' }]
            };
            const result = formatFeedbackText(fb);
            expect(result).toContain('【总结】Test summary');
            expect(result).toContain('【必须修改的问题】');
            expect(result).toContain('[critical] Issue 1');
            expect(result).toContain('【修改建议】');
        });

        it('should handle empty feedback', () => {
            expect(formatFeedbackText({})).toBe('');
            expect(formatFeedbackText(null)).toBe('');
        });

        it('should handle feedback with only summary', () => {
            const result = formatFeedbackText({ summary: 'Only summary' });
            expect(result).toBe('【总结】Only summary');
        });
    });

    describe('checkWordCountHardLimit', () => {
        beforeEach(() => {
            jest.clearAllMocks();
            resolveGenreFromProject.mockReturnValue('high-martial');
            resolveConfig.mockReturnValue({ word: { rejectMin: 1500, maxChapter: 5000 } });
        });

        it('should return blocked:false for non-review steps', async () => {
            const result = await checkWordCountHardLimit('writer', 'ch1', {}, 'novel');
            expect(result.blocked).toBe(false);
        });

        it('should block review when word count below rejectMin', async () => {
            store.getItem.mockResolvedValue({ content: 'A'.repeat(800) });
            const result = await checkWordCountHardLimit('first-review', 'ch1', {}, 'novel');
            expect(result.blocked).toBe(true);
            expect(result.stepResult.passed).toBe(false);
            expect(result.stepResult.feedback.summary).toContain('字数严重不足');
        });

        it('should block review when word count exceeds maxChapter', async () => {
            store.getItem.mockResolvedValue({ content: 'A'.repeat(6000) });
            const result = await checkWordCountHardLimit('second-review', 'ch1', {}, 'novel');
            expect(result.blocked).toBe(true);
            expect(result.stepResult.passed).toBe(false);
            expect(result.stepResult.feedback.summary).toContain('字数超限');
        });

        it('should pass when word count is within limits', async () => {
            store.getItem.mockResolvedValue({ content: 'A'.repeat(2500) });
            const result = await checkWordCountHardLimit('fast-review', 'ch1', {}, 'novel');
            expect(result.blocked).toBe(false);
        });

        it('should handle null chapter data', async () => {
            store.getItem.mockResolvedValue(null);
            const result = await checkWordCountHardLimit('first-review', 'ch1', {}, 'novel');
            expect(result.blocked).toBe(true);
        });
    });
});
