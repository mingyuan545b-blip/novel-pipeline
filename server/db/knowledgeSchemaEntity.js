const KNOWLEDGE_ENTITY_SQL = `
-- ============================================================
-- 知识库统一Schema v2 - 实体部分
-- ============================================================

CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    entityType TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    briefName TEXT DEFAULT '',
    roleLevel TEXT NOT NULL DEFAULT 'npc',
    genreId TEXT DEFAULT '',

    isActive BOOLEAN DEFAULT true,
    isLocked BOOLEAN DEFAULT false,
    firstAppearChapter INTEGER DEFAULT NULL,
    lastAppearChapter INTEGER DEFAULT NULL,
    appearCount INTEGER DEFAULT 0,

    parentEntityId TEXT DEFAULT NULL,
    tags JSONB DEFAULT '[]'::jsonb,

    hp INTEGER DEFAULT 100,
    combatPower INTEGER DEFAULT 0,
    position TEXT DEFAULT '',
    factionName TEXT DEFAULT '',
    personality TEXT DEFAULT '',
    speakingTone TEXT DEFAULT '',
    signatureDetail TEXT DEFAULT '',

    genreState JSONB DEFAULT '{}'::jsonb,
    profile JSONB DEFAULT '{}'::jsonb,
    bindsSummary JSONB DEFAULT '[]'::jsonb,
    relationsSummary JSONB DEFAULT '[]'::jsonb,

    briefText TEXT DEFAULT '',
    briefTokens INTEGER DEFAULT 0,
    summaryText TEXT DEFAULT '',
    summaryTokens INTEGER DEFAULT 0,
    detailText TEXT DEFAULT '',
    detailTokens INTEGER DEFAULT 0,

    sourceContent TEXT DEFAULT '',
    version INTEGER DEFAULT 1,
    sourceChapter INTEGER DEFAULT NULL,
    archived TEXT DEFAULT '',

    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ent_project ON entities(projectId);
CREATE INDEX IF NOT EXISTS idx_ent_project_type ON entities(projectId, entityType);
CREATE INDEX IF NOT EXISTS idx_ent_project_active ON entities(projectId, isActive);
CREATE INDEX IF NOT EXISTS idx_ent_project_name ON entities(projectId, name);
CREATE INDEX IF NOT EXISTS idx_ent_project_role ON entities(projectId, roleLevel);
CREATE INDEX IF NOT EXISTS idx_ent_parent ON entities(parentEntityId);
CREATE INDEX IF NOT EXISTS idx_ent_genre ON entities(projectId, genreId);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ent_project_type_name ON entities(projectId, entityType, name) WHERE isActive = true;
CREATE INDEX IF NOT EXISTS idx_ent_genre_state ON entities USING gin(genreState);
CREATE INDEX IF NOT EXISTS idx_ent_profile ON entities USING gin(profile);

CREATE TABLE IF NOT EXISTS entity_state_history (
    id TEXT PRIMARY KEY,
    entityId TEXT NOT NULL,
    projectId TEXT NOT NULL,
    chapterNumber INTEGER NOT NULL,
    baseState JSONB DEFAULT '{}'::jsonb,
    genreState JSONB DEFAULT '{}'::jsonb,
    delta JSONB DEFAULT '{}'::jsonb,
    changedFields JSONB DEFAULT '[]'::jsonb,
    bindsSnapshot JSONB DEFAULT '[]'::jsonb,
    relationsSnapshot JSONB DEFAULT '[]'::jsonb,
    briefText TEXT DEFAULT '',
    summaryText TEXT DEFAULT '',
    detailText TEXT DEFAULT '',
    isValid BOOLEAN DEFAULT true,
    computedAt TIMESTAMPTZ DEFAULT NOW(),
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_esh_entity_ch ON entity_state_history(entityId, chapterNumber);
CREATE INDEX IF NOT EXISTS idx_esh_project_ch ON entity_state_history(projectId, chapterNumber);
CREATE INDEX IF NOT EXISTS idx_esh_project_ch_role ON entity_state_history(projectId, chapterNumber);
CREATE INDEX IF NOT EXISTS idx_esh_stale ON entity_state_history(projectId, isValid) WHERE isValid = false;

CREATE TABLE IF NOT EXISTS entity_relations (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    fromEntityId TEXT NOT NULL,
    toEntityId TEXT NOT NULL,
    relType TEXT NOT NULL,
    relLabel TEXT DEFAULT '',
    strength INTEGER DEFAULT 50,
    trustLevel INTEGER DEFAULT 50,
    startChapter INTEGER DEFAULT 0,
    endChapter INTEGER DEFAULT NULL,
    isSecret BOOLEAN DEFAULT false,
    cognitiveOnly BOOLEAN DEFAULT false,
    notes TEXT DEFAULT '',
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erel_from ON entity_relations(fromEntityId);
CREATE INDEX IF NOT EXISTS idx_erel_to ON entity_relations(toEntityId);
CREATE INDEX IF NOT EXISTS idx_erel_project ON entity_relations(projectId, relType);
CREATE UNIQUE INDEX IF NOT EXISTS idx_erel_unique ON entity_relations(fromEntityId, toEntityId, relType);
CREATE INDEX IF NOT EXISTS idx_erel_project_ch ON entity_relations(projectId, startChapter);

CREATE TABLE IF NOT EXISTS entity_binds (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    entityId TEXT NOT NULL,
    targetEntityId TEXT NOT NULL,
    bindType TEXT NOT NULL,
    bindStatus TEXT DEFAULT 'active',
    permanence TEXT DEFAULT 'semi-permanent',
    acquiredChapter INTEGER DEFAULT 0,
    lostChapter INTEGER DEFAULT NULL,
    masteryLevel TEXT DEFAULT '',
    masteryProgress INTEGER DEFAULT 0,
    personalNotes TEXT DEFAULT '',
    customName TEXT DEFAULT '',
    slotPosition TEXT DEFAULT '',
    bindOrder INTEGER DEFAULT 0,
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ebind_entity ON entity_binds(entityId, bindType);
CREATE INDEX IF NOT EXISTS idx_ebind_project ON entity_binds(projectId, bindType);
CREATE INDEX IF NOT EXISTS idx_ebind_target ON entity_binds(targetEntityId);
CREATE INDEX IF NOT EXISTS idx_ebind_status ON entity_binds(projectId, bindStatus);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ebind_unique ON entity_binds(entityId, targetEntityId, bindType);
`;

module.exports = { KNOWLEDGE_ENTITY_SQL };
