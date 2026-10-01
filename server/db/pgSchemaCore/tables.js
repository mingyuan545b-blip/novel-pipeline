/**
 * 核心表结构定义（CREATE TABLE 语句）
 * 文件位置：server/db/pgSchemaCore/tables.js
 */

const TABLES_SQL = `
CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    parentPlane TEXT,
    parentFaction TEXT,
    archived BOOLEAN DEFAULT false,
    dialectRegion TEXT DEFAULT NULL,
    dialectIntensity TEXT DEFAULT 'medium',
    speechStyle TEXT DEFAULT NULL,
    speechStyleIntensity TEXT DEFAULT 'medium',
    namingStyle TEXT DEFAULT NULL,
    namingStyleIntensity TEXT DEFAULT 'medium',
    archetype TEXT DEFAULT NULL,
    currentPlaneId TEXT DEFAULT NULL,
    isLocked BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    sourceChapter INTEGER DEFAULT NULL,
    roleLevel TEXT DEFAULT NULL,
    lastAppearChapter INTEGER DEFAULT NULL,
    currentStatus TEXT DEFAULT NULL,
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    chapterNumber INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'outlined',
    title TEXT DEFAULT '',
    wordCount INTEGER DEFAULT 0,
    round INTEGER DEFAULT 0,
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    mode TEXT DEFAULT 'novel',
    targetChapterCount INTEGER DEFAULT NULL,
    targetWordCount INTEGER DEFAULT NULL,
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kv_store (
    type TEXT NOT NULL,
    id TEXT NOT NULL,
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (type, id)
);

CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    apiKey TEXT NOT NULL DEFAULT '',
    groupId TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT '',
    baseURL TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    _encrypted BOOLEAN DEFAULT false,
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_bindings (
    id TEXT PRIMARY KEY,
    agentType TEXT NOT NULL DEFAULT '',
    keyId TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    chapterId TEXT NOT NULL,
    projectId TEXT NOT NULL,
    reviewType TEXT NOT NULL DEFAULT 'first-review',
    passed BOOLEAN NOT NULL DEFAULT false,
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_logs (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    chapterId TEXT,
    step TEXT,
    status TEXT DEFAULT 'running',
    round INTEGER DEFAULT 0,
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS infinite_pipeline_state (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL UNIQUE,
    running BOOLEAN NOT NULL DEFAULT false,
    phase TEXT,
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quests (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    parentId TEXT,
    status TEXT NOT NULL DEFAULT 'planned',
    priority TEXT NOT NULL DEFAULT 'normal',
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timelines (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    eventType TEXT NOT NULL DEFAULT 'plot',
    importance TEXT NOT NULL DEFAULT 'normal',
    isKeyEvent BOOLEAN NOT NULL DEFAULT false,
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memory_layers (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    layer TEXT NOT NULL DEFAULT 'M0',
    data TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- 审计日志（shared/auditLogStore.js 的写入目标）
-- 修复背景：v0003 迁移建的是单数表 audit_log（resourceType/resourceId/createdAt），
-- 而代码写的是复数表 audit_logs（action/project_id/user_id/timestamp/summary/metadata），
-- 且该单数表在 PG 中根本不存在 → 审计日志入库路径一直是死的（每次写入都落到 fallback 文件）。
-- 列名以 auditLogStore 的 INSERT/SELECT 为准（ON CONFLICT (id) 依赖 id 主键）。
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL DEFAULT '',
    project_id TEXT,
    user_id TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    summary TEXT,
    metadata JSONB
);
`;

module.exports = { TABLES_SQL };
