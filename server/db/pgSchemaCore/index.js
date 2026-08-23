/**
 * 核心数据库 schema 聚合入口
 * 拼接表结构与索引语句，对外保持 require('./pgSchemaCore') 路径不变
 * 文件位置：server/db/pgSchemaCore/index.js
 */

const { TABLES_SQL } = require('./tables');
const { INDEXES_SQL } = require('./indexes');

const CORE_SCHEMA_SQL = TABLES_SQL + '\n' + INDEXES_SQL;

module.exports = { CORE_SCHEMA_SQL };
