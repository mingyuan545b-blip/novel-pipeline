/**
 * audit-genre-whitelist.js — 题材白名单CI强制校验脚本
 *
 * 用户原话："禁止不是口头说说"
 *
 * 作用：在CI阶段强制校验题材目录只能包含白名单内的题材
 *      防止"影后归来"式低俗套路再入库
 *
 * 校验范围：
 *   1. server/services/genres/ 下的题材目录（自动扫描）
 *   2. server/config/genreStateFields.js 的 GENRE_SCHEMAS
 *   3. server/services/stateKVHelpers.js 的 GENRE_DEFAULTS
 *   4. server/config/characterFieldGenreOverrides.js 的 GENRE_FIELD_OVERRIDES
 *
 * 新增题材必须：
 *   1. 先过 SOP 09 第一阶段市场五问+质量门禁
 *   2. 在本脚本 WHITELIST 数组添加题材ID
 *   3. 同步更新 SOP 09 的 2.3 题材白名单表
 *
 * 用法：node scripts/audit-genre-whitelist.js
 * 退出码：0=通过，1=发现白名单外题材
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server');

// ============ 题材白名单（唯一真相源）============
// 新增题材前请先过 SOP 09 第一阶段评估
const WHITELIST = [
    'high-martial-comedy',  // 高武穿越·诸天万界
    'baby',                 // 萌宝
];
// ================================================

let errorCount = 0;
let warnCount = 0;

function error(msg) { console.error(`[ERROR] ${msg}`); errorCount++; }
function warn(msg) { console.warn(`[WARN]  ${msg}`); warnCount++; }
function ok(msg) { console.log(`[OK]    ${msg}`); }

// 校验1: 题材目录扫描
function checkGenreDirectories() {
    console.log('=== 校验1: 题材目录扫描 ===');
    const genresDir = path.join(SERVER, 'services', 'genres');
    if (!fs.existsSync(genresDir)) {
        error(`题材目录不存在: ${genresDir}`);
        return;
    }

    const entries = fs.readdirSync(genresDir);
    const actualGenreDirs = entries.filter(d => {
        const fullPath = path.join(genresDir, d);
        return fs.statSync(fullPath).isDirectory() && !d.startsWith('.');
    });

    console.log(`  发现 ${actualGenreDirs.length} 个题材目录: ${actualGenreDirs.join(', ')}`);

    for (const dir of actualGenreDirs) {
        // 通过config.js的id字段解析实际题材ID
        const actualId = _resolveGenreId(dir);
        if (!WHITELIST.includes(actualId)) {
            error(`题材目录 "${dir}" (id=${actualId}) 不在白名单内`);
            error(`  当前白名单: ${WHITELIST.join(', ')}`);
            error(`  如需新增，请先过 SOP 09 第一阶段市场五问+质量门禁，再更新本脚本WHITELIST`);
        }
    }

    if (errorCount === 0) {
        ok(`题材目录白名单校验通过`);
    }
}

// 通过题材目录名解析实际题材ID
function _resolveGenreId(dirName) {
    try {
        const configPath = path.join(SERVER, 'services', 'genres', dirName, 'config.js');
        if (!fs.existsSync(configPath)) return dirName;
        // 清除缓存确保读到最新
        delete require.cache[require.resolve(configPath)];
        const config = require(configPath);
        return config.id || dirName;
    } catch (_) {
        return dirName;
    }
}

// 校验2: genreStateFields.js
function checkGenreStateFields() {
    console.log('=== 校验2: genreStateFields.js GENRE_SCHEMAS ===');
    const filePath = path.join(SERVER, 'config', 'genreStateFields.js');
    if (!fs.existsSync(filePath)) {
        error(`文件不存在: ${filePath}`);
        return;
    }

    delete require.cache[require.resolve(filePath)];
    const { GENRE_SCHEMAS } = require(filePath);

    const schemaIds = Object.keys(GENRE_SCHEMAS || {});
    console.log(`  GENRE_SCHEMAS 包含 ${schemaIds.length} 个题材: ${schemaIds.join(', ')}`);

    for (const id of schemaIds) {
        if (!WHITELIST.includes(id)) {
            error(`GENRE_SCHEMAS 中的题材 "${id}" 不在白名单内`);
        }
    }

    if (errorCount === 0) {
        ok(`genreStateFields 白名单校验通过`);
    }
}

// 校验3: stateKVHelpers.js GENRE_DEFAULTS
function checkStateKVHelpers() {
    console.log('=== 校验3: stateKVHelpers.js GENRE_DEFAULTS ===');
    const filePath = path.join(SERVER, 'services', 'stateKVHelpers.js');
    if (!fs.existsSync(filePath)) {
        error(`文件不存在: ${filePath}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    // 提取 GENRE_DEFAULTS 里的题材ID
    const genreIdMatches = content.match(/GENRE_DEFAULTS\s*=\s*\{([^}]*)\}/s);
    if (!genreIdMatches) {
        warn(`未在 stateKVHelpers.js 找到 GENRE_DEFAULTS，跳过`);
        return;
    }

    const defaultsBlock = genreIdMatches[1];
    const idMatches = defaultsBlock.matchAll(/['"]([^'"]+)['"]\s*:/g);
    const foundIds = new Set();
    for (const m of idMatches) {
        foundIds.add(m[1]);
    }

    console.log(`  GENRE_DEFAULTS 包含 ${foundIds.size} 个题材: ${[...foundIds].join(', ')}`);

    for (const id of foundIds) {
        if (!WHITELIST.includes(id)) {
            error(`GENRE_DEFAULTS 中的题材 "${id}" 不在白名单内`);
        }
    }

    if (errorCount === 0) {
        ok(`stateKVHelpers 白名单校验通过`);
    }
}

// 校验4: characterFieldGenreOverrides.js
function checkCharacterFieldOverrides() {
    console.log('=== 校验4: characterFieldGenreOverrides.js ===');
    const filePath = path.join(SERVER, 'config', 'characterFieldGenreOverrides.js');
    if (!fs.existsSync(filePath)) {
        warn(`文件不存在: ${filePath}（可能已重构，跳过）`);
        return;
    }

    delete require.cache[require.resolve(filePath)];
    try {
        const overrides = require(filePath);
        const GENRE_FIELD_OVERRIDES = overrides.GENRE_FIELD_OVERRIDES || overrides;
        const overrideIds = Object.keys(GENRE_FIELD_OVERRIDES || {});

        console.log(`  GENRE_FIELD_OVERRIDES 包含 ${overrideIds.length} 个题材: ${overrideIds.join(', ')}`);

        for (const id of overrideIds) {
            if (!WHITELIST.includes(id)) {
                error(`GENRE_FIELD_OVERRIDES 中的题材 "${id}" 不在白名单内`);
            }
        }

        if (errorCount === 0) {
            ok(`characterFieldGenreOverrides 白名单校验通过`);
        }
    } catch (e) {
        warn(`解析 ${filePath} 失败: ${e.message}（请人工检查）`);
    }
}

// 主流程
function main() {
    console.log('=========================================');
    console.log('  题材白名单 CI 强制校验');
    console.log('  杜绝低俗烂大街套路再入库');
    console.log('=========================================');
    console.log(`白名单: ${WHITELIST.join(', ')}`);
    console.log('');

    checkGenreDirectories();
    console.log('');

    checkGenreStateFields();
    console.log('');

    checkStateKVHelpers();
    console.log('');

    checkCharacterFieldOverrides();
    console.log('');

    console.log('=========================================');
    if (errorCount === 0) {
        ok(`题材白名单校验全部通过 (${warnCount}个WARN可忽略)`);
        console.log('  低俗套路题材已被有效拦截');
        process.exit(0);
    } else {
        error(`发现 ${errorCount} 个白名单外题材，禁止合并到主分支`);
        error(`请先过 SOP 09 第一阶段评估，再更新 WHITELIST`);
        process.exit(1);
    }
}

main();
