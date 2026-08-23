const { runSql,
    extractCharStateFields, extractStateKvFields, extractCacheFields, extractRegistryFields,
    extractItemDefFields, extractCharBindFields, extractCharRelationFields,
    extractPetFields, extractServantFields, extractChronicleFields,
    extractKnowledgeAccessFields
} = require('./database-pg');

function getEntityTableHandlers() {
    return {
        character_states: async (db, existing, data, id, now) => {
            const f = extractCharStateFields(data);
            if (existing) { await runSql(db, `UPDATE character_states SET projectId=?,characterId=?,characterName=?,chapterNumber=?,delta=?,stateChangedFields=?,previousChapterState=?,data=?,updatedAt=? WHERE id=?`, [f.projectId,f.characterId,f.characterName,f.chapterNumber,f.delta,f.stateChangedFields,f.previousChapterState,f.data,data.updatedAt,id]); }
            else { await runSql(db, `INSERT INTO character_states (id,projectId,characterId,characterName,chapterNumber,delta,stateChangedFields,previousChapterState,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [f.id,f.projectId,f.characterId,f.characterName,f.chapterNumber,f.delta,f.stateChangedFields,f.previousChapterState,f.data,data.createdAt,data.updatedAt]); }
        },
        state_kv_index: async (db, existing, data, id, now) => {
            const f = extractStateKvFields(data);
            if (existing) { await runSql(db, `UPDATE state_kv_index SET projectId=?,scope=?,entityKey=?,dataKey=?,dataValue=?,dataType=?,chapterUpdated=?,isHot=?,data=?,updatedAt=? WHERE id=?`, [f.projectId,f.scope,f.entityKey,f.dataKey,f.dataValue,f.dataType,f.chapterUpdated,f.isHot,f.data,data.updatedAt,id]); }
            else { await runSql(db, `INSERT INTO state_kv_index (id,projectId,scope,entityKey,dataKey,dataValue,dataType,chapterUpdated,isHot,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [f.id,f.projectId,f.scope,f.entityKey,f.dataKey,f.dataValue,f.dataType,f.chapterUpdated,f.isHot,f.data,data.createdAt,data.updatedAt]); }
        },
        character_state_cache: async (db, existing, data, id, now) => {
            const f = extractCacheFields(data);
            if (existing) { await runSql(db, `UPDATE character_state_cache SET characterId=?,projectId=?,chapterNumber=?,roleLevel=?,briefText=?,briefTokens=?,summaryText=?,summaryTokens=?,detailText=?,detailTokens=?,stateJson=?,bindsJson=?,relationsJson=?,deltaJson=?,changedFields=?,isValid=?,computedAt=?,data=?,updatedAt=? WHERE id=?`, [f.characterId,f.projectId,f.chapterNumber,f.roleLevel,f.briefText,f.briefTokens,f.summaryText,f.summaryTokens,f.detailText,f.detailTokens,f.stateJson,f.bindsJson,f.relationsJson,f.deltaJson,f.changedFields,f.isValid,f.computedAt,f.data,data.updatedAt,id]); }
            else { await runSql(db, `INSERT INTO character_state_cache (id,characterId,projectId,chapterNumber,roleLevel,briefText,briefTokens,summaryText,summaryTokens,detailText,detailTokens,stateJson,bindsJson,relationsJson,deltaJson,changedFields,isValid,computedAt,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [f.id,f.characterId,f.projectId,f.chapterNumber,f.roleLevel,f.briefText,f.briefTokens,f.summaryText,f.summaryTokens,f.detailText,f.detailTokens,f.stateJson,f.bindsJson,f.relationsJson,f.deltaJson,f.changedFields,f.isValid,f.computedAt,f.data,data.createdAt,data.updatedAt]); }
        },
        entity_registry: async (db, existing, data, id, now) => {
            const f = extractRegistryFields(data);
            if (existing) { await runSql(db, `UPDATE entity_registry SET projectId=?,entityType=?,name=?,briefName=?,roleLevel=?,isActive=?,firstAppearChapter=?,lastAppearChapter=?,appearCount=?,parentPlane=?,parentFaction=?,tags=?,description=?,data=?,updatedAt=? WHERE id=?`, [f.projectId,f.entityType,f.name,f.briefName,f.roleLevel,f.isActive,f.firstAppearChapter,f.lastAppearChapter,f.appearCount,f.parentPlane,f.parentFaction,f.tags,f.description,f.data,data.updatedAt,id]); }
            else { await runSql(db, `INSERT INTO entity_registry (id,projectId,entityType,name,briefName,roleLevel,isActive,firstAppearChapter,lastAppearChapter,appearCount,parentPlane,parentFaction,tags,description,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [f.id,f.projectId,f.entityType,f.name,f.briefName,f.roleLevel,f.isActive,f.firstAppearChapter,f.lastAppearChapter,f.appearCount,f.parentPlane,f.parentFaction,f.tags,f.description,f.data,data.createdAt,data.updatedAt]); }
        },
        item_definitions: async (db, existing, data, id, now) => {
            const f = extractItemDefFields(data);
            if (existing) { await runSql(db, `UPDATE item_definitions SET projectId=?,defType=?,name=?,rarity=?,briefDesc=?,summaryDesc=?,detailDesc=?,loreDesc=?,briefTokens=?,summaryTokens=?,detailTokens=?,loreTokens=?,propertiesJson=?,constraintsJson=?,sourceChapter=?,tags=?,data=?,updatedAt=? WHERE id=?`, [f.projectId,f.defType,f.name,f.rarity,f.briefDesc,f.summaryDesc,f.detailDesc,f.loreDesc,f.briefTokens,f.summaryTokens,f.detailTokens,f.loreTokens,f.propertiesJson,f.constraintsJson,f.sourceChapter,f.tags,f.data,data.updatedAt,id]); }
            else { await runSql(db, `INSERT INTO item_definitions (id,projectId,defType,name,rarity,briefDesc,summaryDesc,detailDesc,loreDesc,briefTokens,summaryTokens,detailTokens,loreTokens,propertiesJson,constraintsJson,sourceChapter,tags,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [f.id,f.projectId,f.defType,f.name,f.rarity,f.briefDesc,f.summaryDesc,f.detailDesc,f.loreDesc,f.briefTokens,f.summaryTokens,f.detailTokens,f.loreTokens,f.propertiesJson,f.constraintsJson,f.sourceChapter,f.tags,f.data,data.createdAt,data.updatedAt]); }
        },
        character_binds: async (db, existing, data, id, now) => {
            const f = extractCharBindFields(data);
            if (existing) { await runSql(db, `UPDATE character_binds SET projectId=?,characterId=?,defId=?,bindType=?,bindStatus=?,permanence=?,acquiredChapter=?,lostChapter=?,masteryLevel=?,masteryProgress=?,personalNotes=?,customName=?,slotPosition=?,bindOrder=?,data=?,updatedAt=? WHERE id=?`, [f.projectId,f.characterId,f.defId,f.bindType,f.bindStatus,f.permanence,f.acquiredChapter,f.lostChapter,f.masteryLevel,f.masteryProgress,f.personalNotes,f.customName,f.slotPosition,f.bindOrder,f.data,data.updatedAt,id]); }
            else { await runSql(db, `INSERT INTO character_binds (id,projectId,characterId,defId,bindType,bindStatus,permanence,acquiredChapter,lostChapter,masteryLevel,masteryProgress,personalNotes,customName,slotPosition,bindOrder,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [f.id,f.projectId,f.characterId,f.defId,f.bindType,f.bindStatus,f.permanence,f.acquiredChapter,f.lostChapter,f.masteryLevel,f.masteryProgress,f.personalNotes,f.customName,f.slotPosition,f.bindOrder,f.data,data.createdAt,data.updatedAt]); }
        },
        character_relations: async (db, existing, data, id, now) => {
            const f = extractCharRelationFields(data);
            if (existing) { await runSql(db, `UPDATE character_relations SET projectId=?,fromCharacterId=?,toCharacterId=?,relType=?,relLabel=?,strength=?,trustLevel=?,startChapter=?,endChapter=?,isSecret=?,notes=?,data=?,updatedAt=? WHERE id=?`, [f.projectId,f.fromCharacterId,f.toCharacterId,f.relType,f.relLabel,f.strength,f.trustLevel,f.startChapter,f.endChapter,f.isSecret,f.notes,f.data,data.updatedAt,id]); }
            else { await runSql(db, `INSERT INTO character_relations (id,projectId,fromCharacterId,toCharacterId,relType,relLabel,strength,trustLevel,startChapter,endChapter,isSecret,notes,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [f.id,f.projectId,f.fromCharacterId,f.toCharacterId,f.relType,f.relLabel,f.strength,f.trustLevel,f.startChapter,f.endChapter,f.isSecret,f.notes,f.data,data.createdAt,data.updatedAt]); }
        },
        pet_entities: async (db, existing, data, id, now) => {
            const f = extractPetFields(data);
            if (existing) { await runSql(db, `UPDATE pet_entities SET projectId=?,ownerId=?,name=?,species=?,petClass=?,rarity=?,growthStage=?,level=?,hp=?,mp=?,loyalty=?,intelligence=?,abilitiesJson=?,equipmentSlots=?,briefDesc=?,summaryDesc=?,detailDesc=?,acquiredChapter=?,isActive=?,data=?,updatedAt=? WHERE id=?`, [f.projectId,f.ownerId,f.name,f.species,f.petClass,f.rarity,f.growthStage,f.level,f.hp,f.mp,f.loyalty,f.intelligence,f.abilitiesJson,f.equipmentSlots,f.briefDesc,f.summaryDesc,f.detailDesc,f.acquiredChapter,f.isActive,f.data,data.updatedAt,id]); }
            else { await runSql(db, `INSERT INTO pet_entities (id,projectId,ownerId,name,species,petClass,rarity,growthStage,level,hp,mp,loyalty,intelligence,abilitiesJson,equipmentSlots,briefDesc,summaryDesc,detailDesc,acquiredChapter,isActive,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [f.id,f.projectId,f.ownerId,f.name,f.species,f.petClass,f.rarity,f.growthStage,f.level,f.hp,f.mp,f.loyalty,f.intelligence,f.abilitiesJson,f.equipmentSlots,f.briefDesc,f.summaryDesc,f.detailDesc,f.acquiredChapter,f.isActive,f.data,data.createdAt,data.updatedAt]); }
        },
        servant_entities: async (db, existing, data, id, now) => {
            const f = extractServantFields(data);
            if (existing) { await runSql(db, `UPDATE servant_entities SET projectId=?,masterId=?,name=?,servantType=?,loyalty=?,competence=?,specialty=?,personality=?,briefDesc=?,summaryDesc=?,detailDesc=?,recruitedChapter=?,dismissedChapter=?,isActive=?,data=?,updatedAt=? WHERE id=?`, [f.projectId,f.masterId,f.name,f.servantType,f.loyalty,f.competence,f.specialty,f.personality,f.briefDesc,f.summaryDesc,f.detailDesc,f.recruitedChapter,f.dismissedChapter,f.isActive,f.data,data.updatedAt,id]); }
            else { await runSql(db, `INSERT INTO servant_entities (id,projectId,masterId,name,servantType,loyalty,competence,specialty,personality,briefDesc,summaryDesc,detailDesc,recruitedChapter,dismissedChapter,isActive,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [f.id,f.projectId,f.masterId,f.name,f.servantType,f.loyalty,f.competence,f.specialty,f.personality,f.briefDesc,f.summaryDesc,f.detailDesc,f.recruitedChapter,f.dismissedChapter,f.isActive,f.data,data.createdAt,data.updatedAt]); }
        },
        character_chronicle: async (db, existing, data, id, now) => {
            const f = extractChronicleFields(data);
            if (existing) { await runSql(db, `UPDATE character_chronicle SET projectId=?,entityId=?,entityName=?,chapterNumber=?,stance=?,innerConflict=?,quotes=?,deeds=?,stanceShiftReason=?,level=?,data=?,updatedAt=? WHERE id=?`, [f.projectId,f.entityId,f.entityName,f.chapterNumber,f.stance,f.innerConflict,f.quotes,f.deeds,f.stanceShiftReason,f.level,f.data,data.updatedAt,id]); }
            else { await runSql(db, `INSERT INTO character_chronicle (id,projectId,entityId,entityName,chapterNumber,stance,innerConflict,quotes,deeds,stanceShiftReason,level,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [f.id,f.projectId,f.entityId,f.entityName,f.chapterNumber,f.stance,f.innerConflict,f.quotes,f.deeds,f.stanceShiftReason,f.level,f.data,data.createdAt||new Date().toISOString(),data.updatedAt||new Date().toISOString()]); }
        },
        knowledge_access: async (db, existing, data, id, now) => {
            const f = extractKnowledgeAccessFields(data);
            if (existing) {
                await runSql(db, `UPDATE knowledge_access SET projectId=?,factId=?,entityId=?,factText=?,confidence=?,sourceHow=?,sinceChapter=?,notes=?,data=?,updatedAt=? WHERE id=?`,
                    [f.projectId, f.factId, f.entityId, f.factText, f.confidence, f.sourceHow, f.sinceChapter, f.notes, f.data, data.updatedAt, id]);
            } else {
                await runSql(db, `INSERT INTO knowledge_access (id,projectId,factId,entityId,factText,confidence,sourceHow,sinceChapter,notes,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                    [f.id, f.projectId, f.factId, f.entityId, f.factText, f.confidence, f.sourceHow, f.sinceChapter, f.notes, f.data, data.createdAt || now, data.updatedAt]);
            }
        }
    };
}

module.exports = { getEntityTableHandlers };
