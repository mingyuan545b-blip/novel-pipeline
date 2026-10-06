// 章节状态单一真相源（SSOT）：词汇表/标签/颜色/迁移/分类全部由此派生。
//   · 迁移判定在 chapterStateMachine.js，词汇表在本文件；
//   · 前端 client/src/shared/chapterStatusConstants.js 由
//     scripts/generateChapterStatusConstants.js 生成（禁止手抄）；
//   · 闸门 scripts/audit-vocabulary-consistency.js 校验 status 写入值 ⊆ ALL_STATUSES。
const logger = require('../shared/logger');
const CHAPTER_STATUS = {
    // 进行中：含"已通过初审/复审"两个中间态（审核通过后、尚未进入下一步）
    IN_PROGRESS: ['first-reviewing', 'first-reviewed', 'second-reviewing', 'second-reviewed', 'final-editing', 'written', 'polishing', 'approved'],
    COMPLETED: ['material-updated'],
    FAILED: ['failed-skipped', 'timeout-skipped', 'context-error', 'pipeline-failed'],
    COOLDOWN: ['cooldown-waiting'],
    INITIAL: ['outlined', 'draft']
};

// 陷阱#51防御：单独状态值常量，禁止业务代码直接写字面量
const STATUS_VALUES = {
    APPROVED: 'approved',
    MATERIAL_UPDATED: 'material-updated',
    OUTLINED: 'outlined',
    DRAFT: 'draft',
    WRITTEN: 'written',
    FIRST_REVIEWING: 'first-reviewing',
    FIRST_REVIEWED: 'first-reviewed',
    SECOND_REVIEWING: 'second-reviewing',
    SECOND_REVIEWED: 'second-reviewed',
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

// 审核"通过但未推进"的中间态（曾因不在 ALL_STATUSES 造成门槛活锁）
const REVIEWED_STATUSES = ['first-reviewed', 'second-reviewed'];
const STUCK_STATUSES = CHAPTER_STATUS.IN_PROGRESS.filter(s => s !== 'approved');

// 展示元数据（前端生成器据此产出 STATUS_LABELS / STATUS_COLORS / STATUS_ORDER）
const STATUS_LABELS = {
    draft: '草稿',
    outlined: '已规划',
    written: '已创作',
    'first-reviewing': '初审中',
    'first-reviewed': '初审通过',
    'second-reviewing': '复审中',
    'second-reviewed': '复审通过',
    'final-editing': '定稿中',
    polishing: '润色中',
    approved: '已定稿',
    'material-updated': '素材已更新',
    'failed-skipped': '失败跳过',
    'timeout-skipped': '超时跳过',
    'context-error': '上下文错误',
    'pipeline-failed': '流水线失败',
    'cooldown-waiting': '冷却等待'
};

const STATUS_COLORS = {
    draft: 'blue',
    outlined: 'purple',
    written: 'blue',
    'first-reviewing': 'green',
    'first-reviewed': 'green',
    'second-reviewing': 'orange',
    'second-reviewed': 'orange',
    'final-editing': 'pink',
    polishing: 'pink',
    approved: 'green',
    'material-updated': 'purple',
    'failed-skipped': 'red',
    'timeout-skipped': 'red',
    'context-error': 'red',
    'pipeline-failed': 'red',
    'cooldown-waiting': 'orange'
};

const STATUS_ORDER = ['outlined', 'draft', 'written', 'first-reviewing', 'first-reviewed',
    'second-reviewing', 'second-reviewed', 'final-editing', 'polishing', 'approved', 'material-updated', 'cooldown-waiting'];

// 合法状态迁移（增量：reviewed 态承接 reviewing 态，再推进到下一步）
const VALID_TRANSITIONS = {
    outlined: ['written', 'failed-skipped'],
    draft: ['outlined', 'written', 'failed-skipped'],
    written: ['first-reviewing', 'failed-skipped'],
    'first-reviewing': ['first-reviewed', 'second-reviewing', 'written', 'timeout-skipped', 'cooldown-waiting'],
    'first-reviewed': ['second-reviewing', 'written', 'timeout-skipped', 'cooldown-waiting'],
    'second-reviewing': ['second-reviewed', 'final-editing', 'written', 'timeout-skipped', 'cooldown-waiting'],
    'second-reviewed': ['final-editing', 'written', 'timeout-skipped', 'cooldown-waiting'],
    'final-editing': ['approved', 'written', 'timeout-skipped', 'cooldown-waiting'],
    polishing: ['approved', 'written', 'timeout-skipped', 'cooldown-waiting'],
    approved: ['material-updated', 'outlined'],
    'material-updated': ['outlined'],
    'failed-skipped': ['outlined'],
    'timeout-skipped': ['outlined'],
    'context-error': ['outlined'],
    'pipeline-failed': ['outlined'],
    'cooldown-waiting': ['outlined']
};

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

function isReviewedStatus(status) {
    return REVIEWED_STATUSES.includes(status);
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
    // 迁移表引用的状态必须都在 ALL_STATUSES 内（防止再次出现 first-reviewed 幽灵态）
    const badRefs = [];
    for (const [from, tos] of Object.entries(VALID_TRANSITIONS)) {
        if (!isValidStatus(from)) badRefs.push(from);
        for (const to of tos) if (!isValidStatus(to)) badRefs.push(to);
    }
    if (badRefs.length > 0) {
        logger.error('chapterStatus', '[CHAPTER_STATUS] VALID_TRANSITIONS references unknown statuses!', [...new Set(badRefs)]);
        return false;
    }
    const missingLabel = ALL_STATUSES.filter(s => !STATUS_LABELS[s]);
    if (missingLabel.length > 0) {
        logger.error('chapterStatus', '[CHAPTER_STATUS] Missing STATUS_LABELS for statuses!', missingLabel);
        return false;
    }
    return true;
}

validateStatusConsistency();

module.exports = {
    CHAPTER_STATUS,
    STATUS_VALUES,
    ALL_STATUSES,
    REVIEWED_STATUSES,
    STUCK_STATUSES,
    STATUS_LABELS,
    STATUS_COLORS,
    STATUS_ORDER,
    VALID_TRANSITIONS,
    COMPLETED_OR_APPROVED_STATUSES,
    isValidStatus,
    getStatusCategory,
    isTerminalStatus,
    isFailedStatus,
    isReviewedStatus,
    isCompletedOrApproved,
    completedOrApprovedFilter,
    validateStatusConsistency
};
