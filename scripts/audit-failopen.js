/**
 * audit-failopen.js — fail-open（只 log 不处理）审计门禁
 *
 * 背景（R4，见 docs/worklog/2026-10-17-假成果审查-问题统计.md）：
 * 全仓 catch 块中大量"只 logger.warn/debug 后继续"，异常被静默降级 → 失败不可见、不告警、不阻断。
 * 本脚本统计基线并纳入 CI：fail-open 计数只许下降，不许上升（新增降级必须显式声明后果）。
 *
 * 计数口径与 2026-10-17 审计一致（行内单行 catch 体含 logger.warn/debug 即计一次，为下界）。
 * 用法：node scripts/audit-failopen.js [--update-baseline]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server');
const BASELINE_FILE = path.join(ROOT, 'docs', 'failopen-baseline.json');

const BS = String.fromCharCode(92);
// 行级判定，口径与 §三.1 的 grep -En 一致（单行 catch 体只含 logger.warn/debug）
const CATCH_LINE = new RegExp('catch' + BS + 's*' + BS + '(');
const FAILOPEN_LINE = new RegExp(
    'catch' + BS + 's*' + BS + '([^)]*' + BS + ')' + BS + 's*' + BS + '{'
    + '[^}]*logger' + BS + '.' + '(warn|debug)[^}]*' + BS + '}'
);

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

function countMatches(re, src) {
    let n = 0;
    for (const line of src.split('\n')) if (re.test(line)) n++;
    return n;
}

function scan() {
    const files = listJsFiles(SERVER);
    let totalCatch = 0;
    let failOpen = 0;
    let pipelineCatch = 0;
    let pipelineFailOpen = 0;
    for (const f of files) {
        const src = fs.readFileSync(f, 'utf8');
        const c = countMatches(CATCH_LINE, src);
        const fo = countMatches(FAILOPEN_LINE, src);
        totalCatch += c;
        failOpen += fo;
        if (f.split(path.sep).includes('pipeline')) { pipelineCatch += c; pipelineFailOpen += fo; }
    }
    return { totalCatch, failOpen, pipelineCatch, pipelineFailOpen };
}

function main() {
    const cur = scan();
    const update = process.argv.includes('--update-baseline');
    console.log('========================================');
    console.log('fail-open 审计（只 log 不处理）');
    console.log('========================================');
    console.log(JSON.stringify(cur, null, 2));

    if (update || !fs.existsSync(BASELINE_FILE)) {
        const payload = {
            _comment: 'fail-open 基线（docs/worklog/2026-10-17-假成果审查-问题统计.md §三.1）。计数只许下降。',
            measuredAt: new Date().toISOString().slice(0, 10),
            ...cur,
        };
        fs.writeFileSync(BASELINE_FILE, JSON.stringify(payload, null, 2) + '\n');
        console.log('\n[基线已写入] ' + path.relative(ROOT, BASELINE_FILE));
        process.exit(0);
    }

    const base = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    let failed = false;
    for (const key of ['failOpen', 'pipelineFailOpen']) {
        if (cur[key] > base[key]) {
            console.error(`[ERROR] ${key} 上升：${base[key]} → ${cur[key]}（新增静默降级未声明后果）`);
            failed = true;
        } else {
            console.log(`[OK]    ${key}: ${base[key]} → ${cur[key]}`);
        }
    }
    if (failed) {
        console.error('\n❌ fail-open 基线回退');
        process.exit(1);
    }
    console.log('\n✅ fail-open 未上升');
    process.exit(0);
}

main();
