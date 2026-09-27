#!/usr/bin/env node
/**
 * repairRegistryDrift.js — 修复"投影表与真源不一致"的历史漂移
 *
 * 修复对象（均由本次 bug 修复对应的代码缺陷产生）：
 *   1. entity_registry.roleLevel ← entities.roleLevel
 *      （根因：registerEntity 曾"只升不降"，实体中心因此显示多个"主角"）
 *   2. reviews.reviewType 列 ← data.type
 *      （根因：字段注册缺 extractorSource，列恒为 'first-review'）
 *   3. entity_registry.tags 列 ← data.tags
 *      （根因：列长期停留在 '{}'，与 JSON 里的 [] 不一致）
 *
 * 用法：
 *   node scripts/repairRegistryDrift.js            # 干跑，只打印将要做的修改
 *   node scripts/repairRegistryDrift.js --apply    # 实际写入
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });
const { Pool } = require('pg');

const APPLY = process.argv.includes('--apply');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function repairRoleLevel() {
    // 以 data JSON 为准判漂移（应用实际读的是 JSON，列只是投影，可能已先行修好）
    const { rows } = await pool.query(`
        SELECT e.id, e.name, e.projectid, ent.rolelevel AS want, e.data::json->>'roleLevel' AS have
        FROM entity_registry e
        JOIN entities ent ON ent.id = e.id
        WHERE ent.rolelevel IS NOT NULL
          AND COALESCE(e.data::json->>'roleLevel', '') <> ent.rolelevel
        ORDER BY e.projectid, e.name`);
    console.log(`\n[1] entity_registry.roleLevel 漂移: ${rows.length} 条`);
    rows.forEach(r => console.log(`    ${r.name} (${String(r.projectid).slice(0, 8)}): ${r.have} -> ${r.want}`));
    if (APPLY && rows.length) {
        for (const r of rows) {
            // 注意：应用读取的是 data JSON（列只是索引/投影），必须两处一起改
            await pool.query(
                `UPDATE entity_registry
                 SET data = (data::jsonb || jsonb_build_object('roleLevel', $1::text))::text,
                     rolelevel = $1, updatedat = NOW()
                 WHERE id = $2`, [r.want, r.id]);
        }
        console.log(`    ✅ 已修复 ${rows.length} 条`);
    }
    return rows.length;
}

async function repairReviewType() {
    const { rows } = await pool.query(`
        SELECT id, reviewtype AS have, data::json->>'type' AS want
        FROM reviews
        WHERE data::json->>'type' IS NOT NULL AND reviewtype <> data::json->>'type'`);
    console.log(`\n[2] reviews.reviewType 列错误: ${rows.length} 条`);
    const byType = {};
    rows.forEach(r => { byType[`${r.have} -> ${r.want}`] = (byType[`${r.have} -> ${r.want}`] || 0) + 1; });
    Object.entries(byType).forEach(([k, v]) => console.log(`    ${k}: ${v}`));
    if (APPLY && rows.length) {
        await pool.query(`UPDATE reviews SET reviewtype = data::json->>'type' WHERE data::json->>'type' IS NOT NULL AND reviewtype <> data::json->>'type'`);
        console.log(`    ✅ 已修复 ${rows.length} 条`);
    }
    return rows.length;
}

async function repairTags() {
    const { rows } = await pool.query(`
        SELECT id, tags AS have, data::json->'tags' AS want
        FROM entity_registry
        WHERE data::json->'tags' IS NOT NULL AND tags IS DISTINCT FROM (data::json->'tags')::text`);
    console.log(`\n[3] entity_registry.tags 列与 JSON 不一致: ${rows.length} 条`);
    if (APPLY && rows.length) {
        await pool.query(`UPDATE entity_registry SET tags = (data::json->'tags')::text WHERE data::json->'tags' IS NOT NULL`);
        console.log(`    ✅ 已修复 ${rows.length} 条`);
    }
    return rows.length;
}

/**
 * [5] 素材表"多主角"清理
 * 根因：extractRoleLevelFromContent 曾用 content.includes(主角名) 判主角，
 *       凡是描述里提到主角的配角都被标成 protagonist（20章E2E：素材表 5 个主角，实体表 1 个）。
 *       素材 roleLevel 直接决定上下文注入等级与素材深度要求，必须收敛。
 * 规则：每项目只保留 protagonistName（或 isMainCharacter=true）为主角，其余降为 supporting。
 */
async function repairMaterialProtagonists() {
    const { rows } = await pool.query(`
        SELECT m.id, m.name, m.projectid, p.data::json->'styleProfile'->>'protagonistName' AS pname
        FROM materials m JOIN projects p ON p.id = m.projectid
        WHERE m.type = 'character' AND m.rolelevel = 'protagonist'`);
    const offenders = rows.filter(r => {
        const imc = r.isMainCharacter;
        return r.name !== (r.pname || '') && imc !== true;
    });
    // 按项目统计
    const byProj = {};
    offenders.forEach(r => { byProj[r.projectid] = (byProj[r.projectid] || 0) + 1; });
    console.log(`\n[5] 素材表误标主角: ${offenders.length} 条`);
    Object.entries(byProj).forEach(([pid, n]) => console.log(`    ${String(pid).slice(0, 8)}: ${n} 条`));
    offenders.slice(0, 8).forEach(r => console.log(`    ${r.name}（主角应为 ${r.pname || '未设置'}）`));
    if (APPLY && offenders.length) {
        for (const r of offenders) {
            await pool.query(
                `UPDATE materials SET rolelevel = 'supporting', data = (data::jsonb || '{"roleLevel":"supporting"}'::jsonb)::text, updatedat = NOW() WHERE id = $1`,
                [r.id]);
        }
        console.log(`    ✅ 已修复 ${offenders.length} 条`);
    }
    return offenders.length;
}

async function reportOrphans() {
    const tables = ['entities', 'entity_registry', 'reviews', 'state_kv_index', 'character_states', 'item_definitions', 'materials', 'chapters'];
    console.log('\n[4] 孤儿数据（projectId 在 projects 表已不存在）— 仅报告，不自动删除:');
    for (const t of tables) {
        try {
            const { rows } = await pool.query(`SELECT COUNT(*) c FROM ${t} x WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = x.projectid)`);
            const tot = await pool.query(`SELECT COUNT(*) c FROM ${t}`);
            if (Number(rows[0].c) > 0) console.log(`    ${t}: ${rows[0].c}/${tot.rows[0].c}`);
        } catch (e) { console.log(`    ${t}: 跳过 (${e.message})`); }
    }
}

(async () => {
    console.log(`=== repairRegistryDrift (${APPLY ? 'APPLY 实际写入' : 'DRY-RUN 干跑'}) ===`);
    await repairRoleLevel();
    await repairReviewType();
    await repairTags();
    await repairMaterialProtagonists();
    await reportOrphans();
    console.log(`\n${APPLY ? '已完成写入' : '干跑结束：加 --apply 才会真正写入'}`);
    await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
