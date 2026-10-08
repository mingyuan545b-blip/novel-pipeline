'use strict';

/**
 * materialProvenance — 素材"出身"单一源（T2）
 *
 * 为什么要有它：
 *   原实现把"创建章节"记在 `sourceChapter` 上，而**每次更新都会改写它**
 *   （materialActions.js：sourceChapter: chapter.chapterNumber || existing.sourceChapter）
 *   → 第1章创建的角色被第8章更新后，"来源章节"变成 8，创建章节**永久丢失**；
 *   且 changeLog 会被裁剪（STORE_TRIMMING.materialChangeLogKeep），旧记录也没了。
 *   结果是"这条素材什么时间、第几章生成的"根本无法机器查询。
 *
 * 本模块把两件事拆开：
 *   · provenance  不可变事实：createdChapter / createdAt / origin / runId（只写一次）
 *   · sourceChapter / lastUpdatedChapter：可变的"最近一次变化章"
 *
 * changeLog 统一为 v2 结构（历史上至少有 4 种互不兼容的写法）：
 *   { v:2, action, chapter, at, writer, reason, from?, to? }
 */
const CHANGE_LOG_VERSION = 2;
/** changeLog 里 from/to 差量文本的保留上限（旧实现把整段正文塞进日志，会撑爆存储） */
const MAX_DIFF_CHARS = 500;

const ORIGINS = Object.freeze({
    OUTLINE: 'outline',    // 建项时由大纲/设定批量生成
    CHAPTER: 'chapter',    // 正文流水线 material-manager 从章节中提取
    IMPORT: 'import',      // 外部导入（模板/拆书/前作继承）
    MANUAL: 'manual',      // 前端手工新增或编辑
    UNKNOWN: 'unknown',    // 存量数据无法判定
});

const VALID_ORIGINS = new Set(Object.values(ORIGINS));

function _iso(at) {
    if (!at) return null;
    const d = at instanceof Date ? at : new Date(at);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function _num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function _clip(text) {
    return text.length > MAX_DIFF_CHARS ? text.slice(0, MAX_DIFF_CHARS) + '…' : text;
}

/**
 * 构建不可变 provenance（只在**创建**时调用一次）。
 * @param {{origin?:string, chapter?:number, at?:string, runId?:string|null, source?:string|null}} p
 */
function buildProvenance(p = {}) {
    const origin = VALID_ORIGINS.has(p.origin) ? p.origin : ORIGINS.UNKNOWN;
    return {
        createdChapter: _num(p.chapter) ?? 0,
        createdAt: _iso(p.at) || new Date().toISOString(),
        origin,
        runId: p.runId || null,
        source: p.source || null,
    };
}

const CREATED_RE = /initial creation|initial material|auto-created|generated|自动创建|初始创建/i;
const IMPORT_RE = /inherit|import|继承|导入|模板/i;

/** 从历史 changeLog / sourceChapter 推断出身（仅用于存量补齐，不覆盖已有值） */
function _inferOrigin(material, inferredChapter) {
    const entries = Array.isArray(material.changeLog) ? material.changeLog : [];
    const actions = entries.map(e => e && (e.action || e.type)).filter(Boolean);
    const reasons = entries.map(e => e && e.reason).filter(Boolean).join(' ');
    if (actions.some(a => a === 'import' || a === 'inherit') || IMPORT_RE.test(reasons)) return ORIGINS.IMPORT;
    if (actions.some(a => a === 'created' || a === 'generated' || a === 'auto-created') || CREATED_RE.test(reasons)) return ORIGINS.OUTLINE;
    // 无历史可依时按"创建章节"判定：有章号=章节流水线产生；章号 0=建项时生成的项目级素材
    return inferredChapter > 0 ? ORIGINS.CHAPTER : ORIGINS.OUTLINE;
}

/** 旧记录没有 action 时，从 reason 推断（否则一律 update 会丢"这条是建出来的"信息） */
function _inferAction(entry) {
    if (entry.action || entry.type) return entry.action || entry.type;
    const reason = String(entry.reason || '');
    if (CREATED_RE.test(reason)) return 'created';
    if (IMPORT_RE.test(reason)) return 'import';
    return 'update';
}

/**
 * 补齐缺失的 provenance（存量数据 / 老写入点）。
 * **不覆盖已有值**（provenance 不可变）。
 */
function ensureProvenance(material) {
    if (!material) return material;
    const have = material.provenance || {};
    const inferredChapter = have.createdChapter
        ?? _num(material.sourceChapter)
        ?? _num(material.lastUpdatedChapter)
        ?? 0;
    const inferredOrigin = have.origin || _inferOrigin(material, inferredChapter);
    // 标记"这是推断出来的，不是原始记录"（诚实原则：不把猜测伪装成事实）
    const inferredFlag = have.origin ? (have.source || null) : 'inferred-from-legacy';
    material.provenance = {
        createdChapter: inferredChapter,
        createdAt: _iso(have.createdAt) || _iso(material.createdAt) || new Date().toISOString(),
        origin: VALID_ORIGINS.has(inferredOrigin) ? inferredOrigin : ORIGINS.UNKNOWN,
        runId: have.runId || null,
        source: inferredFlag,
    };
    return material;
}

/** 单条历史记录 → v2 结构 */
function normalizeChangeLogEntry(entry, fallbackChapter, fallbackAt) {
    if (!entry || typeof entry !== 'object') return null;
    const action = _inferAction(entry);
    const chapter = _num(entry.chapter) ?? _num(entry.chapterNumber) ?? _num(fallbackChapter);
    // fallbackAt：存储层归一时回落（否则"只缺时间戳"的历史会被误丢）
    const at = _iso(entry.at) || _iso(entry.timestamp) || _iso(entry.updatedAt) || _iso(fallbackAt);
    const out = {
        v: CHANGE_LOG_VERSION,
        action,
        chapter,
        at,
        writer: entry.writer || null,
        reason: entry.reason || null,
    };
    const from = entry.from !== undefined ? entry.from : entry.oldContent;
    const to = entry.to !== undefined ? entry.to : entry.newContent;
    // 保留空串（"从无到有"本身是信息），只丢弃 null/undefined
    if (typeof from === 'string') out.from = _clip(from);
    if (typeof to === 'string') out.to = _clip(to);
    if (!out.at) return null;
    return out;
}

/** 整表归一（过滤掉无法归一的脏数据） */
function normalizeChangeLog(entries, fallbackChapter, fallbackAt) {
    if (!Array.isArray(entries)) return [];
    return entries.map(e => normalizeChangeLogEntry(e, fallbackChapter, fallbackAt)).filter(Boolean);
}

/** 追加一条 v2 记录（保留历史，交给 store 层裁剪长度） */
function appendChangeLog(material, entry, maxKeep) {
    const chapter = _num(entry?.chapter);
    const list = normalizeChangeLog(material?.changeLog, chapter);
    const normalized = normalizeChangeLogEntry(entry, chapter);
    if (normalized) list.push(normalized);
    if (maxKeep && list.length > maxKeep) return list.slice(-maxKeep);
    return list;
}

/**
 * provenance 是否完整（闸门与测试用）
 * @returns {{ok:boolean, missing:string[]}}
 */
function validateProvenance(material) {
    const missing = [];
    const p = material?.provenance;
    if (!p || typeof p !== 'object') return { ok: false, missing: ['provenance'] };
    if (_num(p.createdChapter) === null) missing.push('createdChapter');
    if (!_iso(p.createdAt)) missing.push('createdAt');
    if (!VALID_ORIGINS.has(p.origin)) missing.push('origin');
    return { ok: missing.length === 0, missing };
}

module.exports = {
    CHANGE_LOG_VERSION, ORIGINS, VALID_ORIGINS,
    buildProvenance, ensureProvenance,
    normalizeChangeLog, normalizeChangeLogEntry, appendChangeLog,
    validateProvenance,
};
