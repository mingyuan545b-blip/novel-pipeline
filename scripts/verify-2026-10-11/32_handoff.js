'use strict';
/** 32_handoff.js <projectId> <maxCh> — 动态核查：每个 Agent 每章是否拿到"上游工序资料"（上下文装配实况） */
const { get, Checker, out, readId, sleep } = require('./_lib');
const { AGENT_DECLARATIONS } = require('../../server/services/pipeline/agentDeclarations');
const { DATA_FLOW_SPEC } = require('../../server/services/pipeline/dataFlowSpec');

const pid = process.argv[2] || readId();
const maxCh = parseInt(process.argv[3] || '10', 10);
const reqTypes = (agent) => (AGENT_DECLARATIONS[agent]?.materialNeeds || []).filter(n => n.required).map(n => n.type);

(async () => {
    const c = new Checker('Agent 前后工序资料交接（动态·装配实况）');
    const perChapter = [];
    const agentSeen = {};
    for (let n = 1; n <= maxCh; n++) {
        let j;
        try { const r = await get(`/api/pipeline/context-assembly/${pid}?chapterNumber=${n}`, null, 60000); j = r.data; } catch (e) { perChapter.push({ ch: n, error: e.message }); continue; }
        const agents = j.agents || [];
        const row = { ch: n, agents: agents.map(a => a.agentType), missingRequired: [], alerts: (j.alerts || []).length };
        for (const a of agents) {
            agentSeen[a.agentType] = (agentSeen[a.agentType] || 0) + 1;
            const need = reqTypes(a.agentType);
            const byType = new Map((a.types || []).map(t => [t.type, t.status]));
            for (const t of need) {
                const st = byType.get(t);
                if (st !== 'injected') row.missingRequired.push(`${a.agentType}:${t}=${st || 'absent'}`);
            }
        }
        perChapter.push(row);
    }
    // 断言
    const withAssemblies = perChapter.filter(r => !r.error && r.agents.length > 0);
    c.add('装配实况：至少一章有 Agent 装配记录', withAssemblies.length > 0, `${withAssemblies.length}/${maxCh} 章有记录`);
    const anyMissing = perChapter.filter(r => (r.missingRequired || []).length > 0);
    c.add('交接：所有 Agent 的 required 素材均已注入（非 missing）', anyMissing.length === 0, anyMissing.slice(0, 3).map(r => `ch${r.ch}: ${r.missingRequired.join(',')}`).join(' | '));
    // 关键工序覆盖
    for (const ag of ['writer', 'first-review', 'second-review', 'reviser', 'polisher']) {
        c.add(`交接：${ag} 有装配记录(${agentSeen[ag] || 0}章)`, (agentSeen[ag] || 0) > 0, '');
    }
    console.log('\n每章装配：');
    for (const r of perChapter) console.log(r.error ? `  ch${r.ch}: ERROR ${r.error}` : `  ch${r.ch}: agents=[${r.agents.join(',')}] alerts=${r.alerts} missingReq=${(r.missingRequired||[]).length}`);
    const rep = c.report();
    out('32_handoff.json', { projectId: pid, perChapter, agentSeen, summary: rep });
    process.exit(rep.pass === rep.total ? 0 : 1);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
