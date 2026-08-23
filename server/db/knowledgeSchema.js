const { KNOWLEDGE_ENTITY_SQL } = require('./knowledgeSchemaEntity');
const { KNOWLEDGE_FACTS_SQL } = require('./knowledgeSchemaFacts');

const KNOWLEDGE_SCHEMA_SQL = KNOWLEDGE_ENTITY_SQL + KNOWLEDGE_FACTS_SQL;

module.exports = { KNOWLEDGE_SCHEMA_SQL };
