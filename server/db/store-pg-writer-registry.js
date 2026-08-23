/**
 * store-pg-writer-registry.js — 基于fieldRegistry的通用writer handler
 * 自动生成INSERT/UPDATE SQL，确保字段与注册表一致
 * 替代_writeKnowledgeTable（只写id/projectId/data导致独立列丢失）
 */
const { generateExtractor, getExtractableColumns } = require('./fieldRegistry');
const { runSql } = require('./database-pg');

/**
 * 从注册表自动生成writer handler
 * 根据注册表列定义动态构建INSERT/UPDATE SQL
 */
function buildWriterHandler(tableName) {
    const extractor = generateExtractor(tableName);
    if (!extractor) return null;

    const columns = getExtractableColumns(tableName);
    const colNames = columns.map(c => c.name);

    const insertCols = ['id', ...colNames, 'data', 'createdAt', 'updatedAt'];
    const insertSql = `INSERT INTO ${tableName} (${insertCols.join(',')}) VALUES (${insertCols.map(() => '?').join(',')})`;

    const updateCols = [...colNames, 'data', 'updatedAt'];
    const updateSql = `UPDATE ${tableName} SET ${updateCols.map(c => `${c}=?`).join(',')} WHERE id=?`;

    return async function(db, existing, data, id, now) {
        const f = extractor(data);
        const values = colNames.map(c => f[c]);
        if (existing) {
            await runSql(db, updateSql, [...values, f.data, data.updatedAt, id]);
        } else {
            await runSql(db, insertSql, [id, ...values, f.data, data.createdAt, data.updatedAt]);
        }
    };
}

const _cache = {};

function getRegistryHandlers() {
    if (Object.keys(_cache).length > 0) return _cache;

    const knowledgeTables = [
        'entity_relations', 'entity_binds', 'foreshadow_ledger', 'timeline',
        'narrative_state', 'consistency_checks', 'craft_materials', 'entity_state_history',
        'memory_layers'
    ];
    const generalTables = ['reviews', 'pipeline_logs', 'infinite_pipeline_state'];

    for (const table of [...knowledgeTables, ...generalTables]) {
        const handler = buildWriterHandler(table);
        if (handler) _cache[table] = handler;
    }

    const entityBase = buildWriterHandler('entities');
    if (entityBase) {
        _cache.entities = async (db, existing, data, id, now) => {
            if (!data.briefName && data.name) data.briefName = data.name.substring(0, 4);
            await entityBase(db, existing, data, id, now);
        };
    }

    return _cache;
}

module.exports = { getRegistryHandlers, buildWriterHandler };
