/**
 * verifyDataSourceConsistency - 数据源一致性检测
 *
 * 三处消费方（store.js、projectDeleteHandler.js、database.js）已改为从注册中心读取，
 * 因此检测逻辑调整为：
 *   DS1: store.js 必须从注册中心读取 tablesToSync
 *   DS2: projectDeleteHandler.js 必须从注册中心读取 CASCADE_STORE_TYPES
 *   DS3: database.js 必须从注册中心读取 DEDICATED_TABLES
 *   DS4: 注册中心内部一致性（syncable+cascadable+dedicated 标记无冲突）
 *   DS5: 代码中 store.xxx 调用的类型都已注册
 *   DS6: 注册中心 aliases 无重复（同一别名不能映射到多个标准名）
 */

const fs = require('fs');
const path = require('path');
const {
    normalizeTypeName,
    getSyncableTypes,
    getCascadableTypes,
    getDedicatedTableTypes,
    getAllRegisteredTypes,
    DATA_STORE_REGISTRY,
} = require('../server/config/dataStoreRegistry');

const ROOT = path.join(__dirname, '..');
let errorCount = 0;
let warnCount = 0;

function error(msg) { console.error(`  ❌ [ERROR] ${msg}`); errorCount++; }
function warn(msg) { console.warn(`  ⚠️  [WARN] ${msg}`); warnCount++; }
function ok(msg) { console.log(`  ✅ ${msg}`); }

/**
 * 检查文件是否从注册中心读取
 * @param {string} filePath - 文件路径
 * @param {string} requirePattern - require语句正则
 * @param {string} usagePattern - 使用语句正则
 * @returns {boolean} 是否从注册中心读取
 */
function checkReadsFromRegistry(filePath, requirePattern, usagePattern) {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasRequire = requirePattern.test(content);
    const hasUsage = usagePattern.test(content);
    return hasRequire && hasUsage;
}

function main() {
    console.log('========================================');
    console.log('数据源一致性检测（DS1-DS6）');
    console.log('========================================');

    const registeredTypes = new Set(getAllRegisteredTypes());

    // === DS1: store.js 必须从注册中心读取 tablesToSync ===
    console.log('\n=== DS1: store.js tablesToSync 来源检查 ===');
    const storePath = path.join(ROOT, 'server', 'store.js');
    const ds1Ok = checkReadsFromRegistry(
        storePath,
        /require\(['"`]\.\/config\/dataStoreRegistry['"`]\)/,
        /getSyncableDirNames\(\)/
    );
    if (ds1Ok) {
        ok('store.js tablesToSync 从注册中心读取');
    } else {
        error('store.js tablesToSync 未从注册中心读取 — 应使用 getSyncableDirNames()');
    }

    // === DS2: projectDeleteHandler.js 必须从注册中心读取 CASCADE_STORE_TYPES ===
    console.log('\n=== DS2: projectDeleteHandler.js CASCADE_STORE_TYPES 来源检查 ===');
    const handlerPath = path.join(ROOT, 'server', 'routes', 'projects', 'projectDeleteHandler.js');
    const ds2Ok = checkReadsFromRegistry(
        handlerPath,
        /require\(['"`].*config\/dataStoreRegistry['"`]\)/,
        /getCascadableStoreTypes\(\)/
    );
    if (ds2Ok) {
        ok('projectDeleteHandler.js CASCADE_STORE_TYPES 从注册中心读取');
    } else {
        error('projectDeleteHandler.js CASCADE_STORE_TYPES 未从注册中心读取 — 应使用 getCascadableStoreTypes()');
    }

    // === DS3: database.js 必须从注册中心读取 DEDICATED_TABLES ===
    console.log('\n=== DS3: database.js DEDICATED_TABLES 来源检查 ===');
    const dbPath = path.join(ROOT, 'server', 'db', 'database.js');
    const ds3Ok = checkReadsFromRegistry(
        dbPath,
        /require\(['"`].*config\/dataStoreRegistry['"`]\)/,
        /getDedicatedTableTypes\(\)/
    );
    if (ds3Ok) {
        ok('database.js DEDICATED_TABLES 从注册中心读取');
    } else {
        error('database.js DEDICATED_TABLES 未从注册中心读取 — 应使用 getDedicatedTableTypes()');
    }

    // === DS4: 注册中心内部一致性 ===
    console.log('\n=== DS4: 注册中心内部一致性检查 ===');
    let ds4Errors = 0;
    for (const [name, info] of Object.entries(DATA_STORE_REGISTRY)) {
        // dedicated=true 的类型应该也是 syncable=true（专用表需要同步）
        if (info.dedicated && !info.syncable) {
            error(`注册中心: "${name}" dedicated=true 但 syncable=false（专用表应该可同步）`);
            ds4Errors++;
        }
        // hasProjectId=true 的类型应该 cascadable=true（含projectId的需要级联删除）
        if (info.hasProjectId && !info.cascadable) {
            error(`注册中心: "${name}" hasProjectId=true 但 cascadable=false（含projectId应该可级联删除）`);
            ds4Errors++;
        }
        // cascadable=true 的类型应该 hasProjectId=true（级联删除的前提是含projectId）
        if (info.cascadable && !info.hasProjectId) {
            error(`注册中心: "${name}" cascadable=true 但 hasProjectId=false（级联删除应该含projectId）`);
            ds4Errors++;
        }
    }
    if (ds4Errors === 0) ok('注册中心内部标记一致');

    // === DS5: 代码中 store.xxx 调用的类型都已注册 ===
    console.log('\n=== DS5: 代码中store调用类型注册检查 ===');
    const serverDir = path.join(ROOT, 'server');
    const codeTypes = scanCodeForStoreTypes(serverDir);
    let ds5Errors = 0;
    for (const type of codeTypes) {
        if (!registeredTypes.has(type) && !normalizeTypeName(type)) {
            // 排除动态变量（包含${或+）
            if (type.includes('${') || type.includes('+') || type.includes('`')) continue;
            error(`代码中store调用使用了未注册的类型: "${type}"`);
            ds5Errors++;
        }
    }
    if (ds5Errors === 0) ok(`代码中store调用类型均已注册（扫描${codeTypes.size}个唯一类型）`);

    // === DS6: 注册中心 aliases 无重复 ===
    console.log('\n=== DS6: 注册中心 aliases 唯一性检查 ===');
    const aliasMap = {};
    let ds6Errors = 0;
    for (const [standardName, info] of Object.entries(DATA_STORE_REGISTRY)) {
        for (const alias of info.aliases) {
            if (aliasMap[alias]) {
                error(`注册中心: alias "${alias}" 同时映射到 "${aliasMap[alias]}" 和 "${standardName}"`);
                ds6Errors++;
            } else {
                aliasMap[alias] = standardName;
            }
        }
    }
    if (ds6Errors === 0) ok('注册中心 aliases 无重复映射');

    console.log('\n========================================');
    console.log(`校验完成: ${errorCount} errors, ${warnCount} warnings`);
    console.log('========================================');

    if (errorCount > 0) {
        console.log('❌ 存在错误 — 数据源配置不一致');
        process.exit(1);
    } else if (warnCount > 0) {
        console.log('⚠️  存在警告');
    } else {
        console.log('✅ 校验通过 — 数据源配置一致');
    }
}

/**
 * 扫描server目录下所有.js文件，提取store调用中的类型字符串
 */
function scanCodeForStoreTypes(serverDir) {
    const types = new Set();
    const patterns = [
        /store\.(?:setItem|getItem|deleteItem|listItems|queryItems|updateItem)\s*\(\s*['"`]([^'"`]+)['"`]/g,
        /backend\.(?:setItem|getItem|deleteItem|listItems|queryItems|updateItem)\s*\(\s*['"`]([^'"`]+)['"`]/g,
    ];

    function scanDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === 'node_modules' || entry.name === 'data') continue;
                scanDir(fullPath);
            } else if (entry.name.endsWith('.js')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                for (const pattern of patterns) {
                    let match;
                    while ((match = pattern.exec(content)) !== null) {
                        types.add(match[1]);
                    }
                }
            }
        }
    }

    scanDir(serverDir);
    return types;
}

main();
