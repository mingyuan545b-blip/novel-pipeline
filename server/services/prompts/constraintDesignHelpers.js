'use strict';

/**
 * constraintDesignHelpers.js — 设计时约束冲突预检的共享常量和工具
 *
 * 从 constraintDesignChecker.js 拆分而来（P1-Q3：单文件200行限制）
 * 职责：提供元约束冲突签名、否定词模式、否定检测工具
 *
 * 详见 SOP: docs/sop/09-新项目约束词设计SOP.md Step3
 */

// 已知元约束矛盾模式（配置化，非硬编码业务关键词）
const META_CONFLICT_SIGNATURES = Object.freeze({
    // M1禁比喻词 vs 题材要求诗意化 → 冲突
    poeticVsM1: { metaId: 'M1', conflictKeywords: ['诗意', '文学化', '华丽辞藻', '修辞美感'], tag: 'M1vs诗意化' },
    // M5反工具人 vs 题材要求配角服从 → 冲突
    服从VsM5: { metaId: 'M5', conflictKeywords: ['配角服从', '配角忠诚', '唯命是从', '仆从'], tag: 'M5vs配角服从' },
    // M3章节衔接 vs 题材要求快节奏跳转 → 潜在冲突
    fastPaceVsM3: { metaId: 'M3', conflictKeywords: ['快速切换场景', '跳转', '无需过渡'], tag: 'M3vs快节奏跳转' },
});

// 否定词模式：如果冲突关键词被否定词修饰，说明是"禁止"而非"要求"，不算冲突
const NEGATION_PATTERNS = Object.freeze([
    /(?:严禁|禁止|不得|不要|杜绝|避免|杜绝)[^。；\n]{0,20}/,
    /(?:不要|不应|不能|不可)[^。；\n]{0,20}/,
]);

/**
 * 检查关键词是否被否定词修饰（是"禁止X"而非"要求X"）
 * @param {string} desc - 约束词描述
 * @param {string} keyword - 冲突关键词
 * @returns {boolean} true=被否定（不算冲突），false=未被否定（是真正的冲突）
 */
function isNegated(desc, keyword) {
    for (const pattern of NEGATION_PATTERNS) {
        const match = desc.match(pattern);
        if (match && match[0].includes(keyword)) {
            return true;
        }
    }
    return false;
}

module.exports = {
    META_CONFLICT_SIGNATURES,
    NEGATION_PATTERNS,
    isNegated,
};
