'use strict';

/**
 * audit-character-names.js — 角色命名体检（只读）
 *
 * 查三件事（用户反馈 2026-10-08："别再来萧炎/龙傲天/沈砚/顾清寒/柳如烟"）：
 *   ① 命中禁用名单 / 流水线拼名（namingQualitySpec.validateName）
 *   ② 跨项目重名（同一名字在多个项目里反复出现 = 模板化）
 *   ③ 同项目内重字率高（同一姓氏/后缀扎堆）
 *
 * 用法：
 *   node scripts/audit-character-names.js                 # 全项目体检
 *   node scripts/audit-character-names.js --project <id>   # 单项目体检
 *   node scripts/audit-character-names.js --json
 *   node scripts/audit-character-names.js --strict         # 有违规则退出码=1（可接 CI）
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
    console.log(require('fs').readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n/, ''));
    process.exit(0);
}
const AS_JSON = argv.includes('--json');
const STRICT = argv.includes('--strict');
const pIdx = argv.indexOf('--project');
const PROJECT = pIdx >= 0 ? String(argv[pIdx + 1] || '') : '';

const namingSpec = require('../server/services/namingQualitySpec');

/** 纯函数：命名体检（便于单测） */
function auditNames(items) {
    const list = Array.isArray(items) ? items : [];
    const invalid = [];
    const byName = new Map();
    const bySurname = new Map();
    for (const it of list) {
        const r = namingSpec.validateName(it.name, it.eraKey);
        if (!r.valid) invalid.push({ name: it.name, projectId: it.projectId, issues: r.issues });
        if (!byName.has(it.name)) byName.set(it.name, new Set());
        byName.get(it.name).add(it.projectId);
        const surname = String(it.name || '').slice(0, 1);
        bySurname.set(surname, (bySurname.get(surname) || 0) + 1);
    }
    const duplicated = [...byName.entries()].filter(([, pids]) => pids.size > 1)
        .map(([name, pids]) => ({ name, projects: pids.size }));
    const crowded = [...bySurname.entries()].filter(([, n]) => n >= 4).map(([surname, n]) => ({ surname, count: n }));
    return { total: list.length, invalid, duplicated, crowded };
}

async function main() {
    const { initPgPool } = require('../server/db/pgPool');
    await initPgPool(process.env.DATABASE_URL);
    const store = require('../server/store');
    const projects = await store.queryItems('projects', {});
    const eraOf = new Map(projects.map(p => [p.id, namingSpec.inferEraKey(p.genre || '')]));

    let entities = await store.queryItems('entities', { entityType: 'character' });
    if (PROJECT) entities = entities.filter(e => e.projectId === PROJECT);
    const items = entities.filter(e => e.name).map(e => ({ name: e.name, projectId: e.projectId, eraKey: eraOf.get(e.projectId) || '' }));

    const report = auditNames(items);
    if (AS_JSON) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        console.log(`[name-audit] 角色 ${report.total} 个 · 违规 ${report.invalid.length} · 跨项目重名 ${report.duplicated.length} · 扎堆姓 ${report.crowded.length}`);
        for (const x of report.invalid.slice(0, 30)) console.log(`  ✗ ${x.name}: ${x.issues.join('；')}`);
        for (const x of report.duplicated.slice(0, 15)) console.log(`  ⚠ 重名 ${x.name}（${x.projects} 个项目）`);
        for (const x of report.crowded.slice(0, 10)) console.log(`  ⚠ 姓氏扎堆 ${x.surname}×${x.count}`);
        if (report.invalid.length === 0 && report.duplicated.length === 0) console.log('  ✅ 命名体检通过');
    }
    if (STRICT && (report.invalid.length > 0 || report.duplicated.length > 0)) process.exit(1);
}

if (require.main === module) {
    main().catch(err => { console.error('[name-audit] 失败:', err.message); process.exit(1); });
}

module.exports = { auditNames };
