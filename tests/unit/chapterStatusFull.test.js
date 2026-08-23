const {
    CHAPTER_STATUS,
    ALL_STATUSES,
    STUCK_STATUSES,
    isValidStatus,
    getStatusCategory,
    isTerminalStatus,
    isFailedStatus,
    validateStatusConsistency
} = require('../../server/services/chapterStatus');

describe('chapterStatus full coverage', () => {
    describe('CHAPTER_STATUS', () => {
        test('has required categories', () => {
            expect(Array.isArray(CHAPTER_STATUS.IN_PROGRESS)).toBe(true);
            expect(Array.isArray(CHAPTER_STATUS.COMPLETED)).toBe(true);
            expect(Array.isArray(CHAPTER_STATUS.FAILED)).toBe(true);
            expect(Array.isArray(CHAPTER_STATUS.COOLDOWN)).toBe(true);
            expect(Array.isArray(CHAPTER_STATUS.INITIAL)).toBe(true);
        });

        test('contains expected statuses', () => {
            expect(CHAPTER_STATUS.INITIAL).toContain('outlined');
            expect(CHAPTER_STATUS.COOLDOWN).toContain('cooldown-waiting');
            expect(CHAPTER_STATUS.IN_PROGRESS).toContain('approved');
        });
    });

    describe('ALL_STATUSES', () => {
        test('is non-empty array', () => {
            expect(Array.isArray(ALL_STATUSES)).toBe(true);
            expect(ALL_STATUSES.length).toBeGreaterThan(0);
        });
    });

    describe('STUCK_STATUSES', () => {
        test('excludes approved', () => {
            expect(STUCK_STATUSES).not.toContain('approved');
        });

        test('includes in-progress statuses', () => {
            expect(STUCK_STATUSES).toContain('first-reviewing');
        });
    });

    describe('isValidStatus', () => {
        test('returns true for valid statuses', () => {
            expect(isValidStatus('outlined')).toBe(true);
            expect(isValidStatus('approved')).toBe(true);
        });

        test('returns false for invalid statuses', () => {
            expect(isValidStatus('nonexistent')).toBe(false);
        });
    });

    describe('getStatusCategory', () => {
        test('categorizes outlined as INITIAL', () => {
            expect(getStatusCategory('outlined')).toBe('INITIAL');
        });

        test('categorizes approved as IN_PROGRESS', () => {
            expect(getStatusCategory('approved')).toBe('IN_PROGRESS');
        });

        test('categorizes cooldown-waiting as COOLDOWN', () => {
            expect(getStatusCategory('cooldown-waiting')).toBe('COOLDOWN');
        });

        test('categorizes material-updated as COMPLETED', () => {
            expect(getStatusCategory('material-updated')).toBe('COMPLETED');
        });

        test('categorizes failed-skipped as FAILED', () => {
            expect(getStatusCategory('failed-skipped')).toBe('FAILED');
        });

        test('categorizes unknown as UNKNOWN', () => {
            expect(getStatusCategory('nonexistent')).toBe('UNKNOWN');
        });
    });

    describe('isTerminalStatus', () => {
        test('material-updated is terminal', () => {
            expect(isTerminalStatus('material-updated')).toBe(true);
        });

        test('cooldown-waiting is terminal', () => {
            expect(isTerminalStatus('cooldown-waiting')).toBe(true);
        });

        test('outlined is not terminal', () => {
            expect(isTerminalStatus('outlined')).toBe(false);
        });
    });

    describe('isFailedStatus', () => {
        test('failed-skipped is failed', () => {
            expect(isFailedStatus('failed-skipped')).toBe(true);
        });

        test('timeout-skipped is failed', () => {
            expect(isFailedStatus('timeout-skipped')).toBe(true);
        });

        test('outlined is not failed', () => {
            expect(isFailedStatus('outlined')).toBe(false);
        });
    });

    describe('validateStatusConsistency', () => {
        test('returns true for current definitions', () => {
            expect(validateStatusConsistency()).toBe(true);
        });
    });
});
