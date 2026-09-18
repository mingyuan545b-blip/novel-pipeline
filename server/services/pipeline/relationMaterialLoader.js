'use strict';

/**
 * relationMaterialLoader.js — 人物关系素材加载器
 *
 * 背景（2026-09-18 数据流通核查发现）：
 *   Agent 声明里 relationship 的 source 是 'materials'，但素材库从来不存在
 *   type='relationship' 的记录——关系真实数据源是 character-relations 表
 *   （知识库/实体中心），导致人物关系永远不注入任何 Agent 的 prompt。
 *   按原则1（单一数据源）修消费端：直接从真实数据源读取并格式化。
 *
 * 章内相关性：优先带出"与本章大纲/意图提到的角色相关"的关系，按预算截断。
 */
const store = require('../../store');
const { resolveDepth } = require('./contextDepthConstants');
const { estimateTokens } = require('../contextBudget');
const logger = require('../../shared/logger');

const SECRET_TAG = '【隐秘】';

/** 关系是否在指定章节有效 */
function isActiveAtChapter(rel, chapterNumber) {
    const start = rel.startChapter || 0;
    const end = rel.endChapter;
    if (start > chapterNumber) return false;
    if (end !== null && end !== undefined && end < chapterNumber) return false;
    return true;
}

/** 关系与本章的相关度：命中大纲/意图角色名 → 加分 */
function relevanceScore(rel, nameOf, ctx) {
    let score = 0;
    for (const id of [rel.fromCharacterId, rel.toCharacterId]) {
        const name = nameOf[id];
        if (!name) continue;
        if (ctx.outlineText && ctx.outlineText.includes(name.toLowerCase())) score += 2;
        if (ctx.intentNames && ctx.intentNames.has(name)) score += 3;
    }
    if (!rel.isSecret) score += 1;
    score += Math.min(2, Math.round((rel.strength || 0) / 50));
    return score;
}

/** 按深度格式化单条关系 */
function formatRelation(rel, nameOf, depth) {
    const from = nameOf[rel.fromCharacterId] || rel.fromCharacterId;
    const to = nameOf[rel.toCharacterId] || rel.toCharacterId;
    const secret = rel.isSecret ? SECRET_TAG : '';
    const head = `${from} → ${to}：${rel.relLabel || rel.relType || '关系'}${secret}`;
    const d = resolveDepth(depth);
    if (d === 'L0') return head.substring(0, 60);
    if (d === 'L1') return head.substring(0, 200);
    const meta = `（亲密度${rel.strength ?? '-'} 信任${rel.trustLevel ?? '-'}${rel.relType ? ' 类型' + rel.relType : ''}）`;
    const notes = (rel.notes || '').replace(/\s+/g, ' ');
    if (d === 'L2') return `${head}${meta}\n${notes.substring(0, 300)}`;
    return `${head}${meta}\n${notes.substring(0, 1200)}`;
}

/**
 * 加载人物关系素材
 * @param {object} need 声明的素材需求（resolvedDepth/budget/maxItems）
 * @param {object} ctx { projectId, chapterNumber, outlineText, intentNames }
 * @returns {Promise<Array>} 与其它素材同构的 items
 */
async function loadRelations(need, ctx) {
    const items = [];
    try {
        const relations = await store.queryItems('character-relations', { projectId: ctx.projectId });
        if (!relations.length) return { items };

        // id→名字映射：实体中心为缓存层、素材库为源头，两者 id 空间都可能被关系表引用
        const entityCenter = require('../entityCenter');
        const entities = await entityCenter.getEntitiesForProject(ctx.projectId, { entityType: 'character' });
        const nameOf = {};
        const charMats = (await store.queryItems('materials', { projectId: ctx.projectId }))
            .filter((m) => m.type === 'character');
        for (const m of charMats) nameOf[m.id] = m.name;
        for (const e of entities) nameOf[e.id] = e.name;

        const active = relations.filter((r) => isActiveAtChapter(r, ctx.chapterNumber));
        const scored = active
            .map((r) => ({ rel: r, score: relevanceScore(r, nameOf, ctx) }))
            .sort((a, b) => b.score - a.score);

        const budget = need.budget || 800;
        const maxItems = need.maxItems || scored.length;
        let used = 0;
        for (const { rel } of scored.slice(0, maxItems)) {
            const content = formatRelation(rel, nameOf, need.resolvedDepth || need.detail);
            if (used + content.length > budget) break;
            used += content.length;
            items.push({
                name: rel.relLabel || `${nameOf[rel.fromCharacterId] || ''}-${nameOf[rel.toCharacterId] || ''}`,
                type: 'relationship',
                content,
                source: 'relations',
                isSecret: Boolean(rel.isSecret),
                estTokens: estimateTokens(content),
            });
        }
    } catch (e) {
        logger.warn('relationMaterialLoader', `loadRelations failed: ${e.message}`);
    }
    return { items };
}

module.exports = { loadRelations, formatRelation, isActiveAtChapter, relevanceScore };
