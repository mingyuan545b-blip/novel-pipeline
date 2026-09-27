#!/usr/bin/env node
/**
 * scanOrphans.js — 一键扫描/清理孤儿数据
 *
 * 孤儿数据 = projectId 指向的项目已不存在（多为多轮测试遗留），任何页面都不展示，
 * 但会让健康统计虚高、按项目聚合失真、备份膨胀。
 *
 * 用法：
 *   node scripts/scanOrphans.js                     # 只扫描（默认，安全）
 *   node scripts/scanOrphans.js --clean            # 实际删除
 *   node scripts/scanOrphans.js --clean --keep pid1,pid2   # 保留指定项目ID的数据
 *   node scripts/scanOrphans.js --json             # 输出 JSON（供脚本/CI 消费）
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const argv = process.argv.slice(2);
const DO_CLEAN = argv.includes('--clean');
const AS_JSON = argv.includes('--json');
const keepIdx = argv.indexOf('--keep');
const keepProjectIds = keepIdx >= 0 ? String(argv[keepIdx + 1] || '').split(',').map(s => s.trim()).filter(Boolean) : [];

(async () => {
    // 初始化 PG 连接池（脚本直连，不启 HTTP 服务）
    const { initPgPool } = require('../server/db/pgPool');
    await initPgPool(process.env.DATABASE_URL);

    const orphanCleanup = require('../server/services/orphanCleanup');
    const report = await orphanCleanup.scan({ keepProjectIds });

    if (AS_JSON) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        console.log(`=== 孤儿数据扫描（保留项目 ${report.keepProjectIds.length} 个，扫描 ${report.scannedTables} 张表）===`);
        if (report.tables.length === 0) {
            console.log('  ✅ 未发现孤儿数据');
        } else {
            console.log('  表名'.padEnd(28) + '孤儿/总数');
            for (const t of report.tables) {
                console.log('  ' + t.table.padEnd(26) + `${t.orphans}/${t.total}`);
                t.byProject.slice(0, 2).forEach(p => console.log('      └ ' + String(p.projectId).slice(0, 12) + `… (${p.count} 行)`));
            }
            console.log(`\n  合计孤儿行: ${report.total}`);
        }
    }

    if (DO_CLEAN && report.total > 0) {
        console.log('\n=== 开始清理 ===');
        const result = await orphanCleanup.clean({ keepProjectIds });
        console.log(`  ✅ 已删除 ${result.total} 行`);
        Object.entries(result.deleted).forEach(([t, n]) => console.log(`     ${t}: ${n}`));
    } else if (report.total > 0) {
        console.log('\n（干跑结束：加 --clean 才会真正删除）');
    }

    const { closePgPool } = require('../server/db/pgPool');
    if (typeof closePgPool === 'function') await closePgPool();
    process.exit(0);
})().catch(e => { console.error('扫描失败:', e.message); process.exit(1); });
