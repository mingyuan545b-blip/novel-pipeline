const logger = require('../shared/logger');
const path = require('path');
require(path.join(__dirname, '..', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '..', '..', '.env') });

const db = require('./database-pg');
const { SCHEMA_SQL } = require('./pgSchema');
const { migrateCharacter } = require('./migrateCharacterProcessor');
const { migrateEquipment } = require('./migrateEquipmentProcessor');

async function migrate() {
    try {
        await db.initDatabaseAsync(process.env.DATABASE_URL);
        const pool = db.getDatabase();
        await pool.query(SCHEMA_SQL);

        const store = require('../store');
        const allMats = await store.queryItems('materials', {});

        const characters = allMats.filter(m => m.type === 'character' && !m.archived);
        const equipments = allMats.filter(m => m.type === 'equipment' && !m.archived);

        const counts = { regCount: 0, defCount: 0, bindCount: 0, relCount: 0 };

        for (const ch of characters) {
            await migrateCharacter(ch, allMats, counts);
        }

        for (const eq of equipments) {
            await migrateEquipment(eq, counts);
        }

        logger.info('migrateEntityRegistr', '\n=== MIGRATION SUMMARY ===');
        logger.info('migrateEntityRegistr', `entity_registry: ${counts.regCount} entries`);
        logger.info('migrateEntityRegistr', `item_definitions: ${counts.defCount} entries`);
        logger.info('migrateEntityRegistr', `character_binds: ${counts.bindCount} entries`);
        logger.info('migrateEntityRegistr', `character_relations: ${counts.relCount} entries`);

        const regItems = await store.queryItems('entity-registry', { projectId: characters[0]?.projectId || '' });
        logger.info('migrateEntityRegistr', `\nVerification - entity_registry for project: ${regItems.length} items`);

        const defItems = await store.queryItems('item-definitions', { projectId: characters[0]?.projectId || '' });
        logger.info('migrateEntityRegistr', `Verification - item_definitions for project: ${defItems.length} items`);

        const migratedChars = characters.filter(c => {
            const mat = allMats.find(m => m.id === c.id);
            return mat && mat.migrated;
        });
        logger.info('migrateEntityRegistr', `Verification - materials with migrated=true: ${migratedChars.length} / ${characters.length}`);

        await db.closeDatabase();
        logger.info('migrateEntityRegistr', '\n=== MIGRATION COMPLETE ===');
    } catch (e) {
        logger.error('migrateEntityRegistr', 'MIGRATION ERROR:', e.message);
        logger.error('migrateEntityRegistr', e.stack);
        process.exit(1);
    }
}

migrate();
