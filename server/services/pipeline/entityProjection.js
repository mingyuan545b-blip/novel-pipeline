/**
 * entityProjection.js — 素材/状态增量 → 实体中心 的单一投影函数（P1-D）
 *
 * 问题：实体中心此前是"创建时快照"——只有大纲阶段同步一次，章节级特质更新只写 KV，
 * 永不回写实体；且三处（outlineEntitySync / entityCRUD craft 清单 / mergeableFields）
 * 各维护一份字段清单，任一漏项 → 实体字段空。
 *
 * 本模块是唯一投影入口：字段清单集中、占位/空值不覆盖。
 */
const { hasMeaningfulValue } = require('../../shared/fieldValueGuards');

// 实体顶层列（写实体中心 + registry 同步字段）
const ENTITY_TOP_FIELDS = [
    'position', 'factionName', 'personality', 'speakingTone', 'signatureDetail',
    'craftStyle', 'charisma', 'philosophy', 'entranceDesign', 'highlightScenes',
    'quoteLibrary', 'behaviorRules', 'roleLevel', 'tags'
];
// 深层字段（写入 entity.profile，契约深度键的实体侧来源）
const ENTITY_PROFILE_FIELDS = [
    'innerConflict', 'independentStance', 'fateArc', 'protagonistMirror',
    'background', 'motivation', 'desire', 'fear', 'lie', 'trauma', 'appearance'
];

/** 从多个来源（后者兜底）取第一个"有意义"的值 */
function _pick(sources, key) {
    for (const s of sources) {
        if (!s) continue;
        if (hasMeaningfulValue(s[key])) return s[key];
        if (s.profile && hasMeaningfulValue(s.profile[key])) return s.profile[key];
    }
    return undefined;
}

/**
 * 构建实体字段补丁（单一投影）。
 * @param {...object} sources 素材 / 解析结果 / 状态增量（按优先级从高到低）
 * @returns {object} 可直接传给 entityCenter.getOrCreateEntity / updateEntity 的补丁
 */
function buildCharacterEntityPatch(...sources) {
    const patch = {};
    for (const f of ENTITY_TOP_FIELDS) {
        const v = _pick(sources, f);
        if (v !== undefined) patch[f] = v;
    }
    const profile = {};
    for (const k of ENTITY_PROFILE_FIELDS) {
        const v = _pick(sources, k);
        if (v !== undefined) profile[k] = v;
    }
    if (Object.keys(profile).length > 0) patch.profile = profile;
    // 原文（截断）用于实体详情/registry description
    const src = sources.find(s => s && hasMeaningfulValue(s.sourceContent));
    if (src) patch.sourceContent = src.sourceContent;
    return patch;
}

/** 单点：把素材投影到实体中心（getOrCreate 覆盖新建/合并两条路径） */
async function projectCharacterToEntity(projectId, mat, parsed = {}) {
    const { resolveMaterialName } = require('./materialNameResolver');
    const entityCenter = require('../entityCenter');
    const patch = buildCharacterEntityPatch(mat, parsed);
    return entityCenter.getOrCreateEntity(projectId, 'character', resolveMaterialName(mat), patch);
}

module.exports = { ENTITY_TOP_FIELDS, ENTITY_PROFILE_FIELDS, buildCharacterEntityPatch, projectCharacterToEntity };
