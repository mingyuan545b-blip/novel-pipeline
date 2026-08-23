/**
 * 实体表结构定义 - 核心表（物品/绑定/关系）
 * 文件位置：server/db/pgSchemaEntity/tablesCore.js
 */

const ENTITY_TABLES_CORE_SQL = `
CREATE TABLE IF NOT EXISTS item_definitions (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    defType TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    rarity TEXT DEFAULT 'common',
    briefDesc TEXT DEFAULT '',
    summaryDesc TEXT DEFAULT '',
    detailDesc TEXT DEFAULT '',
    loreDesc TEXT DEFAULT '',
    briefTokens INTEGER DEFAULT 0,
    summaryTokens INTEGER DEFAULT 0,
    detailTokens INTEGER DEFAULT 0,
    loreTokens INTEGER DEFAULT 0,
    propertiesJson TEXT DEFAULT '{}',
    constraintsJson TEXT DEFAULT '{}',
    sourceChapter INTEGER DEFAULT NULL,
    tags TEXT DEFAULT '[]',
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS character_binds (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    characterId TEXT NOT NULL,
    defId TEXT NOT NULL,
    bindType TEXT NOT NULL,
    bindStatus TEXT DEFAULT 'active',
    permanence TEXT DEFAULT 'semi-permanent',
    acquiredChapter INTEGER DEFAULT 0,
    lostChapter INTEGER DEFAULT NULL,
    masteryLevel TEXT DEFAULT '初学',
    masteryProgress INTEGER DEFAULT 0,
    personalNotes TEXT DEFAULT '',
    customName TEXT DEFAULT '',
    slotPosition TEXT DEFAULT '',
    bindOrder INTEGER DEFAULT 0,
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'character_binds' AND column_name = 'permanence') THEN
        ALTER TABLE character_binds ADD COLUMN permanence TEXT DEFAULT 'semi-permanent';
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS character_relations (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    fromCharacterId TEXT NOT NULL,
    toCharacterId TEXT NOT NULL,
    relType TEXT NOT NULL,
    relLabel TEXT DEFAULT '',
    strength INTEGER DEFAULT 50,
    trustLevel INTEGER DEFAULT 50,
    startChapter INTEGER DEFAULT 0,
    endChapter INTEGER DEFAULT NULL,
    isSecret BOOLEAN DEFAULT false,
    notes TEXT DEFAULT '',
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);
`;

module.exports = { ENTITY_TABLES_CORE_SQL };
