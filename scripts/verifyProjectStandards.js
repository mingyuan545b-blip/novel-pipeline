/**
 * verifyProjectStandards.js — PROJECT_STANDARDS.md原则的机器校验脚本
 * 把md里的规则变成CI可执行的校验，让机器替代人记忆
 *
 * 校验规则（对应PROJECT_STANDARDS.md原则）：
 * R1: 第9条 DataContext统一数据入口 — Agent不得直接调用store
 * R2: 第8条 两套系统对齐 — pipeline和chapterAuditor检测函数集合一致
 * R3: 第1条 禁止硬编码业务规则 — Agent模板不得出现业务关键词
 * R4: 单文件不超过200行（用户铁律）
 * R5: 第16条 字数检查覆盖所有输出点
 *
 * 用法：node scripts/verifyProjectStandards.js
 * 退出码：0=通过，1=有违规
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
    R1_WHITELIST, R1_SCAN_DIRS, R1_VIOLATION_PATTERNS,
    R3_FORBIDDEN_BUSINESS_TERMS, R4_MAX_LINES, R5_REQUIRED_CHECKPOINTS,
    scanJsFiles,
} = require('./projectStandardsRules');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server');

let errorCount = 0;
let warnCount = 0;

function error(msg) { console.error(`[ERROR] ${msg}`); errorCount++; }
function warn(msg) { console.warn(`[WARN]  ${msg}`); warnCount++; }
function ok(msg) { console.log(`[OK]    ${msg}`); }

function readFileContent(absPath) {
    if (!fs.existsSync(absPath)) return null;
    return fs.readFileSync(absPath, 'utf8');
}

/** R1: 校验Agent不得直接调用store（白名单除外） */
function checkR1DataContextEnforcement() {
    console.log('\n=== R1: 第9条 DataContext统一数据入口校验 ===');
    let violations = 0;
    for (const scanDir of R1_SCAN_DIRS) {
        const absDir = path.join(ROOT, scanDir);
        const files = scanJsFiles(absDir);
        for (const file of files) {
            const fileName = path.basename(file);
            if (R1_WHITELIST.has(fileName)) continue;
            const content = readFileContent(file);
            if (!content) continue;
            for (const pattern of R1_VIOLATION_PATTERNS) {
                const matches = [...content.matchAll(pattern)];
                if (matches.length > 0) {
                    const relPath = path.relative(ROOT, file);
                    for (const m of matches) {
                        const lineNum = content.substring(0, m.index).split('\n').length;
                        error(`R1违规 ${relPath}:${lineNum} — Agent直接调用${m[0].replace(/\s*\(/, '(')}（应通过DataContext）`);
                        violations++;
                    }
                }
            }
        }
    }
    if (violations === 0) ok('R1通过 — Agent业务逻辑无直接store调用');
    return violations;
}

/** R2: 校验pipeline和chapterAuditor检测函数集合对齐 */
function checkR2PipelineAuditorAlignment() {
    console.log('\n=== R2: 第8条 两套系统检测函数对齐校验 ===');
    // pipeline实际逻辑在server/services/pipeline/目录，chapterAuditor在server/services/chapterAuditor/目录
    const pipelineDir = path.join(SERVER, 'services', 'pipeline');
    const auditorDir = path.join(SERVER, 'services', 'chapterAuditor');
    if (!fs.existsSync(pipelineDir) || !fs.existsSync(auditorDir)) {
        warn('R2跳过 — pipeline或chapterAuditor目录不存在');
        return 0;
    }
    const detectFuncPattern = /detect[A-Z]\w*/g;
    // 扫描pipeline目录所有js文件的detect函数
    const pipelineFiles = scanJsFiles(pipelineDir);
    const pipelineDetections = new Set();
    for (const f of pipelineFiles) {
        const c = readFileContent(f);
        if (c) [...c.matchAll(detectFuncPattern)].forEach(m => pipelineDetections.add(m[0]));
    }
    // 扫描chapterAuditor目录所有js文件的detect函数
    const auditorFiles = scanJsFiles(auditorDir);
    const auditorDetections = new Set();
    for (const f of auditorFiles) {
        const c = readFileContent(f);
        if (c) [...c.matchAll(detectFuncPattern)].forEach(m => auditorDetections.add(m[0]));
    }
    // 只对比两套系统都应该有的硬性检测函数（排除pipeline独有的非检测类函数）
    const HARD_BLOCK_DETECTS = [
        'detectModernSlang', 'detectAdultPerspective', 'detectTechJargon',
        'detectPipelineMetadataLeak', 'detectCrossChapterRepetition',
    ];
    let violations = 0;
    for (const d of HARD_BLOCK_DETECTS) {
        if (!pipelineDetections.has(d)) {
            error(`R2违规 — 硬性检测函数${d}在pipeline目录缺失`);
            violations++;
        }
        if (!auditorDetections.has(d)) {
            error(`R2违规 — 硬性检测函数${d}在chapterAuditor目录缺失`);
            violations++;
        }
    }
    if (violations === 0) ok(`R2通过 — 两套系统硬性检测函数对齐（共${HARD_BLOCK_DETECTS.length}个）`);
    return violations;
}

/** R3: 校验Agent模板不得硬编码业务关键词 */
function checkR3NoHardcodedBusinessRules() {
    console.log('\n=== R3: 第1条 禁止硬编码业务规则校验 ===');
    const agentPromptPath = path.join(SERVER, 'services', 'agentPrompts.js');
    const content = readFileContent(agentPromptPath);
    if (!content) {
        warn('R3跳过 — agentPrompts.js不存在');
        return 0;
    }
    let violations = 0;
    for (const term of R3_FORBIDDEN_BUSINESS_TERMS) {
        const idx = content.indexOf(term);
        if (idx >= 0) {
            const lineNum = content.substring(0, idx).split('\n').length;
            error(`R3违规 agentPrompts.js:${lineNum} — 硬编码业务词"${term}"（应通过styleProfile注入）`);
            violations++;
        }
    }
    if (violations === 0) ok('R3通过 — Agent模板无硬编码业务规则');
    return violations;
}

/** R4: 校验单文件不超过200行 */
function checkR4FileLineLimit() {
    console.log('\n=== R4: 单文件200行上限校验 ===');
    const scanDirs = [
        'server/services/pipeline',
        'server/services/pipeline/steps',
        'server/services/pipeline/steps/review',
        'server/services/pipeline/steps/writer',
        'server/services/pipeline/infinite',
        'server/services/pipeline/pipelineHelpers',
    ];
    let violations = 0;
    const checkedFiles = new Set();
    for (const scanDir of scanDirs) {
        const absDir = path.join(ROOT, scanDir);
        const files = scanJsFiles(absDir);
        for (const file of files) {
            if (checkedFiles.has(file)) continue;
            checkedFiles.add(file);
            const content = readFileContent(file);
            if (!content) continue;
            const lineCount = content.split('\n').length;
            if (lineCount > R4_MAX_LINES) {
                const relPath = path.relative(ROOT, file);
                error(`R4违规 ${relPath} — ${lineCount}行超过${R4_MAX_LINES}行上限`);
                violations++;
            }
        }
    }
    if (violations === 0) ok('R4通过 — 所有文件在200行上限内');
    return violations;
}

/** R5: 校验字数检查覆盖所有输出点 */
function checkR5WordCountCheckpoints() {
    console.log('\n=== R5: 第16条 字数检查覆盖所有输出点校验 ===');
    // 检查点定义统一来自projectStandardsRules.js的R5_REQUIRED_CHECKPOINTS（单一数据源）
    // 字数检查实际分布位置（通过D6审查确认）：
    // writer → writerPostProcess.js
    // reviser → reviserWordGuard.js
    // final-editor → finalEditor.js
    // polisher → pipelinePostApproval.js（编排层，非polisher.js本身）
    // review前 → wordCountGate.js
    let violations = 0;
    for (const checkpoint of R5_REQUIRED_CHECKPOINTS) {
        const absPath = path.join(ROOT, checkpoint.file);
        const content = readFileContent(absPath);
        if (!content) {
            warn(`R5跳过 — ${checkpoint.file}不存在`);
            continue;
        }
        if (!content.includes(checkpoint.keyword)) {
            error(`R5违规 ${checkpoint.file} — ${checkpoint.label}缺少字数检查（关键词"${checkpoint.keyword}"）`);
            violations++;
        }
    }
    if (violations === 0) ok('R5通过 — 所有关键输出点都有字数检查');
    return violations;
}

function main() {
    console.log('========================================');
    console.log('PROJECT_STANDARDS 原则机器校验');
    console.log('========================================');
    const r1 = checkR1DataContextEnforcement();
    const r2 = checkR2PipelineAuditorAlignment();
    const r3 = checkR3NoHardcodedBusinessRules();
    const r4 = checkR4FileLineLimit();
    const r5 = checkR5WordCountCheckpoints();
    const total = r1 + r2 + r3 + r4 + r5;
    console.log('========================================');
    console.log(`校验完成: ${errorCount} errors, ${warnCount} warnings`);
    console.log('========================================');
    if (total === 0) {
        console.log('\n✅ 校验通过 — PROJECT_STANDARDS原则全部遵守');
        process.exit(0);
    } else {
        console.log(`\n❌ 校验失败 — 发现${total}处违规，必须修复`);
        process.exit(1);
    }
}

main();
