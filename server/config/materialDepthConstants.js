'use strict';

/**
 * 素材深度系统常量（单一数据源）
 * 从 materialDepthSpec.js 拆分，职责：仅提供 DEPTH_LEVELS 常量
 *
 * 拆分原因：
 *   1. 主文件 materialDepthSpec.js 超 200 行限制
 *   2. 拆 DEPTH_REQUIREMENTS 时，子文件需要 DEPTH_LEVELS
 *      若从主文件导入会形成循环依赖（陷阱#45）
 *   3. 独立 constants 文件是循环依赖的破环点
 *
 * 深度等级：
 *   - basic:    最小可用（NPC级，80字+）—— 只校验存在性
 *   - standard: 标准深度（配角级，250字+）—— 校验字段存在+字数下限
 *   - deep:     深度刻画（主角级，400字+）—— 校验字段存在+字数下限+内容质量关键词
 */
const DEPTH_LEVELS = Object.freeze({
    BASIC: 'basic',        // NPC级
    STANDARD: 'standard',  // 配角级
    DEEP: 'deep'           // 主角级
});

module.exports = { DEPTH_LEVELS };
