/**
 * worldConstants.js — 前端世界域常量映射
 * 与后端 server/services/worldConstants.js 保持同步
 */

export const WORLD_TYPES = {
    main:    { id: 'main',    label: '主世界',   icon: '🌍' },
    sub:     { id: 'sub',     label: '小世界',   icon: '🌑' },
    pocket:  { id: 'pocket',  label: '口袋世界', icon: '📦' },
    mirror:  { id: 'mirror',  label: '镜像世界', icon: '🪞' },
    secret:  { id: 'secret',  label: '秘境',     icon: '🏔' },
    dream:   { id: 'dream',   label: '梦境世界', icon: '💤' }
};

export const POWER_SYSTEMS = {
    cultivation:      { id: 'cultivation',     label: '修炼体系',   icon: '🧘' },
    immortal:         { id: 'immortal',        label: '修仙体系',   icon: '⚔' },
    tech:             { id: 'tech',            label: '科技体系',   icon: '🔧' },
    magic:            { id: 'magic',           label: '魔法体系',   icon: '✨' },
    'ancient-ritual': { id: 'ancient-ritual',  label: '古老祭祀',   icon: '🕯' },
    martial:          { id: 'martial',         label: '武道体系',   icon: '👊' },
    psionic:          { id: 'psionic',         label: '异能体系',   icon: '🧠' },
    faith:            { id: 'faith',           label: '信仰体系',   icon: '🙏' }
};

export const TECH_LEVELS = {
    none:    { id: 'none',    label: '无科技',   icon: '❌' },
    low:     { id: 'low',     label: '低科技',   icon: '🏺' },
    med:     { id: 'med',     label: '中科技',   icon: '⚙' },
    high:    { id: 'high',    label: '高科技',   icon: '📱' },
    future:  { id: 'future',  label: '未来科技', icon: '🚀' }
};

export const DANGER_LEVELS = {
    safe:    { id: 'safe',    label: '安全', icon: '🟢' },
    low:     { id: 'low',     label: '低危', icon: '🟡' },
    med:     { id: 'med',     label: '中危', icon: '🟠' },
    high:    { id: 'high',    label: '高危', icon: '🔴' },
    lethal:  { id: 'lethal',  label: '致命', icon: '💀' }
};

export const FACTION_STATUS = {
    active:      { id: 'active',      label: '活跃',   icon: '✅' },
    declining:   { id: 'declining',   label: '衰退',   icon: '📉' },
    destroyed:   { id: 'destroyed',   label: '覆灭',   icon: '💀' },
    hidden:      { id: 'hidden',      label: '隐世',   icon: '👻' },
    emerging:    { id: 'emerging',    label: '新兴',   icon: '🌱' }
};

/** 副本带出策略（与后端 server/services/worldConstants.js 同步） */
export const CARRY_OUT_POLICIES = {
    locked:     { id: 'locked',     label: '不可带出', icon: '🔒' },
    native:     { id: 'native',     label: '原生物可带出', icon: '✅' },
    medium:     { id: 'medium',     label: '需媒介', icon: '🪢' },
    item:       { id: 'item',       label: '需特殊道具', icon: '🗝' },
    permission: { id: 'permission', label: '需渠道权限', icon: '🎫' },
    plot:       { id: 'plot',       label: '需剧情许可', icon: '🎬' }
};

/** 带出策略中文标签（未知原样返回） */
export function getCarryOutLabel(policy) {
    return CARRY_OUT_POLICIES[policy]?.label || policy || '未定义';
}

/** 获取武力体系标签数组 */
export function getPowerSystemLabels(systems) {
    if (!Array.isArray(systems)) return [];
    return systems.map(s => POWER_SYSTEMS[s]?.label || s).filter(Boolean);
}

/** 获取世界类型标签 */
export function getWorldTypeLabel(type) {
    return WORLD_TYPES[type]?.label || type || '';
}
