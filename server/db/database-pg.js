const { getPool, initPgPool, closePgPool, healthCheck } = require('./pgPool');
const { SCHEMA_SQL } = require('./pgSchema');
const { KNOWLEDGE_SCHEMA_SQL } = require('./knowledgeSchema');
const { DEDICATED_TABLES, TABLE_ALIASES } = require('./pgConstants');
const { safeParse, convertPlaceholders, queryAll, queryOne, runSql, withTransaction } = require('./pgCore');
const { extractMaterialFields, extractChapterFields, extractProjectFields, extractKvFields, extractApiKeysFields, extractAgentBindingsFields, extractTimelineFields, extractQuestFields } = require('./pgExtractorsBasic');
const { extractCharStateFields, extractStateKvFields, extractCacheFields, extractRegistryFields, extractItemDefFields, extractCharBindFields, extractCharRelationFields, extractPetFields, extractServantFields, extractChronicleFields, extractKnowledgeAccessFields, extractKnowledgeFactFields } = require('./pgExtractorsEntity');
const { queryMaterialsByProject, queryChaptersByProject, queryKvByType, queryCharacterStates, queryStateKvIndex, queryCharacterStateCache, countItemsByType } = require('./pgQueriesCore');
const { queryEntityRegistry, queryItemDefinitions, queryCharacterBinds, queryCharacterRelations, queryPetEntities, queryServantEntities, queryChronicle, queryKnowledgeAccess } = require('./pgQueriesEntity');
const logger = require('../shared/logger');
const { checkSchemaIntegrity } = require('./schemaIntegrityCheck');
const { backfillAllColumns } = require('./backfillColumns');

async function initDatabaseAsync(connectionString) {
    const pool = await initPgPool(connectionString);
    await pool.query(SCHEMA_SQL);
    try {
        await pool.query(KNOWLEDGE_SCHEMA_SQL);
        logger.info('database-pg', 'PostgreSQL knowledge schema initialized');
    } catch (kErr) {
        logger.warn('database-pg', 'Knowledge schema init failed (non-fatal):', kErr.message);
    }
    logger.info('database-pg', 'PostgreSQL schema initialized');

    // 启动时校验schema与extractor一致性
    try {
        const result = await checkSchemaIntegrity();
        if (result.criticals.length > 0) {
            logger.error('database-pg', `Schema integrity check found ${result.criticals.length} CRITICAL issue(s). Field data may be lost on write!`);
        }
    } catch (checkErr) {
        logger.warn('database-pg', 'Schema integrity check failed (non-fatal):', checkErr.message);
    }

    // 启动时自动回填独立列（从data JSONB中提取）
    try {
        await backfillAllColumns();
    } catch (bfErr) {
        logger.warn('database-pg', 'Column backfill failed (non-fatal):', bfErr.message);
    }

    return pool;
}

function getDatabase() { return getPool(); }
async function closeDatabase() { await closePgPool(); }
async function saveToFile() {}
function scheduleSave() {}

function getTableForType(type) {
    const resolved = TABLE_ALIASES[type] || type;
    if (DEDICATED_TABLES.has(resolved)) return resolved;
    return 'kv_store';
}

function resetForTesting() {
    throw new Error('[PG] resetForTesting not supported for PostgreSQL backend. Use test fixtures instead.');
}

module.exports = {
    initDatabaseAsync, getDatabase, closeDatabase, saveToFile, scheduleSave,
    withTransaction, getTableForType, safeParse,
    queryAll, queryOne, runSql,
    extractMaterialFields, extractChapterFields, extractProjectFields, extractKvFields,
    extractApiKeysFields, extractAgentBindingsFields, extractQuestFields, extractTimelineFields,
    extractCharStateFields, extractStateKvFields, extractCacheFields, extractRegistryFields,
    extractItemDefFields, extractCharBindFields, extractCharRelationFields,
    extractPetFields, extractServantFields, extractChronicleFields, extractKnowledgeAccessFields, extractKnowledgeFactFields,
    queryChronicle, queryMaterialsByProject, queryChaptersByProject, queryKvByType,
    queryCharacterStates, queryStateKvIndex, queryCharacterStateCache,
    queryEntityRegistry, queryItemDefinitions, queryCharacterBinds,
    queryCharacterRelations, queryPetEntities, queryServantEntities,
    queryChronicle, queryKnowledgeAccess,
    countItemsByType, DEDICATED_TABLES, TABLE_ALIASES, healthCheck, resetForTesting
};
