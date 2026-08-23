/**
 * targetChapters归一化器 - 数据入口拦截层
 *
 * 职责：从project对象中读取目标章节数，兼容targetChapters和targetChapterCount两个字段名
 * 统一返回targetChapters标准字段名
 *
 * 调用时机：
 *   1. unifiedConfig.resolveConfig 读取项目配置时
 *   2. pipelineInit/batchExecutor/outlineSupplementer 读取目标章节数时
 *   3. projectService API输出时
 */

const {
    TARGET_CHAPTERS_FIELD,
    TARGET_CHAPTERS_DB_COLUMN,
    DEFAULT_TARGET_CHAPTERS
} = require('./targetChaptersSchema');

/**
 * 从project对象中归一化读取目标章节数
 * @param {Object|null} project - 项目对象
 * @returns {number} 目标章节数（默认100）
 */
function normalizeTargetChapters(project) {
    if (!project) return DEFAULT_TARGET_CHAPTERS;

    // 优先读取标准字段名targetChapters
    const val = project[TARGET_CHAPTERS_FIELD];
    if (typeof val === 'number' && val >= 0) return val;

    // 兼容历史字段名targetChapterCount
    const legacyVal = project[TARGET_CHAPTERS_DB_COLUMN];
    if (typeof legacyVal === 'number' && legacyVal >= 0) return legacyVal;

    // 字符串数字转换
    if (typeof val === 'string' && val.trim()) {
        const num = Number(val);
        if (Number.isFinite(num) && num >= 0) return num;
    }

    return DEFAULT_TARGET_CHAPTERS;
}

module.exports = { normalizeTargetChapters };
