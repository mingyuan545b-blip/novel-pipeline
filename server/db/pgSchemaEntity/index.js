/**
 * 实体数据库 schema 聚合入口
 * 拼接 base + tablesCore + tablesExt + indexes，对外保持 require('./pgSchemaEntity') 路径不变
 * 文件位置：server/db/pgSchemaEntity/index.js
 */

const { ENTITY_SCHEMA_SQL: BASE_SQL } = require('../pgSchemaEntityBase');
const { ENTITY_TABLES_CORE_SQL } = require('./tablesCore');
const { ENTITY_TABLES_EXT_SQL } = require('./tablesExt');
const { ENTITY_INDEXES_SQL } = require('./indexes');

const ENTITY_SCHEMA_SQL = BASE_SQL + ENTITY_TABLES_CORE_SQL + '\n' + ENTITY_TABLES_EXT_SQL + '\n' + ENTITY_INDEXES_SQL;

module.exports = { ENTITY_SCHEMA_SQL };
