/**
 * libraryImportTechniques — 把一批「通用写作技法」导入藏经阁（PG单一数据源）
 *
 * 用途：手工/离线整理的高质量技法批量入库（区别于 LLM「一键提取」）。
 * 用法：node scripts/libraryImportTechniques.js <payload.json> [--base=http://localhost:3001] [--dry]
 *   载荷格式：{ "source_novel": "...", "items": [ {display_name, department, subcategory, description,
 *               implementation_rules[], anti_patterns[], evidence[], retrieval_tags[], injection_point,
 *               context_slot, context_priority, worldviewDepth, word_count_impact, applicable_modes[] } ] }
 *   说明：id 按 `部门_子类_序号` 自动生成（取该分类现有最大值+1），与 libraryExtractParse.makeId 一致。
 */
const fs = require('fs');
const path = require('path');

function loadEnvSecret() {
    if (process.env.REQUEST_SECRET) return process.env.REQUEST_SECRET;
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        const m = fs.readFileSync(envPath, 'utf8').match(/^REQUEST_SECRET=(.+)$/m);
        if (m) return m[1].trim();
    }
    return '';
}

function makeId(dept, sub, existingIds) {
    const prefix = `${dept}_${sub}_`;
    let max = 0;
    for (const id of existingIds) {
        if (!id.startsWith(prefix)) continue;
        const seq = parseInt(id.slice(prefix.length), 10);
        if (Number.isFinite(seq) && seq > max) max = seq;
    }
    return prefix + String(max + 1).padStart(2, '0');
}

async function main() {
    const args = process.argv.slice(2);
    const file = args.find(a => !a.startsWith('--'));
    const dry = args.includes('--dry');
    const baseArg = args.find(a => a.startsWith('--base='));
    const base = baseArg ? baseArg.slice('--base='.length) : 'http://localhost:3001';
    const secret = loadEnvSecret();
    if (!file) { console.error('用法: node scripts/libraryImportTechniques.js <payload.json>'); process.exit(2); }

    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    const items = payload.items || [];
    if (!items.length) { console.error('载荷无 items'); process.exit(2); }

    const headers = { 'Content-Type': 'application/json' };
    if (secret) headers['Authorization'] = `Bearer ${secret}`;

    const idxRes = await fetch(`${base}/api/library/index`, { headers });
    if (!idxRes.ok) throw new Error(`拉取 index 失败: HTTP ${idxRes.status}`);
    const idx = await idxRes.json();
    const existingIds = (idx.entries || []).map(e => e.id);

    let ok = 0, fail = 0;
    for (const t of items) {
        const id = makeId(t.department, t.subcategory, existingIds);
        existingIds.push(id);
        const record = Object.assign({}, t, {
            id,
            applicable_modes: t.applicable_modes || ['novel', 'shuangwen'],
            category_path: t.category_path || `${t.department}/${t.subcategory}/${t.display_name}`,
            trigger_condition: t.trigger_condition || { chapter_range: [1, 999], narrative_state: [], emotion_curve: 'any' },
            source_novel: t.source_novel || payload.source_novel || '',
            source_type: 'extracted',
            version: '1.0.0',
        });
        if (dry) { console.log('[dry]', id, record.display_name); ok++; continue; }
        const res = await fetch(`${base}/api/library/techniques`, { method: 'POST', headers, body: JSON.stringify(record) });
        const body = await res.json().catch(() => ({}));
        if (res.ok && body.success) { console.log('OK  ', id, record.display_name); ok++; }
        else { console.error('FAIL', id, record.display_name, JSON.stringify(body).slice(0, 200)); fail++; }
    }
    console.log(`\n完成：成功 ${ok} / 失败 ${fail} / 共 ${items.length}（来源：${payload.source_novel || '未标注'}）`);
    process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
