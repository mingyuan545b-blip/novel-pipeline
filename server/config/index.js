/**
 * 配置统一导出入口
 * 所有消费方只从这里 import，禁止直接引用子模块
 */

const systemConfig = require('./systemConfig');
const { resolveConfig } = require('./unifiedConfig');
const { NOVEL_DEFAULTS, getDefaultsForGenre } = require('./genreDefaults');
const { BUDGET_POLICY, ITEM_COUNT_BY_DEPTH, DEGRADATION_ACTIONS } = require('./budgetPolicy');

module.exports = {
    ...systemConfig,
    resolveConfig,
    NOVEL_DEFAULTS,
    getDefaultsForGenre,
    BUDGET_POLICY,
    ITEM_COUNT_BY_DEPTH,
    DEGRADATION_ACTIONS
};
