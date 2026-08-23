/**
 * apiSelfCheckRegistration.js — 将 API 契约自检注册到 startupChecks
 *
 * 独立文件，避免 startupChecks.js 超过 200 行限制。
 * 自检逻辑在 apiSelfCheck.js 中实现。
 */
const { registerCheck } = require('../services/startupChecks');
const { runApiSelfCheck } = require('./apiSelfCheck');

registerCheck('API契约自检', () => {
    const result = runApiSelfCheck();
    if (!result.passed) {
        return {
            level: 'critical',
            message: `${result.errors.length}个错误: ${result.errors.join('; ')}`
        };
    }
    const d = result.details || {};
    return {
        level: 'ok',
        message: `${d.routeFiles || 0}个路由文件 + ${d.serviceFns || 0}个service函数全部存在`
    };
});
