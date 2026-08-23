/**
 * store-pg-writer-worldscope — 世界域相关表专用写入handler
 *
 * 覆盖3张表：world_scopes / world_factions / cross_world_traces
 * 修复：此前这3张表注册到DEDICATED_TABLES后，写入无专用handler走kv_store，
 *      读取走专用表，导致POST成功GET返回404。本文件提供专用handler确保读写表一致。
 *
 * 模式参照 store-pg-writer-entity.js，extract函数自包含。
 */
const { runSql } = require('./database-pg');

/** world_scopes 字段提取（覆盖实体归属/穿越事件/世界属性3种子类型） */
function extractWorldScopeFields(data) {
    return {
        id: data.id || '',
        projectId: data.projectId || '',
        type: data.type || 'entity-scope',
        entityId: data.entityId || '',
        name: data.name || '',
        entityType: data.entityType || '',
        worldId: data.worldId || 'main-world',
        worldName: data.worldName || '主世界',
        worldType: data.worldType || 'main',
        powerSystem: _stringifyArray(data.powerSystem, []),
        culture: data.culture || '',
        techLevel: data.techLevel || 'med',
        rules: data.rules || '',
        dangerLevel: data.dangerLevel || 'low',
        entryMethod: data.entryMethod || '',
        description: data.description || '',
        isVisitor: Boolean(data.isVisitor),
        character: data.character || '',
        fromWorld: data.fromWorld || '',
        toWorld: data.toWorld || '',
        faction: data.faction || '',
        entity: data.entity || '',
        homeWorld: data.homeWorld || '',
        appearedIn: data.appearedIn || '',
        chapterNumber: data.chapterNumber || 0,
        data: JSON.stringify(data)
    };
}

/** world_factions 字段提取 */
function extractWorldFactionFields(data) {
    return {
        id: data.id || '',
        projectId: data.projectId || '',
        worldId: data.worldId || 'main-world',
        name: data.name || '未命名势力',
        type: data.type || 'cultivation',
        status: data.status || 'active',
        leader: data.leader || '',
        description: data.description || '',
        data: JSON.stringify(data)
    };
}

/** cross_world_traces 字段提取 */
function extractCrossWorldTraceFields(data) {
    return {
        id: data.id || '',
        projectId: data.projectId || '',
        entityId: data.entityId || '',
        entityName: data.entityName || '',
        entityType: data.entityType || 'equipment',
        characterId: data.characterId || '',
        characterName: data.characterName || '',
        originWorldId: data.originWorldId || 'main-world',
        originWorldName: data.originWorldName || '主世界',
        originChapter: data.originChapter || 0,
        originMethod: data.originMethod || 'picked',
        currentWorldId: data.currentWorldId || 'main-world',
        currentWorldName: data.currentWorldName || '主世界',
        traceLog: _stringifyArray(data.traceLog, []),
        data: JSON.stringify(data)
    };
}

/** 安全序列化数组字段（已是字符串则原样返回） */
function _stringifyArray(val, defaultVal) {
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return JSON.stringify(val);
    return JSON.stringify(defaultVal);
}

function getWorldScopeTableHandlers() {
    return {
        world_scopes: async (db, existing, data, id) => {
            const f = extractWorldScopeFields(data);
            if (existing) {
                await runSql(db, `UPDATE world_scopes SET projectId=?,type=?,entityId=?,name=?,entityType=?,worldId=?,worldName=?,worldType=?,powerSystem=?,culture=?,techLevel=?,rules=?,dangerLevel=?,entryMethod=?,description=?,isVisitor=?,character=?,fromWorld=?,toWorld=?,faction=?,entity=?,homeWorld=?,appearedIn=?,chapterNumber=?,data=?,updatedAt=? WHERE id=?`,
                    [f.projectId, f.type, f.entityId, f.name, f.entityType, f.worldId, f.worldName, f.worldType, f.powerSystem, f.culture, f.techLevel, f.rules, f.dangerLevel, f.entryMethod, f.description, f.isVisitor, f.character, f.fromWorld, f.toWorld, f.faction, f.entity, f.homeWorld, f.appearedIn, f.chapterNumber, f.data, data.updatedAt, id]);
            } else {
                await runSql(db, `INSERT INTO world_scopes (id,projectId,type,entityId,name,entityType,worldId,worldName,worldType,powerSystem,culture,techLevel,rules,dangerLevel,entryMethod,description,isVisitor,character,fromWorld,toWorld,faction,entity,homeWorld,appearedIn,chapterNumber,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                    [f.id, f.projectId, f.type, f.entityId, f.name, f.entityType, f.worldId, f.worldName, f.worldType, f.powerSystem, f.culture, f.techLevel, f.rules, f.dangerLevel, f.entryMethod, f.description, f.isVisitor, f.character, f.fromWorld, f.toWorld, f.faction, f.entity, f.homeWorld, f.appearedIn, f.chapterNumber, f.data, data.createdAt, data.updatedAt]);
            }
        },
        world_factions: async (db, existing, data, id) => {
            const f = extractWorldFactionFields(data);
            if (existing) {
                await runSql(db, `UPDATE world_factions SET projectId=?,worldId=?,name=?,type=?,status=?,leader=?,description=?,data=?,updatedAt=? WHERE id=?`,
                    [f.projectId, f.worldId, f.name, f.type, f.status, f.leader, f.description, f.data, data.updatedAt, id]);
            } else {
                await runSql(db, `INSERT INTO world_factions (id,projectId,worldId,name,type,status,leader,description,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                    [f.id, f.projectId, f.worldId, f.name, f.type, f.status, f.leader, f.description, f.data, data.createdAt, data.updatedAt]);
            }
        },
        cross_world_traces: async (db, existing, data, id) => {
            const f = extractCrossWorldTraceFields(data);
            if (existing) {
                await runSql(db, `UPDATE cross_world_traces SET projectId=?,entityId=?,entityName=?,entityType=?,characterId=?,characterName=?,originWorldId=?,originWorldName=?,originChapter=?,originMethod=?,currentWorldId=?,currentWorldName=?,traceLog=?,data=?,updatedAt=? WHERE id=?`,
                    [f.projectId, f.entityId, f.entityName, f.entityType, f.characterId, f.characterName, f.originWorldId, f.originWorldName, f.originChapter, f.originMethod, f.currentWorldId, f.currentWorldName, f.traceLog, f.data, data.updatedAt, id]);
            } else {
                await runSql(db, `INSERT INTO cross_world_traces (id,projectId,entityId,entityName,entityType,characterId,characterName,originWorldId,originWorldName,originChapter,originMethod,currentWorldId,currentWorldName,traceLog,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                    [f.id, f.projectId, f.entityId, f.entityName, f.entityType, f.characterId, f.characterName, f.originWorldId, f.originWorldName, f.originChapter, f.originMethod, f.currentWorldId, f.currentWorldName, f.traceLog, f.data, data.createdAt, data.updatedAt]);
            }
        }
    };
}

module.exports = {
    getWorldScopeTableHandlers,
    extractWorldScopeFields,
    extractWorldFactionFields,
    extractCrossWorldTraceFields
};
