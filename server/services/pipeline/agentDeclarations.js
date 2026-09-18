/**
 * agentDeclarations.js — Agent声明式素材需求定义
 * 每个Agent声明自己需要什么数据类型、精度、优先级
 * 调度器根据声明+大纲意图加载素材，而非Agent自己硬编码拼装
 */

/** 素材精度级别（L0-L4新体系，旧名映射到新层级） */
const DETAIL_LEVELS = {
    L0:    { label: '索引', maxChars: 60,   legacy: 'index' },
    L1:    { label: '简要', maxChars: 200,  legacy: 'brief' },
    L2:    { label: '摘要', maxChars: 500,  legacy: 'summary' },
    L3:    { label: '完整', maxChars: 1500, legacy: 'full' },
    L4:    { label: '原始', maxChars: null,  legacy: 'raw' },
    // 旧名兼容
    index:   { label: '索引', maxChars: 60,   mapsTo: 'L0' },
    brief:   { label: '简要', maxChars: 200,  mapsTo: 'L1' },
    summary: { label: '摘要', maxChars: 500,  mapsTo: 'L2' },
    full:    { label: '完整', maxChars: 1500, mapsTo: 'L3' },
};

/** 约束优先级：entity > genre > global */
const CONSTRAINT_PRIORITY = {
    entity:  { level: 3, label: '实体级（最高）' },
    genre:   { level: 2, label: '题材级' },
    global:  { level: 1, label: '全局级（最低）' },
};

/** 核心Agent素材需求声明 */
const CORE_DECLARATIONS = {
    writer: {
        id: 'writer',
        label: '执笔',
        materialNeeds: [
            { type: 'character',    detail: 'full',    required: true,  budget: 4000, source: 'entity-center' },
            { type: 'relationship', detail: 'summary', required: true,  budget: 800,  source: 'relations' },
            { type: 'worldview',    detail: 'full',    required: true,  budget: 800,  source: 'materials' },
            { type: 'power-system', detail: 'summary', required: false, budget: 400,  source: 'materials' },
            { type: 'equipment',    detail: 'summary', required: false, budget: 300,  source: 'materials', matchOutline: true },
            { type: 'location',     detail: 'brief',   required: false, budget: 300,  source: 'materials', matchOutline: true },
            { type: 'foreshadowing',detail: 'summary', required: false, budget: 400,  source: 'materials' },
            { type: 'sub-plane',    detail: 'summary', required: false, budget: 500,  source: 'materials' },
            { type: 'faction',      detail: 'brief',   required: false, budget: 200,  source: 'materials' },
            { type: 'catchphrase',  detail: 'brief',   required: false, budget: 200,  source: 'materials', maxItems: 5 },
            { type: 'famous-scene', detail: 'brief',   required: false, budget: 150,  source: 'materials', maxItems: 3 },
            { type: 'writing-technique', detail: 'brief', required: false, budget: 400, source: 'materials', maxItems: 3 },
            { type: 'institution',   detail: 'brief',   required: false, budget: 300,  source: 'materials' },
            { type: 'character-combat', detail: 'brief', required: false, budget: 300, source: 'materials', maxItems: 3 },
            { type: 'growth-history',detail: 'brief',   required: false, budget: 300,  source: 'materials', maxItems: 2 },
            { type: 'knowledge-access', detail: 'summary', required: false, budget: 600,  source: 'knowledge-access' },
        ],
        constraintNeeds: {
            behaviorRules:  { source: 'entity-center', priority: 'entity' },
            genreRules:     { source: 'genre-plugin',  priority: 'genre' },
            styleProfile:   { source: 'project',       priority: 'genre' },
            consistencyConstraints: { source: 'consistency-store', priority: 'global' },
            relationshipGuard:     { source: 'relationship-stage', priority: 'genre' },
        },
        lifecycleFilter: 'writer',
        totalBudget: 9000,
        // 差异配置：writer用full（含限知，由writerCharacterFormatter处理，不通过materialInjector）
        characterFormat: 'full',
        foreshadowFilter: 'active',
        materialSections: true,
    },

    'first-review': {
        id: 'first-review',
        label: '初审',
        materialNeeds: [
            { type: 'character',    detail: 'summary', required: true,  budget: 2000, source: 'entity-center' },
            { type: 'relationship', detail: 'brief',   required: false, budget: 400,  source: 'relations' },
            { type: 'foreshadowing',detail: 'brief',   required: false, budget: 300,  source: 'materials' },
            { type: 'worldview',    detail: 'brief',   required: false, budget: 400,  source: 'materials' },
            { type: 'institution',  detail: 'brief',   required: false, budget: 200,  source: 'materials' },
            { type: 'character-combat', detail: 'brief', required: false, budget: 200, source: 'materials', maxItems: 2 },
            { type: 'knowledge-access', detail: 'brief', required: false, budget: 400, source: 'knowledge-access' },
        ],
        constraintNeeds: {
            behaviorRules:  { source: 'entity-center', priority: 'entity' },
            genreRules:     { source: 'genre-plugin',  priority: 'genre' },
            styleProfile:   { source: 'project',       priority: 'genre' },
        },
        lifecycleFilter: 'reviewer',
        totalBudget: 4500,
        // 差异配置：初审用review角色格式（显示lifecycleState+审核依据措辞），全量伏笔
        characterFormat: 'review',
        foreshadowFilter: 'all',
        materialSections: true,
    },

    'second-review': {
        id: 'second-review',
        label: '复审',
        materialNeeds: [
            { type: 'character',    detail: 'summary', required: true,  budget: 1500, source: 'entity-center' },
            { type: 'relationship', detail: 'brief',   required: false, budget: 400,  source: 'relations' },
            { type: 'foreshadowing',detail: 'brief',   required: false, budget: 300,  source: 'materials' },
            { type: 'worldview',    detail: 'brief',   required: false, budget: 400,  source: 'materials' },
            { type: 'institution',  detail: 'brief',   required: false, budget: 200,  source: 'materials' },
            { type: 'character-combat', detail: 'brief', required: false, budget: 200, source: 'materials', maxItems: 2 },
            { type: 'knowledge-access', detail: 'brief', required: false, budget: 400, source: 'knowledge-access' },
        ],
        constraintNeeds: {
            behaviorRules:  { source: 'entity-center', priority: 'entity' },
            genreRules:     { source: 'genre-plugin',  priority: 'genre' },
            styleProfile:   { source: 'project',       priority: 'genre' },
        },
        lifecycleFilter: 'reviewer',
        totalBudget: 3500,
        // 差异配置：复审用review角色格式（显示lifecycleState+审核依据措辞），全量伏笔
        characterFormat: 'review',
        foreshadowFilter: 'all',
        materialSections: true,
    },

    'fast-review': {
        id: 'fast-review',
        label: '快审',
        materialNeeds: [
            { type: 'character',    detail: 'brief',   required: true,  budget: 1000, source: 'entity-center' },
            { type: 'relationship', detail: 'brief',   required: false, budget: 300,  source: 'relations' },
            { type: 'foreshadowing',detail: 'brief',   required: false, budget: 200,  source: 'materials' },
            { type: 'knowledge-access', detail: 'brief', required: false, budget: 300, source: 'knowledge-access' },
        ],
        constraintNeeds: {
            behaviorRules:  { source: 'entity-center', priority: 'entity' },
            genreRules:     { source: 'genre-plugin',  priority: 'genre' },
        },
        lifecycleFilter: 'reviewer',
        totalBudget: 2500,
        // 差异配置：快审用review角色格式（显示lifecycleState+审核依据措辞），全量伏笔
        characterFormat: 'review',
        foreshadowFilter: 'all',
        materialSections: true,
    },
};

// 合并辅助Agent声明（reviser/polisher/intent-planner/final-editor/reader/material-manager）
const { SUPPLEMENT_DECLARATIONS } = require('./agentDeclarationsSupplement');
const AGENT_DECLARATIONS = { ...CORE_DECLARATIONS, ...SUPPLEMENT_DECLARATIONS };

function getDeclaration(agentType) {
    return AGENT_DECLARATIONS[agentType] || null;
}

function getRequiredTypes(agentType) {
    const decl = getDeclaration(agentType);
    if (!decl) return [];
    return decl.materialNeeds.filter(n => n.required).map(n => n.type);
}

function getAllTypes(agentType) {
    const decl = getDeclaration(agentType);
    if (!decl) return [];
    return decl.materialNeeds.map(n => n.type);
}

function getLifecycleFilter(agentType) {
    const decl = getDeclaration(agentType);
    return decl ? decl.lifecycleFilter : null;
}

function getConstraintNeeds(agentType) {
    const decl = getDeclaration(agentType);
    return decl ? decl.constraintNeeds : {};
}

/** 获取Agent的素材差异配置（characterFormat/foreshadowFilter/materialSections）
 *  返回默认值确保向后兼容：未配置的Agent按默认行为处理（注入素材段） */
function getMaterialDifferences(agentType) {
    const decl = getDeclaration(agentType);
    if (!decl) {
        // 未配置的Agent默认注入素材段（向后兼容）
        return { characterFormat: 'none', foreshadowFilter: 'active', materialSections: true };
    }
    return {
        characterFormat: decl.characterFormat || 'none',
        foreshadowFilter: decl.foreshadowFilter || 'active',
        materialSections: decl.materialSections !== false,
    };
}

module.exports = {
    DETAIL_LEVELS,
    CONSTRAINT_PRIORITY,
    AGENT_DECLARATIONS,
    getDeclaration,
    getRequiredTypes,
    getAllTypes,
    getLifecycleFilter,
    getConstraintNeeds,
    getMaterialDifferences,
};
