/**
 * audit-cascade-delete.js — 级联删除注册完整性检查
 *
 * 防止陷阱#32：新增含projectId的PG表忘记注册cascadable:true导致孤儿数据。
 *
 * 检查逻辑：
 * 1. 读取dataStoreRegistry.js，获取所有注册的类型
 * 2. 读取PG schema文件，获取所有含projectId列的表
 * 3. 对比：每个含projectId的表是否在dataStoreRegistry中注册了cascadable:true
 * 4. 输出未注册的表（CRITICAL）和已注册但未含projectId的表（WARN）
 *
 * 用法：
 *   node scripts/audit-cascade-delete.js           # 全量检查
 *   node scripts/audit-cascade-delete.js --ci       # CI模式（有问题时退出码1）
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function loadCascadeTypes() {
    const registry = require('../server/config/dataStoreRegistry');
    const allTypes = registry.DATA_STORE_REGISTRY;
    const cascadableTypes = registry.getCascadableStoreTypes();
    const allRegistered = registry.getAllRegisteredTypes();
    const normalizeTypeName = registry.normalizeTypeName;

    return { allTypes, cascadableTypes, allRegistered, normalizeTypeName };
}

function extractPgTables() {
    const schemaDir = path.join(PROJECT_ROOT, 'server', 'db');
    const tables = [];

    const schemaFiles = fs.readdirSync(schemaDir)
        .filter(f => f.startsWith('pgSchema') && f.endsWith('.js'));

    for (const file of schemaFiles) {
        const content = fs.readFileSync(path.join(schemaDir, file), 'utf8');
        // 匹配 CREATE TABLE IF NOT EXISTS <name> ( ... )
        const tableRegex = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)\s*\(([\s\S]*?)\);/g;
        let match;
        while ((match = tableRegex.exec(content)) !== null) {
            const tableName = match[1];
            const body = match[2];
            const hasProjectId = /projectId\s+TEXT/i.test(body);
            tables.push({ tableName, hasProjectId, file });
        }
    }
    return tables;
}

function normalizeTableName(pgName) {
    // PG表名用下划线，registry用连字符：character_state_cache → character-state-cache
    return pgName.replace(/_/g, '-');
}

function main() {
    const isCI = process.argv.includes('--ci');

    console.log('=== CASCADE DELETE REGISTRATION AUDIT ===\n');

    const { allTypes, cascadableTypes, allRegistered, normalizeTypeName } = loadCascadeTypes();
    const pgTables = extractPgTables();

    console.log(`PG表总数: ${pgTables.length}`);
    console.log(`Registry注册类型: ${allRegistered.length}`);
    console.log(`Cascadable类型: ${cascadableTypes.length}\n`);

    const issues = [];
    const warnings = [];

    for (const { tableName, hasProjectId, file } of pgTables) {
        // PG表名用下划线，registry用连字符：先转换格式再用normalizeTypeName查找标准名
        const hyphenName = tableName.replace(/_/g, '-');
        const standardName = normalizeTypeName(hyphenName) || hyphenName;
        const registryInfo = allTypes[standardName] || allTypes[tableName];

        if (!registryInfo) {
            // PG表未在registry注册
            if (hasProjectId) {
                issues.push({
                    level: 'CRITICAL',
                    table: tableName,
                    file,
                    message: `PG表${tableName}含projectId但未在dataStoreRegistry注册`,
                });
            }
            continue;
        }

        if (hasProjectId && !registryInfo.cascadable) {
            // 含projectId但未标记cascadable
            issues.push({
                level: 'CRITICAL',
                table: tableName,
                file,
                message: `PG表${tableName}含projectId但cascadable=false，项目删除时数据成为孤儿`,
            });
        }

        if (!hasProjectId && registryInfo.cascadable) {
            // 不含projectId但标记了cascadable（可能是设计如此，标记为WARN）
            warnings.push({
                level: 'WARN',
                table: tableName,
                file,
                message: `PG表${tableName}不含projectId但cascadable=true（确认是否有projectId在data JSON中）`,
            });
        }
    }

    // 输出结果
    if (issues.length > 0) {
        console.log(`❌ CRITICAL: ${issues.length} 个表未注册级联删除\n`);
        for (const issue of issues) {
            console.log(`  [${issue.level}] ${issue.table}`);
            console.log(`    文件: ${issue.file}`);
            console.log(`    问题: ${issue.message}`);
            console.log(`    修复: 在dataStoreRegistry.js中注册 '${normalizeTableName(issue.table)}': { cascadable: true, hasProjectId: true }`);
            console.log('');
        }
    }

    if (warnings.length > 0) {
        console.log(`⚠️  WARN: ${warnings.length} 个表需确认\n`);
        for (const warn of warnings) {
            console.log(`  [${warn.level}] ${warn.table}: ${warn.message}`);
        }
        console.log('');
    }

    if (issues.length === 0 && warnings.length === 0) {
        console.log('✅ 所有含projectId的PG表均已正确注册级联删除');
    }

    console.log(`\n总计: ${issues.length} CRITICAL, ${warnings.length} WARN`);

    if (isCI && issues.length > 0) {
        process.exit(1);
    }
}

main();
