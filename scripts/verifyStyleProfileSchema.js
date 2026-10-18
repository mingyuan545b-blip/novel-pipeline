/**
 * verifyStyleProfileSchema - CI约束工具
 *
 * 职责：扫描代码库中styleProfile字段名使用，发现非标准字段名报错
 * 检查项：
 *   S1: 生产代码中直接读取styleProfile字段是否使用标准字段
 *   S2: 已存项目数据是否缺少约束字段（povRule等7个字段）
 */

const fs = require('fs');
const path = require('path');
const { STYLE_PROFILE_FIELDS, CONSTRAINT_FIELDS, FIELD_ALIASES } = require('../server/config/styleProfileSchema');
const { readProjects } = require('./lib/projectDataReader');

const ROOT = path.join(__dirname, '..');
let errorCount = 0;
let warnCount = 0;

function error(msg) { console.error(`  ❌ [ERROR] ${msg}`); errorCount++; }
function warn(msg) { console.warn(`  ⚠️  [WARN] ${msg}`); warnCount++; }
function ok(msg) { console.log(`  ✅ ${msg}`); }

const STANDARD_FIELDS = new Set(Object.values(STYLE_PROFILE_FIELDS));
const ALL_KNOWN_FIELDS = new Set(Object.keys(FIELD_ALIASES));

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

// 检查生产代码中styleProfile字段访问
function checkProductionCode() {
    console.log('\n=== S1: 生产代码styleProfile字段访问 ===');
    const serverDir = path.join(ROOT, 'server');
    const clientDir = path.join(ROOT, 'client/src');
    const ignoreDirs = ['node_modules', '__tests__', 'tests'];
    const files = [...scanJsFiles(serverDir, ignoreDirs), ...scanJsFiles(clientDir, ignoreDirs)];

    // 匹配 styleProfile.xxx 或 styleProfile['xxx'] 模式
    // 排除文件名匹配（如styleProfile.js），要求字段名前必须是.或[
    const fieldAccessPattern = /styleProfile[\.\[]\s*['"]?([a-zA-Z_][a-zA-Z0-9_]*)['"]?\s*\]?/g;
    const nonCoreDirs = ['scripts', 'tests', 'server/scripts', '__tests__'];

    let checkedFiles = 0;
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const relPath = path.relative(ROOT, file);
        const isNonCore = nonCoreDirs.some(d => relPath.replace(/\\/g, '/').includes(d));

        let match;
        while ((match = fieldAccessPattern.exec(content)) !== null) {
            const field = match[1];
            // 排除文件扩展名误报（如styleProfile.js中的js）
            if (field === 'js' || field === 'json' || field === 'ts') continue;
            if (STANDARD_FIELDS.has(field)) continue;
            if (ALL_KNOWN_FIELDS.has(field)) {
                warn(`${relPath}: 使用历史字段名"${field}"，建议迁移为标准字段名`);
            } else {
                if (isNonCore) {
                    warn(`${relPath}: 使用未知字段名"${field}"（非核心代码）`);
                } else {
                    error(`${relPath}: 使用未知字段名"${field}"，不在标准Schema中`);
                }
            }
        }
        checkedFiles++;
    }
    ok(`扫描${checkedFiles}个JS文件完成`);
}

// 检查已存项目数据是否缺少约束字段
async function checkProjectData() {
    console.log('\n=== S2: 已存项目数据约束字段完整性 ===');
    const { source, projects } = await readProjects();
    if (source === 'none') {
        warn('未读到任何项目数据（PG/JSON 均无）— 本项**未被覆盖**，不得视为通过');
        return;
    }

    let completeCount = 0;
    let incompleteCount = 0;
    let noProfile = 0;
    for (const data of projects) {
        if (!data || !data.styleProfile) { noProfile++; continue; }
        const missingFields = CONSTRAINT_FIELDS.filter(f => data.styleProfile[f] === undefined);
        if (missingFields.length > 0) {
            incompleteCount++;
            warn(`${data.id || '?'}: styleProfile缺少约束字段[${missingFields.join(',')}]`);
        } else {
            completeCount++;
        }
    }
    ok(`数据源=${source}，项目 ${projects.length} 个：约束字段完整 ${completeCount} 个, 需补齐 ${incompleteCount} 个, 无 styleProfile ${noProfile} 个`);
}

async function main() {
    console.log('========================================');
    console.log('styleProfile Schema一致性校验（S1-S2）');
    console.log('========================================');

    checkProductionCode();
    await checkProjectData();

    console.log('\n========================================');
    console.log(`校验完成: ${errorCount} errors, ${warnCount} warnings`);
    console.log('========================================');

    if (errorCount > 0) {
        console.log('❌ 存在错误 — 必须修复非标准字段名');
        process.exit(1);
    } else if (warnCount > 0) {
        console.log('⚠️  存在警告 — 历史字段名需逐步迁移');
    } else {
        console.log('✅ 校验通过 — 所有styleProfile字段名符合标准');
    }
}

main().catch((e) => { console.error('校验脚本异常:', e.message); process.exit(1); });
