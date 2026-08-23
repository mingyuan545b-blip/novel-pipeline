/**
 * 角色状态工具函数
 * 格式化、增量计算、键映射
 */

const BRIEF_IMPORTANT_KEYS = [
    'hp', 'mp', 'energy', 'stamina', 'combatPower', 'combatPowerLevel',
    'position', 'jobTitle', 'factionName', 'cultivationStage'
];

function formatStateForPrompt(state, schema, mode = 'brief') {
    if (!state || !schema) return '';
    const lines = [];

    if (mode === 'brief') {
        for (const key of BRIEF_IMPORTANT_KEYS) {
            if (schema.fields[key] && state[key] !== undefined && state[key] !== schema.fields[key].defaultValue) {
                const field = schema.fields[key];
                lines.push(`${field.label}: ${state[key]}${state.unit || field.unit || ''}`);
            }
        }
        if (state.personality && state.personality !== schema.fields.personality.defaultValue) {
            lines.push(`性格: ${state.personality}`);
        }
        if (state.speakingTone && state.speakingTone !== schema.fields.speakingTone.defaultValue) {
            lines.push(`语气: ${state.speakingTone}`);
        }
        return lines.join(', ');
    }

    for (const [key, field] of Object.entries(schema.fields)) {
        if (key === 'stateChangedFields') continue;
        const value = state[key];
        if (value === undefined || value === field.defaultValue) continue;

        if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value) && value.length > 0) {
                lines.push(`${field.label}: ${value.join(', ')}`);
            } else if (!Array.isArray(value) && Object.keys(value).length > 0) {
                lines.push(`${field.label}: ${JSON.stringify(value)}`);
            }
        } else {
            lines.push(`${field.label}: ${value}${field.unit || ''}`);
        }
    }
    return lines.join('\n');
}

function createStateDelta(oldState, newState, schema) {
    const delta = {};
    const changedFields = [];

    for (const key of Object.keys(schema.fields)) {
        const oldVal = oldState?.[key];
        const newVal = newState?.[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            delta[key] = { from: oldVal, to: newVal };
            changedFields.push(key);
        }
    }

    return { delta, changedFields };
}

function applyStateDelta(baseState, deltaData) {
    const state = { ...baseState };
    for (const [key, change] of Object.entries(deltaData)) {
        if (change === null || change === undefined) continue;
        if (change && typeof change === 'object' && 'to' in change) {
            state[key] = change.to;
        } else {
            state[key] = change;
        }
    }
    return state;
}

function buildLabelToKeyMap(schema) {
    const map = {};
    for (const [key, field] of Object.entries(schema.fields)) {
        if (field.label) map[field.label] = key;
        map[key] = key;
    }
    return map;
}

function normalizeDeltaKeys(delta, schema) {
    const labelMap = buildLabelToKeyMap(schema);
    const normalized = {};
    for (const [key, value] of Object.entries(delta)) {
        const mappedKey = labelMap[key] || key;
        normalized[mappedKey] = value;
    }
    return normalized;
}

module.exports = {
    formatStateForPrompt,
    createStateDelta,
    applyStateDelta,
    buildLabelToKeyMap,
    normalizeDeltaKeys
};
