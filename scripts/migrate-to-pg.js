#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { JSON_DIR_TYPES, KV_STORE_TYPES, SET_ITEM_TYPES, insertDirect } = require('./migratePgHelpers');

function readJsonDir(dirPath) {
    if (!fs.existsSync(dirPath)) return [];
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    const items = [];
    for (const file of files) {
        try {
            const raw = fs.readFileSync(path.join(dirPath, file), 'utf-8');
            const data = JSON.parse(raw);
            if (!data.id) data.id = path.basename(file, '.json');
            items.push(data);
        } catch (err) { console.warn(`[MIGRATE] Failed to read ${file}: ${err.message}`); }
    }
    return items;
}

async function migrateItems(items, type, pgTable, pgStore, pgDb) {
    let count = 0;
    if (SET_ITEM_TYPES.has(type)) {
        for (const item of items) {
            try { await pgStore.setItem(type, item.id, item); count++; }
            catch (err) { console.warn(`[MIGRATE]   Failed ${type}/${item.id}: ${err.message}`); }
        }
    } else {
        for (const item of items) {
            try { await pgDb.withTransaction(async (client) => { await insertDirect(client, pgTable, item); }); count++; }
            catch (err) { console.warn(`[MIGRATE]   Failed ${type}/${item.id}: ${err.message}`); }
        }
    }
    return count;
}

async function main() {
    console.log('[MIGRATE] Starting JSON/SQLite → PostgreSQL migration');
    const dataDir = path.join(__dirname, '..', 'data');
    const dbPath = path.join(dataDir, 'novel-pipeline.db');

    let sqliteDb, sqliteStore;
    if (fs.existsSync(dbPath)) {
        try {
            sqliteDb = require('../server/db/database');
            await sqliteDb.initDatabaseAsync(dbPath);
            sqliteStore = require('../server/db/store');
            console.log('[MIGRATE] SQLite database loaded');
        } catch (err) { console.warn('[MIGRATE] SQLite load failed:', err.message); sqliteDb = null; }
    } else { console.log('[MIGRATE] SQLite database not found'); }

    let pgDb, pgStore, getPool, closePgPool;
    try {
        pgDb = require('../server/db/database-pg');
        pgStore = require('../server/db/store-pg');
        ({ getPool, closePgPool } = require('../server/db/pgPool'));
    } catch (err) {
        console.error('[MIGRATE] Failed to load PostgreSQL modules:', err.message);
        if (sqliteDb) sqliteDb.closeDatabase();
        process.exit(1);
    }

    await pgDb.initDatabaseAsync();
    const pool = getPool();
    console.log('[MIGRATE] PostgreSQL schema initialized');

    const checkTables = ['projects', 'materials', 'chapters', 'reviews', 'pipeline_logs', 'infinite_pipeline_state', 'api_keys', 'agent_bindings', 'kv_store', 'timelines', 'quests'];
    let hasData = false;
    for (const table of checkTables) { try { const r = await pool.query(`SELECT COUNT(*) as cnt FROM ${table}`); if (parseInt(r.rows[0].cnt, 10) > 0) { hasData = true; break; } } catch (_) {} }

    if (hasData && process.env.FORCE_MIGRATE !== '1') {
        console.error('[MIGRATE] PostgreSQL already contains data. Set FORCE_MIGRATE=1 to overwrite.');
        await closePgPool(); if (sqliteDb) sqliteDb.closeDatabase(); process.exit(1);
    }
    if (hasData) { console.log('[MIGRATE] FORCE_MIGRATE=1, truncating...'); for (const t of checkTables) { try { await pool.query(`TRUNCATE TABLE ${t} CASCADE`); } catch (_) {} } }

    let totalMigrated = 0;
    const typeCounts = [];

    console.log('\n[MIGRATE] === Phase 1: JSON file directories ===');
    for (const { type, dir, pgTable } of JSON_DIR_TYPES) {
        const items = readJsonDir(path.join(dataDir, dir));
        process.stdout.write(`[MIGRATE] Migrating ${type} (JSON): ${items.length} items...`);
        const count = await migrateItems(items, type, pgTable, pgStore, pgDb);
        console.log(count === items.length ? ' ✓' : ` ✓ (${count}/${items.length})`);
        totalMigrated += count; typeCounts.push({ type, pgTable, source: items.length, migrated: count });
    }

    console.log('\n[MIGRATE] === Phase 2: SQLite kv_store ===');
    if (sqliteStore) {
        for (const { type, pgTable } of KV_STORE_TYPES) {
            const items = await sqliteStore.listItems(type);
            if (items.length === 0) { console.log(`[MIGRATE] ${type} (SQLite): 0 items, skipping`); continue; }
            process.stdout.write(`[MIGRATE] Migrating ${type} (SQLite): ${items.length} items...`);
            const count = await migrateItems(items, type, pgTable, pgStore, pgDb);
            console.log(count === items.length ? ' ✓' : ` ✓ (${count}/${items.length})`);
            totalMigrated += count; typeCounts.push({ type, pgTable, source: items.length, migrated: count });
        }
    } else { console.log('[MIGRATE] SQLite not available, skipping kv_store types'); }

    console.log('\n[MIGRATE] Verifying counts...');
    let verifyOk = true;
    for (const { type, pgTable, source } of typeCounts) {
        try {
            const result = pgTable === 'kv_store' ? await pool.query('SELECT COUNT(*) as cnt FROM kv_store WHERE type = $1', [type]) : await pool.query(`SELECT COUNT(*) as cnt FROM ${pgTable}`);
            const pgCount = parseInt(result.rows[0].cnt, 10);
            if (source !== pgCount) { console.error(`[MIGRATE]   ✗ ${type}: source=${source}, pg=${pgCount}`); verifyOk = false; }
        } catch (err) { console.error(`[MIGRATE]   ✗ ${type}: ${err.message}`); verifyOk = false; }
    }
    if (verifyOk && typeCounts.length > 0) console.log('[MIGRATE]   All counts match ✓');

    console.log('\n[MIGRATE] === Migration Summary ===');
    for (const { type, source, migrated } of typeCounts) console.log(`  ${type}: ${migrated}/${source} migrated`);
    console.log(`\n[MIGRATE] Migration complete: ${typeCounts.length} types, ${totalMigrated} total items`);

    await closePgPool(); if (sqliteDb) sqliteDb.closeDatabase();
}

main().catch(err => { console.error('[MIGRATE] Fatal error:', err); process.exit(1); });
