/**
 * contextCommanderLoaders.js — 上下文决策的异步加载器
 * 从 contextCommander.js 拆出（2026-09-18，原文件超200行限制）：
 * 仆从（pet/servant 绑定实体）加载 + 时间轴上下文加载，失败均降级为空而非阻断。
 */
'use strict';
const logger = require('../../shared/logger');
const { SERVANT_BIND_TYPES } = require('./contextDepthConstants');
// 拆分（2026-09-18）时漏掉的两个真实实现：原先 resolveServantLoads 未定义、
// resolveTimelineContext 自己调自己 → 仆从/时间轴上下文永久失效（被 try/catch 静默吞掉）
const { resolveServantLoads } = require('./servantDecisionEngine');
const { resolveTimelineContext: _resolveTimelineContextImpl } = require('./timelineContextResolver');

async function resolveServants(params, outlineText) {
    try {
        const { chapter, materials } = params;
        const entityCenter = require('../entityCenter');
        const entities = await entityCenter.getEntitiesForProject(params.projectId, {});
        const servants = entities.filter(e =>
            (e.bindsSummary || []).some(b => require('./contextDepthConstants').SERVANT_BIND_TYPES.has(b.bindType || b.type))
        );
        if (servants.length === 0) return [];
        return resolveServantLoads(servants, { chapter, entities, outlineText });
    } catch (e) {
        logger.warn('contextCommander', `Servant resolution failed: ${e.message}`);
        return [];
    }
}

async function resolveTimelineContext(projectId, chapterNumber) {
    try {
        return await _resolveTimelineContextImpl(projectId, chapterNumber);
    } catch (e) {
        logger.warn('contextCommander', `Timeline resolution failed: ${e.message}`);
        return null;
    }
}

module.exports = { resolveServants, resolveTimelineContext };
