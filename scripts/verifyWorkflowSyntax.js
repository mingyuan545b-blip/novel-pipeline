#!/usr/bin/env node
/**
 * verifyWorkflowSyntax.js — GitHub Actions 工作流语法门禁
 *
 * 背景（E3c）：ci.yml 里一个未加引号的 step 名称含 ": "，使整个 workflow YAML 非法
 *   —— 若无人发现，CI 会"连启动都失败"，且本地毫无提示（本轮实测踩到）。
 * 本门禁在本地就把它拦住：解析 .github/workflows/*.yml 并做最小结构断言。
 *
 * 用法：node scripts/verifyWorkflowSyntax.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, '.github', 'workflows');

let errors = 0;
const err = (m) => { console.error(`  ❌ [ERROR] ${m}`); errors++; };
const ok = (m) => console.log(`  ✅ ${m}`);

function checkWorkflow(file) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    let doc;
    try {
        doc = yaml.load(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        err(`${rel} YAML 解析失败：${e.message.split('\n')[0]}`);
        return;
    }
    if (!doc || typeof doc !== 'object') { err(`${rel} 解析结果为空`); return; }
    if (!doc.jobs || typeof doc.jobs !== 'object' || Object.keys(doc.jobs).length === 0) {
        err(`${rel} 缺少 jobs`);
        return;
    }
    for (const [name, job] of Object.entries(doc.jobs)) {
        if (!job || typeof job !== 'object') { err(`${rel} job "${name}" 结构异常`); continue; }
        if (!job['runs-on'] && !job.uses) err(`${rel} job "${name}" 缺少 runs-on`);
        if (!Array.isArray(job.steps) || job.steps.length === 0) { err(`${rel} job "${name}" 缺少 steps`); continue; }
        for (const step of job.steps) {
            if (!step || typeof step !== 'object') { err(`${rel} job "${name}" 存在非对象 step`); continue; }
            if (!step.uses && !step.run) err(`${rel} job "${name}" 存在既无 uses 也无 run 的 step`);
        }
    }
    ok(`${rel}（${Object.keys(doc.jobs).length} 个 job）`);
}

function main() {
    console.log('========================================');
    console.log('GitHub Actions 工作流语法校验');
    console.log('========================================');
    if (!fs.existsSync(DIR)) { ok('无 .github/workflows 目录，跳过'); return; }
    const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
    if (files.length === 0) { ok('无工作流文件，跳过'); return; }
    for (const f of files) checkWorkflow(path.join(DIR, f));
    console.log('\n========================================');
    console.log(`校验完成: ${errors} errors`);
    console.log('========================================');
    if (errors > 0) { console.log('❌ 工作流文件存在错误 — CI 可能无法启动'); process.exit(1); }
    console.log('✅ 所有工作流语法结构正常');
}

main();
