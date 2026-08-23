const fs = require('fs');
const path = require('path');
const { loadChecklist, saveChecklist, loadState, saveState, verifyItem, showStatus } = require('./supervisorCore');

const command = process.argv[2] || 'status';
const itemId = process.argv[3];

switch (command) {
    case 'status': {
        showStatus(loadChecklist());
        break;
    }
    case 'verify': {
        if (!itemId) { console.error('用法: node supervisor.js verify <item-id>'); process.exit(1); }
        const checklist = loadChecklist();
        const item = checklist.items.find(i => i.id === itemId);
        if (!item) { console.error(`未找到项: ${itemId}`); process.exit(1); }
        const result = verifyItem(item);
        const state = loadState();
        state[itemId] = { verifiedAt: new Date().toISOString(), passed: result.passed, results: result.results || [] };
        saveState(state);
        if (result.passed) { console.log(`\n  🎉 ${itemId} 验证通过！`); item.status = 'completed'; saveChecklist(checklist); }
        else { console.log(`\n  💥 ${itemId} 验证失败！`); console.log(`  请修复后重新运行: node scripts/supervisor.js verify ${itemId}`); process.exit(1); }
        break;
    }
    case 'next': {
        const checklist = loadChecklist();
        const nextItem = checklist.items.find(i => i.status === 'pending' && !i.id.endsWith('-GATE'));
        if (!nextItem) { console.log('所有项已完成！'); break; }
        const prevPhase = checklist.items.filter(i => i.status !== 'pending' && !i.id.endsWith('-GATE'));
        const prevPhaseNum = prevPhase.length > 0 ? Math.max(...prevPhase.map(i => i.phase)) : -1;
        if (nextItem.phase > prevPhaseNum + 1 && prevPhaseNum >= 0) {
            const gateId = `P${prevPhaseNum}-GATE`;
            const gate = checklist.items.find(i => i.id === gateId);
            if (gate && gate.status !== 'completed') { console.log(`\n  🚫 不能跳Phase！请先完成 ${gateId}`); process.exit(1); }
        }
        nextItem.status = 'in_progress'; saveChecklist(checklist);
        console.log(`\n  📋 下一个任务: ${nextItem.id} - ${nextItem.title}`);
        console.log(`  Phase: ${nextItem.phase} | 风险: ${nextItem.risk}`);
        console.log(`  描述: ${nextItem.description}`);
        console.log(`  涉及文件:`); nextItem.files.forEach(f => console.log(`    - ${f}`));
        console.log(`\n  完成后运行: node scripts/supervisor.js verify ${nextItem.id}`);
        break;
    }
    case 'gate': {
        if (!itemId) {
            const gates = loadChecklist().items.filter(i => i.id.endsWith('-GATE'));
            console.log('可用验证门:'); gates.forEach(g => console.log(`  ${g.id}: ${g.title} [${g.status}]`)); break;
        }
        const checklist = loadChecklist();
        const gate = checklist.items.find(i => i.id === itemId);
        if (!gate) { console.error(`未找到验证门: ${itemId}`); process.exit(1); }
        const phaseNum = gate.id.match(/P(\d+)/)?.[1];
        const phaseItems = checklist.items.filter(i => i.phase === parseInt(phaseNum) && !i.id.endsWith('-GATE'));
        const incomplete = phaseItems.filter(i => i.status !== 'completed');
        if (incomplete.length > 0) { console.log(`\n  🚫 Phase ${phaseNum} 有 ${incomplete.length} 项未完成:`); incomplete.forEach(i => console.log(`    ❌ ${i.id}: ${i.title}`)); process.exit(1); }
        console.log(`\n  所有Phase ${phaseNum}项已完成，执行验证门测试...`);
        const result = verifyItem(gate);
        if (result.passed) { gate.status = 'completed'; saveChecklist(checklist); const state = loadState(); state[gate.id] = { verifiedAt: new Date().toISOString(), passed: true }; saveState(state); console.log(`\n  🎉 ${gate.id} 验证门通过！`); }
        else { console.log(`\n  💥 ${gate.id} 验证门失败！`); process.exit(1); }
        break;
    }
    case 'reset': {
        if (!itemId) { console.error('用法: node supervisor.js reset <item-id|all>'); process.exit(1); }
        const checklist = loadChecklist();
        if (itemId === 'all') { checklist.items.forEach(i => i.status = 'pending'); console.log('所有项已重置为pending'); }
        else { const item = checklist.items.find(i => i.id === itemId); if (!item) { console.error(`未找到项: ${itemId}`); process.exit(1); } item.status = 'pending'; console.log(`${itemId} 已重置为pending`); }
        saveChecklist(checklist);
        break;
    }
    case 'snapshot': {
        const checklist = loadChecklist();
        const snapshot = { timestamp: new Date().toISOString(), items: checklist.items.map(i => ({ id: i.id, title: i.title, status: i.status, phase: i.phase })) };
        const snapPath = path.join(__dirname, `snapshot-${Date.now()}.json`);
        fs.writeFileSync(snapPath, JSON.stringify(snapshot, null, 2), 'utf-8');
        console.log(`快照已保存: ${snapPath}`);
        showStatus(checklist);
        break;
    }
    default:
        console.log(`\nNovel Pipeline 监督程序\n用法:\n  status              查看状态\n  next                获取下一个待办项\n  verify <item-id>    验证某项\n  gate [gate-id]      检查验证门\n  reset <id|all>      重置状态\n  snapshot            保存快照\n`);
}
