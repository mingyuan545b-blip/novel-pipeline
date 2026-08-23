/**
 * wordConfig Schema - 字段名单一数据源（Single Source of Truth）
 *
 * 历史问题：系统中存在5套字段名变体
 *   A: {minWords, targetWords, maxWords}              — genre-profiles数据源
 *   B: {targetMin, targetMax, rejectMin, maxWords}    — unifiedConfig期望
 *   C: {targetMinWords, targetMaxWords, rejectMinWords, maxChapterWords} — genreDefaults
 *   D: {target, rejectMin}                            — 历史数据atomic-1
 *   E: wordConfig.targetWords                         — 前端读取
 *
 * 根治方案：本文件定义标准字段名，所有模块必须从这里读取，禁止再自定义字段名。
 * 归一化函数 normalizeWordConfig 负责将任意变体转为标准Schema。
 *
 * 标准字段名（采用A变体，因为数据源genre-profiles已用此命名）：
 *   - minWords:     最低字数（硬拦截，低于此值拒绝）
 *   - targetWords:  目标字数（写作瞄准值）
 *   - maxWords:     最大字数（硬拦截，超过此值拒绝）
 *   - rejectMin:    拒绝下限（兼容字段，等价于minWords，用于历史数据兼容）
 */

// 标准字段名常量——所有消费方必须从这里读取
const WORD_CONFIG_FIELDS = Object.freeze({
    MIN_WORDS: 'minWords',
    TARGET_WORDS: 'targetWords',
    MAX_WORDS: 'maxWords',
    REJECT_MIN: 'rejectMin' // 兼容字段，新数据不应使用
});

// 标准Schema模板
const WORD_CONFIG_SCHEMA = Object.freeze({
    [WORD_CONFIG_FIELDS.MIN_WORDS]: 2200,
    [WORD_CONFIG_FIELDS.TARGET_WORDS]: 2800,
    [WORD_CONFIG_FIELDS.MAX_WORDS]: 3500,
    [WORD_CONFIG_FIELDS.REJECT_MIN]: 1800
});

// 字段名别名映射表（历史变体→标准字段名）
// 用于归一化函数将任意变体转为标准Schema
const FIELD_ALIASES = Object.freeze({
    // 变体A（标准）— 直接映射
    minWords: 'minWords',
    targetWords: 'targetWords',
    maxWords: 'maxWords',
    // 变体B（unifiedConfig期望）
    targetMin: 'minWords',        // targetMin → minWords
    targetMax: 'targetWords',     // targetMax → targetWords
    rejectMin: 'rejectMin',
    // 变体C（genreDefaults，带Words后缀）
    targetMinWords: 'minWords',
    targetMaxWords: 'targetWords',
    rejectMinWords: 'rejectMin',
    maxChapterWords: 'maxWords',
    // 变体D（历史数据atomic-1）
    target: 'targetWords',        // target → targetWords
    // 变体E（前端字段名，已在变体A中）
    // maxChapter（unifiedConfig输出字段名，非wordConfig字段，不在此映射）
});

// 必填字段列表（归一化后必须存在）
const REQUIRED_FIELDS = Object.freeze([
    WORD_CONFIG_FIELDS.MIN_WORDS,
    WORD_CONFIG_FIELDS.TARGET_WORDS,
    WORD_CONFIG_FIELDS.MAX_WORDS
]);

module.exports = {
    WORD_CONFIG_FIELDS,
    WORD_CONFIG_SCHEMA,
    FIELD_ALIASES,
    REQUIRED_FIELDS
};
