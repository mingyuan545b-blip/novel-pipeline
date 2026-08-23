const { initDatabaseAsync, resetForTesting } = require('../database');
const { runPending, status } = require('./index');
const { migrateCharacterStates } = require('./v0005_character-state-system');
const logger = require('../../shared/logger');
const path = require('path');

async function main() {
    const mode = process.argv[2];
    const dbPath = path.join(__dirname, '..', 'data', 'novel-pipeline.db');

    try {
        await initDatabaseAsync(dbPath);
    } catch (e) {
        logger.error('run-migration', '[MIGRATE] Failed to initialize database:', e.message);
        process.exit(1);
    }

    if (mode === 'status') {
        const s = status();
        logger.info('run-migration', 'Migration Status:');
        logger.info('run-migration', `  Current version: ${s.currentVersion}`);
        logger.info('run-migration', `  Total migrations: ${s.total}`);
        logger.info('run-migration', `  Applied: ${s.applied.map(m => `v${m.version} (${m.name})`).join(', ') || 'none'}`);
        logger.info('run-migration', `  Pending: ${s.pending.map(m => `v${m.version} (${m.name})`).join(', ') || 'none'}`);
        return;
    }

    if (mode === 'migrate-states') {
        logger.info('run-migration', '[MIGRATE] Running character state data migration...');
        try {
            const result = await migrateCharacterStates();
            logger.info('run-migration', `[MIGRATE] Done: ${result.projects} projects, ${result.chapters} chapters, ${result.states} state entries migrated`);
        } catch (e) {
            logger.error('run-migration', '[MIGRATE] Migration failed:', e.message);
            process.exit(1);
        }
        return;
    }

    logger.info('run-migration', '[MIGRATE] Running pending schema migrations...');
    const result = await runPending();
    logger.info('run-migration', `[MIGRATE] Applied ${result.applied.length} migration(s), ${result.skipped} already applied`);

    for (const r of result.applied) {
        logger.info('run-migration', `  v${r.version} (${r.name}): ${r.status} in ${r.durationMs}ms`);
    }

    logger.info('run-migration', '[MIGRATE] Done. Run "migrate status" to verify.');
}

main().catch(e => {
    logger.error('run-migration', '[MIGRATE] Fatal error:', e.message);
    process.exit(1);
});