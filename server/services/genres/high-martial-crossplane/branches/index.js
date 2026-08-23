/**
 * branches/index.js — 分支注册器+组装器
 *
 * 功能：
 * 1. 注册三个世界观分支（programmatic/layered/metaverse）
 * 2. 提供 getBranchConfig(key) 获取分支配置
 * 3. 提供 applyBranch(genre, branchKey) 将分支配置注入题材插件
 *
 * 设计原则：
 * - 通用配置在题材插件主文件（foundation/styleProfile/detectors等）
 * - 分支专属配置在branches/分支文件
 * - applyBranch将分支配置合并到题材插件，覆盖通用配置
 * - 不传branchKey时返回原题材（向后兼容）
 */
const logger = require('../../../../shared/logger');

const branchProgrammatic = require('./branchProgrammatic');
const branchLayered = require('./branchLayered');
const branchMetaverse = require('./branchMetaverse');

const BRANCH_REGISTRY = {
    [branchProgrammatic.key]: branchProgrammatic,
    [branchLayered.key]: branchLayered,
    [branchMetaverse.key]: branchMetaverse
};

const DEFAULT_BRANCH_KEY = branchProgrammatic.key;
const ALL_BRANCH_KEYS = Object.keys(BRANCH_REGISTRY);

/**
 * 获取分支配置
 * @param {string} key - 分支key
 * @returns {object|null} 分支配置对象
 */
function getBranchConfig(key) {
    if (!key) return null;
    return BRANCH_REGISTRY[key] || null;
}

/**
 * 获取所有分支元信息（用于项目创建时选择）
 * @returns {Array} 分支列表 [{key, label, worldviewCore, powerSystem, planeConcept, mentorConcept}]
 */
function listBranches() {
    return ALL_BRANCH_KEYS.map(k => {
        const b = BRANCH_REGISTRY[k];
        return {
            key: b.key,
            label: b.label,
            worldviewCore: b.worldviewCore,
            powerSystem: { concept: b.powerSystem.concept, levels: b.powerSystem.levels },
            planeConcept: { term: b.planeConcept.term },
            mentorConcept: { term: b.mentorConcept.term }
        };
    });
}

/**
 * 验证branchKey有效性
 * @param {string} key
 * @returns {boolean}
 */
function isValidBranch(key) {
    return ALL_BRANCH_KEYS.includes(key);
}

/**
 * 规范化branchKey（无效或空时返回默认分支）
 * @param {string} key
 * @returns {string} 有效的branchKey
 */
function normalizeBranchKey(key) {
    if (!key || !isValidBranch(key)) return DEFAULT_BRANCH_KEY;
    return key;
}

/**
 * 将分支配置注入题材插件（核心组装函数）
 * @param {object} genre - 原始题材插件对象（来自assembleGenre）
 * @param {string} branchKey - 分支key
 * @returns {object} 注入分支配置后的题材插件（深拷贝，不污染原对象）
 */
function applyBranch(genre, branchKey) {
    if (!genre) return genre;
    const validKey = normalizeBranchKey(branchKey);
    const branch = getBranchConfig(validKey);
    if (!branch) {
        logger.warn('branches', `Branch not found: ${branchKey}, fallback to default`);
        return genre;
    }

    // 深拷贝题材对象，避免污染注册表
    const branchedGenre = JSON.parse(JSON.stringify(genre));

    // 1. 注入分支元信息
    branchedGenre.branchKey = branch.key;
    branchedGenre.branchLabel = branch.label;
    branchedGenre.worldviewCore = branch.worldviewCore;

    // 2. 合并foundation（追加分支约束+铁律）
    if (branchedGenre.foundation) {
        const existingConstraintIds = new Set(
            (branchedGenre.foundation.additionalConstraints || []).map(c => c.id)
        );
        const newConstraints = branch.extraConstraints.filter(c => !existingConstraintIds.has(c.id));
        branchedGenre.foundation.additionalConstraints = [
            ...(branchedGenre.foundation.additionalConstraints || []),
            ...newConstraints
        ];
        branchedGenre.foundation.additionalFoundationRules = [
            ...(branchedGenre.foundation.additionalFoundationRules || []),
            ...branch.extraFoundationRules
        ];
    }

    // 3. 覆盖styleProfile（分支专属风格）
    if (branchedGenre.styleProfile) {
        Object.assign(branchedGenre.styleProfile, branch.styleProfileOverrides);
    }

    // 4. 覆盖genreBase（分支专属行为/语气）
    if (branchedGenre.genreBase) {
        Object.assign(branchedGenre.genreBase, branch.genreBaseOverrides);
    }

    // 5. 覆盖constraintPresets（追加分支约束预设）
    if (branchedGenre.constraintPresets) {
        for (const c of branch.extraConstraints) {
            if (!branchedGenre.constraintPresets[c.id]) {
                branchedGenre.constraintPresets[c.id] = { label: c.label, desc: c.desc };
            }
        }
    }

    // 6. 注入分支检测器配置（供detectors.js读取）
    branchedGenre.branchDetectorConfig = branch.detectorConfig;

    // 7. 注入分支命名风格
    branchedGenre.branchNamingStyle = branch.namingStyle;

    // 8. 注入分支模块覆盖（供modules读取）
    branchedGenre.branchModuleOverrides = branch.moduleOverrides;

    // 9. 注入分支核心概念（供pipeline/agent查询）
    branchedGenre.branchConcepts = {
        powerSystem: branch.powerSystem,
        planeConcept: branch.planeConcept,
        mentorConcept: branch.mentorConcept,
        toneStyle: branch.toneStyle
    };

    return branchedGenre;
}

module.exports = {
    getBranchConfig,
    listBranches,
    isValidBranch,
    normalizeBranchKey,
    applyBranch,
    DEFAULT_BRANCH_KEY,
    ALL_BRANCH_KEYS,
    BRANCH_REGISTRY
};
