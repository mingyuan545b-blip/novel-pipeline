'use strict';

/**
 * ironLawRules.js — 铁律规则唯一定义源（Single Source of Truth）
 *
 * 三条纪律：
 *   1. 所有检查脚本（audit-iron-law / audit-hardcode / hooks）必须从这里引用
 *      模式与阈值，禁止私自定义（由 --self-check 互斥检查强制执行）。
 *   2. 场景化分支：同一规则按文件场景给出 block / warn / skip 三级处置，
 *      不再一刀切。场景按 SCENARIOS 顺序匹配，第一个命中者生效（显式 if/else 链）。
 *   3. 定义处豁免：规则模式出现在规则定义文件中时自动豁免，避免自指拦截。
 *
 * 铁律编号：
 *   P0-4 硬编码敏感信息 | P1-Q1 状态字面量散落 | P1-Q3 文件超200行 | P2-B1 shell语法残留
 */

const path = require('path');

// ========== 规则定义处（模式会出现"模式里"的文件，必须豁免） ==========
const RULE_DEFINITION_FILES = [
    'server/services/chapterStatus.js',
    'client/src/pages/pipeline/pipelineConstants.js',
    'scripts/lib/ironLawRules.js'
];

// ========== P0-4 硬编码敏感信息 ==========
// 修正历史版本三个缺陷：统一阈值口径、补 /g 标志、覆盖 sk-sp- 等含点划线的密钥形态
const SENSITIVE_PATTERNS = [
    // 负向前瞻：避免把依赖名/URL 中的 "task-list-item-2.0.0.tgz" 误判为 sk- Key
    { id: 'api-key', name: 'API Key明文', pattern: /(?<![A-Za-z0-9])sk-[A-Za-z0-9._-]{16,}/g },
    { id: 'password', name: '密码明文', pattern: /password\s*=\s*['"][^'"]{4,}['"]/gi },
    { id: 'apiKey-assign', name: 'apiKey明文', pattern: /\bapiKey\s*=\s*['"][^'"]{4,}['"]/gi },
    { id: 'secret-assign', name: 'secret明文', pattern: /\bsecret\s*=\s*['"][^'"]{4,}['"]/gi }
];
// 敏感信息扫描的文件类型（历史版本只扫 .js，漏掉真正藏密钥的地方）
const SENSITIVE_FILE_RE = /(\.jsx?|\.cjs|\.mjs|\.json|\.ya?ml|\.bat|\.sh|\.ps1|\.env(\.[^/]*)?)$/i;
function isSensitiveScanTarget(file) {
    const name = path.basename(file);
    if (/^\.env/i.test(name)) return true;
    return SENSITIVE_FILE_RE.test(file);
}

// ========== P1-Q1 状态字面量 ==========
// 覆盖历史版本漏掉的形态：!== 比较、反向比较、赋值/对象属性
const STATUS_LITERALS = ['material-updated', 'approved', 'outlined'];
function buildStatusPatterns(literals) {
    const list = [];
    for (const lit of literals) {
        list.push({ id: `status-${lit}`, name: `${lit}字面量`, patterns: [
            { tag: '比较', pattern: new RegExp(`(?:===?|!==?)\\s*['"]${lit}['"]`, 'g') },
            { tag: '反向比较', pattern: new RegExp(`['"]${lit}['"]\\s*(?:===?|!==?)`, 'g') },
            { tag: '赋值', pattern: new RegExp(`\\bstatus\\s*[:=]\\s*['"]${lit}['"]`, 'g') }
        ]});
    }
    return list;
}
const BUSINESS_VALUE_RULES = buildStatusPatterns(STATUS_LITERALS);

// ========== P2-B1 shell 语法残留 ==========
// 修正历史版本错误：| tail / 2>&1 / grep 是 bash 语法，不是 PowerShell。
// 规则语义：JS/前端代码里不应内嵌 shell 管道字符串，脚本逻辑应写成 node。
const SHELL_SYNTAX_PATTERNS = [
    { id: 'shell-pipe', name: 'shell管道(| tail/head/grep)', pattern: /\|\s*(tail|head|grep)\b/g },
    { id: 'shell-redirect', name: 'shell重定向(2>&1)', pattern: /2>&1/g },
    { id: 'shell-ps-var', name: '管道变量($_)', pattern: /\$_\b/g }
];

// ========== P1-Q3 行数上限（与 CI line-count-check 对齐） ==========
const MAX_LINES = 200;
const LINE_SCAN_PREFIXES = ['server/', 'client/src/'];
const LINE_SCAN_SKIP = ['/scripts/', '/__tests__/', '/node_modules/', '/dist', '.test.', '.spec.'];
function isLineScanTarget(file) {
    const f = file.split(path.sep).join('/');
    return LINE_SCAN_PREFIXES.some(p => f.startsWith(p)) && !LINE_SCAN_SKIP.some(s => f.includes(s));
}

// ========== 场景分支表（替代一刀切） ==========
// 动作三级：block=拦截 | warn=提示不拦截 | skip=不检查
// 按数组顺序匹配，第一个命中的场景生效 —— 显式、可测试、可扩展。
const SCENARIOS = [
    {
        id: 'rule-definition',
        desc: '规则定义处：模式出现在模式定义里，必须豁免',
        match: f => RULE_DEFINITION_FILES.includes(f),
        action: { 'P0-4': 'skip', 'P1-Q1': 'skip', 'P2-B1': 'skip', 'P1-Q3': 'block' }
    },
    {
        id: 'test',
        desc: '测试代码：允许mock密钥与状态字面量；敏感信息降为警告',
        match: f => /(^|\/)(__tests__|__mocks__|tests)\//.test(f) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(f),
        action: { 'P0-4': 'warn', 'P1-Q1': 'skip', 'P2-B1': 'warn', 'P1-Q3': 'skip' }
    },
    {
        id: 'example-config',
        desc: '示例/样例配置文件：允许占位值，敏感信息降为警告',
        match: f => /\.example$|\.example\./.test(f),
        action: { 'P0-4': 'warn', 'P1-Q1': 'skip', 'P2-B1': 'skip', 'P1-Q3': 'skip' }
    },
    {
        id: 'docs',
        desc: '文档与文本资料：不查字面量/语法，但敏感信息仍拦截',
        match: f => /\.(md|txt)$/.test(f) || f.startsWith('docs/'),
        action: { 'P0-4': 'block', 'P1-Q1': 'skip', 'P2-B1': 'skip', 'P1-Q3': 'skip' }
    },
    {
        id: 'data-files',
        desc: '数据/种子JSON：不查代码类规则，敏感信息仍拦截',
        match: f => f.startsWith('data/') && /\.json$/.test(f),
        action: { 'P0-4': 'block', 'P1-Q1': 'skip', 'P2-B1': 'skip', 'P1-Q3': 'skip' }
    },
    {
        id: 'frontend-constants',
        desc: '前端状态常量定义处',
        match: f => f.includes('pipelineConstants.js'),
        action: { 'P0-4': 'block', 'P1-Q1': 'skip', 'P2-B1': 'skip', 'P1-Q3': 'block' }
    },
    {
        id: 'default',
        desc: '默认：全部拦截',
        match: () => true,
        action: { 'P0-4': 'block', 'P1-Q1': 'block', 'P2-B1': 'block', 'P1-Q3': 'block' }
    }
];

function normalizePath(file) {
    return file.split(path.sep).join('/');
}

function resolveScenario(file) {
    const f = normalizePath(file);
    for (const s of SCENARIOS) {
        if (s.match(f)) return s;
    }
    return SCENARIOS[SCENARIOS.length - 1];
}

// 查询某文件上某条规则的处置动作
function actionFor(file, ruleId) {
    const scenario = resolveScenario(file);
    return scenario.action[ruleId] || 'block';
}

// 在内容中查找模式命中（统一用 matchAll，避免 /g 的 lastIndex 状态问题）
function findPatternHits(content, patterns) {
    const hits = [];
    for (const p of patterns) {
        for (const m of content.matchAll(p.pattern)) {
            hits.push({ id: p.id, name: p.name, sample: maskSample(m[0]) });
        }
    }
    return hits;
}

// 样本掩码：只保留前6字符，杜绝报错输出泄露密钥前缀
function maskSample(text) {
    const t = String(text);
    return t.length > 6 ? t.slice(0, 6) + '***' : t;
}

module.exports = {
    RULE_DEFINITION_FILES,
    SENSITIVE_PATTERNS,
    isSensitiveScanTarget,
    STATUS_LITERALS,
    BUSINESS_VALUE_RULES,
    SHELL_SYNTAX_PATTERNS,
    MAX_LINES,
    LINE_SCAN_PREFIXES,
    isLineScanTarget,
    SCENARIOS,
    resolveScenario,
    actionFor,
    findPatternHits,
    maskSample
};
