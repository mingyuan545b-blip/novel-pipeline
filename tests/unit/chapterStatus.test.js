const { CHAPTER_STATUS, ALL_STATUSES, STUCK_STATUSES, isValidStatus, getStatusCategory, isTerminalStatus, isFailedStatus } = require('../../server/services/chapterStatus');

describe('chapterStatus', () => {
    describe('CHAPTER_STATUS', () => {
        test('has IN_PROGRESS array', () => {
            expect(Array.isArray(CHAPTER_STATUS.IN_PROGRESS)).toBe(true);
            expect(CHAPTER_STATUS.IN_PROGRESS.length).toBeGreaterThan(0);
        });

        test('has COOLDOWN array', () => {
            expect(Array.isArray(CHAPTER_STATUS.COOLDOWN)).toBe(true);
            expect(CHAPTER_STATUS.COOLDOWN).toContain('cooldown-waiting');
        });

        test('has INITIAL array', () => {
            expect(Array.isArray(CHAPTER_STATUS.INITIAL)).toBe(true);
            expect(CHAPTER_STATUS.INITIAL).toContain('outlined');
        });

        test('has FAILED array', () => {
            expect(Array.isArray(CHAPTER_STATUS.FAILED)).toBe(true);
        });

        test('has COMPLETED array', () => {
            expect(Array.isArray(CHAPTER_STATUS.COMPLETED)).toBe(true);
        });
    });

    describe('ALL_STATUSES', () => {
        test('is an array containing all statuses', () => {
            expect(Array.isArray(ALL_STATUSES)).toBe(true);
            expect(ALL_STATUSES).toContain('outlined');
            expect(ALL_STATUSES).toContain('written');
        });
    });

    describe('isValidStatus', () => {
        test('returns true for valid statuses', () => {
            expect(isValidStatus('outlined')).toBe(true);
            expect(isValidStatus('written')).toBe(true);
        });

        test('returns false for invalid status', () => {
            expect(isValidStatus('nonexistent')).toBe(false);
        });
    });

    describe('isTerminalStatus', () => {
        test('returns true for cooldown-waiting', () => {
            expect(isTerminalStatus('cooldown-waiting')).toBe(true);
        });

        test('returns false for outlined', () => {
            expect(isTerminalStatus('outlined')).toBe(false);
        });
    });

    describe('isFailedStatus', () => {
        test('returns true for failed statuses', () => {
            expect(isFailedStatus('failed-skipped')).toBe(true);
            expect(isFailedStatus('pipeline-failed')).toBe(true);
        });

        test('returns false for normal statuses', () => {
            expect(isFailedStatus('outlined')).toBe(false);
        });
    });

    describe('getStatusCategory', () => {
        test('categorizes outlined as INITIAL', () => {
            expect(getStatusCategory('outlined')).toBe('INITIAL');
        });

        test('categorizes written as IN_PROGRESS', () => {
            expect(getStatusCategory('written')).toBe('IN_PROGRESS');
        });

        test('categorizes cooldown-waiting as COOLDOWN', () => {
            expect(getStatusCategory('cooldown-waiting')).toBe('COOLDOWN');
        });

        test('returns UNKNOWN for unknown status', () => {
            expect(getStatusCategory('unknown')).toBe('UNKNOWN');
        });
    });
});
