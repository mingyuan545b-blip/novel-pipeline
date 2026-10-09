'use strict';

/**
 * 约束检测函数注册表（Constraint Detection Registry）
 *
 * 规范：每个T0/T1约束必须有对应检测函数
 * 检测模式：模式识别 > 关键词匹配（防LLM换词绕过）
 *
 * 详见 SOP: docs/sop/08-约束执行规范.md
 */

const { detectMetaphorSubstitution } = require('./detectors/detectMetaphorSubstitution');
const { detectConflictPatternRepeat } = require('./detectors/detectConflictPatternRepeat');
const { detectChapterCoherence } = require('./detectors/detectChapterCoherence');
const { detectAbstractSentiment } = require('./detectors/detectAbstractSentiment');
const { detectToolCharacter } = require('./detectors/detectToolCharacter');
const { detectBanterDeflation } = require('./detectors/detectBanterDeflation');
const { detectAbstractEnding } = require('./detectors/detectAbstractEnding');
const { detectEmotionalContinuity } = require('./detectors/detectEmotionalContinuity');
const { detectMotifReuse } = require('./detectors/detectMotifReuse');
const { detectHookMonotony } = require('./detectors/detectHookMonotony');
const { detectAiSlop } = require('./detectors/detectAiSlop');
const { getMetaConstraintDetectionSpec } = require('./constraintMetaSpec');
const logger = require('../../shared/logger');

const DETECTION_REGISTRY = Object.freeze({
    M1: { fn: detectMetaphorSubstitution, source: 'meta' },
    M2: { fn: detectConflictPatternRepeat, source: 'meta' },
    M3: { fn: detectChapterCoherence, source: 'meta' },
    M4: { fn: detectAbstractSentiment, source: 'meta' },
    M5: { fn: detectToolCharacter, source: 'meta' },
    // 12-创作工艺 新增
    M6: { fn: detectBanterDeflation, source: 'meta' },
    M7: { fn: detectAbstractEnding, source: 'meta' },
    M8: { fn: detectEmotionalContinuity, source: 'meta' },
    M9: { fn: detectMotifReuse, source: 'meta' },
    M10: { fn: detectHookMonotony, source: 'meta' },
    // 2026-10-10 新增：AI 味高频词
    M11: { fn: detectAiSlop, source: 'meta' },
});

async function runConstraintDetection(constraintId, params) {
    const spec = getMetaConstraintDetectionSpec(constraintId);
    const entry = DETECTION_REGISTRY[constraintId];
    if (!spec || !entry) {
        logger.warn('constraintDetectionRegistry', '[UNKNOWN-CONSTRAINT] {constraintId} has no detection registered', { constraintId });
        return { violated: false, violations: [], reason: 'no-detection' };
    }

    try {
        const result = await entry.fn(params, spec.threshold);
        return {
            violated: result.violations.length > 0,
            violations: result.violations,
            threshold: spec.threshold,
            actual: result.actual,
            block: spec.block,
        };
    } catch (err) {
        logger.error('constraintDetectionRegistry', '[DETECT-ERROR] {constraintId} detection failed: {error}', { constraintId, error: err.message });
        return { violated: false, violations: [], reason: 'detect-error', error: err.message };
    }
}

async function runAllMetaConstraintDetections(params) {
    const results = {};
    for (const id of Object.keys(DETECTION_REGISTRY)) {
        results[id] = await runConstraintDetection(id, params);
    }
    return results;
}

module.exports = {
    DETECTION_REGISTRY,
    runConstraintDetection,
    runAllMetaConstraintDetections,
};
