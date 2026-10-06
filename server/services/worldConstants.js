/**
 * worldConstants.js — 世界域常量定义
 *
 * 所有世界属性枚举集中管理，禁止硬编码。
 * 后端service和前端UI都从这里读取。
 */

/** 世界类型 */
const WORLD_TYPES = Object.freeze({
    main:    { id: 'main',    label: '主世界',   icon: '🌍', desc: '故事主要发生的世界' },
    sub:     { id: 'sub',     label: '小世界',   icon: '🌑', desc: '副本/异空间/平行世界' },
    pocket:  { id: 'pocket',  label: '口袋世界', icon: '📦', desc: '储物空间/内世界' },
    mirror:  { id: 'mirror',  label: '镜像世界', icon: '🪞', desc: '主世界的镜像/倒影' },
    secret:  { id: 'secret',  label: '秘境',     icon: '🏔', desc: '隐藏空间/上古遗迹' },
    dream:   { id: 'dream',   label: '梦境世界', icon: '💤', desc: '梦境/幻境' }
});

/** 武力体系（多选，一个世界可同时有多种） */
const POWER_SYSTEMS = Object.freeze({
    cultivation:    { id: 'cultivation',   label: '修炼体系', icon: '🧘', desc: '武修/灵修/真气修炼' },
    immortal:       { id: 'immortal',      label: '修仙体系', icon: '⚔',  desc: '仙侠/渡劫/飞升' },
    tech:           { id: 'tech',          label: '科技体系', icon: '🔧', desc: '科幻/机甲/赛博' },
    magic:          { id: 'magic',         label: '魔法体系', icon: '✨', desc: '西幻/元素/法术' },
    'ancient-ritual': { id: 'ancient-ritual', label: '古老祭祀', icon: '🕯', desc: '巫术/神降/血祭' },
    martial:        { id: 'martial',       label: '武道体系', icon: '👊', desc: '武侠/拳脚/兵器' },
    psionic:        { id: 'psionic',       label: '异能体系', icon: '🧠', desc: '超能力/精神力' },
    faith:          { id: 'faith',         label: '信仰体系', icon: '🙏', desc: '神术/圣光/教廷' }
});

/** 科技水平 */
const TECH_LEVELS = Object.freeze({
    none:    { id: 'none',    label: '无科技',   icon: '❌', desc: '纯超自然/原始' },
    low:     { id: 'low',     label: '低科技',   icon: '🏺', desc: '古代/冷兵器' },
    med:     { id: 'med',     label: '中科技',   icon: '⚙',  desc: '近代/蒸汽/电气' },
    high:    { id: 'high',    label: '高科技',   icon: '📱', desc: '现代/近未来' },
    future:  { id: 'future',  label: '未来科技', icon: '🚀', desc: '星际/量子/AI' }
});

/** 危险等级 */
const DANGER_LEVELS = Object.freeze({
    safe:    { id: 'safe',    label: '安全',   icon: '🟢', desc: '日常活动无风险' },
    low:     { id: 'low',     label: '低危',   icon: '🟡', desc: '偶有冲突' },
    med:     { id: 'med',     label: '中危',   icon: '🟠', desc: '常驻敌对势力' },
    high:    { id: 'high',    label: '高危',   icon: '🔴', desc: '随时可能丧命' },
    lethal:  { id: 'lethal',  label: '致命',   icon: '💀', desc: '九死一生' }
});

/** 势力状态 */
const FACTION_STATUS = Object.freeze({
    active:      { id: 'active',      label: '活跃',   icon: '✅' },
    declining:   { id: 'declining',   label: '衰退',   icon: '📉' },
    destroyed:   { id: 'destroyed',   label: '覆灭',   icon: '💀' },
    hidden:      { id: 'hidden',      label: '隐世',   icon: '👻' },
    emerging:    { id: 'emerging',    label: '新兴',   icon: '🌱' }
});

/**
 * 副本带出策略（carryOutPolicy）——主角把副本内的 NPC/宠物/道具带出副本的条件。
 * 见 docs/design/实体中心-副本归属与带出机制.md
 */
const CARRY_OUT_POLICIES = Object.freeze({
    locked:     { id: 'locked',     label: '不可带出', desc: '副本内绑定生效，离开即失/回收' },
    native:     { id: 'native',     label: '原生物可带出', desc: '无门槛，默认策略' },
    medium:     { id: 'medium',     label: '需媒介', desc: '需信物/契约/容器等媒介绑定' },
    item:       { id: 'item',       label: '需特殊道具', desc: '需钥匙/通行证等特殊道具' },
    permission: { id: 'permission', label: '需渠道权限', desc: '需势力/身份/等级等渠道权限' },
    plot:       { id: 'plot',       label: '需剧情许可', desc: '需一次性剧情授权/付出代价' }
});

/**
 * 构建扩展后的默认世界对象
 * @param {object} overrides - 覆盖字段
 * @returns {object} 完整的world对象
 */
function buildWorld(overrides = {}) {
    return {
        id: 'main-world',
        name: '主世界',
        color: '#00c8ff',
        type: 'main',
        isDefault: true,
        // 核心固有属性（嵌入world对象）
        powerSystem: ['cultivation'],     // 武力体系（多选数组）
        culture: '',                      // 文化描述
        techLevel: 'med',                 // 科技水平
        rules: '',                        // 世界规则/物理法则
        dangerLevel: 'low',               // 危险等级
        entryMethod: '自然进入',           // 进入方式
        exitMethod: '自然离开',            // 离开方式
        carryOutPolicy: 'native',         // 带出策略（见 CARRY_OUT_POLICIES）
        channelTag: '',                   // 渠道标签：出副本必带凭据（副本建议必填，缺则视同 locked）
        description: '',                  // 世界简介
        ...overrides
    };
}

/** 验证world对象的必填字段 */
function validateWorld(world) {
    const errors = [];
    if (!world.id) errors.push('id必填');
    if (!world.name) errors.push('name必填');
    if (!WORLD_TYPES[world.type]) errors.push(`type必须是: ${Object.keys(WORLD_TYPES).join('/')}`);
    if (world.techLevel && !TECH_LEVELS[world.techLevel]) errors.push(`techLevel无效: ${world.techLevel}`);
    if (world.dangerLevel && !DANGER_LEVELS[world.dangerLevel]) errors.push(`dangerLevel无效: ${world.dangerLevel}`);
    if (world.carryOutPolicy && !CARRY_OUT_POLICIES[world.carryOutPolicy]) errors.push(`carryOutPolicy无效: ${world.carryOutPolicy}`);
    if (Array.isArray(world.powerSystem)) {
        const invalid = world.powerSystem.filter(p => !POWER_SYSTEMS[p]);
        if (invalid.length > 0) errors.push(`powerSystem含无效值: ${invalid.join(',')}`);
    }
    return errors;
}

module.exports = {
    WORLD_TYPES,
    POWER_SYSTEMS,
    TECH_LEVELS,
    DANGER_LEVELS,
    FACTION_STATUS,
    CARRY_OUT_POLICIES,
    buildWorld,
    validateWorld
};
