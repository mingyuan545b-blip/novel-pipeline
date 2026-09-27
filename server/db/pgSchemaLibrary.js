/**
 * pgSchemaLibrary — 藏经阁技法库表结构（PG）
 *
 * 藏经阁原为 server/data/library/*.json（index.json + leaf/*.json + metadata/*.json 三份数据），
 * 存在三处不一致风险（index缺subcategory、meta与leaf分离）。此表把技法收敛为单一记录：
 * 索引列（可SQL过滤） + data列（完整JSON，含rules/anti/tags/evidence）。
 *
 * 文件位置：server/db/pgSchemaLibrary.js
 */

const LIBRARY_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS library_techniques (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    department TEXT NOT NULL,
    subcategory TEXT DEFAULT '',
    category_path TEXT DEFAULT '',
    applicable_modes TEXT DEFAULT '[]',
    context_slot TEXT DEFAULT 'L2',
    injection_point TEXT DEFAULT 'writer',
    worldview_depth TEXT DEFAULT 'meso',
    context_priority INTEGER DEFAULT 70,
    word_count_impact TEXT DEFAULT '+0%',
    retrieval_tags TEXT DEFAULT '[]',
    source_novel TEXT DEFAULT '',
    source_type TEXT DEFAULT 'curated',
    success_rate INTEGER DEFAULT 50,
    attempts INTEGER DEFAULT 0,
    auto_disabled BOOLEAN DEFAULT FALSE,
    version TEXT DEFAULT '1.0.0',
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);
`;

const LIBRARY_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_libtech_department ON library_techniques(department);
CREATE INDEX IF NOT EXISTS idx_libtech_subcategory ON library_techniques(department, subcategory);
CREATE INDEX IF NOT EXISTS idx_libtech_injection ON library_techniques(injection_point);
CREATE INDEX IF NOT EXISTS idx_libtech_depth ON library_techniques(worldview_depth);
CREATE INDEX IF NOT EXISTS idx_libtech_source ON library_techniques(source_novel);
CREATE INDEX IF NOT EXISTS idx_libtech_disabled ON library_techniques(auto_disabled);
`;

const LIBRARY_SCHEMA_SQL = LIBRARY_TABLES_SQL + '\n' + LIBRARY_INDEXES_SQL;

module.exports = { LIBRARY_SCHEMA_SQL };
