/**
 * verifyTargetChaptersSchema - CI约束工具
 *
 * 职责：扫描代码库中targetChapters/targetChapterCount字段名使用
 * 确保业务层通过归一化函数读取，不直接访问字段名
 *
 * 检查项：
 *   T1: 业务代码中直接读取project.targetChapterCount（应通过归一化函数）
 *   T2: 业务代码中直接读取project.targetChapters（应通过归一化函数）
 *   T3: PG层代码允许直接使用targetChapterCount（列名）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let errorCount = 0;
let warnCount = 0;

function error(msg) { console.error(`  ❌ [ERROR] ${msg}`); errorCount++; }
function warn(msg) { console.warn(`  ⚠️  [WARN] ${msg}`); warnCount++; }
function ok(msg) { console.log(`  ✅ ${msg}`); }

// PG层目录（允许直接使用targetChapterCount列名）
const PG_LAYER_DIRS = ['server/db/migrations', 'server/db/store-pg-writer', 'server/db/pgSchema', 'server/db/fieldRegistry'];
// Schema/归一化层目录（允许定义字段名）
const SCHEMA_LAYER_DIRS = ['server/config/targetChaptersSchema', 'server/config/targetChaptersNormalizer'];

function isPgLayer(filePath) {
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
    return PG_LAYER_DIRS.some(d => relPath.includes(d));
}

function isSchemaLayer(filePath) {
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
    return SCHEMA_LAYER_DIRS.some(d => relPath.includes(d));
}

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

function checkBusinessCode() {
    console.log('\n=== T1+T2: 业务代码直接访问targetChapters/targetChapterCount ===');
    const serverDir = path.join(ROOT, 'server');
    const ignoreDirs = ['node_modules', '__tests__', 'tests'];
    const files = scanJsFiles(serverDir, ignoreDirs);

    // 匹配 project.targetChapterCount 或 project.targetChapters（不匹配归一化函数调用）
    const directAccessPattern = /\.(targetChapterCount|targetChapters)\b/g;

    let checkedFiles = 0;
    for (const file of files) {
        if (isSchemaLayer(file)) continue;

        const content = fs.readFileSync(file, 'utf8');
        const relPath = path.relative(ROOT, file);
        const isPg = isPgLayer(file);

        let match;
        while ((match = directAccessPattern.exec(content)) !== null) {
            const field = match[1];
            const lineNum = content.substring(0, match.index).split('\n').length;

            // PG层允许使用targetChapterCount（列名）
            if (isPg && field === 'targetChapterCount') continue;

            // 检查是否在归一化函数调用中（normalizeTargetChapters）
            const context = content.substring(Math.max(0, match.index - 50), match.index + 50);
            if (context.includes('normalizeTargetChapters') || context.includes('FIELD_ALIASES') || context.includes('TARGET_CHAPTERS')) {
                continue;
            }

            // 检查是否是写入操作（project.targetChapters = xxx）
            const afterMatch = content.substring(match.index, match.index + 30);
            if (afterMatch.match(/\s*=/) && !afterMatch.match(/==|===/)) {
                // 写入操作：警告（建议用标准字段名targetChapters）
                if (field === 'targetChapterCount') {
                    warn(`${relPath}:${lineNum} 写入targetChapterCount，建议改用标准字段名targetChapters`);
                }
                continue;
            }

            // 白名单：非project对象的读取场景，不需要归一化
            // 1. req.body/request.body - HTTP请求体输入
            // 2. data - 迁移脚本字段映射
            // 3. config/effectiveConfig/fullConfig - 配置对象（已归一化或传入参数）
            // 4. template.project - 模板数据（已通过归一化函数处理）
            // match.index指向"."的位置，beforeMatch是"."之前的内容
            const beforeMatch = content.substring(Math.max(0, match.index - 40), match.index);
            // 检查beforeMatch是否以这些变量名结尾（前面是非单词字符或行首）
            const nonProjectVars = ['req.body', 'request.body', 'data', 'config', 'effectiveConfig', 'fullConfig', 'template.project'];
            const isNonProject = nonProjectVars.some(v => {
                const pattern = new RegExp(`(^|[^\\w.])${v.replace(/\./g, '\\.')}$`);
                return pattern.test(beforeMatch);
            });
            if (isNonProject) {
                continue;
            }

            // 业务层直接读取：错误
            if (field === 'targetChapterCount') {
                error(`${relPath}:${lineNum} 业务代码直接读取targetChapterCount，应通过normalizeTargetChapters归一化`);
            } else {
                warn(`${relPath}:${lineNum} 业务代码直接读取targetChapters，建议通过normalizeTargetChapters归一化`);
            }
        }
        checkedFiles++;
    }
    ok(`扫描${checkedFiles}个JS文件完成`);
}

function main() {
    console.log('========================================');
    console.log('targetChapters Schema一致性校验（T1-T3）');
    console.log('========================================');

    checkBusinessCode();

    console.log('\n========================================');
    console.log(`校验完成: ${errorCount} errors, ${warnCount} warnings`);
    console.log('========================================');

    if (errorCount > 0) {
        console.log('❌ 存在错误 — 业务代码必须通过归一化函数读取');
        process.exit(1);
    } else if (warnCount > 0) {
        console.log('⚠️  存在警告 — 建议逐步迁移到归一化函数');
    } else {
        console.log('✅ 校验通过 — 所有targetChapters访问符合规范');
    }
}

main();
