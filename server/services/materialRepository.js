'use strict';

/**
 * materialRepository — 素材写入唯一 API（T2/T4）
 *
 * 为什么要有它：
 *   全项目有 **58 处** `store.setItem('materials', ...)` 各自手搓素材对象
 *   （routes/materials.js、subplaneSaver、templateImporter、franchiseProductRoutes、
 *    chapterAuditor、outlineMaterialSaver、materialFinder.findOrCreateMaterial …）
 *   → 字段口径、changeLog 结构、provenance、版本号、时间戳各写各的 = 格式漂移的根。
 *
 * 本模块是**唯一语义写入入口**：
 *   · 创建：buildProvenance（不可变出身）+ version=1 + changeLog v2
 *   · 更新：**不改写 provenance**（修 T2 缺陷）+ version+1 + sourceChapter/lastUpdatedChapter 前进
 *   · 归档：archived + archivedAt + archivedReason + 留痕
 *
 * 与 store 层的关系：
 *   store 层（T4）负责"形状不变量"兜底（存量脏数据归一），本模块负责"语义正确"。
 */
const logger = require('../shared/logger');
const store = require('../store');
const { v4: uuidv4 } = require('uuid');
const { ORIGINS, buildProvenance, ensureProvenance, appendChangeLog } = require('../config/materialProvenance');
const { MATERIAL_WRITER_ID } = require('../config/materialWriteOwnership');

const MATERIALS = 'materials';
const CHANGE_LOG_KEEP = 12;

/** 创建：唯一构造点。字段口径以此为准。 */
function buildNewMaterialRecord(input) {
    const {
        id = uuidv4(), projectId, type, name, content = '',
        chapter = 0, origin = ORIGINS.CHAPTER, source = null,
        writer = MATERIAL_WRITER_ID, reason = 'auto-created',
        tags = [], roleLevel, isMainCharacter, isLocked = false,
        description = '', extra = {},
    } = input;
    if (!projectId) throw new Error('materialRepository: projectId 必填');
    if (!name) throw new Error('materialRepository: name 必填');

    const now = new Date().toISOString();
    return {
        id, projectId, type: type || 'other', name,
        description,
        initialContent: content, currentContent: content,
        tags, version: 1,
        sourceChapter: chapter || 0,
        lastAppearChapter: chapter || 0,
        lastWriter: writer, lastUpdatedChapter: chapter || 0,
        isLocked, archived: false,
        provenance: buildProvenance({ origin, chapter, at: now, source }),
        changeLog: [{ v: 2, action: 'created', chapter: chapter || 0, at: now, writer, reason }],
        createdAt: now, updatedAt: now,
        ...(roleLevel !== undefined ? { roleLevel } : {}),
        ...(isMainCharacter !== undefined ? { isMainCharacter } : {}),
        ...extra,
    };
}

/**
 * 更新：**保留 provenance**，只推进可变字段。
 * 修 T2 缺陷：不再用当前章覆盖 sourceChapter 的"创建章节"语义。
 */
function buildUpdatedMaterialRecord(existing, patch, opts = {}) {
    const { chapter = 0, writer = MATERIAL_WRITER_ID, reason = 'auto-updated' } = opts;
    const base = ensureProvenance({ ...existing });
    const now = new Date().toISOString();
    const updated = {
        ...base,
        ...patch,
        version: (existing?.version || 1) + 1,
        // 最近变化章前进；sourceChapter 保留原值（考点：谁创建的不能被后章改写）
        sourceChapter: base.sourceChapter ?? base.provenance?.createdChapter ?? 0,
        lastUpdatedChapter: chapter || base.lastUpdatedChapter || 0,
        lastWriter: writer,
        updatedAt: now,
    };
    // at 必须显式给：归一器会丢弃没有时间戳的条目（宁可丢也不污染，但不能自己造丢）
    updated.changeLog = appendChangeLog(base, { action: 'updated', chapter, writer, reason, at: now }, CHANGE_LOG_KEEP);
    return updated;
}

/** 归档：同样保留 provenance，留痕可查"谁在哪一章退场的" */
function buildArchivedMaterialRecord(existing, opts = {}) {
    const { chapter = 0, writer = MATERIAL_WRITER_ID, reason = 'auto-archived', action = 'deprecate' } = opts;
    const base = ensureProvenance({ ...existing });
    const now = new Date().toISOString();
    return {
        ...base,
        archived: true, archivedAt: now, archivedReason: reason,
        version: (existing?.version || 1) + 1,
        lastWriter: writer, lastUpdatedChapter: chapter || base.lastUpdatedChapter || 0,
        sourceChapter: base.sourceChapter ?? base.provenance?.createdChapter ?? 0,
        updatedAt: now,
        changeLog: appendChangeLog(base, { action, chapter, writer, reason, at: now }, CHANGE_LOG_KEEP),
    };
}

async function save(record) {
    await store.setItem(MATERIALS, record.id, record);
    return record;
}

/** 创建并落库 */
async function createMaterial(input) {
    const record = buildNewMaterialRecord(input);
    return save(record);
}

/** 更新并落库（existing 必须是已落库的素材） */
async function updateMaterial(existing, patch, opts = {}) {
    if (!existing || !existing.id) return null;
    const record = buildUpdatedMaterialRecord(existing, patch, opts);
    return save(record);
}

/** 归档并落库 */
async function archiveMaterial(existing, opts = {}) {
    if (!existing || !existing.id) return null;
    const record = buildArchivedMaterialRecord(existing, opts);
    await save(record);
    logger.info('materialRepo', `素材归档: ${existing.type}/${existing.name} @ch${opts.chapter || 0} (${opts.reason || 'no reason'})`);
    return record;
}

/** 按 (projectId,type,name) 查未归档素材（幂等 upsert 用） */
async function findByName(projectId, type, name) {
    if (!projectId || !name) return null;
    const items = await store.queryItems(MATERIALS, { projectId, type });
    return (items || []).find(m => !m.archived && m.name === name) || null;
}

module.exports = {
    MATERIALS,
    buildNewMaterialRecord, buildUpdatedMaterialRecord, buildArchivedMaterialRecord,
    createMaterial, updateMaterial, archiveMaterial, save, findByName,
};
