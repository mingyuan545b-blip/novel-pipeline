/**
 * 实体生命周期状态机
 *
 * 角色: active → injured → comatose → dead → archived
 *       ↘ missing ↗ departed
 *
 * 装备: active → damaged → broken → destroyed
 *       ↘ lost ↗
 *
 * 功法: active → deprecated → lost
 *
 * 宠物: active → injured → dead → archived
 *       ↘ lost ↗
 *
 * 仆人: active → injured → dead → archived
 *       ↘ departed ↗
 *
 * 关系: active → strained → broken → dissolved
 */

/** 角色生命周期状态 */
const CHARACTER_LIFECYCLE = {
    active:    { label: '活跃',   color: '#00ff88', order: 0, canAct: true,  visibleToWriter: true,  visibleToReviewer: true },
    injured:   { label: '受伤',   color: '#ffaa00', order: 1, canAct: true,  visibleToWriter: true,  visibleToReviewer: true },
    comatose:  { label: '昏迷',   color: '#ff6600', order: 2, canAct: false, visibleToWriter: true,  visibleToReviewer: true },
    missing:   { label: '失踪',   color: '#888888', order: 2, canAct: false, visibleToWriter: false, visibleToReviewer: true },
    departed:  { label: '离场',   color: '#6666cc', order: 3, canAct: false, visibleToWriter: false, visibleToReviewer: true },
    dead:      { label: '死亡',   color: '#ff0000', order: 4, canAct: false, visibleToWriter: false, visibleToReviewer: true },
    archived:  { label: '归档',   color: '#444444', order: 5, canAct: false, visibleToWriter: false, visibleToReviewer: false },
};

/** 角色状态合法转换 */
const CHARACTER_TRANSITIONS = {
    active:   ['injured', 'missing', 'departed', 'dead'],
    injured:  ['active', 'comatose', 'dead'],
    comatose: ['active', 'injured', 'dead'],
    missing:  ['active', 'dead', 'departed'],
    departed: ['active'],
    dead:     ['archived'],
    archived: [],
};

/** 装备/道具生命周期状态 */
const EQUIPMENT_LIFECYCLE = {
    active:    { label: '完好',   order: 0 },
    damaged:   { label: '损坏',   order: 1 },
    broken:    { label: '破碎',   order: 2 },
    lost:      { label: '遗失',   order: 2 },
    destroyed: { label: '摧毁',   order: 3 },
};

const EQUIPMENT_TRANSITIONS = {
    active:    ['damaged', 'lost', 'destroyed'],
    damaged:   ['active', 'broken', 'destroyed'],
    broken:    ['damaged', 'destroyed'],
    lost:      ['active'],
    destroyed: [],
};

/** 功法生命周期状态 */
const TECHNIQUE_LIFECYCLE = {
    active:     { label: '修炼中', order: 0 },
    deprecated: { label: '已淘汰', order: 1 },
    lost:       { label: '已失传', order: 2 },
};

const TECHNIQUE_TRANSITIONS = {
    active:     ['deprecated', 'lost'],
    deprecated: ['active', 'lost'],
    lost:       [],
};

/** 关系生命周期状态 */
const RELATION_LIFECYCLE = {
    active:   { label: '正常', order: 0 },
    strained: { label: '紧张', order: 1 },
    broken:   { label: '破裂', order: 2 },
    dissolved:{ label: '解除', order: 3 },
};

const RELATION_TRANSITIONS = {
    active:   ['strained', 'broken', 'dissolved'],
    strained: ['active', 'broken', 'dissolved'],
    broken:   ['strained', 'dissolved'],
    dissolved:[],
};

/** 根据实体类型获取对应的生命周期定义 */
function getLifecycleForType(entityType, bindType) {
    if (entityType === 'character') return { states: CHARACTER_LIFECYCLE, transitions: CHARACTER_TRANSITIONS };
    if (bindType === 'technique') return { states: TECHNIQUE_LIFECYCLE, transitions: TECHNIQUE_TRANSITIONS };
    if (bindType === 'pet' || bindType === 'servant') return { states: CHARACTER_LIFECYCLE, transitions: CHARACTER_TRANSITIONS };
    return { states: EQUIPMENT_LIFECYCLE, transitions: EQUIPMENT_TRANSITIONS };
}

/** 验证状态转换是否合法 */
function isValidTransition(entityType, fromState, toState, bindType) {
    const { transitions } = getLifecycleForType(entityType, bindType);
    const allowed = transitions[fromState];
    return allowed ? allowed.includes(toState) : false;
}

/** 获取Agent可见性过滤 */
function getVisibilityFilter(agentType) {
    if (agentType === 'writer') return (state) => CHARACTER_LIFECYCLE[state]?.visibleToWriter ?? false;
    if (agentType === 'reviewer') return (state) => CHARACTER_LIFECYCLE[state]?.visibleToReviewer ?? false;
    return () => true;
}

/** 旧数据兼容：isActive → lifecycleState */
function migrateIsActive(isActive, archived) {
    if (archived && archived !== '') return 'archived';
    if (isActive === false) return 'archived';
    return 'active';
}

module.exports = {
    CHARACTER_LIFECYCLE, CHARACTER_TRANSITIONS,
    EQUIPMENT_LIFECYCLE, EQUIPMENT_TRANSITIONS,
    TECHNIQUE_LIFECYCLE, TECHNIQUE_TRANSITIONS,
    RELATION_LIFECYCLE, RELATION_TRANSITIONS,
    getLifecycleForType, isValidTransition, getVisibilityFilter, migrateIsActive,
};
