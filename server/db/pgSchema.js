const { CORE_SCHEMA_SQL } = require('./pgSchemaCore');
const { ENTITY_SCHEMA_SQL } = require('./pgSchemaEntity');

const SCHEMA_SQL = CORE_SCHEMA_SQL + ENTITY_SCHEMA_SQL;

module.exports = { SCHEMA_SQL };
