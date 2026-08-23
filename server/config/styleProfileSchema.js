/**
 * styleProfile Schema - 字段名单一数据源（Single Source of Truth）
 *
 * 历史问题：styleProfile在多处生成，字段不一致
 *   - projectCreateHandler.js生成完整styleProfile（含povRule等7个约束字段）
 *   - outlineMaterialSaver.js生成缺失7个约束字段的styleProfile
 *   - 测试代码用极简变体{genreId}
 *
 * 根治方案：本文件定义标准字段名和必填字段，归一化函数负责补齐缺失字段
 */

// 标准字段名常量
const STYLE_PROFILE_FIELDS = Object.freeze({
    // 基础字段
    KEY: 'key',
    GENRE: 'genre',
    GENRE_PROFILE: 'genreProfile',
    STYLE: 'style',
    TONE: 'tone',
    POV: 'pov',
    NAMING_STYLE: 'namingStyle',
    NAMING_STYLE_INTENSITY: 'namingStyleIntensity',
    WORLDVIEW_TEMPLATE: 'worldviewTemplate',
    WORLDVIEW_TONE: 'worldviewTone',
    SYSTEM_PERSONA: 'systemPersona',
    REVIEW_FOCUS: 'reviewFocus',
    MATERIAL_FOCUS: 'materialFocus',
    CONSTRAINT_OVERRIDES: 'constraintOverrides',
    PROTAGONIST_NAME: 'protagonistName',
    LABEL: 'label',
    // 风格约束字段（从题材插件继承）
    POV_RULE: 'povRule',
    DIALOGUE_RULE: 'dialogueRule',
    BEHAVIOR_RULE: 'behaviorRule',
    TONE_RULE: 'toneRule',
    CHARACTER_REF_RULES: 'characterRefRules',
    NARRATIVE_DISTANCE: 'narrativeDistance',
    TITLE_RULE: 'titleRule'
});

// 必填字段（归一化后必须存在，缺失时用空字符串/空数组补齐）
const REQUIRED_FIELDS = Object.freeze([
    STYLE_PROFILE_FIELDS.KEY,
    STYLE_PROFILE_FIELDS.GENRE,
    STYLE_PROFILE_FIELDS.GENRE_PROFILE,
    STYLE_PROFILE_FIELDS.STYLE,
    STYLE_PROFILE_FIELDS.TONE,
    STYLE_PROFILE_FIELDS.POV
]);

// 风格约束字段（影响写作质量，缺失会导致约束注入失败）
const CONSTRAINT_FIELDS = Object.freeze([
    STYLE_PROFILE_FIELDS.POV_RULE,
    STYLE_PROFILE_FIELDS.DIALOGUE_RULE,
    STYLE_PROFILE_FIELDS.BEHAVIOR_RULE,
    STYLE_PROFILE_FIELDS.TONE_RULE,
    STYLE_PROFILE_FIELDS.CHARACTER_REF_RULES,
    STYLE_PROFILE_FIELDS.NARRATIVE_DISTANCE,
    STYLE_PROFILE_FIELDS.TITLE_RULE
]);

// 字段默认值（按字段类型）
const FIELD_DEFAULTS = Object.freeze({
    [STYLE_PROFILE_FIELDS.KEY]: '',
    [STYLE_PROFILE_FIELDS.GENRE]: '',
    [STYLE_PROFILE_FIELDS.GENRE_PROFILE]: '',
    [STYLE_PROFILE_FIELDS.STYLE]: '',
    [STYLE_PROFILE_FIELDS.TONE]: '',
    [STYLE_PROFILE_FIELDS.POV]: '',
    [STYLE_PROFILE_FIELDS.NAMING_STYLE]: '',
    [STYLE_PROFILE_FIELDS.NAMING_STYLE_INTENSITY]: 'medium',
    [STYLE_PROFILE_FIELDS.WORLDVIEW_TEMPLATE]: '',
    [STYLE_PROFILE_FIELDS.WORLDVIEW_TONE]: '',
    [STYLE_PROFILE_FIELDS.SYSTEM_PERSONA]: '',
    [STYLE_PROFILE_FIELDS.REVIEW_FOCUS]: '',
    [STYLE_PROFILE_FIELDS.MATERIAL_FOCUS]: '',
    [STYLE_PROFILE_FIELDS.CONSTRAINT_OVERRIDES]: [],
    [STYLE_PROFILE_FIELDS.PROTAGONIST_NAME]: '',
    [STYLE_PROFILE_FIELDS.LABEL]: '',
    [STYLE_PROFILE_FIELDS.POV_RULE]: '',
    [STYLE_PROFILE_FIELDS.DIALOGUE_RULE]: '',
    [STYLE_PROFILE_FIELDS.BEHAVIOR_RULE]: '',
    [STYLE_PROFILE_FIELDS.TONE_RULE]: '',
    [STYLE_PROFILE_FIELDS.CHARACTER_REF_RULES]: '',
    [STYLE_PROFILE_FIELDS.NARRATIVE_DISTANCE]: '',
    [STYLE_PROFILE_FIELDS.TITLE_RULE]: ''
});

// 字段名别名映射（历史变体→标准字段名）
const FIELD_ALIASES = Object.freeze({
    // 历史变体genreId→标准字段genreProfile
    genreId: 'genreProfile',
    // 标准字段直接映射
    key: 'key',
    genre: 'genre',
    genreProfile: 'genreProfile',
    style: 'style',
    tone: 'tone',
    pov: 'pov',
    namingStyle: 'namingStyle',
    namingStyleIntensity: 'namingStyleIntensity',
    worldviewTemplate: 'worldviewTemplate',
    worldviewTone: 'worldviewTone',
    systemPersona: 'systemPersona',
    reviewFocus: 'reviewFocus',
    materialFocus: 'materialFocus',
    constraintOverrides: 'constraintOverrides',
    protagonistName: 'protagonistName',
    label: 'label',
    povRule: 'povRule',
    dialogueRule: 'dialogueRule',
    behaviorRule: 'behaviorRule',
    toneRule: 'toneRule',
    characterRefRules: 'characterRefRules',
    narrativeDistance: 'narrativeDistance',
    titleRule: 'titleRule'
});

module.exports = {
    STYLE_PROFILE_FIELDS,
    REQUIRED_FIELDS,
    CONSTRAINT_FIELDS,
    FIELD_DEFAULTS,
    FIELD_ALIASES
};
