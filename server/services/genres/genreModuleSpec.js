/**
 * genreModuleSpec.js — 题材功能模块规范定义
 *
 * 设计理念：题材插件 = 基础parts + 功能模块(modules)
 * 模块是自包含的功能单元（如符咒系统/攻略进度/小世界约束）
 * 模块内容合并到genre现有字段，agent通过enabledModules查询
 *
 * 模块字段说明：
 *   id                       模块唯一标识（必填）
 *   label                    模块名称（必填）
 *   description              模块描述
 *   entityTypes              实体类型扩展（合并到entitySchema.entityTypes）
 *   genreStateKeys           状态键扩展（合并到entitySchema.genreStateKeys）
 *   relationTypes            关系类型扩展（合并到entitySchema.relationTypes）
 *   relationTypeKeywords     关系关键词扩展（合并到entitySchema.relationTypeKeywords）
 *   narrativePhases          叙事阶段扩展（合并到entitySchema.narrativePhases）
 *   milestones               里程碑扩展（合并到entitySchema.milestones）
 *   constraints              约束扩展（合并到constraintPresets）
 *   characterProfileOverrides 角色素材覆盖（deepMerge到characterProfile）
 *   stateSchemaExtensions    状态Schema扩展（deepMerge到stateSchema）
 *   kvImportantKeysExtensions KV重要键扩展（合并到kvImportantKeys）
 *   materialTemplates        素材模板扩展（合并到materialTemplates）
 *   perspectiveConfig        视角配置（合并到perspective）
 *   agentAccess              agent访问权限（'*'表示所有agent可访问）
 *   dependencies             依赖的其他模块id数组
 */

'use strict';

const MODULE_REQUIRED_FIELDS = ['id', 'label'];
const MODULE_AGENT_ACCESS_ALL = '*';

const MODULE_FIELD_SCHEMA = {
    id: { type: 'string', required: true, description: '模块唯一标识' },
    label: { type: 'string', required: true, description: '模块名称' },
    description: { type: 'string', required: false, description: '模块描述' },
    entityTypes: { type: 'array', required: false, description: '实体类型扩展' },
    genreStateKeys: { type: 'object', required: false, description: '状态键扩展' },
    relationTypes: { type: 'array', required: false, description: '关系类型扩展' },
    relationTypeKeywords: { type: 'object', required: false, description: '关系关键词扩展' },
    narrativePhases: { type: 'array', required: false, description: '叙事阶段扩展' },
    milestones: { type: 'object', required: false, description: '里程碑扩展' },
    constraints: { type: 'object', required: false, description: '约束扩展' },
    characterProfileOverrides: { type: 'object', required: false, description: '角色素材覆盖' },
    stateSchemaExtensions: { type: 'object', required: false, description: '状态Schema扩展' },
    kvImportantKeysExtensions: { type: 'array', required: false, description: 'KV重要键扩展' },
    materialTemplates: { type: 'object', required: false, description: '素材模板扩展' },
    perspectiveConfig: { type: 'object', required: false, description: '视角配置' },
    agentAccess: { type: 'array', required: false, default: MODULE_AGENT_ACCESS_ALL, description: 'agent访问权限' },
    dependencies: { type: 'array', required: false, default: [], description: '依赖的其他模块id' }
};

/**
 * 校验单个模块
 * @param {object} module - 模块对象
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
function validateModule(module) {
    const errors = [];
    const warnings = [];

    if (!module || typeof module !== 'object') {
        errors.push('模块必须是对象');
        return { valid: false, errors, warnings };
    }

    for (const field of MODULE_REQUIRED_FIELDS) {
        if (!module[field]) {
            errors.push(`模块缺少必填字段: ${field}`);
        }
    }

    if (module.id && typeof module.id !== 'string') {
        errors.push('模块id必须是字符串');
    }
    if (module.label && typeof module.label !== 'string') {
        errors.push('模块label必须是字符串');
    }
    if (module.agentAccess !== undefined && !Array.isArray(module.agentAccess) && module.agentAccess !== MODULE_AGENT_ACCESS_ALL) {
        errors.push('模块agentAccess必须是数组或"*"');
    }
    if (module.dependencies !== undefined && !Array.isArray(module.dependencies)) {
        errors.push('模块dependencies必须是数组');
    }

    const arrayFields = ['entityTypes', 'relationTypes', 'narrativePhases', 'kvImportantKeysExtensions'];
    for (const field of arrayFields) {
        if (module[field] !== undefined && !Array.isArray(module[field])) {
            errors.push(`模块${field}必须是数组`);
        }
    }

    const objectFields = ['genreStateKeys', 'relationTypeKeywords', 'milestones', 'constraints',
        'characterProfileOverrides', 'stateSchemaExtensions', 'materialTemplates', 'perspectiveConfig'];
    for (const field of objectFields) {
        if (module[field] !== undefined && (typeof module[field] !== 'object' || Array.isArray(module[field]))) {
            errors.push(`模块${field}必须是对象`);
        }
    }

    return { valid: errors.length === 0, errors, warnings };
}

/**
 * 校验模块间依赖关系
 * @param {Array} modules - 模块数组
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateModuleDependencies(modules) {
    const errors = [];
    if (!Array.isArray(modules)) {
        return { valid: false, errors: ['modules必须是数组'] };
    }

    const moduleIds = new Set(modules.map(m => m.id));
    const seenIds = new Set();

    for (const module of modules) {
        if (seenIds.has(module.id)) {
            errors.push(`模块id重复: "${module.id}"`);
        }
        seenIds.add(module.id);

        if (!module.dependencies) continue;
        for (const depId of module.dependencies) {
            if (!moduleIds.has(depId)) {
                errors.push(`模块"${module.id}"依赖的模块"${depId}"不存在`);
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

module.exports = {
    MODULE_FIELD_SCHEMA,
    MODULE_REQUIRED_FIELDS,
    MODULE_AGENT_ACCESS_ALL,
    validateModule,
    validateModuleDependencies
};
