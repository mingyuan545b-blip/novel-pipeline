const { getTableForType, safeParse, queryOne, runSql, withTransaction,
    extractMaterialFields, extractChapterFields, extractProjectFields, extractKvFields,
    extractApiKeysFields, extractAgentBindingsFields, extractQuestFields, extractTimelineFields,
    extractCharStateFields, extractStateKvFields, extractCacheFields, extractRegistryFields,
    extractItemDefFields, extractCharBindFields, extractCharRelationFields,
    extractPetFields, extractServantFields, extractChronicleFields,
    extractKnowledgeFactFields
} = require('./database-pg');
const { isFoundationMaterialCheck } = require('./storeCommon');
const { acquireLock, releaseLock } = require('./store-pg-lock');
const { getItem } = require('./store-pg-core');
const { isFoundationMaterial, invalidateFactionMap } = require('./store-pg-query');
const { trimItemData } = require('./storeCommon');
const { getEntityTableHandlers } = require('./store-pg-writer-entity');
const { getRegistryHandlers } = require('./store-pg-writer-registry');
const { getWorldScopeTableHandlers } = require('./store-pg-writer-worldscope');
const { getLibraryTableHandlers } = require('./store-pg-writer-library');
const logger = require('../shared/logger');

const IMMEDIATE_SAVE_TYPES = new Set(['chapters', 'materials', 'circuit-breakers', 'infinite-pipeline-state']);

async function _writeItemUnlocked(type, id, data, options = {}) {
    const table = getTableForType(type);
    data = trimItemData(type, { ...data });
    if (!data.id) data.id = id;
    const now = new Date().toISOString();
    try {
        await withTransaction(async (db) => {
            const isKvStore = table === 'kv_store';
            const existingInDb = isKvStore
                ? await queryOne(db, `SELECT data FROM kv_store WHERE type = ? AND id = ?`, [type, id])
                : await queryOne(db, `SELECT data FROM ${table} WHERE id = ?`, [id]);
            let createdAt = null;
            if (existingInDb) {
                const parsed = safeParse(existingInDb.data, '_writeItemUnlocked');
                if (parsed && parsed.createdAt) createdAt = parsed.createdAt;
            }
            if (!data.createdAt) data.createdAt = createdAt || now;
            data.updatedAt = now;

            const handlers = { ..._getTableHandlers(), ...getEntityTableHandlers(), ...getRegistryHandlers(), ...getWorldScopeTableHandlers(), ...getLibraryTableHandlers() };
            const handler = handlers[table];
            if (handler) {
                await handler(db, existingInDb, data, id, now);
            } else {
                await _writeKvStore(db, existingInDb, data, type, id, now);
            }
        });
        if (type === 'materials') invalidateFactionMap();
    } catch (err) {
        logger.error('store-pg', `PG write error for ${type}/${id}:`, err.message);
        throw err;
    }
    return data;
}

async function _writeKvStore(db, existingInDb, data, type, id, now) {
    const f = extractKvFields(type, data);
    if (existingInDb) {
        await runSql(db, `UPDATE kv_store SET data=?, updatedAt=? WHERE type=? AND id=?`, [f.data, data.updatedAt, type, id]);
    } else {
        await runSql(db, `INSERT INTO kv_store (type, id, data, createdAt, updatedAt) VALUES (?,?,?,?,?)`, [f.type, f.id, f.data, data.createdAt, data.updatedAt]);
    }
}

function _getTableHandlers() {
    return {
        materials: async (db, existing, data, id, now) => {
            const f = extractMaterialFields(data);
            // 字段提取审计：记录哪些索引列有值、哪些为null
            const indexedFields = ['type','name','parentPlane','parentFaction','archived',
                'archetype','roleLevel','lastAppearChapter','currentStatus','sourceChapter','version'];
            const nullFields = indexedFields.filter(k => f[k] === null || f[k] === undefined);
            if (nullFields.length > 0 && process.env.LOG_MATERIAL_AUDIT === 'true') {
                logger.debug('material-audit', `Material ${id} (${f.type}/${f.name}) null indexed fields: ${nullFields.join(', ')}`);
            }
            if (existing) { await runSql(db, `UPDATE materials SET projectId=?,type=?,name=?,parentPlane=?,parentFaction=?,archived=?,dialectRegion=?,dialectIntensity=?,speechStyle=?,speechStyleIntensity=?,namingStyle=?,namingStyleIntensity=?,archetype=?,currentPlaneId=?,isLocked=?,version=?,sourceChapter=?,roleLevel=?,lastAppearChapter=?,currentStatus=?,data=?,updatedAt=? WHERE id=?`, [f.projectId,f.type,f.name,f.parentPlane,f.parentFaction,f.archived,f.dialectRegion,f.dialectIntensity,f.speechStyle,f.speechStyleIntensity,f.namingStyle,f.namingStyleIntensity,f.archetype,f.currentPlaneId,f.isLocked,f.version,f.sourceChapter,f.roleLevel,f.lastAppearChapter,f.currentStatus,f.data,data.updatedAt,id]); }
            else { await runSql(db, `INSERT INTO materials (id,projectId,type,name,parentPlane,parentFaction,archived,dialectRegion,dialectIntensity,speechStyle,speechStyleIntensity,namingStyle,namingStyleIntensity,archetype,currentPlaneId,isLocked,version,sourceChapter,roleLevel,lastAppearChapter,currentStatus,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [f.id,f.projectId,f.type,f.name,f.parentPlane,f.parentFaction,f.archived,f.dialectRegion,f.dialectIntensity,f.speechStyle,f.speechStyleIntensity,f.namingStyle,f.namingStyleIntensity,f.archetype,f.currentPlaneId,f.isLocked,f.version,f.sourceChapter,f.roleLevel,f.lastAppearChapter,f.currentStatus,f.data,data.createdAt,data.updatedAt]); }
        },
        api_keys: async (db, existing, data, id, now) => {
            const f = extractApiKeysFields(data);
            if (existing) { await runSql(db, `UPDATE api_keys SET apiKey=?,groupId=?,model=?,provider=?,baseURL=?,name=?,_encrypted=?,data=?,updatedAt=? WHERE id=?`, [f.apiKey,f.groupId,f.model,f.provider,f.baseURL,f.name,f._encrypted,f.data,data.updatedAt,id]); }
            else { await runSql(db, `INSERT INTO api_keys (id,apiKey,groupId,model,provider,baseURL,name,_encrypted,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [f.id,f.apiKey,f.groupId,f.model,f.provider,f.baseURL,f.name,f._encrypted,f.data,data.createdAt,data.updatedAt]); }
        },
        agent_bindings: async (db, existing, data, id, now) => {
            const f = extractAgentBindingsFields(data);
            if (existing) { await runSql(db, `UPDATE agent_bindings SET agentType=?,keyId=?,data=?,updatedAt=? WHERE id=?`, [f.agentType,f.keyId,f.data,data.updatedAt,id]); }
            else { await runSql(db, `INSERT INTO agent_bindings (id,agentType,keyId,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?)`, [f.id,f.agentType,f.keyId,f.data,data.createdAt,data.updatedAt]); }
        },
        chapters: async (db, existing, data, id, now) => {
            const f = extractChapterFields(data);
            if (existing) { await runSql(db, `UPDATE chapters SET projectId=?,chapterNumber=?,status=?,title=?,wordCount=?,round=?,data=?,updatedAt=? WHERE id=?`, [f.projectId,f.chapterNumber,f.status,f.title,f.wordCount,f.round,f.data,data.updatedAt,id]); }
            else { await runSql(db, `INSERT INTO chapters (id,projectId,chapterNumber,status,title,wordCount,round,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)`, [f.id,f.projectId,f.chapterNumber,f.status,f.title,f.wordCount,f.round,f.data,data.createdAt,data.updatedAt]); }
        },
        projects: async (db, existing, data, id, now) => {
            const f = extractProjectFields(data);
            if (existing) { await runSql(db, `UPDATE projects SET mode=?,targetChapterCount=?,targetWordCount=?,data=?,updatedAt=? WHERE id=?`, [f.mode,f.targetChapterCount,f.targetWordCount,f.data,data.updatedAt,id]); }
            else { await runSql(db, `INSERT INTO projects (id,mode,targetChapterCount,targetWordCount,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)`, [f.id,f.mode,f.targetChapterCount,f.targetWordCount,f.data,data.createdAt,data.updatedAt]); }
        },
        quests: async (db, existing, data, id, now) => {
            const f = extractQuestFields(data);
            if (existing) { await runSql(db, `UPDATE quests SET projectId=?,parentId=?,status=?,priority=?,data=?,updatedAt=? WHERE id=?`, [f.projectId,f.parentId,f.status,f.priority,f.data,data.updatedAt,id]); }
            else { await runSql(db, `INSERT INTO quests (id,projectId,parentId,status,priority,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)`, [f.id,f.projectId,f.parentId,f.status,f.priority,f.data,data.createdAt,data.updatedAt]); }
        },
        timelines: async (db, existing, data, id, now) => {
            const f = extractTimelineFields(data);
            if (existing) { await runSql(db, `UPDATE timelines SET projectId=?,eventType=?,importance=?,isKeyEvent=?,data=?,updatedAt=? WHERE id=?`, [f.projectId,f.eventType,f.importance,f.isKeyEvent,f.data,data.updatedAt,id]); }
            else { await runSql(db, `INSERT INTO timelines (id,projectId,eventType,importance,isKeyEvent,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)`, [f.id,f.projectId,f.eventType,f.importance,f.isKeyEvent,f.data,data.createdAt,data.updatedAt]); }
        },
        knowledge_facts: async (db, existing, data, id, now) => {
            const f = extractKnowledgeFactFields(data);
            if (existing) { await runSql(db, `UPDATE knowledge_facts SET projectId=?,level=?,category=?,entityId=?,chapterNumber=?,factText=?,importance=?,accessCount=?,lastAccessedChapter=?,decayScore=?,expiresAtChapter=?,data=?,updatedAt=? WHERE id=?`, [f.projectId,f.level,f.category,f.entityId,f.chapterNumber,f.factText,f.importance,f.accessCount,f.lastAccessedChapter,f.decayScore,f.expiresAtChapter,f.data,data.updatedAt,id]); }
            else { await runSql(db, `INSERT INTO knowledge_facts (id,projectId,level,category,entityId,chapterNumber,factText,importance,accessCount,lastAccessedChapter,decayScore,expiresAtChapter,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [f.id,f.projectId,f.level,f.category,f.entityId,f.chapterNumber,f.factText,f.importance,f.accessCount,f.lastAccessedChapter,f.decayScore,f.expiresAtChapter,f.data,data.createdAt,data.updatedAt]); }
        }
    };
}

async function deleteItem(type, id) {
    const release = await acquireLock(type, id);
    try {
        if (type === 'materials') {
            const item = await getItem(type, id);
            if (item && await isFoundationMaterial(item)) {
                logger.warn('store-pg', `Blocked deletion of foundation material: ${id} (${item.name})`);
                return false;
            }
        }
        const table = getTableForType(type);
        try {
            let existed = false;
            await withTransaction(async (db) => {
                const row = await queryOne(db, `SELECT id FROM ${table} WHERE id = ?`, [id]);
                existed = !!row;
                if (existed) await runSql(db, `DELETE FROM ${table} WHERE id = ?`, [id]);
            });
            if (existed && type === 'materials') invalidateFactionMap();
            return existed;
        } catch (err) {
            logger.error('store-pg', `PG delete error for ${type}/${id}:`, err.message);
            throw err;
        }
    } finally {
        releaseLock(type, id, release);
    }
}

module.exports = { _writeItemUnlocked, deleteItem, IMMEDIATE_SAVE_TYPES };
