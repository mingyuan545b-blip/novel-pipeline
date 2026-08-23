/**
 * crossWorldTraceConstants — 前端跨世界物品溯源常量
 * 与后端server/services/crossWorldTraceConstants.js保持同步
 */

export const ORIGIN_METHODS = Object.freeze({
    defeated:       { id: 'defeated',       label: '击败夺取', icon: '⚔',  desc: '战胜敌人后夺取' },
    gifted:         { id: 'gifted',         label: '获赠',     icon: '🎁', desc: 'NPC赠送' },
    picked:         { id: 'picked',         label: '拾取',     icon: '📦', desc: '捡拾获得' },
    'quest-reward': { id: 'quest-reward',   label: '任务奖励', icon: '🏅', desc: '完成任务获得' },
    crafted:        { id: 'crafted',        label: '炼制',     icon: '🔨', desc: '自己炼制/打造' },
    inherited:      { id: 'inherited',      label: '传承',     icon: '📜', desc: '前辈传承' },
    purchased:      { id: 'purchased',      label: '购买',     icon: '💰', desc: '购买获得' },
    found:          { id: 'found',          label: '探索发现', icon: '🗺', desc: '探索秘境发现' }
});

export const TRACE_ACTIONS = Object.freeze({
    acquired:     { id: 'acquired',     label: '获取',   icon: '✓', color: 'green' },
    transitioned: { id: 'transitioned', label: '跨世界', icon: '→', color: 'blue' },
    transformed:  { id: 'transformed',  label: '转化',   icon: '✨', color: 'purple' },
    lost:         { id: 'lost',         label: '遗失',   icon: '✗', color: 'red' },
    destroyed:    { id: 'destroyed',    label: '损毁',   icon: '💥', color: 'red' },
    sealed:       { id: 'sealed',       label: '封印',   icon: '🔒', color: 'orange' }
});

export const TRACE_ENTITY_TYPES = Object.freeze({
    equipment:            { id: 'equipment',            label: '装备',     icon: '⚔' },
    technique:            { id: 'technique',            label: '功法',     icon: '📖' },
    'cultivation-method': { id: 'cultivation-method',   label: '修炼法',   icon: '🧘' },
    'power-system':       { id: 'power-system',         label: '武力体系', icon: '💎' },
    treasure:             { id: 'treasure',             label: '法宝',     icon: '✨' }
});

export function getOriginMethodLabel(id) {
    return ORIGIN_METHODS[id]?.label || id;
}
export function getOriginMethodIcon(id) {
    return ORIGIN_METHODS[id]?.icon || '❓';
}
export function getTraceActionMeta(id) {
    return TRACE_ACTIONS[id] || { id, label: id, icon: '❓', color: 'gray' };
}
export function getEntityTypeMeta(id) {
    return TRACE_ENTITY_TYPES[id] || { id, label: id, icon: '📋' };
}
