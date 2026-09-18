/**
 * contextDecisionTables.js — 场景/阶段/预算规则表（纯数据）
 * 从 contextDecisionRules.js 拆出（2026-09-18，原文件超200行限制）。
 * 由 contextDecisionRules.js 统一转出，消费方仍从原路径引用。
 */
'use strict';

/** 章节在故事中的位置阶段（短篇：绝对章号；长篇改用比例，见 PHASE_RATIOS） */
const CHAPTER_PHASES = {
    opening:     { range: [1, 5],   label: '开篇期' },
    development: { range: [6, 50],  label: '发展期' },
    climax:      { range: [51, 80], label: '高潮期' },
    resolution:  { range: [81, 99], label: '收尾期' },
};

/**
 * 长篇章阶段比例（三五百万字用）
 * 绝对章号表只覆盖 1-99 章，超过后全部回落 development → 长程节奏/深度调节失效。
 * 因此当项目目标章数 >= longNovelThreshold 时改按"完成比例"划分阶段。
 */
const PHASE_RATIOS = {
    longNovelThreshold: 100,
    opening: 0.05,     // 前5%
    development: 0.75, // 5%~75%
    climax: 0.95,      // 75%~95%
    // 其余为 resolution
};

/** 场景类型关键词映射（收录常见同义/变体，提高召回；命中1个即算该场景） */
const SCENE_KEYWORDS = {
    combat: [
        '战斗', '交手', '对决', '厮杀', '围攻', '破阵', '反击', '出手', '杀招',
        '激战', '大战', '决战', '血战', '搏杀', '击杀', '突袭', '追杀', '伏击',
        '开战', '迎战', '迎敌', '动手', '打斗', '交锋', '拼杀', '死战', '斗法',
    ],
    social: [
        '宴会', '聚会', '谈判', '结盟', '拜访', '茶话', '交流', '对话',
        '议事', '会面', '酒宴', '会谈', '商讨', '宴请', '结交', '觐见',
    ],
    exploration: [
        '探索', '发现', '遗迹', '秘境', '寻宝', '深入', '迷宫', '禁地',
        '探查', '勘察', '古墓', '洞窟', '密道', '寻路', '跋涉', '探险',
    ],
    revelation: [
        '真相', '揭秘', '身世', '阴谋', '背叛', '伏笔', '反转', '揭露',
        '隐情', '谜团', '线索', '幕后', '真相大白', '识破', '察觉异常',
    ],
    training: [
        '修炼', '突破', '悟道', '闭关', '炼丹', '炼器', '参悟', '进阶',
        '练功', '修行', '打坐', '淬体', '感悟', '功法大成', '苦修', '研习',
    ],
    emotional: [
        '告白', '离别', '重逢', '牺牲', '守护', '思念', '回忆', '承诺',
        '告别', '情愫', '深情', '求婚', '心动', '不舍', '牵挂', '愧疚',
    ],
};

/** 章节位置对素材深度的调整规则 */
const PHASE_DEPTH_ADJUSTMENTS = {
    opening: {
        worldview:    { depthBoost: 1, reason: '开篇需建立世界观' },
        character:    { depthBoost: 0, reason: '角色逐步引入' },
        powerSystem:  { depthBoost: 1, reason: '开篇需介绍体系' },
        faction:      { depthBoost: 1, reason: '开篇需展示势力' },
    },
    development: {
        worldview:    { depthBoost: 0, reason: '世界观已建立' },
        character:    { depthBoost: 1, reason: '发展期需角色深度' },
        powerSystem:  { depthBoost: 0, reason: '体系已介绍' },
        faction:      { depthBoost: 0, reason: '势力已展示' },
    },
    climax: {
        worldview:    { depthBoost: -1, reason: '高潮聚焦角色' },
        character:    { depthBoost: 1, reason: '高潮需角色完整信息' },
        powerSystem:  { depthBoost: 1, reason: '高潮可能涉及战力' },
        faction:      { depthBoost: -1, reason: '高潮减少势力信息' },
    },
    resolution: {
        worldview:    { depthBoost: -1, reason: '收尾减少世界观' },
        character:    { depthBoost: 0, reason: '收尾保持角色深度' },
        powerSystem:  { depthBoost: -1, reason: '收尾减少体系' },
        faction:      { depthBoost: -1, reason: '收尾减少势力' },
    },
};

/** 场景类型对素材的优先级调整
 *  双重作用：①预算内优先级提升 ②相关性门控的"场景命中"依据（见 contextRelevance.js）
 *  因此这里列出的类型在其场景章节中不会被丢弃。
 */
const SCENE_PRIORITY_BOOSTS = {
    combat:      { 'power-system': 2, equipment: 2, 'character-combat': 2, character: 1, location: 1 },
    social:      { character: 2, faction: 1, 'famous-scene': 1, institution: 1, 'knowledge-access': 1 },
    exploration: { geography: 2, 'sub-plane': 2, faction: 1, location: 1, 'knowledge-access': 1 },
    revelation:  { foreshadowing: 2, character: 1, 'knowledge-access': 1, institution: 1 },
    training:    { 'power-system': 2, equipment: 1, character: 1, 'growth-history': 1, 'knowledge-access': 1 },
    emotional:   { character: 2, foreshadowing: 1, 'growth-history': 1, 'famous-scene': 1 },
};

/** 预算分配比例（按素材类型） */
const BUDGET_RATIOS = {
    character:     0.35,
    worldview:     0.10,
    'power-system': 0.08,
    equipment:     0.05,
    faction:       0.05,
    foreshadowing: 0.08,
    'sub-plane':   0.05,
    geography:     0.04,
    'knowledge-access': 0.10,
    other:         0.10,
};


module.exports = {
    CHAPTER_PHASES, PHASE_RATIOS, SCENE_KEYWORDS, PHASE_DEPTH_ADJUSTMENTS,
    SCENE_PRIORITY_BOOSTS, BUDGET_RATIOS,
};
