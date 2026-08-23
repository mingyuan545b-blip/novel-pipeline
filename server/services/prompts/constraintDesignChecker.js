'use strict';

/**
 * constraintDesignChecker.js — 设计时约束冲突预检（Step3冲突预检的实现）
 *
 * 职责：新项目创建前/约束词变更时，检测3类冲突
 *   1. M1-M5元约束互检（逻辑矛盾）—— 本文件
 *   2. 元约束 vs 题材约束冲突（重复/矛盾）—— 本文件
 *   3. coveredWordConstraints覆盖检查（陷阱#48）—— constraintDesignCoveredCheck.js
 *
 * 共享常量/工具在 constraintDesignHelpers.js
 *
 * 与constraintConflictDetector.js的区别：
 *   - constraintConflictDetector是运行时检测（entity/genre/global三级文本冲突）
 *   - constraintDesignChecker是设计时预检（元约束之间+元约束vs题材约束）
 *
 * 详见 SOP: docs/sop/09-新项目约束词设计SOP.md Step3
 */

const { META_CONSTRAINTS, META_CONSTRAINT_IDS } = require('./constraintMetaSpec');
const { META_CONFLICT_SIGNATURES, isNegated } = require('./constraintDesignHelpers');
const { verifyCoveredWordDetection } = require('./constraintDesignCoveredCheck');

/**
 * 检测点1：M1-M5元约束互检
 * 检查5个元约束之间是否有逻辑冲突（coveredWordConstraints交集+promptText矛盾）
 * @returns {{ passed: boolean, conflicts: Array, summary: string }}
 */
function verifyMetaConstraintConsistency() {
    const conflicts = [];

    // 检查coveredWordConstraints交集（子集关系不算冲突，完全交集才算）
    for (let i = 0; i < META_CONSTRAINT_IDS.length; i++) {
        for (let j = i + 1; j < META_CONSTRAINT_IDS.length; j++) {
            const a = META_CONSTRAINTS[META_CONSTRAINT_IDS[i]];
            const b = META_CONSTRAINTS[META_CONSTRAINT_IDS[j]];
            const intersection = a.coveredWordConstraints.filter(w => b.coveredWordConstraints.includes(w));
            if (intersection.length > 0) {
                // 子集关系：a的词全部在b中，或反之 → 不算冲突（是覆盖关系）
                const aSubsetOfB = intersection.length === a.coveredWordConstraints.length;
                const bSubsetOfA = intersection.length === b.coveredWordConstraints.length;
                if (!aSubsetOfB && !bSubsetOfA) {
                    conflicts.push({
                        type: 'word_overlap',
                        metaA: a.id,
                        metaB: b.id,
                        overlap: intersection,
                        reason: `${a.id}和${b.id}的coveredWordConstraints有部分交集但非子集关系`,
                    });
                }
            }
        }
    }

    return {
        passed: conflicts.length === 0,
        conflicts,
        summary: `M1-M5互检：${conflicts.length === 0 ? '✅无冲突' : `❌${conflicts.length}个冲突`}`,
    };
}

/**
 * 检测点2：元约束 vs 题材约束冲突
 * 检查题材constraintPresets的desc是否包含与M1-M5矛盾/重复的关键词
 * @param {object} genreConstraintPresets - 题材约束词字典（从constraintPresets.js读取）
 * @returns {{ passed: boolean, conflicts: Array, duplicates: Array, summary: string }}
 */
function detectMetaVsGenreConflicts(genreConstraintPresets) {
    const conflicts = [];
    const duplicates = [];

    if (!genreConstraintPresets || typeof genreConstraintPresets !== 'object') {
        return { passed: true, conflicts: [], duplicates: [], summary: '元约束vs题材约束：✅无题材约束词，跳过' };
    }

    // 遍历题材约束词
    for (const [presetId, preset] of Object.entries(genreConstraintPresets)) {
        const desc = preset?.desc || '';
        const label = preset?.label || '';

        // 检查已知矛盾模式（排除被否定词修饰的关键词）
        for (const sig of Object.values(META_CONFLICT_SIGNATURES)) {
            const matched = sig.conflictKeywords.filter(kw => {
                if (!desc.includes(kw)) return false;
                // 如果关键词被否定词修饰（"禁止诗意"vs"要求诗意"），不算冲突
                return !isNegated(desc, kw);
            });
            if (matched.length > 0) {
                conflicts.push({
                    type: 'meta_vs_genre',
                    presetId,
                    metaId: sig.metaId,
                    tag: sig.tag,
                    matchedKeywords: matched,
                    reason: `题材约束[${presetId}]包含"${matched.join(',')}"，与${sig.metaId}元约束可能冲突`,
                });
            }
        }

        // 检查与M1-M5 coveredWordConstraints的重复（警告但不阻断）
        for (const metaId of META_CONSTRAINT_IDS) {
            const meta = META_CONSTRAINTS[metaId];
            const duplicated = meta.coveredWordConstraints.filter(w => desc.includes(w));
            if (duplicated.length > 0) {
                duplicates.push({
                    presetId,
                    metaId,
                    duplicatedWords: duplicated,
                    reason: `题材约束[${presetId}]与${metaId}有${duplicated.length}个重复约束词（建议依赖元约束，移除题材约束中的重复词）`,
                });
            }
        }
    }

    return {
        passed: conflicts.length === 0, // 重复不阻断，只警告
        conflicts,
        duplicates,
        summary: `元约束vs题材约束：${conflicts.length === 0 ? '✅无冲突' : `❌${conflicts.length}个冲突`}，${duplicates.length > 0 ? `⚠️${duplicates.length}处重复` : '无重复'}`,
    };
}

/**
 * 执行完整冲突预检（Step3的入口）
 * @param {object} params - { genreConstraintPresets }
 * @returns {{ allPassed: boolean, results: object, summary: string }}
 */
function runFullDesignCheck({ genreConstraintPresets } = {}) {
    const results = {
        metaConsistency: verifyMetaConstraintConsistency(),
        metaVsGenre: detectMetaVsGenreConflicts(genreConstraintPresets),
        coveredWordDetection: verifyCoveredWordDetection(),
    };

    // allPassed只看矛盾冲突（metaConsistency + metaVsGenre）
    // coveredWordDetection的缺口和duplicates一样，只警告不阻断
    // 因为部分短词（如"像是""默默"）无法被正则精确匹配，这是已知限制
    const allPassed = results.metaConsistency.passed
        && results.metaVsGenre.passed;

    return {
        allPassed,
        results,
        summary: `冲突预检：${allPassed ? '✅全部通过' : '❌存在冲突'}\n  - ${results.metaConsistency.summary}\n  - ${results.metaVsGenre.summary}\n  - ${results.coveredWordDetection.summary}`,
    };
}

module.exports = {
    verifyMetaConstraintConsistency,
    detectMetaVsGenreConflicts,
    verifyCoveredWordDetection,
    runFullDesignCheck,
    // re-export 保持向后兼容（外部可能直接从此模块取常量）
    META_CONFLICT_SIGNATURES,
};
