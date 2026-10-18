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

// ── E3b 覆盖补齐：陷阱#51 防御函数 + 一致性自检 ──
const {
    COMPLETED_OR_APPROVED_STATUSES,
    isCompletedOrApproved,
    completedOrApprovedFilter,
    validateStatusConsistency,
    STATUS_LABELS,
    VALID_TRANSITIONS,
} = require('../../server/services/chapterStatus');

describe('chapterStatus — 陷阱#51 防御与自检', () => {
    test('isCompletedOrApproved 只认"已完成或审核通过"', () => {
        expect(isCompletedOrApproved('approved')).toBe(true);
        expect(isCompletedOrApproved('writing')).toBe(false);
        expect(isCompletedOrApproved(undefined)).toBe(false);
        for (const s of COMPLETED_OR_APPROVED_STATUSES) expect(isCompletedOrApproved(s)).toBe(true);
    });

    test('completedOrApprovedFilter 返回 $in 条件，字段名可指定', () => {
        expect(completedOrApprovedFilter()).toEqual({ status: { $in: COMPLETED_OR_APPROVED_STATUSES } });
        expect(completedOrApprovedFilter('chapterStatus')).toEqual({ chapterStatus: { $in: COMPLETED_OR_APPROVED_STATUSES } });
    });

    test('validateStatusConsistency：状态定义/迁移表/标签自洽时通过', () => {
        expect(validateStatusConsistency()).toBe(true);
        // 迁移表引用的状态必须都在 ALL_STATUSES 内
        const allRefs = new Set(Object.values(VALID_TRANSITIONS).flat().concat(Object.keys(VALID_TRANSITIONS)));
        expect([...allRefs].every(s => isValidStatus(s))).toBe(true);
        // 每个状态都有标签
        expect(ALL_STATUSES.every(s => !!STATUS_LABELS[s])).toBe(true);
    });

    test('validateStatusConsistency：人为破坏迁移表时自检能发现', () => {
        const ghost = 'first-reviewed-ghost';
        VALID_TRANSITIONS[ghost] = ['writing'];
        try {
            expect(validateStatusConsistency()).toBe(false);
        } finally {
            delete VALID_TRANSITIONS[ghost];
        }
        expect(validateStatusConsistency()).toBe(true);
    });
});
