#!/usr/bin/env node
/**
 * verifyMaterialAssemblyEntry.js — 单点装配入口审计（P1-4c，只读）
 *
 * 规则：任何 agent 取素材必须走 materialStateAssembler（唯一装配+记账入口），
 *       不允许绕过它直接调调度器 —— 绕过的后果是"装配图缺记录 + 缺口无人报警"。
 * 白名单：调度器自身（被装配入口调用）、装配入口自身。
 *
 * 用法：node scripts/verifyMaterialAssemblyEntry.js   （发现违规 exit 1）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCAN_DIRS = ['server', 'scripts'];
const NEEDLE = 'schedule' + 'Materials(';
const ALLOWLIST = new Set([
    path.join('server', 'services', 'pipeline', 'agentMaterialScheduler.js'),
    path.join('server', 'services', 'pipeline', 'materialStateAssembler.js'),
    path.join('scripts', 'verifyMaterialAssemblyEntry.js'),
]);
const SKIP_DIRS = new Set(['node_modules', '.git', 'data', 'output', 'coverage']);

function walk(dir, out = []) {
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
    for (const dir of SCAN_DIRS) {
        const abs = path.join(ROOT, dir);
        if (!fs.existsSync(abs)) continue;
        for (const file of walk(abs)) {
            const rel = path.relative(ROOT, file);
            if (ALLOWLIST.has(rel)) continue;
            const lines = fs.readFileSync(file, 'utf8').split('\n');
            lines.forEach((line, i) => {
                if (line.trim().startsWith('*') || line.trim().startsWith('//')) return; // 注释不算
                if (line.includes(NEEDLE)) violations.push({ file: rel, line: i + 1, text: line.trim() });
            });
        }
    }
    return violations;
}

const violations = scan();
console.log('=== MATERIAL ASSEMBLY ENTRY AUDIT ===\n');
if (violations.length === 0) {
    console.log('✅ 所有 agent 均通过 materialStateAssembler 装配素材（无绕过调度器直调）');
    process.exit(0);
}
for (const v of violations) console.log(`❌ ${v.file}:${v.line}  ${v.text}`);
console.log(`\n共 ${violations.length} 处绕过单点装配入口 → 请改为 assembleMaterialState(agentType, params)`);
process.exit(1);
