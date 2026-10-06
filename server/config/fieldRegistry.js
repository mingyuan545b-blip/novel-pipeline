'use strict';

/**
 * fieldRegistry.js — 字段词汇表注册表（R1，唯一对齐点）
 *
 * 目标：让「生成端 prompt 标签 / 校验端 requiredFields / 提取端正则 / 实体投影键 / 契约键」
 * 共用同一份字段定义与别名。任何一方漂移都会被 scripts/audit-vocabulary-consistency.js 拦截。
 *
 * 单一数据来源：
 *   · materialDepthSpec.FIELD_SPECS          —— 字段约束（minChars/qualityHints）
 *   · materialDepthRequirements.DEPTH_REQUIREMENTS —— 类型×深度 必填标签
 * 本文件只补充两层此前"缺失/对不上"的信息：**别名**与**落点映射**。
 */
const { FIELD_SPECS, ROLE_LEVEL_TO_DEPTH, extractFieldValue } = require('./materialDepthSpec');
const { DEPTH_REQUIREMENTS } = require('./materialDepthRequirements');

// 别名：素材正文里的等价写法（校验与提取共用口径，避免"要【标志性细节】、产出写【标志性动作】"误判）
const FIELD_ALIASES = Object.freeze({
    '身份/职位': ['身份', '职位'],
    '说话语气': ['方言/语感', '方言', '口音', '说话风格', '说话风味', '语言风格', '语气', '口吻'],
    '标志性细节': ['标志性动作', '标志细节', '辨识特征', '日常习惯', '行为习惯'],
    '核心欲望': ['欲望', '渴望'],
    '内在矛盾': ['内心矛盾', '矛盾冲突'],
    '行为模式': ['关键行为', '性格表现'],
    '成长弧光': ['命运弧光', '弧光'],
    '人格魅力': ['魅力点', '核心魅力'],
    '哲学观': ['哲学理念', '核心信念', '价值观'],
    '金句库': ['金句', '代表性金句'],
    '出场设计': ['出场方式', '出场场景', '首次出场'],
    '高光场景': ['高光时刻', '名场面'],
    '代价/限制': ['代价', '限制'],
    '升级条件': ['进阶条件', '突破条件'],
    '功能': ['效果', '作用'],
    '视觉特征': ['环境描写', '场景描写'],
});

// 落点映射：字段 → 实体中心 / KV(stateJson) / PG 列。
// 三者要么同时给出，要么整体缺省（不要臆造）。pgColumn 为空表示落在 entities.profile JSON 内。
const FIELD_MAPPINGS = Object.freeze({
    '身份/职位': { entityKey: 'position', stateJsonKey: 'position', pgColumn: 'position' },
    '性格': { entityKey: 'personality', stateJsonKey: 'personality', pgColumn: 'personality' },
    '说话语气': { entityKey: 'speakingTone', stateJsonKey: 'speakingTone', pgColumn: 'speakingTone' },
    '标志性细节': { entityKey: 'signatureDetail', stateJsonKey: 'signatureDetail', pgColumn: 'signatureDetail' },
    '标志性动作': { entityKey: 'signatureDetail', stateJsonKey: 'signatureDetail', pgColumn: 'signatureDetail' },
    '核心欲望': { entityKey: 'profile.desire', stateJsonKey: 'desire', pgColumn: null },
    '内在矛盾': { entityKey: 'profile.innerConflict', stateJsonKey: 'innerConflict', pgColumn: null },
    '成长弧光': { entityKey: 'profile.fateArc', stateJsonKey: 'fateArc', pgColumn: null },
    '人格魅力': { entityKey: 'charisma', stateJsonKey: 'charisma', pgColumn: null },
    '哲学观': { entityKey: 'philosophy', stateJsonKey: 'philosophy', pgColumn: null },
    '金句库': { entityKey: 'quoteLibrary', stateJsonKey: 'quoteLibrary', pgColumn: null },
    '出场设计': { entityKey: 'entranceDesign', stateJsonKey: 'entranceDesign', pgColumn: null },
    '高光场景': { entityKey: 'highlightScenes', stateJsonKey: 'highlightScenes', pgColumn: null },
});

// 生成端提示语（追加到题材 prompt tags，保证"校验要什么、prompt 就说什么"）
const PROMPT_HINTS = Object.freeze({
    '身份/职位': '在故事世界中的位置',
    '性格': '至少2-3个性格特征词+1段行为表现',
    '说话语气': '声音特征+语言习惯（如冷淡/温和/尖刻）',
    '标志性细节': '习惯动作/随身物品/外貌特征等辨识点',
    '核心欲望': '角色最深层想要什么',
    '内在矛盾': '内心的矛盾冲突',
    '行为模式': '面对问题的典型反应方式',
    '成长弧光': '从开头到结尾的性格/能力变化轨迹',
    '标志性动作': '招牌动作或口头禅',
    '人格魅力': '核心魅力点（至少2个特质）',
    '哲学观': '核心信念与价值观（至少1句）',
    '金句库': '3-5句"场景：金句"',
    '出场设计': '首次出场方式+关键出场场景',
});

/** 字段别名（含自身） */
function aliasesOf(label) {
    return [label, ...(FIELD_ALIASES[label] || [])];
}

/** 提取：先按本名，再按别名（读写同口径） */
function extractFieldWithAliases(content, label) {
    for (const name of aliasesOf(label)) {
        const v = extractFieldValue(content, name);
        if (v) return v;
    }
    return '';
}

/** 某类型×深度 的必填标签 */
function requiredLabels(type, depth) {
    return DEPTH_REQUIREMENTS[type]?.[depth]?.requiredFields || [];
}

/** 角色等级 → 必填标签（用于生成端 prompt tags） */
function promptFieldTags(roleLevel) {
    const depth = ROLE_LEVEL_TO_DEPTH[roleLevel] || ROLE_LEVEL_TO_DEPTH.npc;
    return requiredLabels('character', depth).map(l => `【${l}】${PROMPT_HINTS[l] || ''}`.trim());
}

module.exports = {
    FIELD_SPECS,
    FIELD_ALIASES,
    FIELD_MAPPINGS,
    PROMPT_HINTS,
    DEPTH_REQUIREMENTS,
    ROLE_LEVEL_TO_DEPTH,
    aliasesOf,
    extractFieldWithAliases,
    requiredLabels,
    promptFieldTags,
};
