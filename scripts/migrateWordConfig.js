/**
 * migrateWordConfig.js — 存量项目配置迁移脚本
 *
 * 修复硬阻断1：老项目wordConfig覆盖新阈值
 * 迁移内容：
 *   1. wordConfig: minWords 1500→2400, targetWords 2500→2800, rejectMin 1500→2000
 *   2. 项目名: "次位面"→"小世界"（如有）
 *
 * 安全措施：
 *   - 迁移前输出备份JSON到 scripts/_wordConfigBackup.json
 *   - 只迁移不满足新阈值的字段
 *   - 保留用户自定义的maxWords
 *
 * 运行：node scripts/migrateWordConfig.js
 * 验证：node scripts/migrateWordConfig.js --verify
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL });

// 新阈值常量（与 server/config/genreDefaults.js 保持一致）
const NEW_THRESHOLDS = Object.freeze({
    MIN_WORDS: 2400,
    TARGET_WORDS: 2800,
    REJECT_MIN: 2000,
    MAX_WORDS: 3500
});

// 旧→新映射规则（只升级低于新阈值的字段）
function migrateWordConfig(wc) {
    if (!wc || typeof wc !== 'object') return { wc: wc, changed: false, changes: [] };
    const newWc = { ...wc };
    const changes = [];

    if ((wc.minWords || 0) < NEW_THRESHOLDS.MIN_WORDS) {
        changes.push(`minWords: ${wc.minWords}→${NEW_THRESHOLDS.MIN_WORDS}`);
        newWc.minWords = NEW_THRESHOLDS.MIN_WORDS;
    }
    if ((wc.targetWords || 0) < NEW_THRESHOLDS.TARGET_WORDS) {
        changes.push(`targetWords: ${wc.targetWords}→${NEW_THRESHOLDS.TARGET_WORDS}`);
        newWc.targetWords = NEW_THRESHOLDS.TARGET_WORDS;
    }
    if ((wc.rejectMin || 0) < NEW_THRESHOLDS.REJECT_MIN) {
        changes.push(`rejectMin: ${wc.rejectMin}→${NEW_THRESHOLDS.REJECT_MIN}`);
        newWc.rejectMin = NEW_THRESHOLDS.REJECT_MIN;
    }
    return { wc: newWc, changed: changes.length > 0, changes };
}

async function migrate() {
    const r = await p.query('SELECT id, data FROM projects ORDER BY createdat DESC');
    console.log(`扫描到 ${r.rows.length} 个项目\n`);

    const backup = [];
    let migratedCount = 0;
    let nameFixedCount = 0;

    for (const row of r.rows) {
        let proj;
        try { proj = JSON.parse(row.data); } catch (e) { continue; }

        const originalWc = JSON.parse(JSON.stringify(proj.wordConfig || {}));
        const { wc: newWc, changed, changes } = migrateWordConfig(proj.wordConfig);
        const originalName = proj.name || '';
        const newName = originalName.replace(/次位面/g, '小世界').replace(/主位面/g, '主世界');

        if (!changed && newName === originalName) continue;

        backup.push({ id: row.id, originalWordConfig: originalWc, originalName });
        proj.wordConfig = newWc;
        if (newName !== originalName) {
            proj.name = newName;
            nameFixedCount++;
            console.log(`[${row.id.substring(0, 8)}] 名称: "${originalName}" → "${newName}"`);
        }
        if (changed) {
            migratedCount++;
            console.log(`[${row.id.substring(0, 8)}] wordConfig: ${changes.join(', ')}`);
        }

        await p.query('UPDATE projects SET data = $1 WHERE id = $2', [JSON.stringify(proj), row.id]);
    }

    const backupPath = path.join(__dirname, '_wordConfigBackup.json');
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    console.log(`\n=== 迁移完成 ===`);
    console.log(`总项目: ${r.rows.length}`);
    console.log(`wordConfig升级: ${migratedCount}个`);
    console.log(`项目名修正: ${nameFixedCount}个`);
    console.log(`备份文件: ${backupPath}`);
    await p.end();
}

async function verify() {
    const r = await p.query('SELECT id, data FROM projects ORDER BY createdat DESC');
    console.log('=== 迁移后验证 ===\n');
    let allPass = true;
    for (const row of r.rows) {
        let proj;
        try { proj = JSON.parse(row.data); } catch (e) { continue; }
        const wc = proj.wordConfig || {};
        const issues = [];
        if ((wc.minWords || 0) < NEW_THRESHOLDS.MIN_WORDS) issues.push(`minWords=${wc.minWords}<${NEW_THRESHOLDS.MIN_WORDS}`);
        if ((wc.targetWords || 0) < NEW_THRESHOLDS.TARGET_WORDS) issues.push(`targetWords=${wc.targetWords}<${NEW_THRESHOLDS.TARGET_WORDS}`);
        if ((wc.rejectMin || 0) < NEW_THRESHOLDS.REJECT_MIN) issues.push(`rejectMin=${wc.rejectMin}<${NEW_THRESHOLDS.REJECT_MIN}`);
        if ((proj.name || '').includes('次位面')) issues.push(`名称含"次位面"`);
        if (issues.length > 0) {
            console.log(`❌ [${row.id.substring(0, 8)}] ${proj.name}: ${issues.join(', ')}`);
            allPass = false;
        }
    }
    if (allPass) console.log(`✅ 全部 ${r.rows.length} 个项目验证通过`);
    await p.end();
}

(async () => {
    const isVerify = process.argv.includes('--verify');
    if (isVerify) { await verify(); } else { await migrate(); }
})().catch(e => { console.log('ERR:', e.message); process.exit(1); });
