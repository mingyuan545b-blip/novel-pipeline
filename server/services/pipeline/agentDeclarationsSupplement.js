/**
 * agentDeclarationsSupplement.js — 辅助Agent素材需求声明
 * reviser/polisher/intent-planner/final-editor的声明
 * 被agentDeclarations.js合并到AGENT_DECLARATIONS
 *
 * 差异配置字段说明（声明式差异，消除调用处硬编码）：
 * - characterFormat: 角色段格式
 *   'full'    = writer专用formatter（含限知，不通过materialInjector）
 *   'brief'   = name+role+content截断200字（reviser用）
 *   'simple'  = 只有name+role（finalEditor/polisher用）
 *   'reader'  = name:content极简格式（reader用）
 *   'none'    = 不注入角色段
 * - foreshadowFilter: 伏笔过滤模式
 *   'active'  = 只显示未回收/挂起/待回收（执笔用）
 *   'all'     = 全量显示所有伏笔及状态（审核员用）
 *   'none'    = 不注入伏笔段
 * - materialSections: 是否通过injectMaterials注入其余素材段（relationship/famous-scene等）
 */

const SUPPLEMENT_DECLARATIONS = {
    reviser: {
        id: 'reviser',
        label: '返修',
        materialNeeds: [
            { type: 'character',    detail: 'full',    required: true,  budget: 3000, source: 'entity-center' },
            { type: 'relationship', detail: 'summary', required: true,  budget: 600,  source: 'materials' },
            { type: 'worldview',    detail: 'summary', required: false, budget: 600,  source: 'materials' },
            { type: 'foreshadowing',detail: 'brief',   required: false, budget: 300,  source: 'materials' },
            { type: 'famous-scene', detail: 'brief',   required: false, budget: 150,  source: 'materials', maxItems: 2 },
            { type: 'catchphrase',  detail: 'brief',   required: false, budget: 200,  source: 'materials', maxItems: 3 },
            { type: 'writing-technique', detail: 'brief', required: false, budget: 300, source: 'materials', maxItems: 2 },
            { type: 'institution',  detail: 'brief',   required: false, budget: 200,  source: 'materials' },
            { type: 'character-combat', detail: 'brief', required: false, budget: 200, source: 'materials', maxItems: 2 },
            { type: 'growth-history',detail: 'brief',  required: false, budget: 200,  source: 'materials', maxItems: 2 },
        ],
        constraintNeeds: {
            behaviorRules:  { source: 'entity-center', priority: 'entity' },
            genreRules:     { source: 'genre-plugin',  priority: 'genre' },
            styleProfile:   { source: 'project',       priority: 'genre' },
            relationshipGuard:     { source: 'relationship-stage', priority: 'genre' },
        },
        lifecycleFilter: 'writer',
        totalBudget: 6000,
        // 差异配置
        characterFormat: 'brief',
        foreshadowFilter: 'active',
        materialSections: true,
    },

    polisher: {
        id: 'polisher',
        label: '润色',
        materialNeeds: [
            { type: 'character',    detail: 'summary', required: true,  budget: 1500, source: 'entity-center' },
            { type: 'relationship', detail: 'brief',   required: false, budget: 400,  source: 'materials' },
            { type: 'famous-scene', detail: 'brief',   required: false, budget: 150,  source: 'materials', maxItems: 2 },
            { type: 'writing-technique', detail: 'brief', required: false, budget: 300, source: 'materials', maxItems: 2 },
        ],
        constraintNeeds: {
            genreRules:     { source: 'genre-plugin',  priority: 'genre' },
            styleProfile:   { source: 'project',       priority: 'genre' },
        },
        lifecycleFilter: 'reviewer',
        totalBudget: 3000,
        // 差异配置
        characterFormat: 'simple',
        foreshadowFilter: 'none',
        materialSections: true,
    },

    'intent-planner': {
        id: 'intent-planner',
        label: '意图规划',
        materialNeeds: [
            { type: 'character',    detail: 'summary', required: true,  budget: 1500, source: 'entity-center' },
            { type: 'relationship', detail: 'brief',   required: false, budget: 400,  source: 'materials' },
            { type: 'foreshadowing',detail: 'brief',   required: false, budget: 300,  source: 'materials' },
            { type: 'worldview',    detail: 'brief',   required: false, budget: 400,  source: 'materials' },
        ],
        constraintNeeds: {
            genreRules:     { source: 'genre-plugin',  priority: 'genre' },
        },
        lifecycleFilter: 'writer',
        totalBudget: 3000,
        // 差异配置
        characterFormat: 'simple',
        foreshadowFilter: 'active',
        materialSections: true,
    },

    'final-editor': {
        id: 'final-editor',
        label: '定稿',
        materialNeeds: [
            { type: 'character',    detail: 'summary', required: true,  budget: 1500, source: 'entity-center' },
            { type: 'relationship', detail: 'brief',   required: false, budget: 400,  source: 'materials' },
            { type: 'famous-scene', detail: 'brief',   required: false, budget: 150,  source: 'materials', maxItems: 2 },
            { type: 'foreshadowing',detail: 'brief',   required: false, budget: 300,  source: 'materials' },
            { type: 'writing-technique', detail: 'brief', required: false, budget: 300, source: 'materials', maxItems: 2 },
        ],
        constraintNeeds: {
            behaviorRules:  { source: 'entity-center', priority: 'entity' },
            genreRules:     { source: 'genre-plugin',  priority: 'genre' },
            styleProfile:   { source: 'project',       priority: 'genre' },
        },
        lifecycleFilter: 'reviewer',
        totalBudget: 3500,
        // 差异配置：定稿人需要看全量伏笔状态（含已回收）以确保一致性
        characterFormat: 'simple',
        foreshadowFilter: 'all',
        materialSections: true,
    },

    reader: {
        id: 'reader',
        label: '读者',
        materialNeeds: [
            { type: 'character',    detail: 'brief',   required: false, budget: 1000, source: 'materials' },
            { type: 'relationship', detail: 'brief',   required: false, budget: 400,  source: 'materials' },
            { type: 'foreshadowing',detail: 'brief',   required: false, budget: 200,  source: 'materials' },
        ],
        constraintNeeds: {},
        lifecycleFilter: null,
        totalBudget: 2000,
        // 差异配置：reader极简角色格式（name:content），伏笔只看未回收
        characterFormat: 'reader',
        foreshadowFilter: 'active',
        materialSections: true,
    },

    'material-manager': {
        id: 'material-manager',
        label: '素材管理',
        materialNeeds: [
            { type: 'character',    detail: 'index',   required: false, budget: 500,  source: 'materials' },
            { type: 'relationship', detail: 'index',   required: false, budget: 300,  source: 'materials' },
            { type: 'famous-scene', detail: 'index',   required: false, budget: 200,  source: 'materials' },
            { type: 'catchphrase',  detail: 'index',   required: false, budget: 200,  source: 'materials' },
            { type: 'worldview',    detail: 'index',   required: false, budget: 200,  source: 'materials' },
            { type: 'foreshadowing',detail: 'index',   required: false, budget: 200,  source: 'materials' },
            { type: 'writing-technique', detail: 'index', required: false, budget: 200, source: 'materials' },
            { type: 'institution',  detail: 'index',   required: false, budget: 200,  source: 'materials' },
            { type: 'character-combat', detail: 'index', required: false, budget: 200, source: 'materials' },
            { type: 'growth-history',detail: 'index',  required: false, budget: 200,  source: 'materials' },
        ],
        constraintNeeds: {
            genreRules: { source: 'genre-plugin', priority: 'genre' },
        },
        lifecycleFilter: null,
        totalBudget: 2000,
    },
};

module.exports = { SUPPLEMENT_DECLARATIONS };
