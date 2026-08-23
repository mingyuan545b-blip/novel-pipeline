/**
 * 实体表结构定义 - 扩展表（宠物/仆从/编年史/世界范围/世界势力/跨界追踪）
 * 文件位置：server/db/pgSchemaEntity/tablesExt.js
 */

const ENTITY_TABLES_EXT_SQL = `
CREATE TABLE IF NOT EXISTS pet_entities (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    ownerId TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    species TEXT NOT NULL DEFAULT '',
    petClass TEXT DEFAULT 'beast',
    rarity TEXT DEFAULT 'common',
    growthStage TEXT DEFAULT '幼体',
    level INTEGER DEFAULT 1,
    hp INTEGER DEFAULT 100,
    mp INTEGER DEFAULT 50,
    loyalty INTEGER DEFAULT 80,
    intelligence INTEGER DEFAULT 30,
    abilitiesJson TEXT DEFAULT '[]',
    equipmentSlots TEXT DEFAULT '[]',
    briefDesc TEXT DEFAULT '',
    summaryDesc TEXT DEFAULT '',
    detailDesc TEXT DEFAULT '',
    acquiredChapter INTEGER DEFAULT 0,
    isActive BOOLEAN DEFAULT true,
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS servant_entities (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    masterId TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    servantType TEXT DEFAULT 'retainer',
    loyalty INTEGER DEFAULT 70,
    competence INTEGER DEFAULT 50,
    specialty TEXT DEFAULT '',
    personality TEXT DEFAULT '',
    briefDesc TEXT DEFAULT '',
    summaryDesc TEXT DEFAULT '',
    detailDesc TEXT DEFAULT '',
    recruitedChapter INTEGER DEFAULT 0,
    dismissedChapter INTEGER DEFAULT NULL,
    isActive BOOLEAN DEFAULT true,
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS character_chronicle (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    entityId TEXT NOT NULL,
    entityName TEXT NOT NULL DEFAULT '',
    chapterNumber INTEGER NOT NULL DEFAULT 0,
    stance TEXT DEFAULT '',
    innerConflict TEXT DEFAULT '',
    quotes TEXT DEFAULT '[]',
    deeds TEXT DEFAULT '[]',
    stanceShiftReason TEXT DEFAULT '',
    level TEXT DEFAULT 'basic',
    data TEXT NOT NULL DEFAULT '{}',
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS world_scopes (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'entity-scope',
    entityId TEXT DEFAULT '',
    name TEXT DEFAULT '',
    entityType TEXT DEFAULT '',
    worldId TEXT DEFAULT 'main-world',
    worldName TEXT DEFAULT '主世界',
    worldType TEXT DEFAULT 'main',
    powerSystem TEXT DEFAULT '[]',
    culture TEXT DEFAULT '',
    techLevel TEXT DEFAULT 'med',
    rules TEXT DEFAULT '',
    dangerLevel TEXT DEFAULT 'low',
    entryMethod TEXT DEFAULT '',
    description TEXT DEFAULT '',
    isVisitor BOOLEAN DEFAULT FALSE,
    character TEXT DEFAULT '',
    fromWorld TEXT DEFAULT '',
    toWorld TEXT DEFAULT '',
    faction TEXT DEFAULT '',
    entity TEXT DEFAULT '',
    homeWorld TEXT DEFAULT '',
    appearedIn TEXT DEFAULT '',
    chapterNumber INTEGER DEFAULT 0,
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS world_factions (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    worldId TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'cultivation',
    status TEXT DEFAULT 'active',
    leader TEXT DEFAULT '',
    description TEXT DEFAULT '',
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cross_world_traces (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    entityId TEXT NOT NULL,
    entityName TEXT NOT NULL,
    entityType TEXT NOT NULL DEFAULT 'equipment',
    characterId TEXT DEFAULT '',
    characterName TEXT DEFAULT '',
    originWorldId TEXT NOT NULL,
    originWorldName TEXT DEFAULT '',
    originChapter INTEGER DEFAULT 0,
    originMethod TEXT DEFAULT 'picked',
    currentWorldId TEXT DEFAULT 'main-world',
    currentWorldName TEXT DEFAULT '主世界',
    traceLog TEXT DEFAULT '[]',
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);
`;

module.exports = { ENTITY_TABLES_EXT_SQL };
