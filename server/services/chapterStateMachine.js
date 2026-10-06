// 词汇表 / 迁移表来自唯一真相源 chapterStatus.js（本文件仅保留迁移判定行为）
const { VALID_TRANSITIONS, STATUS_LABELS: STATE_LABELS } = require('./chapterStatus');

const PIPELINE_STATES = ['first-reviewing', 'first-reviewed', 'second-reviewing', 'second-reviewed', 'final-editing'];
const TERMINAL_STATES = ['approved', 'material-updated', 'failed-skipped', 'timeout-skipped', 'cooldown-waiting'];
const RESETTABLE_STATES = ['failed-skipped', 'timeout-skipped', 'cooldown-waiting'];

function isValidTransition(from, to) {
    if (from === to) return true;
    const allowed = VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
}

function validateTransition(from, to) {
    if (isValidTransition(from, to)) return { valid: true };
    return {
        valid: false,
        error: `Invalid chapter state transition: "${from}" → "${to}"`,
        allowedTargets: VALID_TRANSITIONS[from] || []
    };
}

function getNextState(currentState, event) {
    const EVENT_MAP = {
        'write-complete': { from: 'outlined', to: 'written' },
        'review-start': { from: 'written', to: 'first-reviewing' },
        'first-review-pass': { from: 'first-reviewing', to: 'first-reviewed' },
        'first-review-fail': { from: 'first-reviewing', to: 'written' },
        'second-review-start': { from: 'first-reviewed', to: 'second-reviewing' },
        'second-review-pass': { from: 'second-reviewing', to: 'second-reviewed' },
        'second-review-fail': { from: 'second-reviewing', to: 'written' },
        'final-edit-start': { from: 'second-reviewed', to: 'final-editing' },
        'edit-complete': { from: 'final-editing', to: 'approved' },
        'edit-fail': { from: 'final-editing', to: 'written' },
        'material-update': { from: 'approved', to: 'material-updated' },
        'timeout': { from: PIPELINE_STATES, to: 'timeout-skipped' },
        'fail-skip': { from: ['outlined', 'written'], to: 'failed-skipped' },
        'cooldown-wait': { from: PIPELINE_STATES, to: 'cooldown-waiting' },
        'reset': { from: [...TERMINAL_STATES, ...RESETTABLE_STATES, 'material-updated', ...PIPELINE_STATES, 'approved'], to: 'outlined' }
    };
    const mapping = EVENT_MAP[event];
    if (!mapping) return null;
    const fromStates = Array.isArray(mapping.from) ? mapping.from : [mapping.from];
    if (fromStates.includes(currentState)) return mapping.to;
    return null;
}

module.exports = {
    VALID_TRANSITIONS,
    STATE_LABELS,
    PIPELINE_STATES,
    TERMINAL_STATES,
    RESETTABLE_STATES,
    isValidTransition,
    validateTransition,
    getNextState
};
