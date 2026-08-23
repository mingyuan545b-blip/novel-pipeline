const logger = require('../shared/logger');
const CHAPTER_STATUS = {
    IN_PROGRESS: ['first-reviewing', 'second-reviewing', 'final-editing', 'written', 'polishing', 'approved'],
    COMPLETED: ['material-updated'],
    FAILED: ['failed-skipped', 'timeout-skipped', 'context-error', 'pipeline-failed'],
    COOLDOWN: ['cooldown-waiting'],
    INITIAL: ['outlined']
};

// 陷阱#51防御：单独状态值常量，禁止业务代码直接写字面量
const STATUS_VALUES = {
    APPROVED: 'approved',
    MATERIAL_UPDATED: 'material-updated',
    OUTLINED: 'outlined',
    WRITTEN: 'written',
    FIRST_REVIEWING: 'first-reviewing',
    SECOND_REVIEWING: 'second-reviewing',
    FINAL_EDITING: 'final-editing',
    POLISHING: 'polishing'
};

const ALL_STATUSES = [
    ...CHAPTER_STATUS.IN_PROGRESS,
    ...CHAPTER_STATUS.COMPLETED,
    ...CHAPTER_STATUS.FAILED,
    ...CHAPTER_STATUS.COOLDOWN,
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
    if (CHAPTER_STATUS.COOLDOWN.includes(status)) return 'COOLDOWN';
    if (CHAPTER_STATUS.INITIAL.includes(status)) return 'INITIAL';
    return 'UNKNOWN';
}

function isTerminalStatus(status) {
    return CHAPTER_STATUS.COMPLETED.includes(status) ||
           CHAPTER_STATUS.COOLDOWN.includes(status);
}

function isFailedStatus(status) {
    return CHAPTER_STATUS.FAILED.includes(status);
}

// 陷阱#51防御：filter用错状态值导致material-updated被跳过
// "已完成或审核通过"的状态值清单，用于跨章检测/filter上一章等场景
const COMPLETED_OR_APPROVED_STATUSES = [
    ...CHAPTER_STATUS.COMPLETED,    // ['material-updated']
    'approved'                       // approved属于IN_PROGRESS但是终审通过
];

// 陷阱#51防御：filter条件必须用此函数，禁止直接写 status === 'approved'
function isCompletedOrApproved(status) {
    return COMPLETED_OR_APPROVED_STATUSES.includes(status);
}

// 陷阱#51防御：MongoDB/PG filter条件构造，返回 {$in: [...]} 或 SQL IN (...)
function completedOrApprovedFilter(field = 'status') {
    return { [field]: { $in: COMPLETED_OR_APPROVED_STATUSES } };
}

function validateStatusConsistency() {
    const unique = new Set(ALL_STATUSES);
    if (unique.size !== ALL_STATUSES.length) {
        const duplicates = ALL_STATUSES.filter((s, i) => ALL_STATUSES.indexOf(s) !== i);
        logger.error('chapterStatus', '[CHAPTER_STATUS] Status definition has duplicates!', duplicates);
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
    STATUS_VALUES,
    ALL_STATUSES,
    STUCK_STATUSES,
    COMPLETED_OR_APPROVED_STATUSES,
    isValidStatus,
    getStatusCategory,
    isTerminalStatus,
    isFailedStatus,
    isCompletedOrApproved,
    completedOrApprovedFilter,
    validateStatusConsistency
};
