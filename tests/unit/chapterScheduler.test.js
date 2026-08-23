const { resetCooledChapters, fixStuckChapters, selectNextChapter, MAX_CHAPTER_RETRIES } = require('../../server/services/pipeline/infinite/chapterScheduler');

describe('chapterScheduler', () => {
    function createChapter(overrides = {}) {
        return {
            id: 'ch-' + Math.random().toString(36).substr(2, 9),
            chapterNumber: 1,
            status: 'outlined',
            _pipelineRetries: 0,
            _wordCountRetry: 0,
            updatedAt: new Date().toISOString(),
            ...overrides
        };
    }

    const mockAddLog = jest.fn();
    beforeEach(() => { mockAddLog.mockClear(); });

    describe('resetCooledChapters', () => {
        test('resets failed-skipped chapter after cooldown', () => {
            const ch = createChapter({ status: 'failed-skipped', skipUntil: Date.now() - 1000, _pipelineRetries: 1 });
            const result = resetCooledChapters([ch], mockAddLog);
            expect(result).toHaveLength(1);
            expect(result[0].action).toBe('reset-to-outlined');
            expect(ch.status).toBe('outlined');
            expect(ch.skipUntil).toBeUndefined();
        });

        test('resets chapter after max retries (never gives up)', () => {
            const ch = createChapter({ status: 'failed-skipped', skipUntil: Date.now() - 1000, _pipelineRetries: MAX_CHAPTER_RETRIES });
            const result = resetCooledChapters([ch], mockAddLog);
            expect(result).toHaveLength(1);
            expect(result[0].action).toBe('reset-to-outlined');
            expect(ch.status).toBe('outlined');
        });

        test('does not reset chapter still in cooldown', () => {
            const ch = createChapter({ status: 'failed-skipped', skipUntil: Date.now() + 60000 });
            const result = resetCooledChapters([ch], mockAddLog);
            expect(result).toHaveLength(0);
        });

        test('ignores outlined chapters', () => {
            const ch = createChapter({ status: 'outlined' });
            const result = resetCooledChapters([ch], mockAddLog);
            expect(result).toHaveLength(0);
        });
    });

    describe('fixStuckChapters', () => {
        test('resets stuck chapters to outlined', () => {
            const ch = createChapter({ status: 'first-reviewing' });
            const result = fixStuckChapters([ch], mockAddLog);
            expect(result).toHaveLength(1);
            expect(ch.status).toBe('outlined');
        });

        test('resets pipeline-failed chapters', () => {
            const ch = createChapter({ status: 'pipeline-failed' });
            const result = fixStuckChapters([ch], mockAddLog);
            expect(result).toHaveLength(1);
            expect(ch.status).toBe('outlined');
        });

        test('does not modify outlined chapters', () => {
            const ch = createChapter({ status: 'outlined' });
            const result = fixStuckChapters([ch], mockAddLog);
            expect(result).toHaveLength(0);
        });
    });

    describe('selectNextChapter', () => {
        test('returns outlined chapters', () => {
            const ch1 = createChapter({ chapterNumber: 1, status: 'outlined' });
            const ch2 = createChapter({ chapterNumber: 2, status: 'material-updated' });
            const result = selectNextChapter([ch1, ch2], mockAddLog);
            expect(result.outlinedChapters).toHaveLength(1);
            expect(result.outlinedChapters[0].chapterNumber).toBe(1);
        });

        test('excludes chapters in cooldown', () => {
            const ch = createChapter({ status: 'outlined', skipUntil: Date.now() + 60000 });
            const result = selectNextChapter([ch], mockAddLog);
            expect(result.outlinedChapters).toHaveLength(0);
        });

        test('identifies cooldown-waiting chapters', () => {
            const ch = createChapter({ chapterNumber: 1, status: 'cooldown-waiting', skipUntil: Date.now() + 60000 });
            const result = selectNextChapter([ch], mockAddLog);
            expect(result.cooldownChapters).toHaveLength(1);
        });

        test('identifies failed chapters in cooldown', () => {
            const ch = createChapter({ status: 'failed-skipped', skipUntil: Date.now() + 60000 });
            const result = selectNextChapter([ch], mockAddLog);
            expect(result.failedSkippedChapters).toHaveLength(1);
        });

        test('returns empty when no chapters available', () => {
            const result = selectNextChapter([], mockAddLog);
            expect(result.outlinedChapters).toHaveLength(0);
            expect(result.failedSkippedChapters).toHaveLength(0);
            expect(result.cooldownChapters).toHaveLength(0);
        });
    });
});
