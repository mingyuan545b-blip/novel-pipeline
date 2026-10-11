'use strict';
/**
 * 20_agents.js — 静态核查：每个 Agent 的"职责划分 + 前后工序交接契约"
 * 数据源（单一源）：agentDeclarations.AGENT_DECLARATIONS + dataFlowSpec.DATA_FLOW_SPEC
 * 检查项：
 *   1) 每个步骤都有职责声明（materialNeeds/constraintNeeds/outputs）
 *   2) 每个步骤在 dataFlowSpec 有 inputs/outputs/downstream
 *   3) downstream 指向真实存在的步骤（无幽灵下游）
 *   4) 必需输入都能被"上游步骤的 outputs 或项目/DB来源"满足（无断链）
 *   5) 步骤清单与 KNOWN_STEP_KEYS 一致（防漂）
 */
const { Checker, out } = require('./_lib');
const { AGENT_DECLARATIONS } = require('../../server/services/pipeline/agentDeclarations');
const { DATA_FLOW_SPEC, KNOWN_STEP_KEYS } = require('../../server/services/pipeline/dataFlowSpec');

const c = new Checker('Agent 职责划分 + 交接契约（静态）');
const declIds = Object.keys(AGENT_DECLARATIONS);
const specIds = Object.keys(DATA_FLOW_SPEC);

// 1) 职责声明完整性
for (const id of declIds) {
    const d = AGENT_DECLARATIONS[id];
    const hasNeeds = Array.isArray(d.materialNeeds) && d.materialNeeds.length > 0;
    const hasConstraints = d.constraintNeeds && Object.keys(d.constraintNeeds).length > 0;
    c.add(`[职责] ${id} 声明素材需求+约束需求`, hasNeeds && hasConstraints,
        `needs=${d.materialNeeds?.length || 0} constraints=${Object.keys(d.constraintNeeds || {}).length}`);
}

// 2) dataFlowSpec 覆盖
for (const id of KNOWN_STEP_KEYS) {
    const s = DATA_FLOW_SPEC[id];
    const ok = !!(s && s.inputs && s.outputs && Array.isArray(s.downstream));
    c.add(`[数据流] ${id} 有 inputs/outputs/downstream`, ok,
        s ? `in=${s.inputs.length} out=${s.outputs.length} down=[${s.downstream.join(',')}]` : '规范缺失');
}

// 3) downstream 无幽灵
for (const id of specIds) {
    const down = DATA_FLOW_SPEC[id].downstream || [];
    const ghosts = down.filter(x => !KNOWN_STEP_KEYS.includes(x));
    c.add(`[下游] ${id} 下游均为真实步骤`, ghosts.length === 0, ghosts.length ? '幽灵: ' + ghosts.join(',') : '');
}

// 4) 声明/规范一致性（步骤集合 vs 声明集合）
const undeclared = KNOWN_STEP_KEYS.filter(k => !declIds.includes(k) && !['outline-generator','material-organizer','material-registrar','knowledge-extractor','consistency-constraint'].includes(k));
c.add('[一致性] 执行类步骤均有职责声明', undeclared.length === 0, undeclared.join(',') || '');

// 5) 交接断链：每个 agent 的"必需输入"应能由上游 outputs 或外部来源满足
const producedBy = {}; // 数据名 -> 产出它的步骤
for (const id of specIds) for (const o of DATA_FLOW_SPEC[id].outputs) producedBy[o.name] = id;
const EXTERNAL = /PUSH|API|DataContext|store|materialIndex|project|recentChapters|PULL/i;
for (const id of specIds) {
    const s = DATA_FLOW_SPEC[id];
    for (const inp of s.inputs) {
        if (!inp.required) continue;
        const fromStep = producedBy[inp.name];
        const external = EXTERNAL.test(inp.from || '') || EXTERNAL.test(inp.source || '');
        c.add(`[交接] ${id} ⇐ 必需输入「${inp.name}」可满足`, !!fromStep || external,
            fromStep ? `来自 ${fromStep}` : (external ? `外部来源: ${inp.from}` : '断链！'));
    }
}

const r = c.report();
out('20_agents.json', { summary: { pass: r.pass, total: r.total }, rows: r.rows });
console.log('\n声明数:', declIds.length, '| 规范步骤数:', specIds.length, '| KNOWN:', KNOWN_STEP_KEYS.length);
process.exit(r.pass === r.total ? 0 : 1);
