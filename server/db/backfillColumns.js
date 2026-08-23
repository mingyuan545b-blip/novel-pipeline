/**
 * backfillColumns.js — 启动时自动回填PG独立列
 * v2: 基于fieldRegistry，不再硬编码字段映射
 */
const { getPool } = require('./pgPool');
const { getRegisteredTables, getExtractableColumns } = require('./fieldRegistry');
const logger = require('../shared/logger');

async function backfillAllColumns() {
    const pool = getPool();
    let totalBackfilled = 0;
    const tables = getRegisteredTables();

    for (const tableName of tables) {
        try {
            const columns = getExtractableColumns(tableName);
            if (columns.length === 0) continue;

            // 查找独立列为空但data JSONB有值的行
            const nullConditions = columns
                .map(col => {
                    const def = col.default;
                    if (def === null || def === undefined) return `(${col.name} IS NULL)`;
                    if (typeof def === 'string' && def === '') return `(${col.name} IS NULL OR ${col.name} = '')`;
                    if (typeof def === 'number' && def === 0) return `(${col.name} IS NULL OR ${col.name} = 0)`;
                    return `(${col.name} IS NULL)`;
                })
                .join(' OR ');

            const result = await pool.query(
                `SELECT id, data FROM ${tableName} WHERE ${nullConditions} LIMIT 500`
            );

            if (result.rows.length === 0) continue;

            let backfilled = 0;
            for (const row of result.rows) {
                let parsed;
                try { parsed = JSON.parse(row.data || '{}'); } catch (_) { continue; }

                const updates = [];
                const params = [];
                let paramIdx = 0;

                for (const col of columns) {
                    const jsonValue = parsed[col.name];
                    // 过滤空值：undefined/null/''一律跳过
                    // 防止空字符串被推入timestamptz/integer等强类型列导致PG报错（陷阱#33）
                    if (jsonValue === undefined || jsonValue === null || jsonValue === '') continue;
                    // 类型校验：timestamptz列只接受有效日期字符串
                    if (col.type === 'timestamptz') {
                        const ts = new Date(jsonValue);
                        if (isNaN(ts.getTime())) continue;
                    }
                    paramIdx++;
                    updates.push(`${col.name} = $${paramIdx}`);
                    params.push(jsonValue);
                }

                if (updates.length > 0) {
                    paramIdx++;
                    params.push(row.id);
                    await pool.query(
                        `UPDATE ${tableName} SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
                        params
                    );
                    backfilled++;
                }
            }

            if (backfilled > 0) {
                logger.info('backfill', `${tableName}: backfilled ${backfilled} rows`);
                totalBackfilled += backfilled;
            }
        } catch (err) {
            logger.warn('backfill', `${tableName} backfill failed: ${err.message}`);
        }
    }

    if (totalBackfilled > 0) {
        logger.info('backfill', `Total backfilled: ${totalBackfilled} rows across ${tables.length} tables`);
    }
    return totalBackfilled;
}

module.exports = { backfillAllColumns };
