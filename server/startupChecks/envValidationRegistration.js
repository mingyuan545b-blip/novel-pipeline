/**
 * envValidationRegistration.js — G5: 将环境变量 schema 校验注册到 startupChecks
 *
 * 独立文件，避免 startupChecks.js 超过 200 行限制。
 * 校验逻辑在 envValidator.js 中实现。
 */
const { registerCheck } = require('../services/startupChecks');
const { validateEnv } = require('../config/envValidator');

registerCheck('环境变量Schema校验', () => {
    const result = validateEnv();
    if (!result.passed) {
        return {
            level: 'critical',
            message: `${result.errors.length}个错误: ${result.errors.join('; ')}`
        };
    }
    const warnCount = result.warnings.length;
    if (warnCount > 0) {
        return {
            level: 'warn',
            message: `${result.warnings.length}个警告: ${result.warnings.join('; ')}`
        };
    }
    return {
        level: 'ok',
        message: `所有环境变量校验通过（${Object.keys(result.config).length}项）`
    };
});
