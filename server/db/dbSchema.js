const logger = require('../shared/logger');
const fs = require('fs');
const path = require('path');

const SCHEMA_SQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8').catch(() => '');

const PG_SCHEMA_PARTS = [];

function getSchemaSQL() {
    if (PG_SCHEMA_PARTS.length > 0) return PG_SCHEMA_PARTS.join('\n');
    try {
        const entityBase = require('./pgSchemaEntityBase');
        const entityPart = require('./pgSchemaEntity');
        PG_SCHEMA_PARTS.push(entityBase.ENTITY_SCHEMA_SQL || '');
        PG_SCHEMA_PARTS.push(entityPart.ENTITY_SCHEMA_SQL_PART2 || '');
    } catch (e) {
        logger.warn('dbSchema', 'Failed to load schema parts:', e.message);
    }
    return PG_SCHEMA_PARTS.join('\n');
}

module.exports = { SCHEMA_SQL, getSchemaSQL };
