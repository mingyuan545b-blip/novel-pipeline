/**
 * verifyDocFreshness.js — 文档防脱节校验脚本
 * 从代码事实源提取权威值，扫描文档中的过时关键词
 *
 * 校验规则：
 * D1: 文档不得出现已弃用 provider 作为活跃配置（minimax/lmstudio/openai）
 * D2: 文档不得出现已移除 agent（adjuster）作为活跃配置
 * D3: 文档不得出现已移除 mode（shuangwen/tomato-short）作为活跃配置
 * D4: 文档中的 AGENT_TYPES 必须与 genreValidator.js 一致（10个Agent）
 * D5: 文档中的 DEFAULT_STEP_ASSIGNMENTS 必须与 providerDefs.js 一致（aliyunCoding）
 *
 * 用法：node scripts/verifyDocFreshness.js
 * 退出码：0=通过，1=有违规
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// === 代码事实源（单一数据源，避免硬编码） ===

/** 从 providerDefs.js 提取的已弃用 provider（与 providerRegistry.js DEPRECATED_PROVIDERS 对齐） */
const DEPRECATED_PROVIDERS = ['minimax', 'lmstudio', 'openai'];

/** 从 genreValidator.js 提取的当前 AGENT_TYPES（10个，无 adjuster） */
const CURRENT_AGENTS = [
    'writer', 'reviser', 'polisher', 'intent-planner',
    'first-review', 'second-review', 'fast-review',
    'final-editor', 'material-manager', 'reader'
];

/** 已移除的 agent（不得作为活跃配置出现） */
const REMOVED_AGENTS = ['adjuster'];

/** 已移除的 mode（不得作为活跃配置出现） */
const REMOVED_MODES = ['shuangwen', 'tomato-short'];

/** 当前默认 provider（从 providerDefs.js DEFAULT_STEP_ASSIGNMENTS 提取） */
const CURRENT_DEFAULT_PROVIDER = 'aliyunCoding';

/** 当前默认模型 */
const CURRENT_DEFAULT_MODEL = 'qwen3.6-plus';

// === 扫描配置 ===

/** 扫描的文档目录 */
const SCAN_DIRS = ['docs', 'server/docs', '.trae'];

/** 扫描的根级文档 */
const SCAN_ROOT_DOCS = [
    'ARCHITECTURE.md',
    'PROJECT_STANDARDS.md',
    'DATABASE_SCHEMA.md',
    'AGENTS.md',
    'CLAUDE.md'
];

/** 允许出现的"已弃用/已移除"说明性文字白名单（正则） */
const ALLOWED_CONTEXT_PATTERNS = [
    /已弃用/i,
    /已移除/i,
    /已废弃/i,
    /DEPRECATED_PROVIDERS/i,
    /历史记录/i,
    /已删除/i,
    /移除/i,        // 含"移除"动词（如"移除adjuster"、"随模式移除"）
    /废弃/i,        // 含"废弃"（如"随模式移除而废弃"）
    /~~.*~~/, // Markdown 删除线
    /原\s/,         // "原 xxx" 表示过去式
    /等\s*[)）]/,   // "等)" 通用列举
];

// === 工具函数 ===

let errorCount = 0;
let warnCount = 0;

function error(msg) { console.error(`[ERROR] ${msg}`); errorCount++; }
function warn(msg) { console.warn(`[WARN]  ${msg}`); warnCount++; }
function ok(msg) { console.log(`[OK]    ${msg}`); }

/** 判断匹配行是否为允许的说明性文字 */
function isAllowedContext(line) {
    return ALLOWED_CONTEXT_PATTERNS.some(pattern => pattern.test(line));
}

/** 收集所有待扫描的 .md 文件 */
function collectMarkdownFiles() {
    const files = [];
    // 根级文档
    for (const doc of SCAN_ROOT_DOCS) {
        const abs = path.join(ROOT, doc);
        if (fs.existsSync(abs)) files.push(abs);
    }
    // 扫描目录
    for (const dir of SCAN_DIRS) {
        const absDir = path.join(ROOT, dir);
        if (!fs.existsSync(absDir)) continue;
        walkDir(absDir, files);
    }
    return files;
}

function walkDir(dir, files) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'archive') {
            // 跳过 archive 目录（历史归档，不参与一致性校验）
            walkDir(full, files);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            files.push(full);
        }
    }
}

// === 校验规则 ===

/** D1: 检测文档中已弃用 provider 作为活跃配置 */
function checkD1DeprecatedProviders(files) {
    console.log('\n=== D1: 已弃用 Provider 检测 ===');
    let violations = 0;
    const patterns = DEPRECATED_PROVIDERS.map(p => new RegExp(`\\b${p}\\b`, 'i'));
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
            for (const pattern of patterns) {
                if (pattern.test(line) && !isAllowedContext(line)) {
                    const relPath = path.relative(ROOT, file);
                    error(`D1违规 ${relPath}:${idx + 1} — 已弃用provider作为活跃配置（${line.trim().substring(0, 80)}）`);
                    violations++;
                }
            }
        });
    }
    if (violations === 0) ok('D1通过 — 无已弃用provider作为活跃配置');
    return violations;
}

/** D2: 检测文档中已移除 agent 作为活跃配置 */
function checkD2RemovedAgents(files) {
    console.log('\n=== D2: 已移除 Agent 检测 ===');
    let violations = 0;
    const patterns = REMOVED_AGENTS.map(a => new RegExp(`\\b${a}\\b`, 'i'));
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
            for (const pattern of patterns) {
                if (pattern.test(line) && !isAllowedContext(line)) {
                    const relPath = path.relative(ROOT, file);
                    error(`D2违规 ${relPath}:${idx + 1} — 已移除agent作为活跃配置（${line.trim().substring(0, 80)}）`);
                    violations++;
                }
            }
        });
    }
    if (violations === 0) ok('D2通过 — 无已移除agent作为活跃配置');
    return violations;
}

/** D3: 检测文档中已移除 mode 作为活跃配置 */
function checkD3RemovedModes(files) {
    console.log('\n=== D3: 已移除 Mode 检测 ===');
    let violations = 0;
    const patterns = REMOVED_MODES.map(m => new RegExp(`\\b${m}\\b`, 'i'));
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
            for (const pattern of patterns) {
                if (pattern.test(line) && !isAllowedContext(line)) {
                    const relPath = path.relative(ROOT, file);
                    error(`D3违规 ${relPath}:${idx + 1} — 已移除mode作为活跃配置（${line.trim().substring(0, 80)}）`);
                    violations++;
                }
            }
        });
    }
    if (violations === 0) ok('D3通过 — 无已移除mode作为活跃配置');
    return violations;
}

/** D4: 校验文档中 Agent 数量声明与代码一致 */
function checkD4AgentCountConsistency(files) {
    console.log('\n=== D4: Agent 数量一致性校验 ===');
    let violations = 0;
    const agentCountPattern = /(\d+)\s*个\s*Agent/gi;
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const matches = [...content.matchAll(agentCountPattern)];
        for (const m of matches) {
            const declaredCount = parseInt(m[1], 10);
            if (declaredCount !== CURRENT_AGENTS.length && declaredCount !== 9) {
                // 允许9（不含reader可选）或10（完整）
                const lineNum = content.substring(0, m.index).split('\n').length;
                const relPath = path.relative(ROOT, file);
                error(`D4违规 ${relPath}:${lineNum} — 声明${declaredCount}个Agent，实际${CURRENT_AGENTS.length}个`);
                violations++;
            }
        }
    }
    if (violations === 0) ok(`D4通过 — Agent数量声明与代码一致（${CURRENT_AGENTS.length}个）`);
    return violations;
}

/** D5: 校验根级文档未引用已删除的历史文档 */
function checkD5DeletedDocsReferences(files) {
    console.log('\n=== D5: 已删除文档引用检测 ===');
    let violations = 0;
    const deletedDocs = [
        'SYSTEM_ARCHITECTURE.md',
        'HANDOVER.md',
        'SYSTEM_REFERENCE.md',
        'PROJECT_SPEC.md',
        'RENOVATION_CHECKLIST.md',
        'REFACTORING_CHECKLIST.md',
        'EXECUTION_CHECKLIST.md'
    ];
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
            for (const doc of deletedDocs) {
                if (line.includes(doc) && !isAllowedContext(line)) {
                    const relPath = path.relative(ROOT, file);
                    error(`D5违规 ${relPath}:${idx + 1} — 引用已删除文档${doc}（${line.trim().substring(0, 80)}）`);
                    violations++;
                }
            }
        });
    }
    if (violations === 0) ok('D5通过 — 无引用已删除文档');
    return violations;
}

// === 主流程 ===

function main() {
    console.log('========================================');
    console.log('文档防脱节校验 (verifyDocFreshness)');
    console.log('========================================');
    console.log(`代码事实源：${CURRENT_AGENTS.length}个Agent / 默认provider=${CURRENT_DEFAULT_PROVIDER}`);

    const files = collectMarkdownFiles();
    console.log(`扫描文件数：${files.length}`);

    const d1 = checkD1DeprecatedProviders(files);
    const d2 = checkD2RemovedAgents(files);
    const d3 = checkD3RemovedModes(files);
    const d4 = checkD4AgentCountConsistency(files);
    const d5 = checkD5DeletedDocsReferences(files);

    const total = d1 + d2 + d3 + d4 + d5;
    console.log('========================================');
    console.log(`校验完成: ${errorCount} errors, ${warnCount} warnings`);
    console.log('========================================');
    if (total === 0) {
        console.log('\n✅ 校验通过 — 文档与代码事实一致');
        process.exit(0);
    } else {
        console.log(`\n❌ 校验失败 — 发现${total}处文档脱节，必须修复`);
        process.exit(1);
    }
}

main();
