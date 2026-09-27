/**
 * store-pg-writer-library — 藏经阁技法表专用写入handler
 *
 * 陷阱#31：注册到DEDICATED_TABLES后若无专用handler，写入走kv_store、读取走专用表，
 *         导致POST成功GET返回404。本文件为 library_techniques 提供专用handler。
 * 模式参照 store-pg-writer-worldscope.js，extract函数自包含。
 */
const { runSql } = require('./database-pg');

/** 安全序列化数组/对象字段（已是字符串则原样返回） */
function _stringify(val, defaultVal) {
    if (typeof val === 'string') return val;
    if (val === null || val === undefined) return JSON.stringify(defaultVal);
    return JSON.stringify(val);
}

/** library_techniques 字段提取：索引列 + 完整JSON */
function extractLibraryTechniqueFields(data) {
    return {
        id: data.id || '',
        displayName: data.display_name || data.displayName || '',
        department: data.department || '',
        subcategory: data.subcategory || '',
        categoryPath: data.category_path || data.categoryPath || '',
        applicableModes: _stringify(data.applicable_modes || data.applicableModes, []),
        contextSlot: data.context_slot || data.contextSlot || 'L2',
        injectionPoint: data.injection_point || data.injectionPoint || 'writer',
        worldviewDepth: data.worldviewDepth || data.worldview_depth || 'meso',
        contextPriority: Number(data.context_priority || data.contextPriority || 70),
        wordCountImpact: data.word_count_impact || data.wordCountImpact || '+0%',
        retrievalTags: _stringify(data.retrieval_tags || data.retrievalTags, []),
        sourceNovel: data.source_novel || data.sourceNovel || '',
        sourceType: data.source_type || data.sourceType || 'curated',
        successRate: Number(data.success_rate ?? data.successRate ?? 50),
        attempts: Number(data.attempts || 0),
        autoDisabled: Boolean(data.auto_disabled ?? data.autoDisabled ?? false),
        version: data.version || '1.0.0',
        data: JSON.stringify(data)
    };
}

function getLibraryTableHandlers() {
    return {
        library_techniques: async (db, existing, data, id) => {
            const f = extractLibraryTechniqueFields(data);
            if (existing) {
                await runSql(db, `UPDATE library_techniques SET display_name=?,department=?,subcategory=?,category_path=?,applicable_modes=?,context_slot=?,injection_point=?,worldview_depth=?,context_priority=?,word_count_impact=?,retrieval_tags=?,source_novel=?,source_type=?,success_rate=?,attempts=?,auto_disabled=?,version=?,data=?,updatedAt=? WHERE id=?`,
                    [f.displayName, f.department, f.subcategory, f.categoryPath, f.applicableModes, f.contextSlot, f.injectionPoint, f.worldviewDepth, f.contextPriority, f.wordCountImpact, f.retrievalTags, f.sourceNovel, f.sourceType, f.successRate, f.attempts, f.autoDisabled, f.version, f.data, data.updatedAt, id]);
            } else {
                await runSql(db, `INSERT INTO library_techniques (id,display_name,department,subcategory,category_path,applicable_modes,context_slot,injection_point,worldview_depth,context_priority,word_count_impact,retrieval_tags,source_novel,source_type,success_rate,attempts,auto_disabled,version,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                    [f.id, f.displayName, f.department, f.subcategory, f.categoryPath, f.applicableModes, f.contextSlot, f.injectionPoint, f.worldviewDepth, f.contextPriority, f.wordCountImpact, f.retrievalTags, f.sourceNovel, f.sourceType, f.successRate, f.attempts, f.autoDisabled, f.version, f.data, data.createdAt, data.updatedAt]);
            }
        }
    };
}

module.exports = { getLibraryTableHandlers, extractLibraryTechniqueFields };
