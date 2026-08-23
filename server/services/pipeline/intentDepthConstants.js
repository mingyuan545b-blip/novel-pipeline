/**
 * intentDepthConstants.js — 意图深度映射常量
 * 关键词列表 + 深度提升规则表
 */

/** 关系冲突关键词 → 触发relationship深度提升 */
const RELATIONSHIP_KEYWORDS = [
    '冲突', '对峙', '和解', '误解', '信任', '背叛', '告白', '分离', '重逢',
    '依赖', '疏离', '试探', '守护', '救赎', '暧昧', '纠缠', '牵绊', '对立',
    '合作', '利用', '保护', '牺牲', '选择', '放弃', '坚持', '等待', '逃离',
];

/** 世界观关键词 → 触发worldview深度提升 */
const WORLDVIEW_KEYWORDS = [
    '设定', '体系', '规则', '法则', '禁忌', '秘境', '传承', '血脉', '契约',
    '境界', '修炼', '灵气', '天赋', '觉醒', '封印', '禁术', '秘法', '试炼',
    '规则怪谈', '禁忌规则', '死亡条件', '存活条件', '安全区', '危险区',
    '系统', '面板', '属性', '技能', '升级', '副本', '任务', '积分',
    '门派', '学院', '宗门', '势力', '组织', '联盟', '阵营',
];

/** 战斗关键词 → 触发character-combat/power-system深度提升 */
const COMBAT_KEYWORDS = [
    '战斗', '对决', '交手', '过招', '厮杀', '搏斗', '围攻', '突围',
    '招式', '技能', '法术', '术式', '符箓', '阵法', '禁术',
    '实力', '战力', '境界', '突破', '压制', '反杀',
];

/** 成长关键词 → 触发growth-history深度提升 */
const GROWTH_KEYWORDS = [
    '成长', '蜕变', '突破', '觉醒', '进化', '升级',
    '回忆', '过去', '童年', '经历', '往事', '记忆',
    '第一次', '学会', '领悟', '掌握', '超越',
];

/** 深度提升规则表 */
const INTENT_DEPTH_RULES = {
    character: {
        mustKeep:     { minDepth: 'L3', priorityBoost: 2, reason: '意图Must Keep提及角色' },
        mustAvoid:    { minDepth: 'L3', priorityBoost: 2, reason: '意图Must Avoid提及角色' },
        conflict:     { minDepth: 'L3', priorityBoost: 1, reason: '冲突设计提及角色' },
        hookAdvance:  { minDepth: 'L2', priorityBoost: 1, reason: '伏笔推进涉及角色' },
        hookResolve:  { minDepth: 'L3', priorityBoost: 2, reason: '伏笔回收涉及角色' },
    },
    relationship: {
        conflictDesign: { minDepth: 'L3', priorityBoost: 1, reason: '冲突设计涉及关系' },
        mustKeep:       { minDepth: 'L2', priorityBoost: 1, reason: '意图Must Keep涉及关系' },
    },
    foreshadowing: {
        hookAdvance: { minDepth: 'L3', priorityBoost: 2, reason: '伏笔推进中' },
        hookResolve: { minDepth: 'L3', priorityBoost: 3, reason: '伏笔回收必须完整' },
    },
    worldview: {
        mustKeep:       { minDepth: 'L3', priorityBoost: 1, reason: '意图Must Keep涉及世界观' },
        conflictDesign: { minDepth: 'L2', priorityBoost: 1, reason: '冲突设计涉及世界观' },
    },
    'power-system': {
        combat:    { minDepth: 'L3', priorityBoost: 2, reason: '战斗场景需要完整体系' },
        worldview: { minDepth: 'L2', priorityBoost: 1, reason: '世界观涉及体系' },
    },
    'character-combat': {
        combat: { minDepth: 'L3', priorityBoost: 2, reason: '战斗场景需要战斗配置' },
    },
    institution: {
        worldview: { minDepth: 'L2', priorityBoost: 1, reason: '世界观涉及势力' },
    },
    'growth-history': {
        growth: { minDepth: 'L3', priorityBoost: 2, reason: '成长场景需要成长记录' },
    },
};

module.exports = {
    RELATIONSHIP_KEYWORDS,
    WORLDVIEW_KEYWORDS,
    COMBAT_KEYWORDS,
    GROWTH_KEYWORDS,
    INTENT_DEPTH_RULES,
};
