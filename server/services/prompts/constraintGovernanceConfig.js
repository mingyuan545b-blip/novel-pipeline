'use strict';

/**
 * 约束治理系统配置（Constraint Governance Config）
 *
 * 统一管理override治理、反馈闭环、权重调整的系统级参数
 * 与 constraintDetectionConfig.js（检测层）分离，职责清晰
 *
 * 详见 SOP: docs/sop/08-约束执行规范.md 第三、四节
 */

const GOVERNANCE_CONFIG = Object.freeze({
    override: {
        windowChapters: 3,
        thresholdCount: 3,
    },
    feedback: {
        windowChapters: 3,
        rateEscalateToHardBlock: 0.6,
        rateWeightIncrease: 0.8,
        rateWeightDecrease: 0.95,
        weightIncreaseFactor: 1.5,
        weightDecreaseFactor: 0.8,
    },
});

function getOverrideConfig() {
    return GOVERNANCE_CONFIG.override;
}

function getFeedbackConfig() {
    return GOVERNANCE_CONFIG.feedback;
}

module.exports = {
    GOVERNANCE_CONFIG,
    getOverrideConfig,
    getFeedbackConfig,
};
