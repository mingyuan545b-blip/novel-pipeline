/**
 * reviewSoftHardSeparator.js — 审核结果软硬分离共享模块
 *
 * 从 firstReview.js 和 secondReview.js 提取的公共逻辑：
 * - 自动纠正：passed=false但summary正向且无critical issue时自动改为通过
 * - 软硬分离：无critical/blocker级issue时强制通过，软性issues降级为suggestions
 *
 * 解决问题：LLM把软性问题（喜剧不足/节奏偏慢/文风偏文青等）放进issues并判false，导致pipeline卡死
 * 判定原则：无critical/blocker级issue时，强制通过，软性issues转入suggestions保留反馈
 */
const logger = require('../../../../shared/logger');

/** 正向信号正则：summary中出现这些词且无负向信号时，自动纠正为通过 */
const POSITIVE_SIGNALS = /符合核心规范|视角锁定|降维处理得当|悬念钩子有效|字数达标|整体质量|符合要求|通过|达标|合格|良好|优秀|无严重|无重大|无明显/;
/** 负向信号正则：summary中出现这些词时不自动纠正 */
const NEGATIVE_SIGNALS = /严重问题|重大缺陷|设定冲突|逻辑断裂|角色崩坏|OOC|视角违规|术语违规|未降维|泄露|超标|不足/;

/**
 * 自动纠正：passed=false但summary正向且无critical issue时自动改为通过
 * @param {Object} parsed - 解析后的审核结果
 * @param {string} stepName - 步骤名（用于日志）
 */
function autoCorrectContradiction(parsed, stepName) {
    if (!parsed.passed && parsed.summary) {
        const hasPositive = POSITIVE_SIGNALS.test(parsed.summary);
        const hasNegative = NEGATIVE_SIGNALS.test(parsed.summary);
        const hasCriticalIssues = (parsed.issues || []).some(i => i.severity === 'critical' || i.severity === 'blocker');
        if (hasPositive && !hasNegative && !hasCriticalIssues) {
            logger.info(stepName, `${stepName} contradiction: passed=false but summary positive. Auto-correcting.`);
            parsed.passed = true;
            parsed._autoCorrected = true;
        }
    }
    return parsed;
}

/**
 * 软硬分离：无critical/blocker级issue时强制通过，软性issues降级为suggestions
 * @param {Object} parsed - 解析后的审核结果
 * @param {string} stepName - 步骤名（用于日志）
 * @param {string} [overrideReason] - 自定义覆盖原因（如复审推翻初审校验）
 */
function separateSoftFromHard(parsed, stepName, overrideReason) {
    if (parsed.passed) return parsed;

    const criticalIssues = (parsed.issues || []).filter(i => i.severity === 'critical' || i.severity === 'blocker');
    const softIssues = (parsed.issues || []).filter(i => i.severity !== 'critical' && i.severity !== 'blocker');

    if (criticalIssues.length === 0) {
        logger.info(stepName, `${stepName} soft-hard separation: no critical issues, auto-passing. ${softIssues.length} soft issues downgraded to suggestions.`);
        parsed.passed = true;
        parsed._autoCorrected = true;
        parsed._overrideReason = overrideReason || '无critical硬伤，软性问题降级为建议不阻断';
        if (softIssues.length > 0) {
            parsed.suggestions = (parsed.suggestions || []).concat(
                softIssues.map(i => ({ title: i.title || '软性建议', description: i.violationReason || i.description || i.howToFix || '' }))
            );
            parsed.issues = [];
        }
    }
    return parsed;
}

/**
 * 检测是否有critical blocker（用于标记_criticalBlocker）
 * @param {Object} parsed - 解析后的审核结果
 * @returns {boolean}
 */
function hasCriticalBlocker(parsed) {
    return (parsed.issues || []).some(i =>
        i.severity === 'critical' ||
        i.severity === 'blocker' ||
        /设定冲突|严重OOC|角色崩坏|世界观矛盾|战力崩坏|逻辑断裂/.test(i.description || i.title || '')
    );
}

module.exports = { autoCorrectContradiction, separateSoftFromHard, hasCriticalBlocker };
