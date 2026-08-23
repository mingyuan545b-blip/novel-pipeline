/**
 * schemaIntegrityCheck.js — 启动时校验PG schema与字段注册表的一致性
 * v2: 基于fieldRegistry唯一真相源，覆盖所有注册表
 */
const { getPool } = require('./pgPool');
const { getRegisteredTables, validateRegistryVsPgSchema, getIndexedColumns } = require('./fieldRegistry');
const logger = require('../shared/logger');

/**
 * 全量schema校验：检查所有注册表与PG实际列的一致性
 */
async function checkSchemaIntegrity() {
    const issues = [];
    const pool = getPool();
    const registeredTables = getRegisteredTables();

    for (const tableName of registeredTables) {
        try {
            const colResult = await pool.query(
                `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
                [tableName]
            );
            const pgColumns = colResult.rows.map(r => r.column_name);

            if (pgColumns.length === 0) {
                issues.push({
                    severity: 'ERROR',
                    table: tableName,
                    field: '*',
                    message: `PG table "${tableName}" does not exist`
                });
                continue;
            }

            const result = validateRegistryVsPgSchema(tableName, pgColumns);
            for (const issue of result.issues) {
                issues.push({ ...issue, table: tableName });
            }
        } catch (e) {
            issues.push({
                severity: 'ERROR',
                table: tableName,
                field: '*',
                message: `Schema check failed for ${tableName}: ${e.message}`
            });
        }
    }

    // 输出结果
    const criticals = issues.filter(i => i.severity === 'CRITICAL');
    const warnings = issues.filter(i => i.severity === 'WARN');
    const errors = issues.filter(i => i.severity === 'ERROR');

    if (criticals.length > 0) {
        logger.error('schema-check', `CRITICAL: ${criticals.length} field(s) missing from PG schema`);
        for (const c of criticals) {
            logger.error('schema-check', `  ${c.table}.${c.field}: ${c.message}`);
        }
    }
    if (warnings.length > 0) {
        logger.warn('schema-check', `${warnings.length} PG column(s) not in registry`);
        for (const w of warnings) {
            logger.warn('schema-check', `  ${w.table}.${w.field}: ${w.message}`);
        }
    }
    if (errors.length > 0) {
        for (const e of errors) {
            logger.error('schema-check', `  ${e.table}: ${e.message}`);
        }
    }

    if (criticals.length === 0 && errors.length === 0) {
        logger.info('schema-check', `Schema integrity check passed for ${registeredTables.length} tables (${warnings.length} warnings)`);
    }

    return { criticals, warnings, errors, total: issues.length };
}

/**
 * 运行时字段一致性校验：检查data JSON中的字段值与PG索引列是否一致
 * v2: 从fieldRegistry获取索引列，不再硬编码
 */
async function checkFieldConsistency(projectId) {
    const pool = getPool();
    const issues = [];

    // 从注册表获取materials的索引列
    const indexedColumns = getIndexedColumns('materials');
    if (indexedColumns.length === 0) return { projectId, totalMaterials: 0, inconsistencies: [], checked: new Date().toISOString() };

    const colSelectList = indexedColumns.join(', ');

    const result = await pool.query(
        `SELECT id, ${colSelectList}, data FROM materials WHERE projectid = $1`,
        [projectId]
    );

    for (const row of result.rows) {
        const parsed = JSON.parse(row.data || '{}');
        for (const col of indexedColumns) {
            const pgValue = row[col.toLowerCase()];
            const jsonValue = parsed[col] ?? null;
            const pgStr = String(pgValue ?? '');
            const jsonStr = String(jsonValue ?? '');
            if (pgStr !== jsonStr) {
                issues.push({
                    materialId: row.id,
                    materialName: parsed.name || row.id,
                    field: col,
                    pgValue: pgValue,
                    jsonValue: jsonValue,
                    message: `Field "${col}" mismatch: PG=${pgValue}, JSON=${jsonValue}`
                });
            }
        }
    }

    return {
        projectId,
        totalMaterials: result.rows.length,
        inconsistencies: issues,
        checked: new Date().toISOString()
    };
}

module.exports = { checkSchemaIntegrity, checkFieldConsistency };
