/**
 * scripts/audit-ai-slop.js — AI 味高频词扫描（设定堆砌类 + 网文描写类）
 *
 * 词表来源：用户 2026-10-09 点名的一批"AI 最爱堆的设定类词 / 网文描写类词"。
 * 特征：抽象规则、因果结算、闭环平衡、底层逻辑——AI 写设定/战斗/世界观时密集输出，真人写很少这么密。
 *
 * 用法：
 *   node scripts/audit-ai-slop.js                     # 扫 output/ 下最新项目的 final/
 *   node scripts/audit-ai-slop.js --project <id>      # 指定项目（扫 final/）
 *   node scripts/audit-ai-slop.js --all-drafts        # 含 chapters/ 各稿（量更大）
 *   node scripts/audit-ai-slop.js --dir <path>        # 扫任意目录（.txt/.md）
 *   node scripts/audit-ai-slop.js --ci --max 30       # CI：严重词总命中 >30 则退出码 1
 *
 * 说明：有的词（秩序/权限/机制/结算/阈值）在"游戏化/无限流"题材里可能是合理设定词，单独归入
 * 「观察项」不参与 CI 判罚；判罚只看 SEVERE 清单（纯 AI 腔）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'output');

const CATEGORIES = [
    { id: 'causal', name: '因果/命运 · 设定堆砌', words: ['因果闭环', '因果反噬', '因果锁链', '因果线', '因果锚点', '因果代偿', '因果修正', '因果收束', '命运收束', '命运锚定', '命运代偿', '时序修正', '时间线收束'] },
    { id: 'rule', name: '规则/法则 · 设定堆砌', words: ['底层法则', '世界基底', '本源规则', '天地铁则', '权柄', '桎梏', '枷锁', '范式', '底层逻辑', '道则', '律令'] },
    { id: 'settle', name: '结算/平衡 · 设定堆砌', words: ['收支平衡', '代价抵消', '得失对等', '等价交换', '代价偿付', '抹平偏差', '抵消亏欠', '缺口补全', '债务清算', '因果结清', '平衡回归', '能量守恒'] },
    { id: 'syntax', name: '配套高频句式', words: ['核心逻辑', '形成闭环', '本质上', '究其根本', '这意味着', '由此产生', '不可逆', '必然触发', '一旦满足条件', '便会生效', '等价代偿', '触发判定'] },
    { id: 'prose', name: '网文描写类AI高频词', words: ['瞳孔微缩', '心中一凛', '眸色一沉', '嘴角勾起', '不由得', '骤然', '赫然', '宛如', '交织', '洗礼', '镌刻', '萦绕', '悄然', '深邃', '无形之中', '冥冥之中', '在这一刻'] },
    // 观察项：题材可穿透（游戏化/系统流里"结算/权限/机制"未必是AI味），不计入 CI
    { id: 'generic', name: '观察项 · 疑似题材可穿透', words: ['秩序', '权限', '约束', '机制', '本源', '标定', '阀值', '阈值', '熵增', '熵减', '结算', '闭环'], observe: true },
];

// 纯 AI 腔重灾区：CI 只判这部分
const SEVERE = new Set([
    '因果闭环', '因果反噬', '因果锁链', '命运收束', '底层法则', '世界基底', '本源规则', '天地铁则', '权柄', '桎梏',
    '底层逻辑', '核心逻辑', '形成闭环', '本质上', '究其根本', '这意味着', '由此产生', '不可逆', '必然触发',
    '一旦满足条件', '便会生效', '等价代偿', '触发判定', '收支平衡', '得失对等', '代价偿付', '抹平偏差', '债务清算',
    '瞳孔微缩', '心中一凛', '眸色一沉', '嘴角勾起', '无形之中', '冥冥之中',
]);

const ALL_WORDS = CATEGORIES.flatMap((c) => c.words.map((w) => ({ w, cat: c.id, observe: !!c.observe })));

function arg(name, def) {
    const i = process.argv.indexOf('--' + name);
    return i >= 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : def;
}

function newestProjectDir() {
    return fs.readdirSync(OUTPUT_DIR)
        .map((f) => ({ f, m: fs.statSync(path.join(OUTPUT_DIR, f)).mtimeMs }))
        .filter((x) => fs.statSync(path.join(OUTPUT_DIR, x.f)).isDirectory())
        .sort((a, b) => b.m - a.m)[0]?.f;
}

function collectFiles(dir, recursive) {
    const out = [];
    const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, e.name);
            if (e.isDirectory()) { if (recursive) walk(full); continue; }
            if (/\.(txt|md)$/.test(e.name)) out.push(full);
        }
    };
    walk(dir);
    return out;
}

const projectArg = arg('project', null);
const dirArg = arg('dir', null);
const useAllDrafts = !!arg('all-drafts', false);
const topN = parseInt(arg('top', '25'), 10);
const ciMax = parseInt(arg('max', '30'), 10);

let scanDir;
if (dirArg && dirArg !== true) scanDir = path.resolve(dirArg);
else {
    const pid = projectArg && projectArg !== true ? projectArg : newestProjectDir();
    const base = path.join(OUTPUT_DIR, pid);
    scanDir = useAllDrafts ? base : path.join(base, 'final');
}
if (!fs.existsSync(scanDir)) { console.error('[ai-slop] 目录不存在：', scanDir); process.exit(1); }

const files = collectFiles(scanDir, true);
if (!files.length) { console.error('[ai-slop] 无 .txt/.md 可扫：', scanDir); process.exit(1); }

const counts = {};
let totalChars = 0;
for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    totalChars += text.length;
    for (const { w } of ALL_WORDS) counts[w] = (counts[w] || 0) + text.split(w).length - 1;
}

const perCat = {};
for (const c of CATEGORIES) {
    perCat[c.id] = { name: c.name, observe: !!c.observe, total: 0, hits: [] };
    for (const w of c.words) {
        const n = counts[w] || 0;
        perCat[c.id].total += n;
        if (n > 0) perCat[c.id].hits.push({ w, n });
    }
    perCat[c.id].hits.sort((a, b) => b.n - a.n);
}

const severeHits = ALL_WORDS.filter((x) => SEVERE.has(x.w)).reduce((s, x) => s + (counts[x.w] || 0), 0);
const allHits = ALL_WORDS.reduce((s, x) => s + (counts[x.w] || 0), 0);
const per10k = (n) => ((n / totalChars) * 10000).toFixed(1);

console.log('===== AI 味高频词扫描 =====');
console.log('目录   :', scanDir, `(${files.length} 个文件)`);
console.log('总字数 :', totalChars.toLocaleString(), '| 命中总次数:', allHits, `(严重词 ${severeHits})`);
console.log('密度   :', per10k(allHits), '次/万字（严重词', per10k(severeHits), '次/万字）');
console.log('');
console.log('--- 分类汇总 ---');
for (const c of CATEGORIES) {
    const v = perCat[c.id];
    console.log(`[${v.observe ? '观察' : '判罚'}] ${v.name.padEnd(22)} 命中 ${String(v.total).padStart(4)}  ${v.hits.slice(0, 6).map((h) => h.w + '×' + h.n).join('  ') || '-'}`);
}
console.log('');
console.log(`--- Top ${topN} 单词 ---`);
Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, topN)
    .forEach(([w, n], i) => console.log(`  ${String(i + 1).padStart(2)}. ${w.padEnd(8)} ${String(n).padStart(4)}${SEVERE.has(w) ? '  ⚠️' : ''}`));

if (process.argv.includes('--ci')) {
    if (severeHits > ciMax) { console.error(`\n[ai-slop] ❌ 严重 AI 词命中 ${severeHits} > 阈值 ${ciMax}`); process.exit(1); }
    console.log(`\n[ai-slop] ✅ 严重 AI 词命中 ${severeHits} ≤ 阈值 ${ciMax}`);
}
