'use strict';
/** 33_quality.js <projectId> <maxCh> — 章节质量核查：字数/状态/审核链/M1-M11 检测器命中 */
const { Checker, out, readId } = require('./_lib');
const { q, end } = require('./_db');
const { runAllMetaConstraintDetections } = require('../../server/services/prompts/constraintDetectionRegistry');

const pid = process.argv[2] || readId();
const maxCh = parseInt(process.argv[3] || '10', 10);
const MIN = 1500, MAX = 3500;
const parseData = (x) => (x == null ? {} : (typeof x === 'string' ? JSON.parse(x) : x));

(async () => {
    const rows = await q('SELECT chapternumber,status,title,wordcount,data FROM chapters WHERE projectid=$1 ORDER BY chapternumber', [pid]);
    const c = new Checker('章节质量（字数/状态/审核链/M1-M11）');
    const chap = [];
    for (const r of rows.filter(r => r.chapternumber <= maxCh)) {
        const d = parseData(r.data);
        const content = d.content || '';
        const chars = content.length;
        let det = {}; try { det = await runAllMetaConstraintDetections({ content }); } catch (e) { det = { error: e.message }; }
        const hits = Object.entries(det).filter(([, v]) => v && v.actual >= (v.threshold || Infinity) && v.actual > 0).map(([k, v]) => `${k}:${v.actual}`);
        const row = {
            ch: r.chapternumber, status: r.status, words: r.wordcount || 0, chars,
            first: !!d.firstReviewOutput, second: !!d.secondReviewOutput, final: !!d.finalEditorOutput,
            detHits: hits,
        };
        chap.push(row);
    }
    const written = chap.filter(r => r.chars > 0);
    c.add('产出：所有目标章均有正文', written.length === chap.length, `${written.length}/${chap.length}`);
    const inRange = written.filter(r => r.chars >= MIN && r.chars <= MAX);
    c.add(`字数：${MIN}-${MAX} 字达标`, written.length > 0 && inRange.length === written.length, `${inRange.length}/${written.length} 达标`);
    const approved = chap.filter(r => ['approved', 'material-updated', 'second-reviewed'].includes(r.status));
    c.add('状态：全部到达 approved/material-updated', chap.length > 0 && approved.length === chap.length, `${approved.length}/${chap.length}`);
    const chained = chap.filter(r => r.first && r.final);
    c.add('审核链：初审+定稿均有输出', written.length > 0 && chained.length === written.length, `${chained.length}/${written.length}`);
    const slopHeavy = chap.filter(r => (r.detHits || []).some(h => h.startsWith('M11') && parseInt(h.split(':')[1], 10) >= 4));
    c.add('AI 味(M11)：无章超阈值', slopHeavy.length === 0, slopHeavy.map(r => 'ch' + r.ch).join(',') || '');
    console.log('\n章节明细：');
    for (const r of chap) console.log(`  ch${r.ch} ${r.status} words=${r.words} chars=${r.chars} 初审=${r.first?'Y':'N'} 定稿=${r.final?'Y':'N'} 检测命中=[${(r.detHits||[]).join(',')}]`);
    const rep = c.report();
    out('33_quality.json', { projectId: pid, chapters: chap, summary: rep });
    await end();
    process.exit(rep.pass === rep.total ? 0 : 1);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
