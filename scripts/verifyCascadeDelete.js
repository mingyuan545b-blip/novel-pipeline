/**
 * verifyCascadeDelete - 项目删除级联完整性检测
 *
 * 检查项：
 *   D1: CASCADE_STORE_TYPES列表完整性（覆盖所有含projectId的数据目录）
 *   D2: 已存数据中projectId引用的目录是否都在CASCADE_STORE_TYPES中
 *   D3: 孤儿数据检测（projectId对应的项目不存在）
 */

const fs = require('fs');
const path = require('path');
const { CASCADE_STORE_TYPES } = require('../server/routes/projects/projectDeleteHandler');
const { DATA_STORE_REGISTRY } = require('../server/config/dataStoreRegistry');

const ROOT = path.join(__dirname, '..');
let errorCount = 0;
let warnCount = 0;

function error(msg) { console.error(`  ❌ [ERROR] ${msg}`); errorCount++; }
function warn(msg) { console.warn(`  ⚠️  [WARN] ${msg}`); warnCount++; }
function ok(msg) { console.log(`  ✅ ${msg}`); }

// 已知的非项目数据目录（不含projectId，不应加入CASCADE_STORE_TYPES）
const NON_PROJECT_DIRS = new Set([
    'character-archetypes', 'comic-config', 'dialects', 'genre-profiles',
    'humor-devices', 'migrations', 'style-templates', 'worldview-profiles',
    'prompt-config', 'foundation-prompts', 'genre-rules', 'library',
    'naming-styles', 'speech-styles', 'system-personas', 'meme-lexicon',
    'subplanes', 'license.json',
]);

function scanDataDirsWithProjectId() {
    const dataDir = path.join(ROOT, 'data');
    const dirsWithProjectId = new Set();

    if (!fs.existsSync(dataDir)) return dirsWithProjectId;

    for (const entry of fs.readdirSync(dataDir)) {
        if (NON_PROJECT_DIRS.has(entry)) continue;
        const entryPath = path.join(dataDir, entry);
        const stat = fs.statSync(entryPath);
        if (!stat.isDirectory()) continue;

        // 检查目录下的JSON文件是否含projectId字段
        try {
            const files = fs.readdirSync(entryPath).filter(f => f.endsWith('.json'));
            for (const file of files) {
                const filePath = path.join(entryPath, file);
                try {
                    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    if (content && typeof content === 'object' && content.projectId) {
                        dirsWithProjectId.add(entry);
                        break;
                    }
                    // 检查嵌套对象
                    if (content && typeof content === 'object') {
                        const jsonStr = JSON.stringify(content);
                        if (jsonStr.includes('"projectId"')) {
                            dirsWithProjectId.add(entry);
                            break;
                        }
                    }
                } catch (_) { /* skip invalid json */ }
            }
        } catch (_) { /* skip */ }
    }
    return dirsWithProjectId;
}

function checkCascadeListCompleteness() {
    console.log('\n=== D1: CASCADE_STORE_TYPES列表完整性 ===');
    const dirsWithProjectId = scanDataDirsWithProjectId();
    const cascadeSet = new Set(CASCADE_STORE_TYPES);

    let missingCount = 0;
    for (const dir of dirsWithProjectId) {
        if (!cascadeSet.has(dir)) {
            // 检查是否有等价的命名（如memory-layers vs memory_layers）
            const normalized = dir.replace(/-/g, '_');
            const hasEquivalent = Array.from(cascadeSet).some(c => c.replace(/-/g, '_') === normalized);
            if (!hasEquivalent) {
                error(`数据目录"${dir}"含projectId但不在CASCADE_STORE_TYPES中 — 删除项目时数据会残留`);
                missingCount++;
            }
        }
    }

    if (missingCount === 0) {
        ok(`所有含projectId的数据目录都在CASCADE_STORE_TYPES中（${dirsWithProjectId.size}个目录）`);
    }
    return dirsWithProjectId;
}

function checkOrphanedData() {
    console.log('\n=== D2: 孤儿数据检测 ===');
    const dataDir = path.join(ROOT, 'data');
    const projectsDir = path.join(dataDir, 'projects');

    // 获取所有现存项目ID
    const existingProjectIds = new Set();
    if (fs.existsSync(projectsDir)) {
        for (const file of fs.readdirSync(projectsDir)) {
            if (file.endsWith('.json')) {
                existingProjectIds.add(file.replace('.json', ''));
            }
        }
    }

    if (existingProjectIds.size === 0) {
        ok('无现存项目（跳过孤儿数据检测）');
        return;
    }

    // 扫描所有数据目录，查找projectId引用
    let orphanedCount = 0;
    const dirsWithProjectId = scanDataDirsWithProjectId();
    for (const dir of dirsWithProjectId) {
        const dirPath = path.join(dataDir, dir);
        if (!fs.existsSync(dirPath)) continue;
        const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
        for (const file of files) {
            try {
                const content = JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf8'));
                const projectId = content?.projectId;
                if (projectId && !existingProjectIds.has(projectId)) {
                    orphanedCount++;
                    if (orphanedCount <= 10) {
                        warn(`${dir}/${file} 引用projectId="${projectId}"但项目不存在（孤儿数据）`);
                    }
                }
            } catch (_) { /* skip */ }
        }
    }

    if (orphanedCount === 0) {
        ok('无孤儿数据');
    } else if (orphanedCount > 10) {
        warn(`...共${orphanedCount}个孤儿数据文件`);
    }
}

function checkCascadeListNaming() {
    console.log('\n=== D3: CASCADE_STORE_TYPES命名规范 ===');
    // 构建别名集合（这些是注册中心故意保留的兼容别名，不检查命名规范）
    const aliasSet = new Set();
    for (const info of Object.values(DATA_STORE_REGISTRY)) {
        for (const alias of info.aliases) {
            aliasSet.add(alias);
        }
    }
    // 只对主名称检查命名风格一致性（应为kebab-case）
    for (const storeType of CASCADE_STORE_TYPES) {
        if (aliasSet.has(storeType)) continue; // 跳过注册别名
        if (storeType.includes('_')) {
            warn(`CASCADE_STORE_TYPES中"${storeType}"使用下划线，建议统一为kebab-case`);
        }
    }
    ok(`检查${CASCADE_STORE_TYPES.length}个store type命名完成`);
}

function main() {
    console.log('========================================');
    console.log('项目删除级联完整性检测（D1-D3）');
    console.log('========================================');

    checkCascadeListCompleteness();
    checkOrphanedData();
    checkCascadeListNaming();

    console.log('\n========================================');
    console.log(`校验完成: ${errorCount} errors, ${warnCount} warnings`);
    console.log('========================================');

    if (errorCount > 0) {
        console.log('❌ 存在错误 — 级联删除列表不完整，会导致数据残留');
        process.exit(1);
    } else if (warnCount > 0) {
        console.log('⚠️  存在警告');
    } else {
        console.log('✅ 校验通过 — 级联删除列表完整');
    }
}

main();
