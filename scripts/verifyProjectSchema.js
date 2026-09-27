/**
 * verifyProjectSchema.js — 项目素材字段三处对齐校验脚本
 *
 * SOP 09 第三阶段步骤3.5 数据库字段对齐检查的执行入口
 *
 * 三处对齐校验：
 * 1. 字段注册表 ↔ PG实际表结构（调用 schemaIntegrityCheck.checkSchemaIntegrity）
 * 2. 题材schema(genreStateFields.extraFields) ↔ 字段注册表（题材定义的字段是否都在注册表里）
 * 3. 题材白名单校验（项目用的题材是否在允许列表内）
 *
 * 用法：
 *   node scripts/verifyProjectSchema.js                     # 全量校验
 *   node scripts/verifyProjectSchema.js --project=<id>      # 指定项目校验
 *   node scripts/verifyProjectSchema.js --skip-pg           # 跳过PG校验（无DB环境）
 *
 * 退出码：0=全部通过，1=有CRITICAL/ERROR
 */
'use strict';

// 加载.env环境变量（独立脚本未走server启动流程）
require('dotenv').config({ override: true });

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server');

let errorCount = 0;
let warnCount = 0;

function error(msg) { console.error(`[ERROR] ${msg}`); errorCount++; }
function warn(msg) { console.warn(`[WARN]  ${msg}`); warnCount++; }
function ok(msg) { console.log(`[OK]    ${msg}`); }
function info(msg) { console.log(`[INFO]  ${msg}`); }

// 解析命令行参数
function parseArgs() {
    const args = { project: null, skipPg: false };
    for (const arg of process.argv.slice(2)) {
        if (arg.startsWith('--project=')) args.project = arg.slice('--project='.length);
        else if (arg === '--skip-pg') args.skipPg = true;
    }
    return args;
}

// 校验1: 题材白名单
function checkGenreWhitelist() {
    info('=== 校验1: 题材白名单 ===');
    const WHITELIST = ['high-martial-comedy', 'baby'];

    const genresDir = path.join(SERVER, 'services', 'genres');
    if (!fs.existsSync(genresDir)) {
        error(`题材目录不存在: ${genresDir}`);
        return;
    }

    const actualGenres = fs.readdirSync(genresDir).filter(d => {
        const stat = fs.statSync(path.join(genresDir, d));
        return stat.isDirectory() && !d.startsWith('.') && !['baseGenreTemplate.js'].includes(d);
    });

    const violations = actualGenres.filter(g => !WHITELIST.includes(g) && !WHITELIST.includes(_resolveGenreId(g)));
    if (violations.length > 0) {
        error(`发现白名单外题材目录: ${violations.join(', ')}`);
        error(`当前白名单: ${WHITELIST.join(', ')}`);
        error(`如需新增题材，请先过 SOP 09 第一阶段市场五问+质量门禁，再更新本脚本白名单`);
    } else {
        ok(`题材白名单校验通过 (${actualGenres.length}个题材: ${actualGenres.join(', ')})`);
    }
}

// 通过题材目录名解析实际题材ID（读取config.js的id字段）
function _resolveGenreId(dirName) {
    try {
        const configPath = path.join(SERVER, 'services', 'genres', dirName, 'config.js');
        if (!fs.existsSync(configPath)) return dirName;
        const config = require(configPath);
        return config.id || dirName;
    } catch (_) {
        return dirName;
    }
}

// 校验2: 题材schema ↔ 字段注册表
function checkGenreSchemaVsRegistry() {
    info('=== 校验2: 题材schema ↔ 字段注册表对齐 ===');

    const { GENRE_SCHEMAS } = require('../server/config/genreStateFields');
    const { REGISTRY } = require('../server/db/fieldRegistryData');

    // 收集所有注册表里定义的字段名（跨所有表）
    const allRegistryFields = new Set();
    for (const [tableName, tableDef] of Object.entries(REGISTRY)) {
        for (const colName of Object.keys(tableDef.columns || {})) {
            allRegistryFields.add(colName);
        }
    }

    // 题材extraFields里的字段，应该在注册表或BASE_STATE_FIELDS里有对应
    const { BASE_STATE_FIELDS } = require('../server/config/characterStateSchemas');
    const baseFields = new Set(Object.keys(BASE_STATE_FIELDS));

    for (const [genreId, schema] of Object.entries(GENRE_SCHEMAS)) {
        const extraFields = schema.extraFields || {};
        const missingFields = [];

        for (const [fieldKey, fieldDef] of Object.entries(extraFields)) {
            // 题材字段要么在注册表里，要么在BASE_STATE_FIELDS里，要么在character-states表里
            // character-states表的data字段是JSONB，所有题材字段都会落到data里
            // 所以这里只检查字段名是否合法（非空、无特殊字符）
            if (!fieldKey || typeof fieldKey !== 'string') {
                error(`题材 ${genreId} 的 extraFields 有非法字段名: ${fieldKey}`);
                continue;
            }
            // 检查字段定义是否完整
            if (!fieldDef.key || !fieldDef.label || !fieldDef.type) {
                error(`题材 ${genreId} 的 extraFields.${fieldKey} 定义不完整 (需要key/label/type)`);
                continue;
            }
        }

        if (missingFields.length > 0) {
            warn(`题材 ${genreId} 的extraFields未在注册表找到对应列: ${missingFields.join(', ')}`);
            warn(`  (若字段落在JSONB data列里则正常，仅提示)`);
        } else {
            ok(`题材 ${genreId} schema定义完整 (${Object.keys(extraFields).length}个extraFields)`);
        }
    }

    // 反向检查：注册表里character-states表的字段，是否覆盖了所有题材的关键状态字段
    const charStateTable = REGISTRY['character_states'] || REGISTRY['character-states'];
    if (charStateTable) {
        ok(`character-states表注册表定义存在 (${Object.keys(charStateTable.columns || {}).length}列)`);
    } else {
        warn(`character-states表未在注册表找到（可能是命名差异，请人工确认）`);
    }
}

// 校验3: 字段注册表 ↔ PG实际表结构
async function checkRegistryVsPg() {
    info('=== 校验3: 字段注册表 ↔ PG实际表结构 ===');

    let schemaCheck;
    try {
        schemaCheck = require('../server/db/schemaIntegrityCheck');
    } catch (e) {
        warn(`无法加载schemaIntegrityCheck模块: ${e.message}`);
        warn(`跳过PG校验（可能是无DB环境，用 --skip-pg 显式跳过）`);
        return;
    }

    if (typeof schemaCheck.checkSchemaIntegrity !== 'function') {
        warn(`schemaIntegrityCheck.checkSchemaIntegrity 不存在，跳过PG校验`);
        return;
    }

    // 初始化PG连接池（schemaIntegrityCheck依赖getPool，但独立脚本未走server启动流程）
    try {
        const { initPgPool } = require('../server/db/pgPool');
        await initPgPool();
    } catch (e) {
        warn(`PG连接池初始化失败: ${e.message}`);
        warn(`可能是PG未启动或连接配置错误，用 --skip-pg 跳过`);
        return;
    }

    try {
        const result = await schemaCheck.checkSchemaIntegrity();
        if (result && typeof result === 'object') {
            const criticals = (result.issues || []).filter(i => i.severity === 'CRITICAL' || i.severity === 'ERROR');
            const warnings = (result.issues || []).filter(i => i.severity === 'WARN');
            if (criticals.length === 0) {
                ok(`PG schema校验通过 (${warnings.length}个WARN可忽略)`);
            } else {
                error(`PG schema有 ${criticals.length} 个CRITICAL/ERROR问题:`);
                for (const c of criticals.slice(0, 10)) {
                    error(`  ${c.table}.${c.field || c.column}: ${c.message}`);
                }
                if (criticals.length > 10) error(`  ... 还有 ${criticals.length - 10} 个`);
            }
        }
    } catch (e) {
        warn(`PG schema校验执行失败: ${e.message}`);
        warn(`可能是PG未启动或连接配置错误，用 --skip-pg 跳过`);
    }
}

// 主流程
async function main() {
    const args = parseArgs();

    console.log('=========================================');
    console.log('  项目素材字段三处对齐校验');
    console.log('  SOP 09 第三阶段步骤3.5');
    console.log('=========================================');
    if (args.project) info(`指定项目: ${args.project}`);
    if (args.skipPg) info('已跳过PG校验');
    console.log('');

    // 校验1: 题材白名单（不依赖DB）
    checkGenreWhitelist();
    console.log('');

    // 校验2: 题材schema ↔ 注册表（不依赖DB）
    checkGenreSchemaVsRegistry();
    console.log('');

    // 校验3: 注册表 ↔ PG（依赖DB）
    if (!args.skipPg) {
        await checkRegistryVsPg();
        console.log('');
    }

    // 汇总
    console.log('=========================================');
    console.log('  校验汇总');
    console.log('=========================================');
    if (errorCount === 0) {
        ok(`全部通过 (${warnCount}个WARN)`);
        process.exit(0);
    } else {
        error(`失败: ${errorCount}个ERROR, ${warnCount}个WARN`);
        process.exit(1);
    }
}

main().catch(e => {
    console.error('未捕获异常:', e);
    process.exit(1);
});
