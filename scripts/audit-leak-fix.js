/**
 * audit-leak-fix.js — 堵漏式修复CI检测脚本（陷阱#87）
 *
 * 检测4类堵漏模式：
 *   模式1：消费端拼凑（enricher/merger/combiner类文件或函数）
 *   模式2：事后补标记（markChapter/postProcess/afterStep类函数）
 *   模式3：fallback默认值掩盖（|| 'npc' / || 'unknown' 等业务语义默认值）
 *   模式4：事后提取补救（reverseExtract/postExtract类函数）
 *
 * 用法：
 *   node scripts/audit-leak-fix.js              # 检测新增堵漏（对比git）
 *   node scripts/audit-leak-fix.js --full       # 全量扫描所有堵漏代码
 *   node scripts/audit-leak-fix.js --ci         # CI模式：critical阻断，warning不阻断
 *
 * 退出码：
 *   0 = 无新增堵漏 / CI模式下仅有warning
 *   1 = 发现新增堵漏（阻断CI）
 *   2 = 已有堵漏未清理（警告不阻断，仅--full模式）
 */
'use strict';

const { execSync } = require('child_process');
const path = require('path');

const PIPELINE_DIR = path.resolve(__dirname, '..', 'server', 'services', 'pipeline');

// 4类堵漏模式检测规则
const LEAK_PATTERNS = [
    {
        id: 'MODE1_CONSUMER_MERGE',
        severity: 'critical',
        description: '消费端拼凑：在读取端合并多数据源补救',
        filePattern: /(enricher|merger|combiner|contractMaterialEnricher)\.js$/i,
        funcPattern: /\b(enrichMaterials|mergeState|combineData|enrichForContract)\s*\(/g,
        examples: ['contractMaterialEnricher.js:enrichMaterialsForContract']
    },
    {
        id: 'MODE2_POST_MARK',
        severity: 'critical',
        description: '事后补标记：流程结束后补写状态字段',
        filePattern: /(postMarker|afterStepUpdater)\.js$/i,
        funcPattern: /\b(markChapterProcessed|postMarkChapter|afterStepUpdate)\s*\(/g,
        examples: ['stateKVIndex.markChapterProcessed']
    },
    {
        id: 'MODE3_FALLBACK_MASK',
        severity: 'warning',
        description: 'fallback默认值掩盖：核心业务字段用业务默认值伪装生产端缺失',
        // 陷阱#89教训：原规则检测所有||+业务默认值，误报率52%
        // 根因：没区分"核心业务字段"vs"错误/标识字段"
        //   堵漏：mat.roleLevel || 'npc' — roleLevel是核心业务字段，应生产端产出
        //   防御：errorMessage || 'unknown' — errorMessage是错误信息，兜底合理
        // 新规则：同一行内同时出现核心业务字段+业务默认值即判定为堵漏
        // 覆盖两种模式：
        //   1. mat.roleLevel || 'npc' — 字段直接在||左侧
        //   2. newMaterial.importance = extractXXX(...) || 'normal' — 字段在赋值目标
        // 核心业务字段清单：roleLevel/roleType/importance/significance
        // （新增核心业务字段时必须同步追加到此清单）
        codePattern: /\b(roleLevel|roleType|importance|significance)\b.*\|\|\s*('npc'|"npc"|'unknown'|"unknown"|'default'|"default"|'normal'|"normal"|'none'|"none"|'minor'|"minor"|'major'|"major"|'protagonist'|"protagonist"|'antagonist'|"antagonist")/g,
        examples: ["outlineEntitySync.js: mat.roleLevel || 'npc'", "materialCreateHelpers.js: newMaterial.importance = extractFieldFromContent(...) || 'normal'"]
    },
    {
        id: 'MODE4_POST_EXTRACT',
        severity: 'critical',
        description: '事后提取补救：从正文反向提取本应生产端直接输出的字段',
        filePattern: /(postExtractor|reverseExtractor|depthExtractor)\.js$/i,
        funcPattern: /\b(processChapterDepth|reverseExtract|postExtractFromContent)\s*\(/g,
        examples: ['materialRegistrar.js:processChapterDepth']
    }
];

// 白名单：允许保留的堵漏代码（必须满足6.4节白名单条件）
const WHITELIST = [
    {
        file: 'pipelinePostApproval.js',
        func: '_convertMmOutputToOrganizingPlan',
        reason: '跨系统适配：organizer失败时的fallback转换层',
        deleteCondition: 'material-organizer稳定运行30天无失败后删除'
    },
    {
        file: 'agentTemplateFallbacks.js',
        func: 'fallbackPersonality',
        reason: '优雅降级：LLM返回非结构化文本时的fallback提取',
        deleteCondition: '所有题材agent都输出结构化personality后删除'
    },
    {
        file: 'materialManager.js',
        func: 'markChapterProcessed',
        reason: '自然流程：material-manager步骤内部更新chapterUpdated，非外部补标记',
        deleteCondition: 'stateKVIndex.updateAfterOperations内部自动更新chapterUpdated后删除'
    },
    {
        file: 'materialRegistrar.js',
        func: 'markChapterProcessed',
        reason: '自然流程：material-registrar步骤内部更新chapterUpdated，非外部补标记',
        deleteCondition: 'stateKVIndex.updateAfterOperations内部自动更新chapterUpdated后删除'
    },
    {
        file: 'materialRegistrar.js',
        func: 'processChapterDepth',
        reason: '独立检测机制：深度指标提取用于characterArcGuard工具人化检测，非数据拼凑',
        deleteCondition: 'writer prompt直接输出深度指标计数后删除'
    },
    {
        file: 'contractMaterialEnricher.js',
        func: 'enrichMaterialsForContract',
        reason: '数据源统一层：统一契约校验与writer数据源，删除会导致契约校验误判阻断',
        deleteCondition: 'materials表stateJson直接包含深度字段后删除'
    },
    {
        file: 'characterDepthExtractor.js',
        func: 'processChapterDepth',
        reason: '独立检测机制：深度指标提取器，用于characterArcGuard工具人化检测',
        deleteCondition: 'writer prompt直接输出深度指标计数后删除'
    }
];

/**
 * 获取git新增/修改的文件列表
 */
function getChangedFiles() {
    try {
        const output = execSync('git diff --name-only HEAD', { encoding: 'utf8' });
        return output.split('\n').filter(f => f.endsWith('.js') && f.includes('server/'));
    } catch (e) {
        console.log('[audit-leak-fix] 无法获取git diff，跳过新增检测，执行全量扫描');
        return null;
    }
}

/**
 * 扫描文件内容检测堵漏模式
 */
function scanFile(filePath, content, patterns) {
    const findings = [];
    const fileName = path.basename(filePath);

    for (const pattern of patterns) {
        // 文件名模式检测
        if (pattern.filePattern && pattern.filePattern.test(fileName)) {
            findings.push({
                fileId: pattern.id,
                severity: pattern.severity,
                file: filePath,
                line: 0,
                type: 'filename',
                message: `${pattern.description}（文件名匹配: ${fileName}）`
            });
        }

        // 函数名模式检测（排除函数定义，只检测函数调用）
        if (pattern.funcPattern) {
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                pattern.funcPattern.lastIndex = 0;
                // 排除函数定义行：function xxx / async function xxx / async xxx(
                // 函数定义不是堵漏，只有函数调用才是
                const isFuncDef = /\b(function|async\s+function)\b/.test(line) ||
                                  /^async\s+\w+\s*\(/.test(line.trim());
                if (pattern.funcPattern.test(line) && !isFuncDef) {
                    findings.push({
                        fileId: pattern.id,
                        severity: pattern.severity,
                        file: filePath,
                        line: idx + 1,
                        type: 'function',
                        message: `${pattern.description}（函数调用匹配: ${line.trim().substring(0, 80)}）`
                    });
                }
            });
        }

        // 代码模式检测
        if (pattern.codePattern) {
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                pattern.codePattern.lastIndex = 0;
                if (pattern.codePattern.test(line) && !line.includes('//') && !line.includes('*')) {
                    findings.push({
                        fileId: pattern.id,
                        severity: pattern.severity,
                        file: filePath,
                        line: idx + 1,
                        type: 'code',
                        message: `${pattern.description}（代码模式匹配: ${line.trim().substring(0, 80)}）`
                    });
                }
            });
        }
    }

    return findings;
}

/**
 * 检查是否在白名单中
 * 支持两种匹配方式：
 * 1. 文件名+函数名匹配（函数调用类finding）
 * 2. 文件名匹配（文件名类finding，如MODE1_CONSUMER_MERGE）
 */
function isWhitelisted(file, line, message) {
    const fileName = path.basename(file);
    for (const w of WHITELIST) {
        if (fileName !== w.file) continue;
        // 函数名匹配
        if (message.includes(w.func)) return w;
        // 文件名匹配（用于MODE1_CONSUMER_MERGE等文件名检测）
        if (message.includes(fileName)) return w;
    }
    return null;
}

/**
 * 主函数
 */
function main() {
    const fullScan = process.argv.includes('--full');
    const ciMode = process.argv.includes('--ci');
    const changedFiles = fullScan ? null : getChangedFiles();

    console.log('=====================================');
    console.log(' audit-leak-fix.js — 堵漏式修复CI检测');
    console.log(' 陷阱#87：4类堵漏模式识别');
    console.log('=====================================\n');

    const targetFiles = changedFiles || scanAllPipelineFiles();
    if (!targetFiles || targetFiles.length === 0) {
        console.log('[audit-leak-fix] 无变更文件，跳过检测');
        process.exit(0);
    }

    console.log(`[audit-leak-fix] 扫描 ${targetFiles.length} 个文件\n`);

    let criticalCount = 0;
    let warningCount = 0;
    const allFindings = [];

    const fs = require('fs');
    for (const filePath of targetFiles) {
        if (!fs.existsSync(filePath)) continue;
        const content = fs.readFileSync(filePath, 'utf8');
        const findings = scanFile(filePath, content, LEAK_PATTERNS);

        for (const f of findings) {
            const whitelist = isWhitelisted(f.file, f.line, f.message);
            if (whitelist) {
                f.whitelisted = true;
                f.whitelistReason = whitelist.reason;
                f.deleteCondition = whitelist.deleteCondition;
            }
            allFindings.push(f);
            if (f.severity === 'critical' && !f.whitelisted) criticalCount++;
            if (f.severity === 'warning' && !f.whitelisted) warningCount++;
        }
    }

    // 输出结果
    if (allFindings.length === 0) {
        console.log('[audit-leak-fix] ✅ 未发现堵漏式修复代码');
        process.exit(0);
    }

    console.log('--- 检测结果 ---\n');

    const critical = allFindings.filter(f => f.severity === 'critical' && !f.whitelisted);
    const warnings = allFindings.filter(f => f.severity === 'warning' && !f.whitelisted);
    const whitelisted = allFindings.filter(f => f.whitelisted);

    if (critical.length > 0) {
        console.log(`❌ CRITICAL（新增堵漏，阻断CI）: ${critical.length} 处`);
        critical.forEach(f => {
            console.log(`   ${f.file}:${f.line}`);
            console.log(`     ${f.message}`);
        });
        console.log('');
    }

    if (warnings.length > 0) {
        console.log(`⚠️  WARNING（fallback默认值，需审查）: ${warnings.length} 处`);
        warnings.slice(0, 10).forEach(f => {
            console.log(`   ${f.file}:${f.line}`);
            console.log(`     ${f.message}`);
        });
        if (warnings.length > 10) console.log(`   ... 还有 ${warnings.length - 10} 处`);
        console.log('');
    }

    if (whitelisted.length > 0) {
        console.log(`✅ WHITELIST（白名单允许）: ${whitelisted.length} 处`);
        whitelisted.forEach(f => {
            console.log(`   ${f.file}:${f.line}`);
            console.log(`     ${f.whitelistReason}`);
            console.log(`     删除条件: ${f.deleteCondition}`);
        });
        console.log('');
    }

    // 退出码
    // CI模式（--ci）：critical阻断（退出码1），warning不阻断（退出码0）
    // 全量模式（--full）：critical阻断（退出码1），warning警告（退出码2）
    if (criticalCount > 0) {
        console.log(`[audit-leak-fix] ❌ 发现 ${criticalCount} 处新增堵漏，阻断CI`);
        console.log('[audit-leak-fix] 请按SOP 04-bug修复.md 第六节"堵漏式修复禁令"执行源头修复6步法');
        process.exit(1);
    }

    if (warningCount > 0) {
        console.log(`[audit-leak-fix] ⚠️ 发现 ${warningCount} 处fallback默认值，请审查是否符合白名单条件`);
        if (ciMode) {
            console.log('[audit-leak-fix] CI模式：warning不阻断，请尽快审查');
            process.exit(0);
        }
        process.exit(2);
    }

    console.log('[audit-leak-fix] ✅ 检测通过');
    process.exit(0);
}

/**
 * 扫描所有pipeline文件
 */
function scanAllPipelineFiles() {
    const fs = require('fs');
    const files = [];

    function walkDir(dir) {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                walkDir(fullPath);
            } else if (item.endsWith('.js')) {
                files.push(fullPath);
            }
        }
    }

    if (fs.existsSync(PIPELINE_DIR)) {
        walkDir(PIPELINE_DIR);
    }

    return files;
}

main();
