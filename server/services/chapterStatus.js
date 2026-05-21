const CHAPTER_STATUS = {
    IN_PROGRESS: ['first-reviewing', 'second-reviewing', 'final-editing', 'written', 'polishing', 'approved'],
    COMPLETED: ['material-updated'],
    FAILED: ['failed-skipped', 'timeout-skipped', 'context-error', 'pipeline-failed'],
    TERMINAL: ['permanently-skipped'],
    INITIAL: ['outlined']
};

const ALL_STATUSES = [
    ...CHAPTER_STATUS.IN_PROGRESS,
    ...CHAPTER_STATUS.COMPLETED,
    ...CHAPTER_STATUS.FAILED,
    ...CHAPTER_STATUS.TERMINAL,
    ...CHAPTER_STATUS.INITIAL
];

const STUCK_STATUSES = CHAPTER_STATUS.IN_PROGRESS.filter(s => s !== 'approved');

function isValidStatus(status) {
    return ALL_STATUSES.includes(status);
}

function getStatusCategory(status) {
    if (CHAPTER_STATUS.IN_PROGRESS.includes(status)) return 'IN_PROGRESS';
    if (CHAPTER_STATUS.COMPLETED.includes(status)) return 'COMPLETED';
    if (CHAPTER_STATUS.FAILED.includes(status)) return 'FAILED';
    if (CHAPTER_STATUS.TERMINAL.includes(status)) return 'TERMINAL';
    if (CHAPTER_STATUS.INITIAL.includes(status)) return 'INITIAL';
    return 'UNKNOWN';
}

function isTerminalStatus(status) {
    return CHAPTER_STATUS.COMPLETED.includes(status) ||
           CHAPTER_STATUS.TERMINAL.includes(status);
}

function isFailedStatus(status) {
    return CHAPTER_STATUS.FAILED.includes(status);
}

function validateStatusConsistency() {
    const unique = new Set(ALL_STATUSES);
    if (unique.size !== ALL_STATUSES.length) {
        const duplicates = ALL_STATUSES.filter((s, i) => ALL_STATUSES.indexOf(s) !== i);
        console.error('[CHAPTER_STATUS] Status definition has duplicates!', duplicates);
        return false;
    }
    if (STUCK_STATUSES.some(s => CHAPTER_STATUS.COMPLETED.includes(s))) {
        throw new Error('FATAL: STUCK_STATUSES contains completed statuses! This will reset approved chapters.');
    }
    return true;
}

validateStatusConsistency();

module.exports = {
    CHAPTER_STATUS,
    ALL_STATUSES,
    STUCK_STATUSES,
    isValidStatus,
    getStatusCategory,
    isTerminalStatus,
    isFailedStatus,
    validateStatusConsistency
};
