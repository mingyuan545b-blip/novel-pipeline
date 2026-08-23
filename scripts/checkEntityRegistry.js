/**
 * 临时脚本：检查entity_registry表的重复实体数量
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
    try {
        const r1 = await pool.query('SELECT COUNT(*) as cnt FROM entity_registry');
        console.log('entity_registry total:', r1.rows[0].cnt);

        const r2 = await pool.query(`
            SELECT (data::jsonb)->>'name' as name, COUNT(*) as cnt
            FROM entity_registry
            GROUP BY (data::jsonb)->>'name'
            HAVING COUNT(*) > 1
            ORDER BY cnt DESC
            LIMIT 10
        `);
        console.log('top duplicates:');
        r2.rows.forEach(r => console.log(`  ${r.name}: ${r.cnt}`));

        const r3 = await pool.query(`
            SELECT COUNT(DISTINCT (data::jsonb)->>'projectId') as proj_cnt
            FROM entity_registry
        `);
        console.log('distinct projects:', r3.rows[0].proj_cnt);

        const r4 = await pool.query(`
            SELECT (data::jsonb)->>'projectId' as pid, COUNT(*) as cnt
            FROM entity_registry
            GROUP BY (data::jsonb)->>'projectId'
            ORDER BY cnt DESC
            LIMIT 5
        `);
        console.log('top projects by entity count:');
        r4.rows.forEach(r => console.log(`  ${r.pid}: ${r.cnt}`));

        // 检查所有表的总记录数
        const tables = ['projects', 'chapters', 'materials', 'pipeline_logs', 'entity_registry', 'outlines'];
        for (const t of tables) {
            try {
                const r = await pool.query(`SELECT COUNT(*) as cnt FROM ${t}`);
                console.log(`  ${t}: ${r.rows[0].cnt}`);
            } catch (e) {
                console.log(`  ${t}: ERROR ${e.message}`);
            }
        }
    } catch (e) {
        console.error(e.message);
    } finally {
        await pool.end();
    }
})();
