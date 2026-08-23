/**
 * worldScopeModule.js — 世界域模块统一入口（re-export）
 *
 * 已拆分为3个子模块，此处仅做re-export保持向后兼容（陷阱#1: re-export完整）
 * - worldScopeCrud.js: 世界域CRUD + 项目世界配置
 * - worldFactionModule.js: 势力CRUD
 * - worldScopeExtractRunner.js: LLM提取+存储执行器
 */
const crud = require('./worldScopeCrud');
const factions = require('./worldFactionModule');
const runner = require('./worldScopeExtractRunner');

module.exports = {
    // 来自 worldScopeCrud.js
    SCOPE_DEFS: crud.SCOPE_DEFS,
    getWorldScopes: crud.getWorldScopes,
    setWorldScope: crud.setWorldScope,
    removeWorldScope: crud.removeWorldScope,
    getVisibleEntities: crud.getVisibleEntities,
    buildWorldScopePrompt: crud.buildWorldScopePrompt,
    batchSetScopes: crud.batchSetScopes,
    buildScopePrompt: crud.buildScopePrompt,
    detectScopeViolation: crud.detectScopeViolation,
    resolveEffectiveScope: crud.resolveEffectiveScope,
    filterByScope: crud.filterByScope,
    getProjectWorlds: crud.getProjectWorlds,
    saveProjectWorlds: crud.saveProjectWorlds,

    // 来自 worldFactionModule.js
    setWorldFaction: factions.setWorldFaction,
    getWorldFactions: factions.getWorldFactions,
    removeWorldFaction: factions.removeWorldFaction,
    batchSetWorldFactions: factions.batchSetWorldFactions,

    // 来自 worldScopeExtractRunner.js
    extractAndSave: runner.extractAndSave
};
