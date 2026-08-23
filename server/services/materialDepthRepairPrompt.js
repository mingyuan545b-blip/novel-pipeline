'use strict';

/**
 * 素材深度修复提示词构建
 * 从 materialDepthValidator.js 拆分，职责：根据校验结果生成补充提示词
 */

const { FIELD_SPECS } = require('../config/materialDepthSpec');

/**
 * 生成深度校验失败时的提示词片段（用于告诉AI补充什么）
 * @param {object} validationResult - validateMaterialDepth 的返回值
 * @returns {string} 提示词片段
 */
function buildDepthRepairPrompt(validationResult) {
    if (!validationResult || validationResult.valid) return '';

    const parts = [];

    if (validationResult.missing.length > 0) {
        parts.push(`【必须补充的字段】${validationResult.missing.map(f => `【${f}】`).join('、')}`);
    }

    if (validationResult.shortFields.length > 0) {
        const details = validationResult.shortFields.map(f => {
            const spec = FIELD_SPECS[f];
            return `【${f}】(至少${spec?.minChars || '?'}字)`;
        });
        parts.push(`【内容过短需扩展的字段】${details.join('、')}`);
    }

    if (validationResult.qualityFailedFields.length > 0) {
        const details = validationResult.qualityFailedFields.map(f => {
            const spec = FIELD_SPECS[f];
            return `【${f}】(需包含: ${spec?.qualityHints?.slice(0, 3).join('/') || '相关关键词'})`;
        });
        parts.push(`【质量不达标需重写的字段】${details.join('、')}`);
    }

    if (validationResult.totalChars < validationResult.minTotalChars) {
        parts.push(`【总字数不足】当前${validationResult.totalChars}字，需补至${validationResult.minTotalChars}字以上`);
    }

    return parts.length > 0
        ? `\n【⚠ 素材深度校验未通过 - ${validationResult.depthLevel}等级】\n${parts.join('\n')}\n请在更新素材时补充上述内容。`
        : '';
}

module.exports = { buildDepthRepairPrompt };
