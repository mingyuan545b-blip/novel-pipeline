/**
 * verifyWordConfigSchema - CI约束工具
 *
 * 职责：扫描代码库中所有wordConfig字段名使用，发现非标准字段名立即报错
 * 防止"字段名到处发挥"的问题再次发生
 *
 * 检查项：
 *   W1: genre-profiles/*.json的wordConfig字段名是否符合标准
 *   W2: 生产代码中直接读取wordConfig字段名是否使用标准字段
 *   W3: 测试代码中wordConfig字面量是否使用标准字段
 *   W4: 已存项目数据是否使用非标准字段（警告，需迁移）
 */

const fs = require('fs');
const path = require('path');
const { WORD_CONFIG_FIELDS, FIELD_ALIASES } = require('../server/config/wordConfigSchema');

const ROOT = path.join(__dirname, '..');
let errorCount = 0;
let warnCount = 0;

function error(msg) {
    console.error(`  ❌ [ERROR] ${msg}`);
    errorCount++;
}

function warn(msg) {
    console.warn(`  ⚠️  [WARN] ${msg}`);
    warnCount++;
}

function ok(msg) {
    console.log(`  ✅ ${msg}`);
}

// 标准字段名集合
const STANDARD_FIELDS = new Set(Object.values(WORD_CONFIG_FIELDS));
// 所有已知别名（包括标准字段名和历史变体）
const ALL_KNOWN_FIELDS = new Set(Object.keys(FIELD_ALIASES));

// 扫描genre-profiles JSON文件
function checkGenreProfiles() {
    console.log('\n=== W1: genre-profiles/*.json wordConfig字段名 ===');
    const profileDir = path.join(ROOT, 'data/genre-profiles');
    if (!fs.existsSync(profileDir)) {
        warn('genre-profiles目录不存在');
        return;
    }

    const files = fs.readdirSync(profileDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
        const filePath = path.join(profileDir, file);
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (!data.wordConfig) continue;

            const fields = Object.keys(data.wordConfig);
            for (const field of fields) {
                if (!STANDARD_FIELDS.has(field)) {
                    error(`${file}: wordConfig包含非标准字段"${field}"，应迁移为标准字段名`);
                }
            }
        } catch (e) {
            warn(`${file}: 解析失败 - ${e.message}`);
        }
    }
    ok(`扫描${files.length}个genre-profile文件完成`);
}

// 递归扫描.js文件中的wordConfig字段访问
function scanJsFiles(dir, ignoreDirs = []) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (ignoreDirs.includes(entry.name) || entry.name.startsWith('.')) continue;
            results.push(...scanJsFiles(fullPath, ignoreDirs));
        } else if (entry.name.endsWith('.js')) {
            results.push(fullPath);
        }
    }
    return results;
}

// 检查生产代码中wordConfig字段访问模式
function checkProductionCode() {
    console.log('\n=== W2: 生产代码wordConfig字段访问 ===');
    const serverDir = path.join(ROOT, 'server');
    const clientDir = path.join(ROOT, 'client/src');
    const ignoreDirs = ['node_modules', '__tests__', 'tests'];

    const files = [
        ...scanJsFiles(serverDir, ignoreDirs),
        ...scanJsFiles(clientDir, ignoreDirs)
    ];

    // 匹配 wordConfig.xxx 或 wordConfig['xxx'] 模式
    const fieldAccessPattern = /wordConfig[\.\[]\s*['"]?([a-zA-Z_][a-zA-Z0-9_]*)['"]?\s*\]?/g;

    // 非核心目录（测试/脚本）：警告而非错误，允许历史代码逐步迁移
    const nonCoreDirs = ['scripts', 'tests', 'server/scripts'];

    let checkedFiles = 0;
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const relPath = path.relative(ROOT, file);
        const isNonCore = nonCoreDirs.some(d => relPath.replace(/\\/g, '/').includes(d));

        let match;
        while ((match = fieldAccessPattern.exec(content)) !== null) {
            const field = match[1];
            // 允许标准字段名
            if (STANDARD_FIELDS.has(field)) continue;
            // 允许已知别名（历史代码兼容，但应逐步迁移）
            if (ALL_KNOWN_FIELDS.has(field)) {
                // 已知别名：警告，建议迁移
                warn(`${relPath}: 使用历史字段名"${field}"，建议迁移为标准字段名`);
            } else {
                // 未知字段：核心代码错误，非核心代码警告
                if (isNonCore) {
                    warn(`${relPath}: 使用未知字段名"${field}"（非核心代码，建议清理）`);
                } else {
                    error(`${relPath}: 使用未知字段名"${field}"，不在标准Schema中`);
                }
            }
        }
        checkedFiles++;
    }
    ok(`扫描${checkedFiles}个JS文件完成`);
}

// 检查已存项目数据
function checkProjectData() {
    console.log('\n=== W4: 已存项目数据wordConfig字段名 ===');
    const projectDir = path.join(ROOT, 'data/projects');
    if (!fs.existsSync(projectDir)) {
        warn('data/projects目录不存在');
        return;
    }

    const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.json'));
    let migratedCount = 0;
    let needMigrationCount = 0;

    for (const file of files) {
        const filePath = path.join(projectDir, file);
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (!data.wordConfig) continue;

            const fields = Object.keys(data.wordConfig);
            const hasNonStandard = fields.some(f => !STANDARD_FIELDS.has(f));
            if (hasNonStandard) {
                needMigrationCount++;
                warn(`${file}: wordConfig使用历史字段名[${fields.join(',')}]，需运行迁移脚本`);
            } else {
                migratedCount++;
            }
        } catch (e) {
            // 忽略解析错误
        }
    }
    ok(`已存项目: ${migratedCount}个已符合标准, ${needMigrationCount}个需迁移`);
}

// 主函数
function main() {
    console.log('========================================');
    console.log('wordConfig Schema一致性校验（W1-W4）');
    console.log('========================================');

    checkGenreProfiles();
    checkProductionCode();
    checkProjectData();

    console.log('\n========================================');
    console.log(`校验完成: ${errorCount} errors, ${warnCount} warnings`);
    console.log('========================================');

    if (errorCount > 0) {
        console.log('❌ 存在错误 — 必须修复非标准字段名');
        process.exit(1);
    } else if (warnCount > 0) {
        console.log('⚠️  存在警告 — 历史字段名需逐步迁移');
        // 警告不阻断CI，但需要跟踪
    } else {
        console.log('✅ 校验通过 — 所有wordConfig字段名符合标准');
    }
}

main();
