#!/usr/bin/env node

const path = require('path');
const rootDir = path.join(__dirname, '..');

async function main() {
    const command = process.argv[2] || 'status';
    const targetVersion = process.argv[3] ? parseInt(process.argv[3]) : undefined;

    const { initDatabaseAsync, closeDatabase, saveToFile } = require(path.join(rootDir, 'server', 'db', 'database'));
    const migrationEngine = require(path.join(rootDir, 'server', 'db', 'migrations'));

    const dbPath = path.join(rootDir, 'data', 'novel-pipeline.db');
    console.log('[Migrate] Initializing database...');
    const db = await initDatabaseAsync(dbPath);

    try {
        switch (command) {
            case 'up':
            case 'migrate': {
                console.log('[Migrate] Running pending migrations...');
                const result = await migrationEngine.runPending(db);
                console.log('\n=== Migration Results ===');
                result.applied.forEach(r => {
                    const status = r.status === 'ok' ? '✅' : '❌';
                    console.log(`  ${status} v${r.version}: ${r.name} (${r.durationMs}ms)${r.error ? ' - ' + r.error : ''}`);
                });
                console.log(`\nApplied: ${result.applied.length}, Skipped: ${result.skipped}`);
                saveToFile();
                break;
            }

            case 'down':
            case 'rollback': {
                console.log(`[Migrate] Rolling back${targetVersion !== undefined ? ' to v' + targetVersion : ''}...`);
                const result = await migrationEngine.rollback(db, targetVersion);
                console.log('\n=== Rollback Results ===');
                result.rolledBack.forEach(r => {
                    const status = r.status === 'ok' ? '✅' : '❌';
                    console.log(`  ${status} v${r.version}: ${r.name} (${r.durationMs}ms)${r.error ? ' - ' + r.error : ''}`);
                });
                saveToFile();
                break;
            }

            case 'status': {
                const s = migrationEngine.status();
                console.log('\n=== Migration Status ===');
                console.log(`  Current version: v${s.currentVersion}`);
                console.log(`  Total migrations: ${s.total}`);
                console.log(`  Applied: ${s.applied.length}`);
                console.log(`  Pending: ${s.pending.length}`);

                if (s.applied.length > 0) {
                    console.log('\n  Applied migrations:');
                    s.applied.forEach(m => console.log(`    ✅ v${m.version}: ${m.name}`));
                }
                if (s.pending.length > 0) {
                    console.log('\n  Pending migrations:');
                    s.pending.forEach(m => console.log(`    ⏳ v${m.version}: ${m.name}`));
                }
                break;
            }

            default:
                console.log('Usage: node scripts/migrate.js [up|down|status] [targetVersion]');
                console.log('');
                console.log('Commands:');
                console.log('  up       Run all pending migrations');
                console.log('  down     Rollback migrations (optionally to target version)');
                console.log('  status   Show current migration status');
                break;
        }
    } finally {
        closeDatabase();
    }
}

main().catch(err => {
    console.error('[Migrate] Fatal error:', err);
    process.exit(1);
});
