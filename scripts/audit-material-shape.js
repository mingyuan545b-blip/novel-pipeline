#!/usr/bin/env node
/**
 * audit-material-shape.js — 素材形状闸门（T4，只读）
 *
 * 三条规则：
 *  1. **不变量必须接线**：存储层两个写入路径（storeTrim/storeCommon）必须调用
 *     normalizeMaterialRecord —— 否则"任何来源写进来的素材都合规"这个保证就断了。
 *  2. **写入点基线冻结**：非豁免的 `setItem('materials', ...)` 调用点数量不得超过基线。
 *     存量 47 处已冻结（逐个重构风险高），但**不允许再新增**；减少时提示更新基线。
 *  3. **真实库抽样**（--db）：抽样读素材，用 checkMaterialShape 验证形状不变量真的成立。
 *
 * 用法：node scripts/audit-material-shape.js [--db] [--update-baseline]
 *   退出码 1 = 违规
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASELINE_FILE = path.join(__dirname, 'materialShapeBaseline.json');
const NEEDLE = "setItem('materials'";
const SKIP_DIRS = new Set(['node_modules', '.git', 'data', 'output', 'coverage', '.tmp-extract', 'dist', 'dist_backup']);
/** 豁免文件（精确路径）：唯一写入 API */
const EXEMPT_FILES = [path.join('server', 'services', 'materialRepository.js')];
/** 豁免目录（前缀）：存储层 / 迁移与一次性脚本 / 测试夹具 */
const EXEMPT_DIRS = [
    path.join('server', 'db'),
    path.join('server', 'scripts'),
    path.join('server', 'tests'),
    path.join('server', '__tests__'),
    path.join('scripts'),
    path.join('tests'),
];

function walk(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full, out);
        else if (e.name.endsWith('.js')) out.push(full);
    }
    return out;
}

const isExempt = (rel) => EXEMPT_FILES.includes(rel)
    || EXEMPT_DIRS.some(d => rel === d || rel.startsWith(d + path.sep));

function collectWriteSites(root = ROOT) {
    const sites = {};
    for (const file of walk(path.join(root, 'server'))) {
        const rel = path.relative(root, file);
        if (isExempt(rel)) continue;
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        const hits = lines.filter(l => {
            const t = l.trim();
            return !t.startsWith('*') && !t.startsWith('//') && l.includes(NEEDLE);
        }).length;
        if (hits > 0) sites[rel] = hits;
    }
    return sites;
}

const WIRING_TARGETS = [path.join('server', 'db', 'storeTrim.js'), path.join('server', 'db', 'storeCommon.js')];

function checkWiring(root = ROOT) {
    const problems = [];
    for (const rel of WIRING_TARGETS) {
        const full = path.join(root, rel);
        if (!fs.existsSync(full)) { problems.push(`${rel} 不存在`); continue; }
        const src = fs.readFileSync(full, 'utf8');
        if (!src.includes('normalizeMaterialRecord')) problems.push(`${rel} 未接 normalizeMaterialRecord（形状不变量失效）`);
    }
    return problems;
}

function diffBaseline(sites, baseline) {
    const increased = [];
    const decreased = [];
    const entries = Object.entries(baseline || {}).filter(([k]) => k !== '__total');
    for (const [file, n] of Object.entries(sites)) {
        const before = baseline?.[file] || 0;
        if (n > before) increased.push({ file, before, after: n });
    }
    for (const [file, n] of entries) {
        if ((sites[file] || 0) < n) decreased.push({ file, before: n, after: sites[file] || 0 });
    }
    return { increased, decreased };
}

async function checkRealDb() {
    process.chdir(ROOT);
    require('dotenv').config({ path: path.join(ROOT, '.env'), override: true });
    const store = require('../server/store');
    const { checkMaterialShape } = require('../server/config/materialShape');
    await store.ensureBackend();
    const materials = await store.queryItems('materials', {});
    const bad = [];
    for (const m of materials) {
        const r = checkMaterialShape(m);
        if (!r.ok) bad.push({ name: `${m.type}/${m.name}`, problems: r.problems });
    }
    return { total: materials.length, bad };
}

async function main(root = ROOT, args = process.argv.slice(2)) {
    const sites = collectWriteSites(root);
    const total = Object.values(sites).reduce((s, n) => s + n, 0);
    const baselineFile = path.join(root, path.relative(ROOT, BASELINE_FILE));
    const baseline = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, 'utf8')) : null;

    console.log('\n=== MATERIAL SHAPE AUDIT (T4) ===');
    const wiring = checkWiring(root);
    console.log(`[1] 形状不变量接线: ${wiring.length === 0 ? '✅ 存储层已接（storeTrim + storeCommon）' : '❌ 断裂'}`);
    wiring.forEach(w => console.log(`    ✗ ${w}`));

    console.log(`[2] 非豁免写入点: ${total} 处 / ${Object.keys(sites).length} 个文件`);
    let increased = [];
    if (!baseline) {
        console.log('    （无基线文件）');
    } else {
        const d = diffBaseline(sites, baseline);
        increased = d.increased;
        console.log(`    基线: ${baseline.__total ?? 0} 处 → 当前 ${total} 处`);
        if (increased.length > 0) {
            console.log('    ❌ 新增写入点（禁止扩散，请改走 materialRepository）:');
            increased.forEach(i => console.log(`      + ${i.file}: ${i.before} → ${i.after}`));
        } else {
            console.log('    ✅ 无新增');
        }
        if (d.decreased.length > 0) {
            console.log('    ℹ️  已收口（可更新基线）:');
            d.decreased.forEach(i => console.log(`      - ${i.file}: ${i.before} → ${i.after}`));
        }
    }

    if (args.includes('--update-baseline')) {
        fs.writeFileSync(BASELINE_FILE, JSON.stringify({ ...sites, __total: total }, null, 2) + '\n');
        console.log(`    📝 基线已更新: ${BASELINE_FILE}`);
    }

    let dbBad = [];
    if (args.includes('--db')) {
        const r = await checkRealDb();
        dbBad = r.bad;
        console.log(`[3] 真实库抽样: ${r.total} 条素材，形状不合规 ${r.bad.length} 条`);
        r.bad.slice(0, 5).forEach(b => console.log(`    ✗ ${b.name}: ${b.problems.join('; ')}`));
    }

    const failed = wiring.length > 0 || increased.length > 0 || dbBad.length > 0;
    console.log(failed ? '\n❌ MATERIAL SHAPE AUDIT 失败' : '\n✅ MATERIAL SHAPE AUDIT 通过');
    process.exit(failed ? 1 : 0);
}

module.exports = { collectWriteSites, checkWiring, diffBaseline, isExempt, NEEDLE, WIRING_TARGETS, EXEMPT_FILES, EXEMPT_DIRS };

if (require.main === module) {
    main().catch(e => { console.error('[audit-material-shape] 异常:', e.message); process.exit(1); });
}
