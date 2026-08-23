const VALID_TRANSITIONS = {
    'outlined': ['written', 'failed-skipped'],
    'written': ['first-reviewing', 'failed-skipped'],
    'first-reviewing': ['second-reviewing', 'written', 'timeout-skipped', 'cooldown-waiting'],
    'second-reviewing': ['final-editing', 'written', 'timeout-skipped', 'cooldown-waiting'],
    'final-editing': ['approved', 'written', 'timeout-skipped', 'cooldown-waiting'],
    'approved': ['material-updated', 'outlined'],
    'material-updated': ['outlined'],
    'failed-skipped': ['outlined'],
    'timeout-skipped': ['outlined'],
    'cooldown-waiting': ['outlined']
};

const STATE_LABELS = {
    'outlined': '大纲',
    'written': '已写',
    'first-reviewing': '初审中',
    'second-reviewing': '复审中',
    'final-editing': '定稿中',
    'approved': '已通过',
    'material-updated': '素材已更新',
    'failed-skipped': '失败跳过',
    'timeout-skipped': '超时跳过',
    'cooldown-waiting': '冷却等待'
};

const PIPELINE_STATES = ['first-reviewing', 'second-reviewing', 'final-editing'];
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
        'first-review-pass': { from: 'first-reviewing', to: 'second-reviewing' },
        'first-review-fail': { from: 'first-reviewing', to: 'written' },
        'second-review-pass': { from: 'second-reviewing', to: 'final-editing' },
        'second-review-fail': { from: 'second-reviewing', to: 'written' },
        'edit-complete': { from: 'final-editing', to: 'approved' },
        'edit-fail': { from: 'final-editing', to: 'written' },
        'material-update': { from: 'approved', to: 'material-updated' },
        'timeout': { from: PIPELINE_STATES, to: 'timeout-skipped' },
        'fail-skip': { from: ['outlined', 'written'], to: 'failed-skipped' },
        'cooldown-wait': { from: PIPELINE_STATES, to: 'cooldown-waiting' },
        'reset': { from: [...TERMINAL_STATES, ...RESETTABLE_STATES, 'material-updated'], to: 'outlined' }
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
