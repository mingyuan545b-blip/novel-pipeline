/**
 * 实体表索引定义（CREATE INDEX 语句）
 * 文件位置：server/db/pgSchemaEntity/indexes.js
 */

const ENTITY_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_itemdef_project_type ON item_definitions(projectId, defType);
CREATE INDEX IF NOT EXISTS idx_itemdef_project_rarity ON item_definitions(projectId, rarity);
CREATE INDEX IF NOT EXISTS idx_itemdef_project_name ON item_definitions(projectId, name);

CREATE INDEX IF NOT EXISTS idx_bind_character ON character_binds(characterId, bindType);
CREATE INDEX IF NOT EXISTS idx_bind_project ON character_binds(projectId, bindType);
CREATE INDEX IF NOT EXISTS idx_bind_def ON character_binds(defId);
CREATE INDEX IF NOT EXISTS idx_bind_status ON character_binds(projectId, bindStatus);
CREATE INDEX IF NOT EXISTS idx_bind_permanence ON character_binds(projectId, permanence);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bind_unique ON character_binds(characterId, defId, bindType);

CREATE INDEX IF NOT EXISTS idx_rel_from ON character_relations(fromCharacterId);
CREATE INDEX IF NOT EXISTS idx_rel_to ON character_relations(toCharacterId);
CREATE INDEX IF NOT EXISTS idx_rel_project ON character_relations(projectId, relType);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rel_unique ON character_relations(fromCharacterId, toCharacterId, relType);

CREATE INDEX IF NOT EXISTS idx_pet_owner ON pet_entities(ownerId);
CREATE INDEX IF NOT EXISTS idx_pet_project ON pet_entities(projectId, isActive);
CREATE INDEX IF NOT EXISTS idx_pet_species ON pet_entities(projectId, species);

CREATE INDEX IF NOT EXISTS idx_servant_master ON servant_entities(masterId);
CREATE INDEX IF NOT EXISTS idx_servant_project ON servant_entities(projectId, isActive);
CREATE INDEX IF NOT EXISTS idx_servant_type ON servant_entities(projectId, servantType);

CREATE INDEX IF NOT EXISTS idx_chronicle_project ON character_chronicle(projectId, chapterNumber);
CREATE INDEX IF NOT EXISTS idx_chronicle_entity ON character_chronicle(entityId, chapterNumber);

CREATE INDEX IF NOT EXISTS idx_worldscope_project ON world_scopes(projectId);
CREATE INDEX IF NOT EXISTS idx_worldscope_type ON world_scopes(projectId, type);
CREATE INDEX IF NOT EXISTS idx_worldscope_world ON world_scopes(projectId, worldId);

CREATE INDEX IF NOT EXISTS idx_faction_project ON world_factions(projectId);
CREATE INDEX IF NOT EXISTS idx_faction_world ON world_factions(projectId, worldId);

CREATE INDEX IF NOT EXISTS idx_trace_project ON cross_world_traces(projectId);
CREATE INDEX IF NOT EXISTS idx_trace_entity ON cross_world_traces(projectId, entityId);
CREATE INDEX IF NOT EXISTS idx_trace_character ON cross_world_traces(projectId, characterId);
CREATE INDEX IF NOT EXISTS idx_trace_origin_world ON cross_world_traces(projectId, originWorldId);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trace_unique ON cross_world_traces(projectId, entityId, characterId);
`;

module.exports = { ENTITY_INDEXES_SQL };
