/**
 * contextAssemblyMapBuilder.js — 上下文装配图：素材树构建器
 * 构建项目素材的树状结构，用于思维导图可视化
 * 根=项目, 二级=超级分组, 三级=类别分支, 四级=具体素材
 *
 * 世界观3层体系：
 *   宏观·底层规则 — 境界划分、力量体系、世界运行规则
 *   中观·势力与地理 — 地理版图、宗派势力、时代背景、子位面
 *   微观·细节补充 — 专有术语、常见物品、习俗文化、关键场景
 * 角色3层体系：
 *   主角·核心设定 — 基础信息、性格内核、能力配置、人物弧光、标志性特征
 *   配角与反派 — 剧情功能定位、核心动机与立场、性格/外貌标签
 *   人物关系网 — 核心关系、恩怨纠葛、利益绑定
 */
const store = require('../../store');
const { classifyMaterial, classifyMaterials } = require('./worldviewClassification');
const { resolveDepth, DEPTH_LEVELS, WORLDVIEW_DEPTH_RULES, CHARACTER_MATERIAL_TYPES } = require('./contextDepthConstants');
const { getDeclaration } = require('./agentDeclarations');
const contextOverrideStore = require('./contextOverrideStore');
const logger = require('../../shared/logger');

const NODE_STATUS = { HEALTHY: 'healthy', WARNING: 'warning', ERROR: 'error', EMPTY: 'empty' };

/** 二级分类定义 — 思维导图的分支节点 */
const CATEGORY_BRANCHES = [
    { key: 'worldview-macro', label: '宏观·底层规则', icon: '🌍', parentKey: 'worldview', worldviewDepth: 'macro',
      description: '境界划分、力量体系、世界运行规则' },
    { key: 'worldview-meso', label: '中观·势力与地理', icon: '🏔', parentKey: 'worldview', worldviewDepth: 'meso',
      description: '地理版图、宗派势力、时代背景、子位面' },
    { key: 'worldview-micro', label: '微观·细节补充', icon: '🔬', parentKey: 'worldview', worldviewDepth: 'micro',
      description: '专有术语、常见物品、习俗文化、关键场景' },
    { key: 'character-protagonist', label: '主角·核心设定', icon: '⭐', parentKey: 'character',
      description: '基础信息、性格内核、能力配置、人物弧光、标志性特征' },
    { key: 'character-supporting', label: '配角与反派', icon: '🎭', parentKey: 'character',
      description: '剧情功能定位、核心动机与立场、性格/外貌标签' },
    { key: 'character-relationship', label: '人物关系网', icon: '🕸', parentKey: 'character',
      description: '核心关系、恩怨纠葛、利益绑定' },
    { key: 'equipment', label: '装备', icon: '🗡', parentKey: 'bindable' },
    { key: 'technique', label: '功法', icon: '📖', parentKey: 'bindable' },
    { key: 'foreshadowing', label: '伏笔', icon: '🪝', parentKey: 'foreshadowing' },
    { key: 'knowledge-access', label: '知识库', icon: '📚', parentKey: 'knowledge' },
];

function assessNodeStatus(items, agentDeclarations, currentDepth) {
    if (!items || items.length === 0) {
        const isRequired = agentDeclarations.some(d => (d.materialNeeds || []).some(n => n.required));
        return isRequired ? NODE_STATUS.ERROR : NODE_STATUS.EMPTY;
    }
    return resolveDepth(currentDepth) === 'L0' ? NODE_STATUS.WARNING : NODE_STATUS.HEALTHY;
}

async function buildContextAssemblyMap(projectId, chapterNumber) {
    const project = await store.getItem('projects', projectId);
    if (!project) return { error: 'Project not found' };

    const materials = await store.queryItems('materials', { projectId });
    const active = materials.filter(m => !m.archived);
    const classified = classifyMaterials(active);
    const overrides = await _safeGetOverrides(projectId);
    const overrideMap = {};
    for (const o of overrides) overrideMap[o.materialId] = o;

    const writerDecl = getDeclaration('writer') || {};
    const writerNeeds = writerDecl.materialNeeds || [];

    const root = { id: projectId, label: project.name || '未命名项目', icon: '📁', status: NODE_STATUS.HEALTHY, depth: null, children: [] };

    for (const branch of CATEGORY_BRANCHES) {
        const branchItems = _getBranchItems(branch, classified, active);
        const defaultDepth = _getDefaultDepth(branch, writerNeeds);
        const branchOverride = branchItems.find(item => overrideMap[item.id]);
        const currentDepth = branchOverride ? overrideMap[branchOverride.id].targetDepth : defaultDepth;
        const status = assessNodeStatus(branchItems, writerNeeds, currentDepth);

        const childNodes = branchItems.map(item => {
            const itemOverride = overrideMap[item.id];
            const itemDepth = itemOverride ? itemOverride.targetDepth : defaultDepth;
            return {
                id: item.id, label: item.name || '未命名', icon: _typeIcon(item.type),
                status: _assessItemStatus(item, itemDepth, writerNeeds),
                depth: itemDepth, type: item.type,
                hasOverride: !!itemOverride, overrideId: itemOverride?.id || null,
                wordCount: (item.content || '').length,
            };
        });

        root.children.push({
            id: branch.key, label: branch.label, icon: branch.icon,
            description: branch.description || null,
            status, depth: currentDepth, defaultDepth,
            type: branch.key, itemCount: branchItems.length, children: childNodes,
        });
    }

    const summary = _buildSummary(root);
    root.status = summary.worstStatus;
    return { root, summary, depthLevels: DEPTH_LEVELS, chapterNumber: chapterNumber || 1 };
}

function _getBranchItems(branch, classified, allMaterials) {
    if (branch.worldviewDepth) return classified[branch.worldviewDepth] || [];
    if (branch.key === 'character-protagonist') {
        return (allMaterials || []).filter(m =>
            m.type === 'character' && m.roleLevel === 'protagonist'
        );
    }
    if (branch.key === 'character-supporting') {
        return (allMaterials || []).filter(m =>
            m.type === 'character' && m.roleLevel !== 'protagonist'
        );
    }
    if (branch.key === 'character-relationship') {
        return (allMaterials || []).filter(m => m.type === 'character-relationship');
    }
    if (branch.key === 'equipment' || branch.key === 'technique') return classified.bindable?.filter(m => m.type === branch.key) || [];
    if (branch.key === 'foreshadowing') return classified.foreshadowing || [];
    if (branch.key === 'knowledge-access') return [];
    return (allMaterials || []).filter(m => m.type === branch.key);
}

function _getDefaultDepth(branch, writerNeeds) {
    const need = writerNeeds.find(n => n.type === branch.key);
    if (need) return resolveDepth(need.detail);
    if (branch.worldviewDepth) return WORLDVIEW_DEPTH_RULES[branch.worldviewDepth]?.defaultLoad || 'L0';
    return 'L0';
}

function _assessItemStatus(item, depth, writerNeeds) {
    const need = writerNeeds.find(n => n.type === item.type);
    if (!item.content || item.content.length < 10) return need?.required ? NODE_STATUS.ERROR : NODE_STATUS.WARNING;
    return resolveDepth(depth) === 'L0' ? NODE_STATUS.WARNING : NODE_STATUS.HEALTHY;
}

function _typeIcon(type) {
    const icons = { character: '👤', 'character-relationship': '🕸', worldview: '🌍', 'power-system': '⚡', faction: '🏯', organization: '🏛', geography: '🗺', scene: '🎬', phenomenon: '🌌', equipment: '🗡', technique: '📖', foreshadowing: '🪝', 'sub-plane': '🌀' };
    return icons[type] || '📄';
}

function _buildSummary(root) {
    let healthy = 0, warning = 0, error = 0, empty = 0, total = 0;
    for (const branch of root.children) {
        total++;
        const cnt = { healthy, warning, error, empty };
        cnt[branch.status] = (cnt[branch.status] || 0) + 1;
        ({ healthy, warning, error, empty } = cnt);
        for (const child of branch.children || []) {
            total++;
            const cnt2 = { healthy, warning, error, empty };
            cnt2[child.status] = (cnt2[child.status] || 0) + 1;
            ({ healthy, warning, error, empty } = cnt2);
        }
    }
    const worstStatus = error > 0 ? NODE_STATUS.ERROR : warning > 0 ? NODE_STATUS.WARNING : NODE_STATUS.HEALTHY;
    return { healthy, warning, error, empty, total, worstStatus };
}

async function _safeGetOverrides(projectId) {
    try { return await contextOverrideStore.getOverrides(projectId); } catch { return []; }
}

module.exports = { buildContextAssemblyMap, NODE_STATUS, CATEGORY_BRANCHES, DEPTH_LEVELS };
