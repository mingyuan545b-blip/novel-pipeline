#!/usr/bin/env node
/**
 * verifyMaterialAssemblyEntry.js — 单点装配入口审计（P1-4c/P1-A，只读）
 *
 * 规则：**消费者 agent** 取素材必须走 materialStateAssembler（唯一装配+记账入口），
 *       不允许绕过它直接调调度器 —— 绕过的后果是"装配图缺记录 + 缺口无人报警"。
 *
 * 修正历史：旧版只 grep `scheduleMaterials(`，对"agent 完全不走装配入口"是盲区，
 *          打印"✅ 所有 agent 均通过"属于**假阳性**。现在改为按 agent 名单逐一断言。
 *
 * 角色划分：
 *   · 消费者（必须走装配入口）：writer/first-review/second-review/fast-review/reviser/polisher/final-editor/reader
 *   · 生产者（写素材，不走装配入口）：material-manager / material-organizer / material-registrar
 *   · 声明了需求但实际不取素材（声明待清理）：intent-planner
 *
 * 用法：node scripts/verifyMaterialAssemblyEntry.js   （发现违规 exit 1）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCAN_DIRS = ['server'];
const NEEDLE = 'schedule' + 'Materials(';
const ALLOWLIST = new Set([
    path.join('server', 'services', 'pipeline', 'agentMaterialScheduler.js'),
    path.join('server', 'services', 'pipeline', 'materialStateAssembler.js'),
]);
const SKIP_DIRS = new Set(['node_modules', '.git', 'data', 'output', 'coverage']);

// 每个消费者 agent 走装配入口的"必需调用特征"（评审三件套共用 reviewShared 的变量式调用）
const ENTRY_CALLS = {
    writer: ["assembleMaterialState('writer'"],
    'first-review': ['assembleMaterialState(agentType'],
    'second-review': ['assembleMaterialState(agentType'],
    'fast-review': ['assembleMaterialState(agentType'],
    reviser: ["assembleMaterialState('reviser'"],
    polisher: ["assembleMaterialState('polisher'"],
    'final-editor': ["assembleMaterialState('final-editor'"],
    reader: ["assembleMaterialState('reader'"],
};
const PRODUCERS = new Set(['material-manager', 'material-organizer', 'material-registrar']);
const DECLARED_UNUSED = new Set(['intent-planner']);

function walk(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (entry.name.endsWith('.js')) out.push(full);
    }
    return out;
}

function scan() {
    const violations = [];
    const files = [];
    for (const dir of SCAN_DIRS) files.push(...walk(path.join(ROOT, dir)));

    // 1) 直接调调度器（绕过装配入口）
    for (const file of files) {
        const rel = path.relative(ROOT, file);
        if (ALLOWLIST.has(rel)) continue;
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
            const t = line.trim();
            if (t.startsWith('*') || t.startsWith('//')) return;
            if (line.includes(NEEDLE)) violations.push({ kind: 'direct-scheduler', file: rel, line: i + 1, detail: t });
        });
    }

    // 2) 消费者 agent 逐一断言"走了装配入口"
    let declared = {};
    try { declared = require('../server/services/pipeline/agentDeclarations').AGENT_DECLARATIONS; } catch (_) { declared = {}; }
    const consumerAgents = Object.keys(declared).filter(a => !PRODUCERS.has(a) && !DECLARED_UNUSED.has(a));
    const allSource = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
    for (const agent of consumerAgents) {
        const patterns = ENTRY_CALLS[agent];
        if (!patterns) { violations.push({ kind: 'unknown-agent', file: 'agentDeclarations.js', detail: `新声明的消费者 agent "${agent}" 未登记装配入口断言（请补 ENTRY_CALLS）` }); continue; }
        if (!patterns.some(p => allSource.includes(p))) violations.push({ kind: 'no-entry', file: 'server/services/pipeline', detail: `agent "${agent}" 未走 materialStateAssembler 装配入口` });
    }
    return { violations, consumerAgents };
}

function main() {
    const { violations } = scan();
    console.log('=== MATERIAL ASSEMBLY ENTRY AUDIT ===\n');
    if (violations.length === 0) {
        console.log('✅ 所有消费者 agent 均通过 materialStateAssembler 装配（无绕过/无遗漏）');
        return 0;
    }
    for (const v of violations) console.log(`❌ [${v.kind}] ${v.file}${v.line ? ':' + v.line : ''}  ${v.detail}`);
    console.log(`\n共 ${violations.length} 处问题 → 消费者改为 assembleMaterialState(agentType, params)；生产者请登记 PRODUCERS`);
    return 1;
}

if (require.main === module) process.exit(main());
module.exports = { scan, main };
