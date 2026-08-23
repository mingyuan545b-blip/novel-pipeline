const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CHECKLIST_PATH = path.join(__dirname, 'checklist.json');
const STATE_PATH = path.join(__dirname, 'supervisor-state.json');

function loadChecklist() { return JSON.parse(fs.readFileSync(CHECKLIST_PATH, 'utf-8')); }
function saveChecklist(data) { fs.writeFileSync(CHECKLIST_PATH, JSON.stringify(data, null, 2), 'utf-8'); }
function loadState() { if (!fs.existsSync(STATE_PATH)) return {}; return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8')); }
function saveState(state) { fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8'); }

function runCommand(cmd) {
    try {
        const output = execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 120000, maxBuffer: 10 * 1024 * 1024, shell: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '0', PATH: process.env.PATH + ';C:\\Program Files\\nodejs' } });
        return { success: true, output, stderr: '', exitCode: 0 };
    } catch (err) { return { success: false, output: err.stdout || '', stderr: err.stderr || '', exitCode: err.status || 1 }; }
}

function assertOutput(assertion, output, stderr) {
    const fullOutput = output + (stderr || '');
    switch (assertion.type) {
        case 'stdout_contains': return fullOutput.includes(assertion.value);
        case 'stdout_not_contains': return !fullOutput.includes(assertion.value);
        case 'stdout_regex': return new RegExp(assertion.pattern).test(fullOutput);
        case 'test_pass_count': {
            const match = fullOutput.match(/Tests:\s+\d+\s+failed,\s+(\d+)\s+passed/) || fullOutput.match(/Tests:\s+(\d+)\s+passed/);
            return match ? parseInt(match[1]) >= (assertion.min || 0) : false;
        }
        case 'test_fail_count': {
            const match = fullOutput.match(/Tests:\s+(\d+)\s+failed/);
            if (match) return parseInt(match[1]) <= (assertion.max || 0);
            return !fullOutput.includes('failed');
        }
        default: console.warn(`Unknown assertion type: ${assertion.type}`); return false;
    }
}

function verifyItem(item) {
    console.log(`\n${'═'.repeat(70)}\n  验证项: ${item.id} - ${item.title}\n  风险: ${item.risk} | 原则: ${item.principle}\n${'═'.repeat(70)}`);
    if (!item.verification || !item.verification.command) { console.log('  ⚠️  无验证命令，跳过'); return { passed: true, reason: 'no_verification' }; }
    console.log(`  执行: ${item.verification.command}\n`);
    const result = runCommand(item.verification.command);
    if (result.output) {
        const lines = result.output.split('\n');
        const relevant = lines.filter(l => l.includes('PASS') || l.includes('FAIL') || l.includes('Tests:') || l.includes('✅') || l.includes('❌') || l.match(/^\s*[√×]/));
        (relevant.length > 0 ? relevant : lines.slice(-20)).forEach(l => console.log(`    ${l}`));
    }
    if (result.stderr) { const errLines = result.stderr.split('\n').filter(l => l.trim()); if (errLines.length > 0) { console.log('    [stderr]:'); errLines.slice(-5).forEach(l => console.log(`    ${l}`)); } }
    let allPassed = true;
    const results = [];
    for (const assertion of (item.verification.assertions || [])) {
        const passed = assertOutput(assertion, result.output, result.stderr);
        const desc = `${assertion.type}: ${assertion.value || assertion.pattern || assertion.min || assertion.max}`;
        results.push({ assertion: desc, passed });
        console.log(`    ${passed ? '✅' : '❌'} ${desc}`);
        if (!passed) allPassed = false;
    }
    return { passed: allPassed, results, exitCode: result.exitCode };
}

function showStatus(checklist) {
    console.log(`\n${'═'.repeat(70)}\n  改造清单状态总览\n${'═'.repeat(70)}`);
    const phases = {};
    for (const item of checklist.items) { const phase = `Phase ${item.phase}`; if (!phases[phase]) phases[phase] = []; phases[phase].push(item); }
    for (const [phase, items] of Object.entries(phases)) {
        const completed = items.filter(i => i.status === 'completed').length;
        console.log(`\n  ${phase} (${completed}/${items.length})`);
        for (const item of items) {
            const icon = item.status === 'completed' ? '✅' : item.status === 'in_progress' ? '🔄' : '⬜';
            console.log(`    ${icon} ${item.id}: ${item.title}`);
        }
    }
    const totalCompleted = checklist.items.filter(i => i.status === 'completed' && !i.id.endsWith('-GATE')).length;
    const totalItems = checklist.items.filter(i => !i.id.endsWith('-GATE')).length;
    console.log(`\n  总进度: ${totalCompleted}/${totalItems} 项完成`);
}

module.exports = { loadChecklist, saveChecklist, loadState, saveState, verifyItem, showStatus };
