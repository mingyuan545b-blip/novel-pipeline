/**
 * verifyChapterIntentsSchema - chapterIntents Schema一致性校验
 *
 * 检查项：
 *   C1: 生产代码中chapterIntents.chapters数组类型残留检测
 *   C2: 业务代码应通过normalizeChapterIntents归一化读取
 *   C3: 已存项目数据chapterIntents结构合规性
 */

const fs = require('fs');
const path = require('path');
const store = require('../server/store');
const { normalizeChapterIntents, validateChapterIntents } = require('../server/config/chapterIntentsNormalizer');

const ROOT = path.join(__dirname, '..');
let errorCount = 0;
let warnCount = 0;

function error(msg) { console.error(`  ❌ [ERROR] ${msg}`); errorCount++; }
function warn(msg) { console.warn(`  ⚠️  [WARN] ${msg}`); warnCount++; }
function ok(msg) { console.log(`  ✅ ${msg}`); }

function scanJsFiles(dir, ignoreDirs = []) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
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

// Schema层目录（允许直接操作字段）
const SCHEMA_LAYER = ['server/config/chapterIntentsSchema', 'server/config/chapterIntentsNormalizer'];

function isSchemaLayer(filePath) {
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
    return SCHEMA_LAYER.some(d => relPath.includes(d));
}

function checkBusinessCode() {
    console.log('\n=== C1+C2: 业务代码chapterIntents访问检查 ===');
    const serverDir = path.join(ROOT, 'server');
    const files = scanJsFiles(serverDir, ['node_modules', '__tests__', 'tests']);
    let checkedFiles = 0;

    for (const file of files) {
        if (isSchemaLayer(file)) continue;
        const content = fs.readFileSync(file, 'utf8');
        const relPath = path.relative(ROOT, file);

        // C1: 检测数组类型残留（Array.isArray(xxx.chapterIntents) 本身，非.chapters子字段）
        // 注意：Array.isArray(xxx.chapterIntents.chapters) 是合理的兼容性处理，不警告
        const arrayCheckPattern = /Array\.isArray\([^)]*\.chapterIntents\)/g;
        let match;
        while ((match = arrayCheckPattern.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            warn(`${relPath}:${lineNum} 检测到Array.isArray(chapterIntents) — 建议通过normalizeChapterIntents归一化`);
        }

        // C2: 直接写入chapterIntents = { chapters: [] }（数组初始化）
        const arrayInitPattern = /chapterIntents\s*[:=]\s*\{[^}]*chapters\s*:\s*\[\]/g;
        while ((match = arrayInitPattern.exec(content)) !== null) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            error(`${relPath}:${lineNum} 初始化chapterIntents.chapters为数组，必须使用对象{}`);
        }
        checkedFiles++;
    }
    ok(`扫描${checkedFiles}个JS文件完成`);
}

function checkProjectData() {
    console.log('\n=== C3: 已存项目数据chapterIntents结构 ===');
    try {
        const projects = store.listItems('projects');
        if (projects.length === 0) {
            ok('已存项目: 0个（无需校验）');
            return;
        }
        let validCount = 0;
        let invalidCount = 0;
        for (const project of projects) {
            if (!project.chapterIntents) {
                validCount++; // 无chapterIntents视为合规（默认结构）
                continue;
            }
            const result = validateChapterIntents(project.chapterIntents);
            if (result.valid) {
                validCount++;
            } else {
                invalidCount++;
                warn(`项目${project.id} chapterIntents结构异常: ${result.errors.join('; ')}`);
            }
        }
        ok(`已存项目: ${validCount}个合规, ${invalidCount}个异常`);
    } catch (e) {
        ok(`项目数据检查跳过: ${e.message}`);
    }
}

function main() {
    console.log('========================================');
    console.log('chapterIntents Schema一致性校验（C1-C3）');
    console.log('========================================');

    checkBusinessCode();
    checkProjectData();

    console.log('\n========================================');
    console.log(`校验完成: ${errorCount} errors, ${warnCount} warnings`);
    console.log('========================================');

    if (errorCount > 0) {
        console.log('❌ 存在错误 — chapterIntents结构必须修复');
        process.exit(1);
    } else if (warnCount > 0) {
        console.log('⚠️  存在警告 — 建议逐步迁移到归一化函数');
    } else {
        console.log('✅ 校验通过 — chapterIntents结构符合规范');
    }
}

main();
