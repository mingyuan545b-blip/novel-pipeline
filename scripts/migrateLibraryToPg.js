#!/usr/bin/env node
/**
 * migrateLibraryToPg.js — 藏经阁 JSON → PG 迁移（一次性，幂等）
 *
 * 背景：藏经阁原为 server/data/library/ 下三份JSON（index.json / leaf / metadata），
 *      现统一为 PG 表 library_techniques（一条记录=技法全文）。
 *
 * 用法：
 *   node scripts/migrateLibraryToPg.js            # 迁移（默认）
 *   node scripts/migrateLibraryToPg.js --dry-run  # 只报告不写入
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const LIB = path.join(__dirname, '..', 'server', 'data', 'library');
const DRY = process.argv.includes('--dry-run');

function readJson(p) {
    return JSON.parse(fs.readFileSync(p, 'utf-8').replace(/^\uFEFF/, ''));
}

/** 收集 leaf + metadata + index，合并为PG记录 */
function collectTechniques() {
    const index = readJson(path.join(LIB, 'index.json'));
    const metaDir = path.join(LIB, 'metadata');
    const records = [];
    for (const entry of index.entries) {
        const leafPath = path.join(LIB, entry.path);
        if (!fs.existsSync(leafPath)) continue;
        const leaf = readJson(leafPath);
        const metaPath = path.join(metaDir, `${entry.id}.json`);
        const meta = fs.existsSync(metaPath) ? readJson(metaPath) : {};
        records.push({
            ...leaf,
            subcategory: leaf.subcategory || entry.subcategory || '',
            worldviewDepth: leaf.worldviewDepth || entry.worldviewDepth || 'meso',
            source_type: 'curated',
            source_novel: leaf.source_novel || '通用技法体系（藏经阁v1）',
            success_rate: meta.success_rate ?? 50,
            attempts: meta.attempts ?? 0,
            auto_disabled: meta.auto_disabled ?? false,
        });
    }
    return records;
}

(async () => {
    const records = collectTechniques();
    console.log(`[migrate] 源JSON收集到 ${records.length} 条技法`);
    if (DRY) {
        console.log('[migrate] dry-run，未写入。示例:', JSON.stringify(records[0], null, 1).slice(0, 400));
        process.exit(0);
    }
    const { initPgPool } = require('../server/db/pgPool');
    await initPgPool(process.env.DATABASE_URL);
    const { initDatabaseAsync } = require('../server/db/database-pg');
    await initDatabaseAsync();
    const libraryStore = require('../server/services/libraryStore');
    const result = await libraryStore.importTechniques(records);
    const stats = await libraryStore.getStats();
    console.log(`[migrate] 完成：新增 ${result.inserted}，更新 ${result.updated}`);
    console.log(`[migrate] 库现状：total=${stats.total} departments=${stats.departments} disabled=${stats.disabled}`);
    const byDept = Object.entries(stats.byDepartment).map(([k, v]) => `${k}:${v}`).join(' ');
    console.log(`[migrate] 部门分布: ${byDept}`);
    process.exit(0);
})().catch(e => { console.error('[migrate] FAILED:', e.message); process.exit(1); });
