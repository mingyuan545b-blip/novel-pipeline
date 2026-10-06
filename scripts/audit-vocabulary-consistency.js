#!/usr/bin/env node
/**
 * 词汇表一致性闸门（P2-A）
 * 根治"消费端各自维护词汇表 → 漂移 → 点状打补丁"的结构性缺陷。
 *
 * 本闸门当前覆盖（后续步骤继续扩展）：
 *   #4 章节状态：代码写入的 status ⊆ chapterStatus.ALL_STATUSES
 *      4a statusMap / *statusMap* 对象字面量的值
 *      4b 章节流程范围内 `.status = '字面量'` 的赋值
 *      4c 状态机迁移表引用（VALID_TRANSITIONS）
 *      4d 前端生成常量与后端单一源一致（chapterStatusConstants.js）
 *      4e 前端状态展示表 CHAPTER_STATUS_META 的键
 * 用法：node scripts/audit-vocabulary-consistency.js [--json] [--warn]
 *   默认有违规 exit 1；--warn 只提示不失败。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const status = require('../server/services/chapterStatus');
const { VALID_TRANSITIONS, ALL_STATUSES } = status;

const ROOT = path.join(__dirname, '..');
const VALID = new Set(ALL_STATUSES);

function walk(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir)) {
        if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
        const p = path.join(dir, name);
        const st = fs.statSync(p);
        if (st.isDirectory()) walk(p, out);
        else if (p.endsWith('.js') && !p.includes('.test.') && !p.includes('/__tests__/')) out.push(p);
    }
    return out;
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

// ---- 4a: statusMap 值 ----
/** 纯函数：抽取 statusMap 对象字面量的"值"（键是步骤名，不算状态） */
function extractStatusMapValues(src) {
    const out = [];
    const re = /\b\w*statusMap\w*\s*[:=]\s*\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(src))) {
        out.push(...[...m[1].matchAll(/:\s*['"]([a-z][a-z0-9-]*)['"]/g)].map(x => x[1]));
    }
    return out;
}

function checkStatusMap() {
    const v = [];
    const files = [...walk(path.join(ROOT, 'server')), ...walk(path.join(ROOT, 'client', 'src'))];
    for (const f of files) {
        for (const val of extractStatusMapValues(fs.readFileSync(f, 'utf8'))) {
            if (!VALID.has(val)) v.push({ check: '4a', file: rel(f), detail: `statusMap 值 "${val}" 不在 ALL_STATUSES` });
        }
    }
    return v;
}

// ---- 4b: 章节流程范围内 .status = '字面量' ----
const CHAPTER_SCOPES = ['server/core/pipeline', 'server/services/pipeline', 'server/services/chapterStateMachine.js'];
function checkChapterStatusAssignments() {
    const v = [];
    for (const scope of CHAPTER_SCOPES) {
        const p = path.join(ROOT, scope);
        const files = fs.existsSync(p) && fs.statSync(p).isDirectory() ? walk(p) : (fs.existsSync(p) ? [p] : []);
        for (const f of files) {
            const src = fs.readFileSync(f, 'utf8');
            const re = /\.status\s*=\s*['"]([a-z][a-z0-9-]*)['"]/g;
            let m;
            while ((m = re.exec(src))) {
                if (!VALID.has(m[1])) v.push({ check: '4b', file: rel(f), detail: `.status 赋值 "${m[1]}" 不在 ALL_STATUSES` });
            }
        }
    }
    return v;
}

// ---- 4c: 迁移表引用 ----
function checkStateMachineRefs() {
    const v = [];
    for (const [from, tos] of Object.entries(VALID_TRANSITIONS)) {
        if (!VALID.has(from)) v.push({ check: '4c', file: 'server/services/chapterStatus.js', detail: `迁移表 from "${from}" 非法` });
        for (const to of tos) if (!VALID.has(to)) v.push({ check: '4c', file: 'server/services/chapterStatus.js', detail: `迁移表 to "${to}" 非法` });
    }
    return v;
}

// ---- 4d: 前端生成常量同步 ----
function checkClientConstantsSync() {
    try {
        execFileSync('node', [path.join(__dirname, 'generateChapterStatusConstants.js'), '--check'], { stdio: 'pipe' });
        return [];
    } catch (e) {
        return [{ check: '4d', file: 'client/src/shared/chapterStatusConstants.js', detail: '与后端单一源不一致（运行 node scripts/generateChapterStatusConstants.js）' }];
    }
}

// ---- 4e: 前端状态展示表键 ----
const CLIENT_STATUS_MAP_FILES = ['client/src/pages/progress/progressConstants.js'];
function checkClientStatusMaps() {
    const v = [];
    for (const rf of CLIENT_STATUS_MAP_FILES) {
        const f = path.join(ROOT, rf);
        if (!fs.existsSync(f)) continue;
        const src = fs.readFileSync(f, 'utf8');
        const re = /CHAPTER_STATUS_META\s*=\s*\{([\s\S]*?)\n\};/g;
        let m;
        while ((m = re.exec(src))) {
            const keys = [...m[1].matchAll(/^\s*['"]?([a-z][a-z0-9-]*)['"]?\s*:/gm)].map(x => x[1]);
            for (const k of keys) if (!VALID.has(k)) v.push({ check: '4e', file: rf, detail: `状态键 "${k}" 不在 ALL_STATUSES` });
        }
    }
    return v;
}

const CHECKS = [checkStatusMap, checkChapterStatusAssignments, checkStateMachineRefs, checkClientConstantsSync, checkClientStatusMaps];

function main() {
    const json = process.argv.includes('--json');
    const warn = process.argv.includes('--warn');
    let violations = [];
    for (const c of CHECKS) violations = violations.concat(c());
    if (json) { console.log(JSON.stringify({ ok: violations.length === 0, violations }, null, 2)); }
    else if (violations.length === 0) { console.log('✓ 词汇表一致性：0 违规（章节状态词汇表单一源）'); }
    else {
        console.error(`✗ 词汇表一致性：${violations.length} 处违规`);
        for (const x of violations) console.error(`  [${x.check}] ${x.file} — ${x.detail}`);
    }
    if (violations.length > 0 && !warn) process.exit(1);
}

if (require.main === module) main();
module.exports = { extractStatusMapValues, checkStatusMap, checkChapterStatusAssignments, checkStateMachineRefs, checkClientConstantsSync, checkClientStatusMaps };
