/**
 * 核心索引与数据迁移语句（CREATE INDEX + DO $$ 块）
 * 文件位置：server/db/pgSchemaCore/indexes.js
 */

const INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_materials_project ON materials(projectId);
CREATE INDEX IF NOT EXISTS idx_materials_type ON materials(type, archived);
CREATE INDEX IF NOT EXISTS idx_materials_parent ON materials(parentPlane, parentFaction);
CREATE INDEX IF NOT EXISTS idx_materials_dialect ON materials(dialectRegion);
CREATE INDEX IF NOT EXISTS idx_materials_style ON materials(speechStyle);
CREATE INDEX IF NOT EXISTS idx_materials_locked ON materials(isLocked);
CREATE INDEX IF NOT EXISTS idx_materials_version ON materials(version);
CREATE INDEX IF NOT EXISTS idx_materials_roleLevel ON materials(roleLevel);
CREATE INDEX IF NOT EXISTS idx_materials_lastAppear ON materials(lastAppearChapter);
CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(currentStatus);

CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(projectId, chapterNumber);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chapters_project_number ON chapters(projectId, chapterNumber);
CREATE INDEX IF NOT EXISTS idx_chapters_status ON chapters(status);
CREATE INDEX IF NOT EXISTS idx_chapters_wordcount ON chapters(wordCount);

CREATE INDEX IF NOT EXISTS idx_projects_mode ON projects(mode);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_materials_project_type_name') THEN
        DROP INDEX IF EXISTS idx_materials_project_type_name;
    END IF;
END $$;

DO $$
BEGIN
    -- 仅在存在重复数据时执行去重，避免每次启动都无条件DELETE
    -- 修复前：每次启动都执行DELETE，若数据源不一致会反复删除
    IF EXISTS (
        SELECT 1 FROM materials a JOIN materials b
        ON a.id < b.id AND a.projectId = b.projectId
        AND a.type = b.type AND a.name = b.name
        LIMIT 1
    ) THEN
        DELETE FROM materials a USING materials b
        WHERE a.id < b.id AND a.projectId = b.projectId AND a.type = b.type AND a.name = b.name;
        RAISE NOTICE 'materials去重: 已删除重复数据';
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_materials_project_type_name ON materials(projectId, type, name);
CREATE INDEX IF NOT EXISTS idx_kv_type ON kv_store(type);

CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider);
CREATE INDEX IF NOT EXISTS idx_agent_bindings_keyId ON agent_bindings(keyId);
CREATE INDEX IF NOT EXISTS idx_agent_bindings_agentType ON agent_bindings(agentType);

CREATE INDEX IF NOT EXISTS idx_reviews_chapter ON reviews(chapterId);
CREATE INDEX IF NOT EXISTS idx_reviews_project ON reviews(projectId);
CREATE INDEX IF NOT EXISTS idx_reviews_type ON reviews(reviewType);

CREATE INDEX IF NOT EXISTS idx_memory_layers_project ON memory_layers(projectId);
CREATE INDEX IF NOT EXISTS idx_memory_layers_layer ON memory_layers(projectId, layer);

CREATE INDEX IF NOT EXISTS idx_pipeline_logs_project ON pipeline_logs(projectId);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_chapter ON pipeline_logs(chapterId);

CREATE INDEX IF NOT EXISTS idx_infinite_pipeline_project ON infinite_pipeline_state(projectId);

CREATE INDEX IF NOT EXISTS idx_quests_project ON quests(projectId);
CREATE INDEX IF NOT EXISTS idx_quests_parent ON quests(parentId);
CREATE INDEX IF NOT EXISTS idx_quests_status ON quests(status);

CREATE INDEX IF NOT EXISTS idx_timelines_project ON timelines(projectId);
CREATE INDEX IF NOT EXISTS idx_timelines_type ON timelines(eventType);

-- 审计日志查询索引（auditLogStore.queryArchived 按 action/project_id/timestamp 过滤并倒序）
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project ON audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
`;

module.exports = { INDEXES_SQL };
