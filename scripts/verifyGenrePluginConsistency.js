/**
 * verifyGenrePluginConsistency - genre插件命名一致性检测
 *
 * 三套命名系统：
 *   1. 目录名（如 high-martial-crossplane）
 *   2. config.id（如 high-martial-comedy）
 *   3. genreProfileIds（中文，如 ['武侠','历史','奇幻']）
 *
 * 检查项：
 *   G1: 每个genre目录必须有config.js且包含id字段
 *   G2: config.id不能为空，且必须是kebab-case
 *   G3: genreProfileIds不能为空数组
 *   G4: 目录名与config.id不一致时，genreLoader.js必须建立别名映射
 *   G5: genreProfileIds中的中文名必须在data/genre-profiles中存在
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let errorCount = 0;
let warnCount = 0;

function error(msg) { console.error(`  ❌ [ERROR] ${msg}`); errorCount++; }
function warn(msg) { console.warn(`  ⚠️  [WARN] ${msg}`); warnCount++; }
function ok(msg) { console.log(`  ✅ ${msg}`); }

const SKIP_ENTRIES = new Set(['baseGenreTemplate.js', 'genrePluginSpec.js', 'genreValidator.js']);

function loadGenreConfigs() {
    const genresDir = path.join(ROOT, 'server', 'services', 'genres');
    const genres = [];

    for (const entry of fs.readdirSync(genresDir)) {
        if (SKIP_ENTRIES.has(entry) || entry.startsWith('_') || entry.startsWith('.')) continue;
        const entryPath = path.join(genresDir, entry);
        const stat = fs.statSync(entryPath);

        if (stat.isDirectory()) {
            // 优先从config.js加载，其次从index.js内联config加载
            const configPath = path.join(entryPath, 'config.js');
            const indexPath = path.join(entryPath, 'index.js');
            let config = null;
            let configSource = '';

            if (fs.existsSync(configPath)) {
                try {
                    delete require.cache[require.resolve(configPath)];
                    config = require(configPath);
                    configSource = 'config.js';
                } catch (e) {
                    error(`加载${entry}/config.js失败: ${e.message}`);
                }
            } else if (fs.existsSync(indexPath)) {
                // infinite-dungeon模式：config内联在index.js中
                try {
                    delete require.cache[require.resolve(indexPath)];
                    const genreModule = require(indexPath);
                    if (genreModule && genreModule.id) {
                        config = {
                            id: genreModule.id,
                            label: genreModule.label,
                            genreProfileIds: genreModule.genreProfileIds || [],
                            patterns: genreModule.patterns || [],
                        };
                        configSource = 'index.js(inline)';
                    }
                } catch (e) {
                    error(`加载${entry}/index.js失败: ${e.message}`);
                }
            }

            if (config) {
                genres.push({
                    dirName: entry,
                    configId: config.id,
                    label: config.label,
                    genreProfileIds: config.genreProfileIds || [],
                    patterns: config.patterns || [],
                    configPath: configSource,
                });
            } else {
                error(`genre目录${entry}缺少config.js且index.js无内联config`);
            }
        }
    }
    return genres;
}

function loadGenreProfiles() {
    const profilesDir = path.join(ROOT, 'data', 'genre-profiles');
    const profiles = new Set();
    if (fs.existsSync(profilesDir)) {
        for (const entry of fs.readdirSync(profilesDir)) {
            if (entry.endsWith('.json')) {
                profiles.add(entry.replace('.json', ''));
            }
        }
    }
    return profiles;
}

function checkGenreConfigs(genres) {
    console.log('\n=== G1-G3: genre插件配置完整性 ===');
    for (const genre of genres) {
        // G1: config.id必须存在
        if (!genre.configId) {
            error(`${genre.dirName}/config.js 缺少id字段`);
            continue;
        }
        // G2: config.id必须是kebab-case
        if (!/^[a-z][a-z0-9-]*$/.test(genre.configId)) {
            error(`${genre.dirName}/config.js id="${genre.configId}" 不是kebab-case格式`);
        }
        // G3: genreProfileIds不能为空
        if (genre.genreProfileIds.length === 0) {
            warn(`${genre.dirName}/config.js genreProfileIds为空数组`);
        }
    }
    ok(`检查${genres.length}个genre插件配置完成`);
}

function checkDirNameConsistency(genres) {
    console.log('\n=== G4: 目录名与config.id一致性 ===');
    for (const genre of genres) {
        if (genre.dirName !== genre.configId) {
            // 目录名与id不一致是允许的，但genreLoader.js必须建立别名映射
            // 检查genreLoader.js是否有对应处理
            const loaderPath = path.join(ROOT, 'server', 'services', 'genreLoader.js');
            const loaderContent = fs.readFileSync(loaderPath, 'utf8');
            if (!loaderContent.includes('entry !== genre.id') && !loaderContent.includes('map[entry]')) {
                error(`${genre.dirName}/config.js id="${genre.configId}" 与目录名不一致，但genreLoader.js未建立别名映射`);
            } else {
                ok(`${genre.dirName} → id=${genre.configId}（别名映射已建立）`);
            }
        }
    }
}

function checkGenreProfileIds(genres) {
    console.log('\n=== G5: genreProfileIds引用完整性 ===');
    const profiles = loadGenreProfiles();
    if (profiles.size === 0) {
        ok('genre-profiles目录为空或不存在（跳过检查）');
        return;
    }
    for (const genre of genres) {
        for (const profileId of genre.genreProfileIds) {
            if (!profiles.has(profileId)) {
                warn(`${genre.dirName}/config.js genreProfileIds引用"${profileId}"在data/genre-profiles中不存在`);
            }
        }
    }
    ok(`检查${genres.length}个genre的genreProfileIds引用完成`);
}

function checkDuplicateIds(genres) {
    console.log('\n=== G6: config.id唯一性 ===');
    const idMap = {};
    for (const genre of genres) {
        if (genre.configId) {
            if (idMap[genre.configId]) {
                error(`config.id重复: ${genre.configId}（${idMap[genre.configId]} 与 ${genre.dirName}）`);
            } else {
                idMap[genre.configId] = genre.dirName;
            }
        }
    }
    ok(`检查${Object.keys(idMap).length}个唯一id完成`);
}

function main() {
    console.log('========================================');
    console.log('genre插件命名一致性校验（G1-G6）');
    console.log('========================================');

    const genres = loadGenreConfigs();
    ok(`加载${genres.length}个genre插件配置`);

    checkGenreConfigs(genres);
    checkDirNameConsistency(genres);
    checkGenreProfileIds(genres);
    checkDuplicateIds(genres);

    console.log('\n========================================');
    console.log(`校验完成: ${errorCount} errors, ${warnCount} warnings`);
    console.log('========================================');

    if (errorCount > 0) {
        console.log('❌ 存在错误 — genre插件命名必须修复');
        process.exit(1);
    } else if (warnCount > 0) {
        console.log('⚠️  存在警告');
    } else {
        console.log('✅ 校验通过 — genre插件命名一致');
    }
}

main();
