const fs = require('fs');
const path = require('path');
const logger = require('../../shared/logger');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'data', 'migrations');
const MIGRATION_LOG_FILE = path.join(MIGRATIONS_DIR, 'migration-log.json');

function _ensureDir() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    }
}

function _loadLog() {
    _ensureDir();
    try {
        if (fs.existsSync(MIGRATION_LOG_FILE)) {
            return JSON.parse(fs.readFileSync(MIGRATION_LOG_FILE, 'utf-8'));
        }
    } catch (e) {
        logger.warn('migrations', 'Corrupt log file, starting fresh:', e.message);
    }
    return { applied: [], rolledBack: [] };
}

function _saveLog(log) {
    _ensureDir();
    fs.writeFileSync(MIGRATION_LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');
}

function _getAppliedVersions() {
    const log = _loadLog();
    return new Set(log.applied.map(e => e.version));
}

function _discoverMigrations() {
    const files = fs.readdirSync(__dirname)
        .filter(f => /^v\d{4}_.*\.js$/.test(f))
        .sort();
    return files.map(f => {
        const match = f.match(/^v(\d{4})_(.+)\.js$/);
        return {
            version: parseInt(match[1]),
            name: match[2],
            file: f,
            path: path.join(__dirname, f)
        };
    });
}

async function runPending(db) {
    const applied = _getAppliedVersions();
    const all = _discoverMigrations();
    const pending = all.filter(m => !applied.has(m.version));

    if (pending.length === 0) {
        logger.info('migrations', 'No pending migrations');
        return { applied: [], skipped: all.length };
    }

    logger.info('migrations', `${pending.length} pending migration(s) found`);
    const results = [];

    for (const migration of pending) {
        logger.info('migrations', `Running v${migration.version}: ${migration.name}`);
        try {
            const mod = require(migration.path);
            if (!mod.up) {
                throw new Error(`Migration v${migration.version} has no up() function`);
            }

            const startTime = Date.now();
            await mod.up(db);
            const duration = Date.now() - startTime;

            const log = _loadLog();
            log.applied.push({
                version: migration.version,
                name: migration.name,
                appliedAt: new Date().toISOString(),
                durationMs: duration
            });
            _saveLog(log);

            results.push({ version: migration.version, name: migration.name, status: 'ok', durationMs: duration });
            logger.info('migrations', `v${migration.version} applied in ${duration}ms`);
        } catch (e) {
            results.push({ version: migration.version, name: migration.name, status: 'failed', error: e.message });
            logger.error('migrations', `v${migration.version} FAILED:`, e.message);
            break;
        }
    }

    return { applied: results, skipped: all.length - pending.length };
}

async function rollback(db, targetVersion) {
    const applied = _getAppliedVersions();
    const all = _discoverMigrations();
    const toRollback = all
        .filter(m => applied.has(m.version) && m.version > (targetVersion || 0))
        .sort((a, b) => b.version - a.version);

    if (toRollback.length === 0) {
        logger.info('migrations', 'No migrations to rollback');
        return { rolledBack: [] };
    }

    logger.info('migrations', `Rolling back ${toRollback.length} migration(s)`);
    const results = [];

    for (const migration of toRollback) {
        logger.info('migrations', `Rolling back v${migration.version}: ${migration.name}`);
        try {
            const mod = require(migration.path);
            if (!mod.down) {
                throw new Error(`Migration v${migration.version} has no down() function (rollback not supported)`);
            }

            const startTime = Date.now();
            await mod.down(db);
            const duration = Date.now() - startTime;

            const log = _loadLog();
            log.applied = log.applied.filter(e => e.version !== migration.version);
            log.rolledBack.push({
                version: migration.version,
                name: migration.name,
                rolledBackAt: new Date().toISOString(),
                durationMs: duration
            });
            _saveLog(log);

            results.push({ version: migration.version, name: migration.name, status: 'ok', durationMs: duration });
            logger.info('migrations', `v${migration.version} rolled back in ${duration}ms`);
        } catch (e) {
            results.push({ version: migration.version, name: migration.name, status: 'failed', error: e.message });
            logger.error('migrations', `Rollback v${migration.version} FAILED:`, e.message);
            break;
        }
    }

    return { rolledBack: results };
}

function status() {
    const applied = _getAppliedVersions();
    const all = _discoverMigrations();
    return {
        currentVersion: all.filter(m => applied.has(m.version)).reduce((max, m) => Math.max(max, m.version), 0),
        total: all.length,
        applied: all.filter(m => applied.has(m.version)).map(m => ({ version: m.version, name: m.name })),
        pending: all.filter(m => !applied.has(m.version)).map(m => ({ version: m.version, name: m.name }))
    };
}

module.exports = { runPending, rollback, status, _discoverMigrations, _loadLog, _saveLog };
