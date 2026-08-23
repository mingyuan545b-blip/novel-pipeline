const ENTITY_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS character_states (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    characterId TEXT NOT NULL,
    characterName TEXT NOT NULL DEFAULT '',
    chapterNumber INTEGER NOT NULL,
    delta TEXT DEFAULT '{}',
    stateChangedFields TEXT DEFAULT '[]',
    previousChapterState TEXT,
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS state_kv_index (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    scope TEXT NOT NULL,
    entityKey TEXT NOT NULL,
    dataKey TEXT NOT NULL,
    dataValue TEXT NOT NULL,
    dataType TEXT DEFAULT 'string',
    chapterUpdated INTEGER NOT NULL,
    isHot BOOLEAN DEFAULT false,
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_char_state_project ON character_states(projectId, characterId);
CREATE INDEX IF NOT EXISTS idx_char_state_chapter ON character_states(projectId, chapterNumber);
CREATE INDEX IF NOT EXISTS idx_kv_project_scope ON state_kv_index(projectId, scope);
CREATE INDEX IF NOT EXISTS idx_kv_entity ON state_kv_index(projectId, entityKey);
CREATE INDEX IF NOT EXISTS idx_kv_hot ON state_kv_index(projectId, scope, isHot);

CREATE TABLE IF NOT EXISTS character_state_cache (
    id TEXT PRIMARY KEY,
    characterId TEXT NOT NULL,
    projectId TEXT NOT NULL,
    chapterNumber INTEGER NOT NULL,
    roleLevel TEXT NOT NULL DEFAULT 'npc',
    briefText TEXT DEFAULT '',
    briefTokens INTEGER DEFAULT 0,
    summaryText TEXT DEFAULT '',
    summaryTokens INTEGER DEFAULT 0,
    detailText TEXT DEFAULT '',
    detailTokens INTEGER DEFAULT 0,
    stateJson TEXT DEFAULT '{}',
    bindsJson TEXT DEFAULT '[]',
    relationsJson TEXT DEFAULT '[]',
    deltaJson TEXT DEFAULT '{}',
    changedFields TEXT DEFAULT '[]',
    isValid BOOLEAN DEFAULT true,
    computedAt TIMESTAMPTZ DEFAULT NOW(),
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cache_character ON character_state_cache(characterId, chapterNumber);
CREATE INDEX IF NOT EXISTS idx_cache_project_ch ON character_state_cache(projectId, chapterNumber);
CREATE INDEX IF NOT EXISTS idx_cache_project_ch_role ON character_state_cache(projectId, chapterNumber, roleLevel);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_unique ON character_state_cache(characterId, chapterNumber);
CREATE INDEX IF NOT EXISTS idx_cache_stale ON character_state_cache(projectId, isValid) WHERE isValid = false;

CREATE TABLE IF NOT EXISTS entity_registry (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    entityType TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    briefName TEXT DEFAULT '',
    roleLevel TEXT DEFAULT 'npc',
    isActive BOOLEAN DEFAULT true,
    firstAppearChapter INTEGER DEFAULT NULL,
    lastAppearChapter INTEGER DEFAULT NULL,
    appearCount INTEGER DEFAULT 0,
    parentPlane TEXT DEFAULT NULL,
    parentFaction TEXT DEFAULT NULL,
    tags TEXT DEFAULT '[]',
    description TEXT DEFAULT '',
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registry_project_type ON entity_registry(projectId, entityType);
CREATE INDEX IF NOT EXISTS idx_registry_project_active ON entity_registry(projectId, isActive);
CREATE INDEX IF NOT EXISTS idx_registry_project_name ON entity_registry(projectId, name);
CREATE INDEX IF NOT EXISTS idx_registry_appear ON entity_registry(projectId, lastAppearChapter DESC);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entity_registry' AND column_name = 'description') THEN
        ALTER TABLE entity_registry ADD COLUMN description TEXT DEFAULT '';
    END IF;
END $$;
`;

module.exports = { ENTITY_SCHEMA_SQL };
