/**
 * libraryStore — 藏经阁技法库数据访问层（PG单一数据源）
 *
 * 职责：技法记录的CRUD/统计/元数据更新，供 techIndex（检索/注入）、
 *      library路由（前端读写）、techniqueExtraction（一键提取落库）共用。
 * 存储：store类型 'library-techniques' → PG表 library_techniques（见pgSchemaLibrary.js）
 * 说明：一条记录 = 技法全文（索引列 + data完整JSON），不再分 leaf/metadata 两处。
 * 文件位置：server/services/libraryStore.js
 */
const store = require('../store');
const logger = require('../shared/logger');

const STORE_TYPE = 'library-techniques';
const DEFAULT_SUCCESS_RATE = 50;

/** 归一化：兼容 snake_case（JSON时代字段）与 camelCase（前端/新写入） */
function normalize(t = {}) {
    return {
        id: t.id || '',
        display_name: t.display_name || t.displayName || '',
        department: t.department || '',
        subcategory: t.subcategory || '',
        category_path: t.category_path || t.categoryPath || '',
        applicable_modes: t.applicable_modes || t.applicableModes || ['novel'],
        context_slot: t.context_slot || t.contextSlot || 'L2',
        injection_point: t.injection_point || t.injectionPoint || 'writer',
        worldviewDepth: t.worldviewDepth || t.worldview_depth || 'meso',
        context_priority: Number(t.context_priority ?? t.contextPriority ?? 70),
        word_count_impact: t.word_count_impact || t.wordCountImpact || '+0%',
        retrieval_tags: t.retrieval_tags || t.retrievalTags || [],
        trigger_condition: t.trigger_condition || t.triggerCondition || { chapter_range: [1, 999], narrative_state: [], emotion_curve: 'any' },
        implementation_rules: t.implementation_rules || t.implementationRules || [],
        anti_patterns: t.anti_patterns || t.antiPatterns || [],
        evidence: t.evidence || [],
        source_novel: t.source_novel || t.sourceNovel || '',
        source_type: t.source_type || t.sourceType || 'curated',
        success_rate: Number(t.success_rate ?? t.successRate ?? DEFAULT_SUCCESS_RATE),
        attempts: Number(t.attempts || 0),
        auto_disabled: Boolean(t.auto_disabled ?? t.autoDisabled ?? false),
        version: t.version || '1.0.0',
        description: t.description || '',
    };
}

async function listTechniques() {
    const items = await store.listItems(STORE_TYPE);
    return items.map(normalize);
}

/**
 * 列表 + 时间戳（只读场景：来源面板/新鲜度展示）。
 * 单独一个函数而不改 normalize：normalize 同时用于写入路径，
 * 携带 createdAt/updatedAt 会影响 INSERT 的字段取值，风险不值得。
 */
async function listTechniquesWithTimestamps() {
    const items = await store.listItems(STORE_TYPE);
    return items.map(t => Object.assign(normalize(t), {
        createdAt: t.createdAt || null,
        updatedAt: t.updatedAt || null,
    }));
}

async function getTechnique(id) {
    const item = await store.getItem(STORE_TYPE, id);
    return item ? normalize(item) : null;
}

async function upsertTechnique(tech) {
    const t = normalize(tech);
    if (!t.id) throw new Error('libraryStore.upsertTechnique: id is required');
    await store.setItem(STORE_TYPE, t.id, t);
    return t;
}

async function deleteTechnique(id) {
    return await store.deleteItem(STORE_TYPE, id);
}

/** 批量导入：已存在则更新（保留原统计），返回 {inserted, updated, total} */
async function importTechniques(list, { overwrite = true } = {}) {
    const existing = new Set((await listTechniques()).map(t => t.id));
    let inserted = 0, updated = 0;
    for (const raw of list) {
        const t = normalize(raw);
        if (!t.id) continue;
        if (existing.has(t.id)) {
            if (!overwrite) continue;
            const old = await getTechnique(t.id);
            t.success_rate = old ? old.success_rate : t.success_rate;
            t.attempts = old ? old.attempts : t.attempts;
            t.auto_disabled = old ? old.auto_disabled : t.auto_disabled;
            await upsertTechnique(t);
            updated++;
        } else {
            await upsertTechnique(t);
            inserted++;
        }
    }
    logger.info('libraryStore', `importTechniques: +${inserted} / ~${updated}`);
    return { inserted, updated, total: inserted + updated };
}

/** 更新统计元数据（反馈闭环/手动禁用用） */
async function updateMeta(id, patch = {}) {
    const t = await getTechnique(id);
    if (!t) return null;
    const merged = { ...t, ...patch };
    return await upsertTechnique(merged);
}

async function getStats() {
    const all = await listTechniques();
    const byDepartment = {};
    for (const t of all) byDepartment[t.department] = (byDepartment[t.department] || 0) + 1;
    return {
        total: all.length,
        departments: Object.keys(byDepartment).length,
        disabled: all.filter(t => t.auto_disabled).length,
        byDepartment,
    };
}

/** 已有技法名集合（提取时去重用） */
async function listNamesWithDept() {
    const all = await listTechniques();
    return all.map(t => ({ id: t.id, name: t.display_name, department: t.department, subcategory: t.subcategory }));
}

module.exports = {
    STORE_TYPE, normalize,
    listTechniques, listTechniquesWithTimestamps, getTechnique, upsertTechnique, deleteTechnique,
    importTechniques, updateMeta, getStats, listNamesWithDept,
};
