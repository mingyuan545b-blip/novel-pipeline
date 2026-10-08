'use strict';

/**
 * materialShape — 素材记录的**形状不变量**（T4）
 *
 * 为什么放在这里（而不是逐个改 47 个写入点）：
 *   全项目有 47 处 `store.setItem('materials', ...)` 各自手搓素材对象
 *   （routes/services/pipeline/integration 全都有）。逐个重构风险高、收益低；
 *   而所有写入**都必须经过存储层**（store-pg-writer / store.js → trimItemData）。
 *   把不变量挂在存储层 = 一处生效、永久生效、存量自动归一。
 *
 * 不变量（任何来源写进来的素材，读出来都必须满足）：
 *   1. 有 provenance{createdChapter, createdAt, origin}
 *   2. changeLog 每条都是 v2：{v:2, action, chapter, at, writer, reason}
 *   3. createdAt / updatedAt 是 ISO 字符串
 *   4. version 是 ≥1 的整数；sourceChapter 是数字
 *   5. archived 是布尔
 *
 * 注意：这里只做**形状**归一（不改语义、不写库、不删字段），语义正确性由
 *       materialRepository（唯一语义写入 API）负责。
 */
const { ensureProvenance, normalizeChangeLog, CHANGE_LOG_VERSION } = require('./materialProvenance');

const ORIGIN_IMPORT = 'import';

function _iso(at, fallback) {
    const d = at ? new Date(at) : null;
    if (d && !Number.isNaN(d.getTime())) return d.toISOString();
    return fallback;
}

function _num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * 归一素材记录（纯函数：返回新对象，不修改入参）。
 * @param {object} data 素材记录
 * @param {string} nowIso 当前时间（便于测试注入）
 */
function normalizeMaterialRecord(data, nowIso = new Date().toISOString()) {
    if (!data || typeof data !== 'object') return data;
    const out = { ...data };
    out.createdAt = _iso(out.createdAt, nowIso);
    out.updatedAt = _iso(out.updatedAt, nowIso);
    out.version = Math.max(1, Math.floor(_num(out.version, 1)));
    out.sourceChapter = _num(out.sourceChapter, 0);
    out.archived = Boolean(out.archived);

    ensureProvenance(out);
    out.provenance.createdAt = _iso(out.provenance.createdAt, out.createdAt);

    const chapter = _num(out.lastUpdatedChapter, out.sourceChapter);
    out.changeLog = normalizeChangeLog(out.changeLog, chapter, out.updatedAt);
    return out;
}

/**
 * 形状是否合格（闸门/测试用；不做归一，只看现状）
 * @returns {{ok:boolean, problems:string[]}}
 */
function checkMaterialShape(data) {
    const problems = [];
    if (!data || typeof data !== 'object') return { ok: false, problems: ['不是对象'] };
    const p = data.provenance;
    if (!p || typeof p !== 'object') problems.push('缺 provenance');
    else {
        if (_num(p.createdChapter, null) === null) problems.push('provenance.createdChapter 缺失');
        if (!_iso(p.createdAt, null)) problems.push('provenance.createdAt 非法');
        if (!p.origin) problems.push('provenance.origin 缺失');
    }
    const log = data.changeLog;
    if (!Array.isArray(log)) problems.push('changeLog 不是数组');
    else if (log.some(e => !e || e.v !== CHANGE_LOG_VERSION)) problems.push(`changeLog 存在非 v${CHANGE_LOG_VERSION} 条目`);
    if (!_iso(data.createdAt, null)) problems.push('createdAt 非法');
    if (!Number.isFinite(Number(data.version))) problems.push('version 非数字');
    return { ok: problems.length === 0, problems };
}

module.exports = { normalizeMaterialRecord, checkMaterialShape, ORIGIN_IMPORT };
