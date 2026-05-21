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

describe('chapterStatus', () => {
    test('all statuses are unique (no duplicates)', () => {
        const unique = new Set(ALL_STATUSES);
        expect(unique.size).toBe(ALL_STATUSES.length);
    });

    test('pipeline-failed is in FAILED category', () => {
        expect(CHAPTER_STATUS.FAILED).toContain('pipeline-failed');
    });

    test('context-error is in FAILED category', () => {
        expect(CHAPTER_STATUS.FAILED).toContain('context-error');
    });

    test('isValidStatus returns true for known statuses', () => {
        expect(isValidStatus('outlined')).toBe(true);
        expect(isValidStatus('written')).toBe(true);
        expect(isValidStatus('approved')).toBe(true);
        expect(isValidStatus('material-updated')).toBe(true);
        expect(isValidStatus('pipeline-failed')).toBe(true);
        expect(isValidStatus('permanently-skipped')).toBe(true);
    });

    test('isValidStatus returns false for unknown statuses', () => {
        expect(isValidStatus('unknown-status')).toBe(false);
        expect(isValidStatus('skipped')).toBe(false);
        expect(isValidStatus('')).toBe(false);
    });

    test('getStatusCategory returns correct categories', () => {
        expect(getStatusCategory('outlined')).toBe('INITIAL');
        expect(getStatusCategory('written')).toBe('IN_PROGRESS');
        expect(getStatusCategory('first-reviewing')).toBe('IN_PROGRESS');
        expect(getStatusCategory('approved')).toBe('IN_PROGRESS');
        expect(getStatusCategory('material-updated')).toBe('COMPLETED');
        expect(getStatusCategory('failed-skipped')).toBe('FAILED');
        expect(getStatusCategory('pipeline-failed')).toBe('FAILED');
        expect(getStatusCategory('context-error')).toBe('FAILED');
        expect(getStatusCategory('permanently-skipped')).toBe('TERMINAL');
    });

    test('getStatusCategory returns UNKNOWN for invalid status', () => {
        expect(getStatusCategory('nonexistent')).toBe('UNKNOWN');
    });

    test('isTerminalStatus identifies completed and terminal statuses', () => {
        expect(isTerminalStatus('material-updated')).toBe(true);
        expect(isTerminalStatus('permanently-skipped')).toBe(true);
        expect(isTerminalStatus('outlined')).toBe(false);
        expect(isTerminalStatus('written')).toBe(false);
        expect(isTerminalStatus('pipeline-failed')).toBe(false);
    });

    test('isFailedStatus identifies failed statuses', () => {
        expect(isFailedStatus('failed-skipped')).toBe(true);
        expect(isFailedStatus('timeout-skipped')).toBe(true);
        expect(isFailedStatus('context-error')).toBe(true);
        expect(isFailedStatus('pipeline-failed')).toBe(true);
        expect(isFailedStatus('outlined')).toBe(false);
        expect(isFailedStatus('approved')).toBe(false);
    });

    test('STUCK_STATUSES does not contain completed statuses', () => {
        CHAPTER_STATUS.COMPLETED.forEach(s => {
            expect(STUCK_STATUSES).not.toContain(s);
        });
    });

    test('STUCK_STATUSES does not contain approved', () => {
        expect(STUCK_STATUSES).not.toContain('approved');
    });

    test('validateStatusConsistency returns true', () => {
        expect(validateStatusConsistency()).toBe(true);
    });

    test('all statuses used in pipeline are covered', () => {
        const pipelineStatuses = [
            'outlined', 'written', 'first-reviewing', 'second-reviewing',
            'final-editing', 'approved', 'material-updated',
            'failed-skipped', 'timeout-skipped', 'context-error',
            'pipeline-failed', 'permanently-skipped'
        ];
        pipelineStatuses.forEach(s => {
            expect(isValidStatus(s)).toBe(true);
        });
    });
});
