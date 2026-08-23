/**
 * targetChapters Schema - 字段名单一数据源
 *
 * 历史问题：JSON业务代码用targetChapters，PG数据库列名用targetChapterCount
 *   - unifiedConfig用??兼容两个字段
 *   - pipelineInit/batchExecutor用||兼容
 *   - v0002FieldExtractors只提取targetChapterCount，漏了targetChapters（迁移数据丢失）
 *
 * 根治方案：
 *   - JSON层统一用targetChapters（业务标准字段名）
 *   - PG层保留targetChapterCount作为列名（不改数据库schema）
 *   - 归一化函数负责读取时兼容两个字段，统一返回targetChapters
 *   - v0002FieldExtractors修复为同时提取两个字段
 */

// JSON层标准字段名
const TARGET_CHAPTERS_FIELD = 'targetChapters';

// PG层列名（不可更改，涉及数据库schema迁移）
const TARGET_CHAPTERS_DB_COLUMN = 'targetChapterCount';

// 历史别名（归一化时兼容）
const FIELD_ALIASES = [TARGET_CHAPTERS_FIELD, TARGET_CHAPTERS_DB_COLUMN];

// 默认值
const DEFAULT_TARGET_CHAPTERS = 100;

module.exports = {
    TARGET_CHAPTERS_FIELD,
    TARGET_CHAPTERS_DB_COLUMN,
    FIELD_ALIASES,
    DEFAULT_TARGET_CHAPTERS
};
