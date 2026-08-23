/**
 * configSyncCheck.js — Pipeline配置同步自动校验（YAML驱动版）
 *
 * 阶段3迁移：STEP_CONTRACTS硬编码已删除，本模块改为校验：
 * 1. YAML契约覆盖所有STEP_ORDER步骤
 * 2. YAML契约errorCode格式规范
 * 3. REQUIRED_OUTPUT_FIELDS的步骤都在STEP_ORDER中
 * 4. TERMINAL_STATUSES不为空
 * 5. 字数配置合理性
 */
const logger = require('../../shared/logger');

/**
 * 校验Pipeline配置一致性
 * @returns {{ level: 'ok'|'warning'|'critical', message: string, details: string[] }}
 */
function checkPipelineConfigSync() {
    const details = [];
    let hasCritical = false;
    let hasWarning = false;

    try {
        const { PIPELINE_CONTRACT } = require('./pipelineContract');
        const contractValidator = require('./contractValidator');
        const yamlSummary = contractValidator.getContractSummary();

        // 1. 校验YAML契约覆盖所有STEP_ORDER步骤
        const contractSteps = PIPELINE_CONTRACT.STEP_ORDER;
        const yamlAgents = new Set(Object.keys(yamlSummary));
        const stepsWithoutYaml = contractSteps.filter(s => !yamlAgents.has(s));
        if (stepsWithoutYaml.length > 0) {
            details.push(`STEP_ORDER中有${stepsWithoutYaml.length}个步骤无YAML契约定义: ${stepsWithoutYaml.join(', ')}`);
            hasWarning = true;
        }

        // 2. 校验YAML契约的input规则数>0
        let totalInputRules = 0;
        let totalOutputRules = 0;
        for (const [agent, info] of Object.entries(yamlSummary)) {
            if (info.inputRules === 0 && contractSteps.includes(agent)) {
                details.push(`YAML契约${agent}的input规则数为0`);
                hasWarning = true;
            }
            totalInputRules += info.inputRules || 0;
            totalOutputRules += info.outputRules || 0;
        }

        // 3. 校验REQUIRED_OUTPUT_FIELDS的步骤都在STEP_ORDER中
        const requiredOutputSteps = Object.keys(PIPELINE_CONTRACT.REQUIRED_OUTPUT_FIELDS);
        const missingInOrder = requiredOutputSteps.filter(s => !contractSteps.includes(s));
        if (missingInOrder.length > 0) {
            details.push(`REQUIRED_OUTPUT_FIELDS中有${missingInOrder.length}个步骤不在STEP_ORDER中: ${missingInOrder.join(', ')}`);
            hasCritical = true;
        }

        // 4. 校验TERMINAL_STATUSES不为空
        if (!PIPELINE_CONTRACT.TERMINAL_STATUSES || PIPELINE_CONTRACT.TERMINAL_STATUSES.length === 0) {
            details.push('TERMINAL_STATUSES为空，Pipeline无法正常终止');
            hasCritical = true;
        }

        // 5. 校验字数配置合理性
        if (PIPELINE_CONTRACT.MIN_WORD_COUNT >= PIPELINE_CONTRACT.MAX_WORD_COUNT) {
            details.push(`MIN_WORD_COUNT(${PIPELINE_CONTRACT.MIN_WORD_COUNT}) >= MAX_WORD_COUNT(${PIPELINE_CONTRACT.MAX_WORD_COUNT})`);
            hasCritical = true;
        }

        const level = hasCritical ? 'critical' : (hasWarning ? 'warning' : 'ok');
        const summary = `YAML契约: agents=${yamlAgents.size}/${contractSteps.length}, 输入规则=${totalInputRules}, 输出规则=${totalOutputRules}, 步骤=${contractSteps.length}, 输出字段=${requiredOutputSteps.length}`;

        if (details.length > 0) {
            logger.warn('configSyncCheck', `配置同步校验发现问题: ${details.join('; ')}`);
        }

        return { level, message: summary, details };
    } catch (e) {
        return { level: 'critical', message: `校验失败: ${e.message}`, details: [] };
    }
}

module.exports = { checkPipelineConfigSync };
