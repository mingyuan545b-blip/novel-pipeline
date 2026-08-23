const logger = require('../shared/logger');
const fs = require('fs');
const path = require('path');
const { initDatabase, getDatabase, closeDatabase, DATA_DIR } = require('./database');

function migrateFromJson(dbPath) {
    logger.info('migrate', '[MIGRATE] Starting JSON → SQLite migration...');

    const db = initDatabase(dbPath);
    const stats = { projects: 0, materials: 0, chapters: 0, reviews: 0, other: 0, errors: [] };

    const migrateType = (type) => {
        const dir = path.join(DATA_DIR, type);
        if (!fs.existsSync(dir)) {
            logger.info('migrate', `[MIGRATE] Skipping ${type}/ (directory not found)`);
            return;
        }

        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        logger.info('migrate', `[MIGRATE] Found ${files.length} files in ${type}/`);

        const store = require('./store');

        for (const file of files) {
            const id = file.replace('.json', '');
            try {
                const content = fs.readFileSync(path.join(dir, file), 'utf-8').replace(/^\uFEFF/, '');
                if (!content.trim()) continue;
                const data = JSON.parse(content);
                if (!data || !data.id) {
                    data.id = id;
                }
                store.setItem(type, id, data);

                if (type === 'projects') stats.projects++;
                else if (type === 'materials') stats.materials++;
                else if (type === 'chapters') stats.chapters++;
                else if (type === 'reviews') stats.reviews++;
                else stats.other++;
            } catch (err) {
                const msg = `Failed to migrate ${type}/${file}: ${err.message}`;
                logger.error('migrate', `[MIGRATE] ${msg}`);
                stats.errors.push(msg);
            }
        }
    };

    const knownTypes = ['projects', 'materials', 'chapters', 'reviews', 'pipeline-logs', 'infinite-pipeline-state', 'api-keys'];
    for (const type of knownTypes) {
        migrateType(type);
    }

    const allDirs = fs.readdirSync(DATA_DIR).filter(f => {
        const full = path.join(DATA_DIR, f);
        return fs.statSync(full).isDirectory() && !knownTypes.includes(f);
    });
    for (const type of allDirs) {
        migrateType(type);
    }

    logger.info('migrate', `[MIGRATE] Migration complete:`);
    logger.info('migrate', `  Projects: ${stats.projects}`);
    logger.info('migrate', `  Materials: ${stats.materials}`);
    logger.info('migrate', `  Chapters: ${stats.chapters}`);
    logger.info('migrate', `  Reviews: ${stats.reviews}`);
    logger.info('migrate', `  Other: ${stats.other}`);
    if (stats.errors.length > 0) {
        logger.info('migrate', `  Errors: ${stats.errors.length}`);
        stats.errors.forEach(e => logger.info('migrate', `    - ${e}`));
    }

    return stats;
}

async function verifyMigration(dbPath) {
    logger.info('migrate', '[VERIFY] Verifying migration integrity...');

    const db = initDatabase(dbPath);
    const issues = [];

    const verifyType = async (type) => {
        const dir = path.join(DATA_DIR, type);
        if (!fs.existsSync(dir)) return;

        const jsonFiles = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        const store = require('./store');
        const dbItems = await store.listItems(type);

        const dbIds = new Set(dbItems.map(i => i.id));
        const jsonIds = new Set(jsonFiles.map(f => f.replace('.json', '')));

        for (const jsonId of jsonIds) {
            if (!dbIds.has(jsonId)) {
                issues.push(`MISSING in DB: ${type}/${jsonId}`);
            }
        }

        for (const dbId of dbIds) {
            if (!jsonIds.has(dbId)) {
                issues.push(`EXTRA in DB (not in JSON): ${type}/${dbId}`);
            }
        }

        for (const item of dbItems) {
            const filePath = path.join(dir, `${item.id}.json`);
            if (fs.existsSync(filePath)) {
                try {
                    const jsonContent = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
                    const jsonData = JSON.parse(jsonContent);
                    if (jsonData.name && item.name && jsonData.name !== item.name) {
                        issues.push(`NAME MISMATCH: ${type}/${item.id} JSON="${jsonData.name}" DB="${item.name}"`);
                    }
                } catch(_) { logger.warn('migrate', _.message || _); }
            }
        }
    };

    for (const type of ['projects', 'materials', 'chapters', 'reviews']) {
        await verifyType(type);
    }

    if (issues.length === 0) {
        logger.info('migrate', '[VERIFY] ✅ All data verified successfully');
    } else {
        logger.info('migrate', `[VERIFY] ❌ Found ${issues.length} issues:`);
        issues.forEach(i => logger.info('migrate', `  - ${i}`));
    }

    return issues;
}

function backupJsonData() {
    const backupDir = path.join(DATA_DIR, '..', 'data-json-backup');
    if (fs.existsSync(backupDir)) {
        logger.info('migrate', '[BACKUP] Backup directory already exists, skipping');
        return backupDir;
    }

    logger.info('migrate', '[BACKUP] Creating JSON data backup...');
    fs.mkdirSync(backupDir, { recursive: true });

    const dirs = fs.readdirSync(DATA_DIR).filter(f => {
        const full = path.join(DATA_DIR, f);
        return fs.statSync(full).isDirectory();
    });

    for (const dir of dirs) {
        const srcDir = path.join(DATA_DIR, dir);
        const dstDir = path.join(backupDir, dir);
        fs.mkdirSync(dstDir, { recursive: true });

        const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
            fs.copyFileSync(path.join(srcDir, file), path.join(dstDir, file));
        }
    }

    logger.info('migrate', `[BACKUP] ✅ Backup created at ${backupDir}`);
    return backupDir;
}

if (require.main === module) {
    const command = process.argv[2];
    const dbPath = process.argv[3] || undefined;

    if (command === 'migrate') {
        backupJsonData();
        const stats = migrateFromJson(dbPath);
        const issues = verifyMigration(dbPath);
        process.exit(issues.length > 0 ? 1 : 0);
    } else if (command === 'verify') {
        const issues = verifyMigration(dbPath);
        process.exit(issues.length > 0 ? 1 : 0);
    } else if (command === 'backup') {
        backupJsonData();
    } else {
        logger.info('migrate', 'Usage: node migrate.js <migrate|verify|backup> [dbPath]');
        process.exit(1);
    }
}

module.exports = { migrateFromJson, verifyMigration, backupJsonData };
