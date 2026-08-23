/**
 * genreModuleAssembler.js — 题材功能模块组装逻辑
 *
 * 职责：将功能模块合并到genre对象，提供模块查询接口
 * 合并策略：deepMerge到对应字段，数组去重合并
 *
 * 依赖：baseGenreTemplate.deepMerge, genreModuleSpec校验
 */

'use strict';

const { deepMerge } = require('./baseGenreTemplate');
const { validateModule, validateModuleDependencies, MODULE_AGENT_ACCESS_ALL } = require('./genreModuleSpec');

/**
 * 递归合并两个对象，数组字段做合并去重（而非覆盖）
 * 用于stateSchema等需要数组合并的场景
 * @param {object} target - 目标对象
 * @param {object} source - 源对象
 * @returns {object} 合并后的对象
 */
function deepMergeWithArrayMerge(target, source) {
    if (!target) return source;
    if (!source) return target;
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (Array.isArray(source[key])) {
            result[key] = [...new Set([...(target[key] || []), ...source[key]])];
        } else if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMergeWithArrayMerge(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

/**
 * 将单个模块合并到genre对象
 * @param {object} genre - genre对象（会被修改）
 * @param {object} module - 模块对象
 * @returns {object} 修改后的genre
 */
function mergeModuleToGenre(genre, module) {
    if (!genre || !module) return genre;

    if (!genre.entitySchema) genre.entitySchema = {};
    const es = genre.entitySchema;

    if (module.entityTypes) {
        es.entityTypes = [...new Set([...(es.entityTypes || []), ...module.entityTypes])];
    }
    if (module.genreStateKeys) {
        es.genreStateKeys = deepMerge(deepMerge({}, es.genreStateKeys || {}), module.genreStateKeys);
    }
    if (module.relationTypes) {
        es.relationTypes = [...new Set([...(es.relationTypes || []), ...module.relationTypes])];
    }
    if (module.relationTypeKeywords) {
        es.relationTypeKeywords = deepMerge(deepMerge({}, es.relationTypeKeywords || {}), module.relationTypeKeywords);
    }
    if (module.narrativePhases) {
        es.narrativePhases = [...new Set([...(es.narrativePhases || []), ...module.narrativePhases])];
    }
    if (module.milestones) {
        es.milestones = { ...(es.milestones || {}), ...module.milestones };
    }

    if (module.constraints) {
        genre.constraintPresets = { ...(genre.constraintPresets || {}), ...module.constraints };
    }

    if (module.characterProfileOverrides) {
        genre.characterProfile = deepMerge(deepMerge({}, genre.characterProfile || {}), module.characterProfileOverrides);
    }

    if (module.stateSchemaExtensions) {
        genre.stateSchema = deepMergeWithArrayMerge(genre.stateSchema || {}, module.stateSchemaExtensions);
    }

    if (module.kvImportantKeysExtensions) {
        genre.kvImportantKeys = [...new Set([...(genre.kvImportantKeys || []), ...module.kvImportantKeysExtensions])];
    }

    if (module.materialTemplates) {
        genre.materialTemplates = deepMerge(deepMerge({}, genre.materialTemplates || {}), module.materialTemplates);
    }

    if (module.perspectiveConfig) {
        genre.perspective = deepMerge(deepMerge({}, genre.perspective || {}), module.perspectiveConfig);
    }

    return genre;
}

/**
 * 组装多个模块到genre
 * @param {object} genre - 已组装的genre对象
 * @param {Array} modules - 模块数组
 * @returns {object} 组装后的genre（含enabledModules元信息）
 * @throws {Error} 模块校验或依赖校验失败时抛出
 */
function assembleModules(genre, modules = []) {
    if (!genre) throw new Error('assembleModules: genre不能为空');

    if (!Array.isArray(modules) || modules.length === 0) {
        genre.enabledModules = [];
        return genre;
    }

    for (const module of modules) {
        const { valid, errors } = validateModule(module);
        if (!valid) {
            throw new Error(`模块校验失败 [${module.id || 'UNKNOWN'}]: ${errors.join('; ')}`);
        }
    }

    const depResult = validateModuleDependencies(modules);
    if (!depResult.valid) {
        throw new Error(`模块依赖校验失败: ${depResult.errors.join('; ')}`);
    }

    for (const module of modules) {
        mergeModuleToGenre(genre, module);
    }

    genre.enabledModules = modules.map(m => ({
        id: m.id,
        label: m.label,
        description: m.description || '',
        agentAccess: m.agentAccess || MODULE_AGENT_ACCESS_ALL,
        dependencies: m.dependencies || []
    }));

    return genre;
}

/**
 * 查询genre启用的所有模块
 * @param {object} genre - genre对象
 * @returns {Array} 模块元信息数组
 */
function getEnabledModules(genre) {
    return (genre && genre.enabledModules) || [];
}

/**
 * 查询genre是否启用了指定模块
 * @param {object} genre - genre对象
 * @param {string} moduleId - 模块id
 * @returns {boolean}
 */
function hasModule(genre, moduleId) {
    return getEnabledModules(genre).some(m => m.id === moduleId);
}

/**
 * 查询agent是否有权限访问指定模块
 * @param {object} genre - genre对象
 * @param {string} moduleId - 模块id
 * @param {string} agentType - agent类型
 * @returns {boolean}
 */
function canAgentAccessModule(genre, moduleId, agentType) {
    const moduleMeta = getEnabledModules(genre).find(m => m.id === moduleId);
    if (!moduleMeta) return false;
    if (moduleMeta.agentAccess === MODULE_AGENT_ACCESS_ALL) return true;
    return Array.isArray(moduleMeta.agentAccess) && moduleMeta.agentAccess.includes(agentType);
}

/**
 * 获取agent可访问的所有模块
 * @param {object} genre - genre对象
 * @param {string} agentType - agent类型
 * @returns {Array} 模块元信息数组
 */
function getModulesForAgent(genre, agentType) {
    return getEnabledModules(genre).filter(m => {
        if (m.agentAccess === MODULE_AGENT_ACCESS_ALL) return true;
        return Array.isArray(m.agentAccess) && m.agentAccess.includes(agentType);
    });
}

module.exports = {
    deepMergeWithArrayMerge,
    mergeModuleToGenre,
    assembleModules,
    getEnabledModules,
    hasModule,
    canAgentAccessModule,
    getModulesForAgent
};
