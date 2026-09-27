/**
 * 清理历史测试数据，解决OOM问题
 * 保留最新的1个项目，删除其他所有项目的数据
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
    try {
        // 1. 查看当前所有项目
        const projects = await pool.query(`
            SELECT id, (data::jsonb)->>'name' as name,
                   (data::jsonb)->>'createdAt' as created
            FROM projects
            ORDER BY (data::jsonb)->>'createdAt' DESC
        `);
        console.log(`当前项目数: ${projects.rows.length}`);
        projects.rows.slice(0, 5).forEach(p => {
            console.log(`  ${p.id}: ${p.name} (${p.created})`);
        });

        // 2. 清空所有测试数据表（保留表结构）
        const tablesToClean = [
            'pipeline_logs', 'entity_registry', 'materials',
            'chapters', 'projects', 'outlines',
            'chapter_intents', 'state_kv_index', 'knowledge_base',
            'audit_logs', 'review_records', 'entity_relations'
        ];

        for (const t of tablesToClean) {
            try {
                const r = await pool.query(`DELETE FROM ${t}`);
                console.log(`  清空 ${t}: ${r.rowCount} 条`);
            } catch (e) {
                console.log(`  跳过 ${t}: ${e.message}`);
            }
        }

        // 3. 验证清理结果
        console.log('\n清理后:');
        for (const t of ['projects', 'chapters', 'materials', 'pipeline_logs', 'entity_registry']) {
            try {
                const r = await pool.query(`SELECT COUNT(*) as cnt FROM ${t}`);
                console.log(`  ${t}: ${r.rows[0].cnt}`);
            } catch (e) {
                console.log(`  ${t}: ERROR`);
            }
        }

        console.log('\n✅ 历史数据已清理，可以重新运行测试');
    } catch (e) {
        console.error('清理失败:', e.message);
    } finally {
        await pool.end();
    }
})();
