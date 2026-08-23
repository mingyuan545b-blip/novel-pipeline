'use strict';

/**
 * constraintDesignCoveredCheck.js — coveredWordConstraints覆盖检查（陷阱#48）
 *
 * 从 constraintDesignChecker.js 拆分而来（P1-Q3：单文件200行限制）
 * 职责：检测点3——确保每个M约束的coveredWordConstraints都能被
 *       constraintDetectionConfig的patterns匹配
 *
 * 详见 SOP: docs/sop/09-新项目约束词设计SOP.md Step3
 */

const { META_CONSTRAINTS, META_CONSTRAINT_IDS } = require('./constraintMetaSpec');
const { getConfig } = require('./constraintDetectionConfig');

/**
 * 检测点3：coveredWordConstraints覆盖检查（陷阱#48）
 * 确保每个M约束的coveredWordConstraints都能被constraintDetectionConfig的patterns匹配
 * @returns {{ passed: boolean, missingPatterns: Array, summary: string }}
 */
function verifyCoveredWordDetection() {
    const missingPatterns = [];

    for (const metaId of META_CONSTRAINT_IDS) {
        const meta = META_CONSTRAINTS[metaId];
        const config = getConfig(metaId);
        if (!config || !config.patterns) {
            missingPatterns.push({
                metaId,
                missingWords: meta.coveredWordConstraints,
                reason: `${metaId}无检测模式配置`,
            });
            continue;
        }

        // 收集所有pattern的正则源
        const patterns = Object.values(config.patterns);
        const unmatched = [];

        for (const word of meta.coveredWordConstraints) {
            // 检查该词是否能被任一pattern匹配
            const matched = patterns.some(pattern => {
                try {
                    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
                    return re.test(word);
                } catch (_) {
                    return false;
                }
            });
            if (!matched) {
                unmatched.push(word);
            }
        }

        if (unmatched.length > 0) {
            missingPatterns.push({
                metaId,
                missingWords: unmatched,
                reason: `${metaId}有${unmatched.length}个coveredWordConstraints未被patterns覆盖：${unmatched.join(',')}`,
            });
        }
    }

    return {
        passed: missingPatterns.length === 0,
        missingPatterns,
        summary: `覆盖检查：${missingPatterns.length === 0 ? '✅全覆盖' : `❌${missingPatterns.length}个缺口`}`,
    };
}

module.exports = {
    verifyCoveredWordDetection,
};
