/**
 * contractCompat.js — YAML契约到旧STEP_CONTRACTS格式的兼容适配层
 *
 * 阶段3迁移：pipelinePreflight.preflight()依赖getStepContract返回
 *   [{checks:[{code,label,severity,check}]}]
 * 旧STEP_CONTRACTS硬编码已删除，本模块从YAML契约生成兼容格式
 *
 * check函数从YAML规则生成（字段存在性校验，与旧PF-xxx行为一致）
 */
const contractValidator = require('./contractValidator');

/**
 * 从YAML契约生成旧格式STEP_CONTRACTS兼容结构
 * @param {string} step - agent名称
 * @returns {Array} 旧格式 [{checks:[...]}]，无契约时返回[]
 */
function getStepContract(step) {
    const contract = contractValidator.loadContract(step);
    if (!contract || !contract.input || !contract.input.required) return [];

    const checks = contract.input.required.map(rule => ({
        code: rule.errorCode,
        label: rule.message,
        severity: rule.severity || 'CRITICAL',
        check: (ctx) => {
            // 与旧STEP_CONTRACTS行为一致：字段存在性校验
            const value = rule.path.split('.').reduce(
                (acc, key) => (acc == null ? null : acc[key]),
                ctx
            );
            return value !== undefined && value !== null;
        }
    }));

    return checks.length > 0 ? [{ checks }] : [];
}

/**
 * 获取契约摘要（兼容旧getContractSummary格式）
 * @returns {Object} { totalSteps, steps: { agent: [{code,label,severity}] } }
 */
function getContractSummary() {
    const { getContractSummary: yamlSummary } = contractValidator;
    const yamlResult = yamlSummary();
    const steps = {};

    for (const [agent, info] of Object.entries(yamlResult)) {
        const contract = contractValidator.loadContract(agent);
        if (!contract || !contract.input || !contract.input.required) continue;
        steps[agent] = contract.input.required.map(rule => ({
            code: rule.errorCode,
            label: rule.message,
            severity: rule.severity || 'CRITICAL'
        }));
    }

    return {
        totalSteps: Object.keys(steps).length,
        steps
    };
}

module.exports = { getStepContract, getContractSummary };
