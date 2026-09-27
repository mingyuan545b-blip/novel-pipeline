#!/usr/bin/env node
/**
 * repairEntityFieldResidue.js — 修复实体人设字段里的"组合标签残留"
 *
 * 背景：素材使用《身份/职位》《性格/动机》这类双标签时，抽取器只吃掉第一个分隔符，
 *       第二个标签会跟进取值（实测 position="职位】前户曹档案库职员"）。
 *       抽取器已修（characterStateExtractor.stripLabelResidue），本脚本用同一抽取器回填历史脏数据。
 *
 * 覆盖两张表：entities（实体）+ entity_registry（实体中心 UI 读取的投影表），
 * 且同时改 data JSON 与独立列（应用从 JSON 读，列用于索引/过滤）。
 *
 * 用法：
 *   node scripts/repairEntityFieldResidue.js            # 干跑
 *   node scripts/repairEntityFieldResidue.js --apply    # 写入
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });
const { Pool } = require('pg');

const APPLY = process.argv.includes('--apply');
const RESIDUE = /^[一-龥]{2,8}[】\]]/;
const FIELDS = ['position', 'personality', 'speakingTone', 'signatureDetail', 'craftStyle'];
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function strip(v) {
    const s = String(v || '').replace(RESIDUE, '').trim();
    return s || String(v || '').trim();
}

(async () => {
    const { extractCharacterStateFromContent } = require('../server/services/pipeline/characterStateExtractor');
    console.log(`=== repairEntityFieldResidue (${APPLY ? 'APPLY 实际写入' : 'DRY-RUN 干跑'}) ===`);
    let total = 0;
    for (const table of ['entities', 'entity_registry']) {
        // 两表列不同（entity_registry 没有 position/personality 列，只有 data JSON），按实际列裁剪
        const colRows = (await pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [table])).rows;
        const tableCols = new Set(colRows.map(r => r.column_name.toLowerCase()));
        const rows = (await pool.query(`SELECT id, name, data FROM ${table}`)).rows;
        let fixed = 0;
        for (const row of rows) {
            let e;
            try { e = JSON.parse(row.data); } catch { continue; }
            const bad = FIELDS.filter(f => typeof e[f] === 'string' && RESIDUE.test(e[f]));
            if (bad.length === 0) continue;
            const parsed = extractCharacterStateFromContent(e.sourceContent || '', {});
            const updates = {};
            for (const f of bad) {
                const candidate = parsed[f];
                updates[f] = (candidate && !RESIDUE.test(candidate)) ? candidate : strip(e[f]);
            }
            console.log(`  [${table}] ${row.name}: ` + Object.entries(updates).map(([k, v]) => `${k}: ${JSON.stringify(e[k])} -> ${JSON.stringify(v)}`).join(' | '));
            if (APPLY) {
                const sets = [];
                const params = [JSON.stringify(updates), row.id];
                for (const f of Object.keys(updates)) {
                    const col = f.toLowerCase();
                    if (!tableCols.has(col)) continue; // 该表没有这一列，只更新 data JSON
                    params.push(updates[f]);
                    sets.push(`${col} = $${params.length}`);
                }
                const tail = sets.length ? `, ${sets.join(', ')}` : '';
                await pool.query(`UPDATE ${table} SET data = (data::jsonb || $1::jsonb)::text, updatedat = NOW()${tail} WHERE id = $2`, params);
            }
            fixed++;
        }
        console.log(`  ${table}: 受影响 ${fixed} 条`);
        total += fixed;
    }
    console.log(`\n合计 ${total} 条${APPLY ? '（已修复）' : '（干跑，加 --apply 写入）'}`);
    await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
