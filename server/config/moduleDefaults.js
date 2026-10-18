/**
 * moduleDefaults.js — Pipeline 模块的项目级默认档位（单一源）
 *
 * 背景（F2，见 docs/worklog/2026-10-17-假成果审查-问题统计.md）：
 * pipelineModuleRegistry.registerModule 的 offValue 默认 'off'；新项目若不写入非 off 值，
 * 模块钩子永不触发。此处集中定义新项目默认档位，供 projectCreateHandler 与
 * outlineMaterialSaver 等所有"建项目"路径复用，避免逐点打补丁导致漏配（F10 同族问题）。
 *
 * 门禁：scripts/verifyModuleSwitchDefaults.js 断言本表覆盖全部已注册模块的 configKey。
 */
'use strict';

const DEFAULT_MODULE_SETTINGS = Object.freeze({
    chronicleLevel: 'basic',
    worldScopeLevel: 'basic',
    // 约束执行反馈闭环：模块注册 offValue='off'，非 off 默认值才能启用。
    constraintFeedback: 'basic',
});

module.exports = { DEFAULT_MODULE_SETTINGS };
