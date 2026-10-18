#!/usr/bin/env node
/**
 * verifyLineCount.js — 单文件行数上限门禁（CI 用）
 *
 * 背景（E3a）：ci.yml 里原有一段内联 node -e 脚本自行实现"200 行"扫描，
 *   跳过规则与唯一规则源 scripts/lib/ironLawRules.js 不一致（未跳过 *.test.*），
 *   于是 server/tests/unit/materialDepthValidator.test.js 被判超标 → CI 恒红。
 * 本脚本复用唯一规则源（MAX_LINES / LINE_SCAN_PREFIXES / isLineScanTarget），消除影子规则。
 *
 * 用法：node scripts/verifyLineCount.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { MAX_LINES, LINE_SCAN_PREFIXES, isLineScanTarget } = require('./lib/ironLawRules');

const ROOT = path.join(__dirname, '..');

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
    }
    return out;
}

function main() {
    console.log('========================================');
    console.log(`单文件 ${MAX_LINES} 行上限校验（规则源：scripts/lib/ironLawRules.js）`);
    console.log('========================================');
    const violations = [];
    let checked = 0;
    for (const prefix of LINE_SCAN_PREFIXES) {
        const rootDir = path.join(ROOT, prefix);
        if (!fs.existsSync(rootDir)) continue;
        for (const file of walk(rootDir)) {
            const rel = path.relative(ROOT, file).split(path.sep).join('/');
            if (!isLineScanTarget(rel)) continue;
            checked++;
            const lines = fs.readFileSync(file, 'utf8').split('\n').length;
            if (lines > MAX_LINES) violations.push(`${rel} — ${lines} 行`);
        }
    }
    for (const v of violations) console.error(`  ❌ [ERROR] ${v}`);
    console.log(`\n扫描 ${checked} 个文件，超限 ${violations.length} 个`);
    if (violations.length > 0) {
        console.log(`❌ 存在超过 ${MAX_LINES} 行的文件`);
        process.exit(1);
    }
    console.log(`✅ 所有文件在 ${MAX_LINES} 行上限内`);
}

main();
