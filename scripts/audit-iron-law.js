'use strict';

/**
 * 铁律违反检测脚本（v2 重构）
 *
 * 规则定义全部来自 scripts/lib/ironLawRules.js（唯一定义源），本文件不含任何私有模式。
 *
 * 模式：
 *   --pre-commit     git pre-commit 钩子：只扫暂存区（含行数检查）
 *   --pre-deliver    交付前：扫已修改文件 + 未跟踪新文件（修复历史版本漏新文件问题）
 *   --session-start  会话开始：环境与配套CI就绪检查（已移除硬编码本机路径）
 *   --self-check     铁律互斥自检：规则私定义/自指拦截/钩子翻转/场景完备性
 *
 * 场景化处置：每条命中按文件场景解析为 block / warn / skip（见 ironLawRules.SCENARIOS），
 * 不再一刀切。违反以 exit(1) 拦截。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const rules = require('./lib/ironLawRules');

const PROJECT_ROOT = path.join(__dirname, '..');

// ========== 文件收集 ==========

function gitLines(cmd) {
    try {
        return execSync(cmd, { cwd: PROJECT_ROOT, encoding: 'utf8' })
            .split('\n').map(s => s.trim()).filter(Boolean);
    } catch (e) {
        return [];
    }
}

const IGNORED_PATH_SEGMENTS = new Set(['node_modules', '.stryker-tmp', 'reports']);

function isIgnoredPath(file) {
    return file.split(/[\\/]/).some((segment) => IGNORED_PATH_SEGMENTS.has(segment));
}

function getStagedFiles() {
    return gitLines('git diff --cached --name-only').filter((file) => !isIgnoredPath(file));
}

// 修复：历史版本只扫 git diff HEAD，漏掉未跟踪的新文件
function getDeliverFiles() {
    const changed = gitLines('git diff --name-only HEAD');
    const untracked = gitLines('git ls-files --others --exclude-standard');
    return [...new Set([...changed, ...untracked])].filter((file) => !isIgnoredPath(file));
}

function readIfExists(file) {
    const full = path.join(PROJECT_ROOT, file);
    try { return fs.readFileSync(full, 'utf8'); } catch (e) { return null; }
}

const JS_FILE_RE = /\.(js|jsx|cjs|mjs)$/;

// ========== 规则执行（场景化处置） ==========

function runChecks(files) {
    const blocked = [];
    const warned = [];

    const apply = (file, ruleId, hits, detail) => {
        if (!hits.length) return;
        const action = rules.actionFor(file, ruleId);
        if (action === 'skip') return;
        const entry = { rule: ruleId, file, action, detail };
        if (action === 'block') blocked.push(entry);
        else warned.push(entry);
    };

    for (const file of files) {
        const content = readIfExists(file);
        if (content === null) continue; // 已删除的文件跳过

        // P0-4 敏感信息（扩展文件类型：.env/.json/.yaml 等）
        if (rules.isSensitiveScanTarget(file)) {
            const hits = rules.findPatternHits(content, rules.SENSITIVE_PATTERNS);
            apply(file, 'P0-4', hits, hits.map(h => h.name + '->' + h.sample).slice(0, 3).join('; '));
        }

        // P1-Q1 状态字面量 / P2-B1 shell语法 / P1-Q3 行数（仅代码文件）
        if (JS_FILE_RE.test(file)) {
            const statusHits = [];
            for (const rule of rules.BUSINESS_VALUE_RULES) {
                statusHits.push(...rules.findPatternHits(content, rule.patterns));
            }
            apply(file, 'P1-Q1', statusHits, statusHits.map(h => h.name).slice(0, 3).join('; '));
            const shellHits = rules.findPatternHits(content, rules.SHELL_SYNTAX_PATTERNS);
            apply(file, 'P2-B1', shellHits, shellHits.map(h => h.name).slice(0, 3).join('; '));

            if (rules.isLineScanTarget(file)) {
                const lines = content.split('\n').length;
                if (lines > rules.MAX_LINES) apply(file, 'P1-Q3', [{ sample: '' }], lines + '行 > ' + rules.MAX_LINES);
            }
        }
    }
    return { blocked, warned };
}

function printReport(title, blocked, warned) {
    console.log('[IRON-LAW] ' + title);
    for (const w of warned) {
        console.log('  ~ [warn/' + w.rule + '/' + rules.resolveScenario(w.file).id + '] ' + w.file + ' -- ' + w.detail);
    }
    for (const b of blocked) {
        console.log('  X [block/' + b.rule + '/' + rules.resolveScenario(b.file).id + '] ' + b.file + ' -- ' + b.detail);
    }
    if (!blocked.length && !warned.length) console.log('  V 无违反');
}

// ========== --self-check 铁律互斥自检 ==========

function selfCheck() {
    console.log('[IRON-LAW] 铁律互斥自检');
    console.log('='.repeat(60));
    const problems = [];

    // 1. 规则私定义检测：共享模块之外不允许出现密钥模式或行数阈值
    const scriptFiles = [];
    const walk = (dir) => {
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
            const fp = path.join(dir, item.name);
            if (item.isDirectory()) {
                if (!item.name.startsWith('.') && item.name !== 'node_modules') walk(fp);
            } else if (item.name.endsWith('.js')) scriptFiles.push(fp);
        }
    };
    walk(path.join(PROJECT_ROOT, 'scripts'));
    const ROGUE_KEY = /sk-\[A-Za-z0-9/;
    const ROGUE_MAXLINES = /MAX_LINES\s*=\s*\d/;
    for (const fp of scriptFiles) {
        const rel = path.relative(PROJECT_ROOT, fp).split(path.sep).join('/');
        if (rel === 'scripts/lib/ironLawRules.js') continue;
        const c = fs.readFileSync(fp, 'utf8');
        if (ROGUE_KEY.test(c)) problems.push('规则重复: ' + rel + ' 私有定义了sk-密钥模式（应引用lib/ironLawRules）');
        if (ROGUE_MAXLINES.test(c)) problems.push('阈值漂移: ' + rel + ' 私有定义了MAX_LINES（应引用lib/ironLawRules）');
    }

    // 2. 自指检测：规则定义文件若含模式，必须被场景豁免，否则规则拦截自己
    for (const def of rules.RULE_DEFINITION_FILES) {
        const content = readIfExists(def);
        if (content === null) continue;
        const allPatterns = [
            ...rules.SENSITIVE_PATTERNS,
            ...rules.BUSINESS_VALUE_RULES.flatMap(r => r.patterns),
            ...rules.SHELL_SYNTAX_PATTERNS
        ];
        if (rules.findPatternHits(content, allPatterns).length > 0) {
            for (const ruleId of ['P0-4', 'P1-Q1', 'P2-B1']) {
                if (rules.actionFor(def, ruleId) !== 'skip') {
                    problems.push('自指冲突: ' + def + ' 含规则模式但场景未豁免 ' + ruleId);
                }
            }
        }
    }

    // 3. 钩子一致性：core.hooksPath 与 package.json prepare 必须同向，否则npm install翻转
    let hooksPath = '';
    try {
        hooksPath = execSync('git config core.hooksPath', { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
    } catch (e) { /* 未设置 */ }
    const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
    const prepare = (pkg.scripts && pkg.scripts.prepare) || '';
    const prepareParts = prepare.split(' ');
    const prepareDir = prepareParts.length > 1 ? prepareParts[prepareParts.length - 1] : '.husky';
    const hooksNorm = hooksPath.split(path.sep).join('/');
    // husky 9 语义：`husky <dir>` 会把 core.hooksPath 设为 <dir>/_（真正的用户钩子在 <dir>/ 下，
    // 由 <dir>/_/<hook> → h 委托执行）。旧判定只认"相等"，于是本仓库恒报假红（E5）。
    const isHuskyDelegateLayout = hooksNorm === prepareDir + '/_';
    if (hooksPath && hooksNorm !== prepareDir && !isHuskyDelegateLayout) {
        problems.push('钩子翻转风险: core.hooksPath=' + hooksPath + ' 但 prepare 指向 ' + prepareDir + '（npm install会翻转钩子）');
    }
    if (!hooksPath) {
        problems.push('钩子未安装: core.hooksPath 未设置，运行 npx husky ' + prepareDir + ' 安装');
    } else {
        // 比"字符串相等"更实质的判定：钩子链必须**真的可执行**
        const entry = path.join(PROJECT_ROOT, hooksNorm, 'pre-commit');
        const delegate = path.join(PROJECT_ROOT, isHuskyDelegateLayout ? prepareDir : hooksNorm, 'pre-commit');
        if (!fs.existsSync(entry)) {
            problems.push('钩子链不可执行: 缺少 ' + path.relative(PROJECT_ROOT, entry).split(path.sep).join('/'));
        } else if (!fs.existsSync(delegate)) {
            problems.push('钩子链不可执行: husky 委托目标缺失 ' + path.relative(PROJECT_ROOT, delegate).split(path.sep).join('/'));
        }
    }

    // 4. 场景完备性：唯一default、动作合法、ID不重复
    const ids = new Set();
    let defaults = 0;
    for (const s of rules.SCENARIOS) {
        if (ids.has(s.id)) problems.push('场景ID重复: ' + s.id);
        ids.add(s.id);
        if (s.id === 'default') defaults++;
        for (const v of Object.values(s.action)) {
            if (!['block', 'warn', 'skip'].includes(v)) problems.push('非法动作: ' + s.id + ' -> ' + v);
        }
    }
    if (defaults !== 1) problems.push('场景表必须有且仅有一个 default（当前 ' + defaults + '）');

    if (problems.length) {
        for (const p of problems) console.log('  X ' + p);
    } else {
        console.log('  V 无互斥冲突');
    }
    console.log('='.repeat(60));
    process.exit(problems.length ? 1 : 0);
}

// ========== --session-start（已移除硬编码本机路径） ==========

function sessionStart() {
    console.log('[IRON-LAW] 会话开始检查');
    const envPath = path.join(PROJECT_ROOT, '.env');
    const checks = [
        { name: '.env文件存在', ok: fs.existsSync(envPath), fatal: false },
        { name: '题材白名单CI脚本存在', ok: fs.existsSync(path.join(PROJECT_ROOT, 'scripts/audit-genre-whitelist.js')), fatal: true },
        { name: '路由参数CI脚本存在', ok: fs.existsSync(path.join(PROJECT_ROOT, 'scripts/audit-route-param-consistency.js')), fatal: true },
        { name: 'SOP 09存在', ok: fs.existsSync(path.join(PROJECT_ROOT, 'docs/sop/09-新项目约束词设计SOP.md')), fatal: true }
    ];
    let fail = false;
    for (const c of checks) {
        const mark = c.ok ? 'V' : (c.fatal ? 'X' : '~');
        console.log('  ' + mark + ' ' + c.name);
        if (!c.ok && c.fatal) fail = true;
    }
    for (const cmd of ['node scripts/audit-genre-whitelist.js', 'node scripts/audit-route-param-consistency.js']) {
        try {
            execSync(cmd, { cwd: PROJECT_ROOT, stdio: 'inherit' });
        } catch (e) { fail = true; }
    }
    process.exit(fail ? 1 : 0);
}

// ========== 主入口 ==========

const mode = process.argv[2];
if (mode === '--self-check') selfCheck();
else if (mode === '--session-start') sessionStart();
else if (mode === '--pre-commit' || mode === '--pre-deliver') {
    const files = mode === '--pre-commit' ? getStagedFiles() : getDeliverFiles();
    const title = mode === '--pre-commit'
        ? 'pre-commit 扫描暂存区(' + files.length + '个文件)'
        : '交付前扫描修改+新增(' + files.length + '个文件)';
    if (!files.length) { console.log('[IRON-LAW] 无待检文件'); process.exit(0); }
    const { blocked, warned } = runChecks(files);
    printReport(title, blocked, warned);
    if (blocked.length) {
        console.log('共 ' + blocked.length + ' 处拦截级违反，' + (mode === '--pre-commit' ? 'commit已拦截' : '交付检查失败'));
        process.exit(1);
    }
    process.exit(0);
} else {
    console.log('用法: node scripts/audit-iron-law.js --pre-commit|--pre-deliver|--session-start|--self-check');
    process.exit(1);
}
