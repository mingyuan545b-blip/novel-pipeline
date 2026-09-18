'use strict';

/**
 * contextAssemblyView.js — 上下文装配图视图组装
 *
 * 把三份数据合成前端可直接渲染的"章节上下文装配图"：
 *   1. tree   —— 素材分类树（现有思维导图，回答"项目有什么、默认什么层级"）
 *   2. chapter—— 本章各Agent的装配实况（回答"这一章到底用了哪些、什么密度"）
 *   3. flow   —— 数据源流通状态（回答"哪些数据传入/丢失/没接上"）
 *
 * 数据来源：contextAssemblyMapBuilder（树）+ contextTrace 的 assemblies（实况）
 */
const { buildContextAssemblyMap } = require('./contextAssemblyMapBuilder');
const { getContextTraceForProject } = require('../contextTrace');
const { TYPE_STATUS } = require('./contextAssemblyRecorder');
const { reasonLabel } = require('./contextRelevance');
const { MATERIAL_TYPE_LABELS, MATERIAL_TYPE_ICONS } = require('../../config/materialTypes');
const { ASSEMBLY_TRACE_POLICY } = require('../../config/assemblyTracePolicy');
const logger = require('../../shared/logger');

/** 装配状态 → 前端展示用严重度 */
const DROPPED_LABELS = Object.freeze({
    'not-relevant': '与本章无关',
    'genre-excluded': '题材未声明',
    'drop': '预算裁剪',
});

const STATUS_SEVERITY = Object.freeze({
    [TYPE_STATUS.INJECTED]: 'ok',
    [TYPE_STATUS.DROPPED]: 'info',
    [TYPE_STATUS.EMPTY]: 'warning',
    [TYPE_STATUS.MISSING]: 'error',
});

/** 组装单章视图 */
async function buildAssemblyView(projectId, chapterNumber, agentFilter) {
    const tree = await buildContextAssemblyMap(projectId, chapterNumber);
    if (tree?.error) return tree;

    const trace = getContextTraceForProject(projectId);
    const assemblies = await trace.getChapterAssemblies(chapterNumber);
    const agents = Object.keys(assemblies)
        .filter(a => !agentFilter || a === agentFilter)
        .map(a => _normalizeAssembly(assemblies[a]));

    return {
        chapterNumber,
        supportedAgents: ASSEMBLY_TRACE_POLICY.agents,
        agents,
        flow: _mergeFlow(agents),
        alerts: _collectAlerts(agents),
        tree,
    };
}

function _statusLabel(t) {
    if (t.status === TYPE_STATUS.INJECTED) return '已注入';
    if (t.status === TYPE_STATUS.DROPPED) return DROPPED_LABELS[t.dropReason] || '本章不需要';
    if (t.status === TYPE_STATUS.EMPTY) return '无数据';
    if (t.status === TYPE_STATUS.MISSING) return '链路丢失';
    return t.status;
}

function _normalizeAssembly(assembly) {
    const types = (assembly.types || []).map(t => ({
        ...t,
        typeLabel: MATERIAL_TYPE_LABELS[t.type] || t.type,
        typeIcon: MATERIAL_TYPE_ICONS[t.type] || '📄',
        // 依据/丢弃原因统一转中文（前端不再硬编码映射）
        relevanceLabel: reasonLabel(t.relevanceReason),
        dropReasonLabel: reasonLabel(t.dropReason),
        statusLabel: _statusLabel(t),
        severity: STATUS_SEVERITY[t.status] || 'info',
        density: t.actualDepth || '-',
    }));
    return {
        agentType: assembly.agentType,
        recordedAt: assembly.recordedAt,
        budget: assembly.budget,
        meta: assembly.meta,
        summary: assembly.summary,
        sources: assembly.sources || [],
        types,
    };
}

/** 数据源流通：取各Agent记录的并集，任一Agent接上即视为已接入 */
function _mergeFlow(agents) {
    const merged = new Map();
    for (const agent of agents) {
        for (const src of agent.sources) {
            const prev = merged.get(src.key);
            merged.set(src.key, {
                key: src.key, label: src.label,
                wired: Boolean(prev?.wired || src.wired),
                detail: prev?.detail || src.detail,
            });
        }
    }
    return [...merged.values()];
}

/** 告警：该有却没有（empty=素材库缺数据，missing=链路断裂） */
function _collectAlerts(agents) {
    const alerts = [];
    for (const agent of agents) {
        for (const t of agent.types) {
            if (t.severity === 'warning' || t.severity === 'error') {
                alerts.push({
                    agentType: agent.agentType, type: t.type, status: t.status,
                    severity: t.severity, message: _alertMessage(t),
                });
            }
        }
    }
    return alerts;
}

function _alertMessage(t) {
    const name = MATERIAL_TYPE_LABELS[t.type] || t.type;
    if (t.status === TYPE_STATUS.EMPTY) return `${name}：决策需要但素材库无数据（${t.actualDepth || '-'}）`;
    if (t.status === TYPE_STATUS.MISSING) return `${name}：规划未注入也未标记丢弃，疑似链路断裂`;
    return `${name}：${t.status}`;
}

module.exports = { buildAssemblyView, STATUS_SEVERITY };
