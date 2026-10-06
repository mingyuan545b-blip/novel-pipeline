#!/usr/bin/env node
/**
 * designCharacterCraft.js — 人物工艺体检 + 设计模板（离线，默认只读）
 *
 * 目的（P2）：把"台词/人物/高光"的质量下限变成可执行的门禁——
 *   开写前/复盘时体检每个角色的工艺完整度，主角缺失即不合格。
 * 依据：docs/design/角色编年史升级-多维分层与素材质检.md §三/§四
 *
 * 用法：
 *   node scripts/designCharacterCraft.js --help                 # 用法
 *   node scripts/designCharacterCraft.js [--project <id>]       # 体检（只读）
 *   node scripts/designCharacterCraft.js --json                 # JSON 输出
 *   node scripts/designCharacterCraft.js --emit-prompt          # 打印设计模板
 *   node scripts/designCharacterCraft.js --strict               # 主角缺工艺则退出码=1
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
const EMIT = argv.includes('--emit-prompt');
const pIdx = argv.indexOf('--project');
const PROJECT = pIdx >= 0 ? String(argv[pIdx + 1] || '') : '';

const { FIELD_SPECS } = require('../server/config/materialDepthSpec');
const { validateQuotes } = require('../server/services/validateQuotes');

const CRAFT_FIELDS = [
    { key: 'charisma', label: '人格魅力' },
    { key: 'philosophy', label: '哲学观' },
    { key: 'entranceDesign', label: '出场设计' },
    { key: 'quoteLibrary', label: '金句库', kind: 'quotes' },
    { key: 'highlightScenes', label: '高光场景', kind: 'highlights' }
];

const DESIGN_TEMPLATE = `【人物工艺设计模板】（供设计器/人工填写，落 entities）
【核心欲望】[角色最深层的追求，不是"帮主角"]
【恐惧】[深层驱动：他最怕什么]
【谎言】[他信错的东西，会被现实打碎＝成长弧]（配角可省）
【创伤/软肋】[一碰就破防的点]
【人格魅力】[核心魅力特质，参考蛊真人方源/龙公]
【哲学观】[核心信念与价值观]
【金句库】[每条格式 场景：原文金句（＋记忆点）]
【出场设计】[出场方式与标志性场景]
【高光场景】[场景＋做了什么＋为什么是名场面]`;

function checkEntity(entity) {
    const missing = [];
    const detail = {};
    for (const f of CRAFT_FIELDS) {
        const spec = FIELD_SPECS[f.label] || { minChars: 1 };
        const val = entity[f.key];
        if (f.kind === 'quotes') {
            const r = validateQuotes(Array.isArray(val) ? val : []);
            detail[f.label] = `${r.passed} 条合格名言`;
            if (r.passed === 0) missing.push(f.label);
        } else if (f.kind === 'highlights') {
            const n = Array.isArray(val) ? val.length : 0;
            detail[f.label] = `${n} 条高光`;
            if (n === 0) missing.push(f.label);
        } else {
            const len = (typeof val === 'string' ? val : '').trim().length;
            detail[f.label] = `${len} 字`;
            if (len < spec.minChars) missing.push(f.label);
        }
    }
    return { missing, detail };
}

(async () => {
    if (EMIT) { console.log(DESIGN_TEMPLATE); return; }

    const { initPgPool } = require('../server/db/pgPool');
    await initPgPool(process.env.DATABASE_URL);
    const store = require('../server/store');

    let entities = await store.queryItems('entities', { entityType: 'character' });
    if (PROJECT) entities = entities.filter(e => e.projectId === PROJECT);

    const report = entities.map(e => {
        const { missing, detail } = checkEntity(e);
        return { id: e.id, name: e.name, roleLevel: e.roleLevel || 'npc', missing, detail };
    });

    const protagonistFails = report.filter(r => r.roleLevel === 'protagonist' && r.missing.length > 0);

    if (AS_JSON) {
        console.log(JSON.stringify({ total: report.length, protagonistFails: protagonistFails.length, report }, null, 2));
    } else {
        console.log(`[craft-audit] 角色 ${report.length} 个 · 主角不合格 ${protagonistFails.length} 个`);
        for (const r of report) {
            const flag = r.missing.length === 0 ? 'OK' : `缺: ${r.missing.join('/')}`;
            console.log(`  - [${r.roleLevel}] ${r.name}: ${flag}`);
        }
        if (protagonistFails.length > 0) console.log('  提示：用 --emit-prompt 查看设计模板补齐');
    }
    if (STRICT && protagonistFails.length > 0) process.exit(1);
})().catch(err => { console.error('[craft-audit] 失败:', err.message); process.exit(1); });
