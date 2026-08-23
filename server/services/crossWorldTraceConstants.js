/**
 * crossWorldTraceConstants — 跨世界物品溯源常量
 *
 * 用途：主角从小世界获取的装备/功法/法宝带往主世界时，需记录来源世界+获取章节+获取方式+跨世界轨迹
 * 前后端共享，禁止硬编码
 */

/** 获取方式枚举（物品最初如何被主角获得） */
const ORIGIN_METHODS = Object.freeze({
    defeated:       { id: 'defeated',       label: '击败夺取', icon: '⚔',  desc: '战胜敌人后夺取' },
    gifted:         { id: 'gifted',         label: '获赠',     icon: '🎁', desc: 'NPC赠送' },
    picked:         { id: 'picked',         label: '拾取',     icon: '📦', desc: '捡拾获得' },
    'quest-reward': { id: 'quest-reward',   label: '任务奖励', icon: '🏅', desc: '完成任务获得' },
    crafted:        { id: 'crafted',        label: '炼制',     icon: '🔨', desc: '自己炼制/打造' },
    inherited:      { id: 'inherited',      label: '传承',     icon: '📜', desc: '前辈传承' },
    purchased:      { id: 'purchased',      label: '购买',     icon: '💰', desc: '购买获得' },
    found:          { id: 'found',          label: '探索发现', icon: '🗺', desc: '探索秘境发现' }
});

/** 轨迹动作枚举（每次跨世界/状态变更事件） */
const TRACE_ACTIONS = Object.freeze({
    acquired:     { id: 'acquired',     label: '获取',   icon: '✓', color: 'green' },
    transitioned: { id: 'transitioned', label: '跨世界', icon: '→', color: 'blue' },
    transformed:  { id: 'transformed',  label: '转化',   icon: '✨', color: 'purple' },
    lost:         { id: 'lost',         label: '遗失',   icon: '✗', color: 'red' },
    destroyed:    { id: 'destroyed',    label: '损毁',   icon: '💥', color: 'red' },
    sealed:       { id: 'sealed',       label: '封印',   icon: '🔒', color: 'orange' }
});

/** 实体类型枚举（可被溯源的物品类型） */
const TRACE_ENTITY_TYPES = Object.freeze({
    equipment:            { id: 'equipment',            label: '装备',     icon: '⚔' },
    technique:            { id: 'technique',            label: '功法',     icon: '📖' },
    'cultivation-method': { id: 'cultivation-method',   label: '修炼法',   icon: '🧘' },
    'power-system':       { id: 'power-system',         label: '武力体系', icon: '💎' },
    treasure:             { id: 'treasure',             label: '法宝',     icon: '✨' }
});

/** 工厂函数：构造一条溯源记录的默认结构 */
function buildTrace(overrides = {}) {
    return {
        id: '',
        projectId: '',
        entityId: '',
        entityName: '',
        entityType: 'equipment',
        characterId: '',
        characterName: '',
        originWorldId: 'main-world',
        originWorldName: '主世界',
        originChapter: 0,
        originMethod: 'picked',
        currentWorldId: 'main-world',
        currentWorldName: '主世界',
        traceLog: [],  // [{ chapter, fromWorld, toWorld, action, note, timestamp }]
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides
    };
}

/** 校验溯源记录 */
function validateTrace(trace) {
    const errors = [];
    if (!trace.projectId) errors.push('projectId必填');
    if (!trace.entityId) errors.push('entityId必填');
    if (!trace.entityName) errors.push('entityName必填');
    if (!TRACE_ENTITY_TYPES[trace.entityType]) errors.push(`entityType无效: ${trace.entityType}`);
    if (!ORIGIN_METHODS[trace.originMethod]) errors.push(`originMethod无效: ${trace.originMethod}`);
    if (!Number.isInteger(trace.originChapter) || trace.originChapter < 0) errors.push('originChapter必须是非负整数');
    if (!trace.originWorldId) errors.push('originWorldId必填');
    if (!Array.isArray(trace.traceLog)) errors.push('traceLog必须是数组');
    return errors;
}

/** 向traceLog追加一条轨迹事件 */
function appendTraceEvent(trace, event) {
    if (!TRACE_ACTIONS[event.action]) {
        throw new Error(`无效的trace action: ${event.action}`);
    }
    const entry = {
        chapter: event.chapter || 0,
        fromWorld: event.fromWorld || '',
        toWorld: event.toWorld || '',
        action: event.action,
        note: event.note || '',
        timestamp: new Date().toISOString()
    };
    trace.traceLog = [...(trace.traceLog || []), entry];
    // 同步currentWorldId
    if (entry.toWorld) {
        trace.currentWorldId = entry.toWorld;
    }
    trace.updatedAt = new Date().toISOString();
    return trace;
}

module.exports = {
    ORIGIN_METHODS,
    TRACE_ACTIONS,
    TRACE_ENTITY_TYPES,
    buildTrace,
    validateTrace,
    appendTraceEvent
};
