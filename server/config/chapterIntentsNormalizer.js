/**
 * chapterIntentsNormalizer - 章节意图归一化层
 *
 * 职责：
 *   1. 归一化历史数据（数组→对象）
 *   2. 补齐缺失的顶层字段
 *   3. 校验Schema合规性
 *
 * 使用场景：
 *   - 读取project.chapterIntents时调用normalizeChapterIntents
 *   - 写入project.chapterIntents前调用validateChapterIntents
 */

const { TOP_LEVEL_FIELDS, DEFAULT_STRUCTURE, CHAPTER_KEY_PATTERN, REQUIRED_INTENT_FIELDS, INTENT_FIELDS } = require('./chapterIntentsSchema');

/**
 * 归一化chapterIntents结构
 * - 输入null/undefined → 返回默认结构
 * - 输入chapters为数组 → 转换为对象（以chapter字段为key）
 * - 输入chapters为对象 → 原样保留，补齐缺失字段
 * @param {any} rawIntents - 原始chapterIntents数据
 * @returns {{chapters: Object}} 归一化后的结构
 */
function normalizeChapterIntents(rawIntents) {
    // null/undefined → 默认结构
    if (!rawIntents || typeof rawIntents !== 'object') {
        return { ...DEFAULT_STRUCTURE };
    }

    const result = { ...DEFAULT_STRUCTURE, ...rawIntents };

    // chapters字段处理：数组→对象转换
    if (Array.isArray(result.chapters)) {
        const converted = {};
        for (const intent of result.chapters) {
            if (intent && typeof intent === 'object') {
                const chapterNum = intent[INTENT_FIELDS.CHAPTER];
                if (typeof chapterNum === 'number') {
                    const key = `chapter-${String(chapterNum).padStart(4, '0')}`;
                    converted[key] = intent;
                }
            }
        }
        result.chapters = converted;
    } else if (!result.chapters || typeof result.chapters !== 'object') {
        result.chapters = {};
    }

    return result;
}

/**
 * 校验chapterIntents结构合规性
 * @param {any} intents - 待校验的chapterIntents
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateChapterIntents(intents) {
    const errors = [];

    if (!intents || typeof intents !== 'object') {
        return { valid: false, errors: ['chapterIntents必须为对象类型'] };
    }

    // chapters必须是对象，不能是数组
    if (Array.isArray(intents.chapters)) {
        errors.push('chapterIntents.chapters不能为数组类型，必须为对象');
    } else if (!intents.chapters || typeof intents.chapters !== 'object') {
        errors.push('chapterIntents.chapters必须为对象类型');
    } else {
        // 校验每个章节key格式
        for (const key of Object.keys(intents.chapters)) {
            if (!CHAPTER_KEY_PATTERN.test(key)) {
                errors.push(`章节key格式错误: ${key}，应为chapter-XXXX格式`);
            }
            // 校验必填字段
            const intent = intents.chapters[key];
            if (intent && typeof intent === 'object') {
                for (const field of REQUIRED_INTENT_FIELDS) {
                    if (intent[field] === undefined || intent[field] === null) {
                        errors.push(`章节${key}缺少必填字段: ${field}`);
                    }
                }
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

module.exports = {
    normalizeChapterIntents,
    validateChapterIntents,
};
