/**
 * verifyReachability.js — 关键导出"可达性"门禁
 *
 * 背景（R1/R2、F4/F11，见 docs/worklog/2026-10-17-假成果审查-问题统计.md）：
 * 既有门禁只验"文本存在"（grep 字符串/函数名/lint），无法发现"函数有定义但全仓无人调用"的死导出。
 * 典型事故：validationEngine.recordTechniqueResult 有实现、有文档、有"自动禁用"叙事，但 0 个调用点，
 * 技法成功率数据永远为空，且没有任何门禁报警。
 *
 * 本门禁对"关键子系统导出"建立可达性断言：CRITICAL_EXPORTS 中的导出，必须在自己文件之外
 * 至少有 1 处运行时引用（排除 test）。否则视为"假成果"并 exit 1。
 * 另附"服务内部疑似死导出"普查（仅 WARN，不阻断）。
 *
 * 用法：node scripts/verifyReachability.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server');

let errorCount = 0;
let warnCount = 0;
const error = (m) => { console.error('[ERROR] ' + m); errorCount++; };
const warn = (m) => { console.warn('[WARN]  ' + m); warnCount++; };
const ok = (m) => console.log('[OK]    ' + m);

const CRITICAL_EXPORTS = [
    { file: 'services/prompts/constraintFeedbackCollector.js', name: 'collectConstraintFeedback', why: 'F2 约束反馈闭环唯一收集器' },
    { file: 'services/pipeline/modules/constraintFeedbackModule.js', name: 'registerConstraintFeedbackModule', why: 'F2 约束反馈模块注册入口' },
    { file: 'services/prompts/constraintDetectionRegistry.js', name: 'runAllMetaConstraintDetections', why: 'F1 T0 元约束检测入口' },
    { file: 'services/validationEngine.js', name: 'recordTechniqueResults', why: 'F4 技法结果批量回写' },
    { file: 'services/chapterAuditor/hardBlockChecks.js', name: '_buildTechniqueHints', why: 'F6 初审技法提示' },
    { file: 'services/pipeline/techniqueFeedback.js', name: 'recordFeedback', why: '技法效果反馈闭环写入' },
];

// 无正则实现（避免转义层次问题）：词法工具
const WORD_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_$';
const IDENT_START = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
function isWordChar(c) { return WORD_CHARS.indexOf(c) !== -1; }
function isIdent(s) {
    if (!s || IDENT_START.indexOf(s[0]) === -1) return false;
    for (const c of s) if (!isWordChar(c)) return false;
    return true;
}

function listJsFiles(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listJsFiles(full));
        else if (entry.name.endsWith('.js')) out.push(full);
    }
    return out;
}

const ALL_SERVER_FILES = listJsFiles(SERVER);
const FILE_CACHE = new Map();
function contentOf(f) {
    if (!FILE_CACHE.has(f)) FILE_CACHE.set(f, fs.readFileSync(f, 'utf8'));
    return FILE_CACHE.get(f);
}

function isTestFile(f) {
    if (f.endsWith('.test.js')) return true;
    const parts = f.split(path.sep);
    return parts.includes('__tests__') || parts.includes('test') || parts.includes('spec');
}

/** 统计标识符（含词边界）在源码中的出现次数 */
function countWord(src, name) {
    let n = 0;
    let i = 0;
    while ((i = src.indexOf(name, i)) !== -1) {
        const before = i > 0 ? src[i - 1] : '';
        const after = src[i + name.length] || '';
        if ((!before || !isWordChar(before)) && (!after || !isWordChar(after))) n++;
        i += name.length;
    }
    return n;
}

function countExternalRefs(name, definingFile) {
    let hits = 0;
    for (const f of ALL_SERVER_FILES) {
        if (f === definingFile) continue;
        if (isTestFile(f)) continue;
        hits += countWord(contentOf(f), name);
    }
    return hits;
}

/** 提取 module.exports = {...} 的具名导出（花括号配平） */
function objectExports(src) {
    const names = new Set();
    const marker = 'module.exports = {';
    const idx = src.indexOf(marker);
    if (idx === -1) return names;
    let i = idx + marker.length - 1;
    let depth = 0;
    let end = -1;
    for (; i < src.length; i++) {
        const c = src[i];
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) return names;
    const body = src.slice(idx + marker.length, end);
    for (const part of body.split(',')) {
        const key = part.split(':')[0].trim();
        if (isIdent(key)) names.add(key);
    }
    return names;
}

/** 提取 exports.name = ... 形式 */
function assignedExports(src) {
    const names = new Set();
    const marker = 'exports.';
    let i = 0;
    while ((i = src.indexOf(marker, i)) !== -1) {
        let j = i + marker.length;
        let k = j;
        while (k < src.length && isWordChar(src[k])) k++;
        const name = src.slice(j, k);
        let t = k;
        while (t < src.length && (src[t] === ' ' || src[t] === '\t')) t++;
        if (isIdent(name) && src[t] === '=' && src[t + 1] !== '=') names.add(name);
        i = k;
    }
    return names;
}

function namedExportsOf(file) {
    const src = contentOf(file);
    const names = objectExports(src);
    for (const n of assignedExports(src)) names.add(n);
    return names;
}

function checkCriticalExports() {
    console.log('\n-- 关键导出可达性 --');
    for (const item of CRITICAL_EXPORTS) {
        const abs = path.join(SERVER, item.file);
        if (!fs.existsSync(abs)) { error('关键导出缺失：server/' + item.file + ' 不存在（' + item.why + '）'); continue; }
        if (countWord(contentOf(abs), item.name) === 0) { error('server/' + item.file + ' 未定义 ' + item.name + '（' + item.why + '）'); continue; }
        const refs = countExternalRefs(item.name, abs);
        if (refs === 0) error('死导出：' + item.name + '（server/' + item.file + '）在自己文件外 0 引用 — 功能不可达（' + item.why + '）');
        else ok(item.name + ': ' + refs + ' 处外部引用（' + item.why + '）');
    }
}

function checkSuspectedDeadExports() {
    console.log('\n-- 服务内部疑似死导出（仅 WARN）--');
    let count = 0;
    for (const f of ALL_SERVER_FILES) {
        const parts = f.split(path.sep);
        if (!parts.includes('services')) continue;
        for (const name of namedExportsOf(f)) {
            if (countExternalRefs(name, f) === 0) {
                warn('疑似死导出：' + name + '（server/' + path.relative(SERVER, f).split(path.sep).join('/') + '）外部 0 引用');
                count++;
            }
        }
    }
    console.log('疑似死导出合计: ' + count + '（人工收敛，不阻断）');
}

function main() {
    console.log('========================================');
    console.log('关键导出的运行时可达性校验');
    console.log('========================================');
    checkCriticalExports();
    checkSuspectedDeadExports();
    console.log('\n========================================');
    console.log('校验完成: ' + errorCount + ' errors, ' + warnCount + ' warnings');
    console.log('========================================');
    if (errorCount > 0) {
        console.error('\n❌ 可达性校验失败 — 存在"已实现但运行时不可达"的导出');
        process.exit(1);
    }
    console.log('\n✅ 可达性校验通过');
    process.exit(0);
}

main();
