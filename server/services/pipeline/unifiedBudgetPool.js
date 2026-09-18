/**
 * unifiedBudgetPool.js — 统一预算管理器（预算池分配 + Agent素材分类）
 *
 * 2026-09-18 拆分：预算评估/降级决策移至 contextBudgetPlanner.js，
 * 本文件保留：统一预算池分区、素材分类与槽位分配、user content 组装。
 * 对外导出保持向后兼容（calculateBudget 等由 planner 转发）。
 */
'use strict';

const { ContextBudget, estimateTokens, truncateToTokens } = require('../contextBudget');
const { calculateBudget, MODEL_BUDGETS, MODEL_BUDGET_OVERRIDES, DEGRADATION_THRESHOLDS } = require('./contextBudgetPlanner');
const { DEPTH_LEVELS } = require('./contextDepthConstants');
const logger = require('../../shared/logger');

const BUDGET_ZONES = {
    memory:      { label: '记忆上下文', ratio: 0.25, minTokens: 1000 },
    characters:  { label: '角色素材',   ratio: 0.30, minTokens: 1500 },
    worldview:   { label: '世界观素材', ratio: 0.15, minTokens: 500 },
    plot:        { label: '剧情素材',   ratio: 0.15, minTokens: 500 },
    constraints: { label: '约束规则',   ratio: 0.10, minTokens: 300 },
    reserve:     { label: '预留缓冲',   ratio: 0.05, minTokens: 200 },
};

const WORLDVIEW_TYPES = new Set(['worldview','power-system','relationship','scene','phenomenon','institution','organization','faction','geography','technology']);
const CHARACTER_TYPES = new Set(['character','character-psychology','character-combat','character-personality','character-relationship','character-dialogue','character-behavior','foreshadowing']);

/* ===== 统一预算池分配 ===== */
/** 估算单个素材需求的 token 占用（供统一预算池的 zone.used 统计使用） */
function _estimateTokenCost(need) {
    const depthConfig = DEPTH_LEVELS[need.resolvedDepth] || DEPTH_LEVELS.L2;
    return Math.round((depthConfig.tokenBudget || 330) * (need.maxItems || 5) * 1.2);
}

function allocateUnifiedBudget(params) {
    const { model, totalBudget, memorySize = 0, materialNeeds = [], constraints = [] } = params;
    const zones = {};
    let remaining = totalBudget;
    const warnings = [];
    for (const [name, config] of Object.entries(BUDGET_ZONES)) {
        const allocated = Math.max(config.minTokens, Math.round(totalBudget * config.ratio));
        zones[name] = { ...config, allocated, used: 0 };
        remaining -= allocated;
    }
    if (remaining < 0) {
        warnings.push(`总预算${totalBudget}不足以满足最低分配需求`);
        _reduceProportionally(zones, totalBudget);
    } else if (remaining > 0) {
        zones.characters.allocated += remaining;
    }
    if (memorySize > 0) {
        const memoryUsed = Math.min(memorySize, zones.memory.allocated);
        zones.memory.used = memoryUsed;
        if (memoryUsed >= zones.memory.allocated * 0.9) warnings.push('记忆上下文占用过高，建议压缩历史章节');
    }
    for (const need of materialNeeds) {
        const zone = _getZoneForType(need.type);
        if (zones[zone]) zones[zone].used += _estimateTokenCost(need);
    }
    for (const c of constraints) zones.constraints.used += (c.length || 0) / 4;
    return { zones, totalAllocated: Object.values(zones).reduce((s, z) => s + z.allocated, 0), warnings };
}

function _getZoneForType(type) {
    const map = { character:'characters','character-psychology':'characters','character-combat':'characters','character-personality':'characters', worldview:'worldview','power-system':'worldview',faction:'worldview',geography:'worldview','sub-plane':'worldview',organization:'worldview', foreshadowing:'plot',equipment:'plot',technique:'plot','famous-scene':'plot',catchphrase:'plot' };
    return map[type] || 'worldview';
}

function _reduceProportionally(zones, totalBudget) {
    const totalMin = Object.values(zones).reduce((s, z) => s + z.minTokens, 0);
    const ratio = totalBudget / totalMin;
    for (const zone of Object.values(zones)) zone.allocated = Math.round(zone.minTokens * ratio);
}

/* ===== Agent素材分类与分配(原agentBudgetManager) ===== */
function classifyMaterials(materials, allowedTypes) {
    const worldviewMats = [], characterMats = [], otherMats = [], indexMats = [];
    const matArray = Array.isArray(materials) ? materials : (typeof materials === 'object' ? Object.values(materials) : []);
    const filteredMats = allowedTypes ? matArray.filter(m => allowedTypes.has(m.type || m.category || '')) : matArray;
    for (const m of filteredMats) {
        const type = m.type || m.category || '';
        if (WORLDVIEW_TYPES.has(type)) worldviewMats.push(m);
        else if (CHARACTER_TYPES.has(type)) characterMats.push(m);
        else if (type === 'index') indexMats.push(m);
        else otherMats.push(m);
    }
    return { worldviewMats, characterMats, otherMats, indexMats };
}

function allocateMaterialsToBudget(budget, classified, detailLevel, isUltraLong) {
    const charLimit = detailLevel === 'full' ? null : detailLevel === 'summary' ? 200 : 60;
    if (isUltraLong && detailLevel === 'full') {
        if (classified.worldviewMats.length > 0) budget.allocate('worldview_materials', `【世界观素材】\n${classified.worldviewMats.map(m => `--- ${m.name} ---\n${m.currentContent || ''}`).join('\n\n')}`);
        if (classified.characterMats.length > 0) budget.allocate('character_materials', `【角色素材】\n${classified.characterMats.map(m => `--- ${m.name} ---\n${m.currentContent || ''}`).join('\n\n')}`);
        if (classified.otherMats.length > 0) budget.allocate('other_materials', `【其他素材】\n${classified.otherMats.map(m => `--- ${m.name} ---\n${m.currentContent || ''}`).join('\n\n')}`);
    } else {
        if (classified.indexMats.length > 0) {
            budget.allocate('worldview_materials', `【素材索引（按需加载）】\n${classified.indexMats.map(m => m.currentContent || '').join('\n\n')}`);
        } else {
            if (classified.worldviewMats.length > 0) budget.allocate('worldview_materials', `【世界观素材】${classified.worldviewMats.map(m => `[${m.name}]: ${(m.currentContent || '').substring(0, charLimit || 200)}`).join('\n')}`);
            if (classified.characterMats.length > 0) budget.allocate('character_materials', `【角色素材】${classified.characterMats.map(m => `[${m.name}]: ${(m.currentContent || '').substring(0, charLimit || 200)}`).join('\n')}`);
        }
        if (classified.otherMats.length > 0) budget.allocate('other_materials', `【其他素材】${classified.otherMats.map(m => `[${m.name}]: ${(m.currentContent || '').substring(0, charLimit || 150)}`).join('\n')}`);
    }
}

function buildUserContent(budget, context) {
    let userContent = context.content || '';
    for (const slotName of ['chapter_outline', 'review_feedback', 'chapter_content']) {
        const slot = budget.slots[slotName];
        if (slot?.content) { if (userContent) userContent += '\n\n'; userContent += slot.content; }
    }
    if (context.userMessage) { if (userContent) userContent += '\n\n'; userContent += context.userMessage; }
    return userContent;
}

function truncateUserContent(userContent, budget, agentType) {
    const userTokenEstimate = estimateTokens(userContent);
    const isInputHeavy = ['material-manager', 'first-review', 'second-review', 'final-editor'].includes(agentType);
    const userBudget = budget.inputBudget * (isInputHeavy ? 0.55 : 0.25);
    return userTokenEstimate > userBudget ? truncateToTokens(userContent, Math.floor(userBudget)) : userContent;
}

function getMaterialAccessConfig(genre, agentType) {
    const genreAMA = genre?.agentMaterialAccess || null;
    return (genreAMA && genreAMA[agentType]) ? genreAMA[agentType] : { needs: null, detail: 'summary' };
}

module.exports = {
    calculateBudget, MODEL_BUDGETS, MODEL_BUDGET_OVERRIDES, DEGRADATION_THRESHOLDS,
    allocateUnifiedBudget, BUDGET_ZONES,
    classifyMaterials, allocateMaterialsToBudget, buildUserContent, truncateUserContent, getMaterialAccessConfig,
};
