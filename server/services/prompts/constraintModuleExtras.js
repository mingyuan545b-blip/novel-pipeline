'use strict';

/**
 * constraintModuleExtras.js — 聚合22个补充约束模块
 *
 * 背景：agentSlotRegistry.js引用22个moduleIds，但constraintModuleDefs.js只定义6个
 * 导致resolveModulesSlot返回null，role-boundary/redlines-writer等约束全部丢失
 *
 * 拆分说明：因单文件200行限制，22个模块拆为两个子文件：
 * - constraintModuleExtrasRedlines.js：11个红线/边界类模块（critical/high）
 * - constraintModuleExtrasCraft.js：11个写作技巧类模块（medium/high）
 *
 * 本文件聚合两者，对外暴露统一的EXTRA_CONSTRAINT_MODULES
 */

const { REDLINE_MODULES } = require('./constraintModuleExtrasRedlines');
const { CRAFT_MODULES } = require('./constraintModuleExtrasCraft');

const EXTRA_CONSTRAINT_MODULES = {
    ...REDLINE_MODULES,
    ...CRAFT_MODULES
};

module.exports = { EXTRA_CONSTRAINT_MODULES };
