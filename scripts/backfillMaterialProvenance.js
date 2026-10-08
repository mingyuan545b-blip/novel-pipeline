/**
 * backfillMaterialProvenance.js — 回填存量素材的 provenance + changeLog v2（T2）
 *
 * 用法: node scripts/backfillMaterialProvenance.js [projectId] [--apply]
 *   默认只读（干跑），加 --apply 才写库。
 *
 * 做的事（**不改语义，只补缺失**）：
 *   1. 每条素材补 provenance{createdChapter, createdAt, origin, runId, source}
 *      —— createdChapter 优先取 sourceChapter，其次 lastUpdatedChapter，最后 0
 *   2. changeLog 旧结构（timestamp / oldContent / type …）归一到 v2
 *   3. **不触碰** sourceChapter / currentContent / version 等既有语义字段
 */
const path = require('path');
process.chdir(path.resolve(__dirname, '..'));
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), override: true });
const store = require('../server/store');
const { ensureProvenance, normalizeChangeLog, validateProvenance, CHANGE_LOG_VERSION } = require('../server/config/materialProvenance');

function needsWork(m) {
    if (!validateProvenance(m).ok) return true;
    const log = Array.isArray(m.changeLog) ? m.changeLog : [];
    return log.some(e => !e || e.v !== CHANGE_LOG_VERSION);
}

async function main() {
    const args = process.argv.slice(2);
    const apply = args.includes('--apply');
    const projectId = args.find(a => !a.startsWith('--'));
    await store.ensureBackend();

    const materials = await store.queryItems('materials', projectId ? { projectId } : {});
    let changed = 0, ok = 0, logFixed = 0;
    const samples = [];

    for (const mat of materials) {
        if (!needsWork(mat)) { ok++; continue; }
        const next = ensureProvenance({ ...mat });
        next.changeLog = normalizeChangeLog(mat.changeLog, mat.sourceChapter);
        if ((mat.changeLog || []).length > 0 && next.changeLog.length !== mat.changeLog.length) logFixed++;
        changed++;
        if (samples.length < 5) {
            samples.push(`${mat.type}/${mat.name}: provenance.createdChapter=${next.provenance.createdChapter} origin=${next.provenance.origin} changeLog=${(mat.changeLog || []).length}→${next.changeLog.length}`);
        }
        if (apply) await store.setItem('materials', mat.id, next);
    }

    console.log(`\n[backfillMaterialProvenance] 扫描 ${materials.length} 条素材`);
    console.log(`  已合规: ${ok}    待回填: ${changed}    其中 changeLog 有丢弃条目: ${logFixed}`);
    samples.forEach(s => console.log(`  · ${s}`));
    console.log(apply ? '  ✅ 已写入（--apply）' : '  ⚠️  干跑模式：未写库（加 --apply 才写）');
}

main().catch(e => { console.error('[backfillMaterialProvenance] 失败:', e.message); process.exit(1); });
