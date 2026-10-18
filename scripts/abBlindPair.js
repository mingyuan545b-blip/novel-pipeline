#!/usr/bin/env node
/**
 * abBlindPair.js — 双盲对照打印（D3-b 消费者）
 * 用法：node scripts/abBlindPair.js --a "文本A" --b "文本B" [--seed s] [--reveal]
 */
'use strict';

const { buildBlindSet, unblindCode } = require('../server/services/blindJudge');

function arg(name, def) {
    const i = process.argv.indexOf(name);
    return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const seed = arg('--seed', 'demo');
const set = buildBlindSet([
    { id: 'variantA', payload: arg('--a', '（A 文本）') },
    { id: 'variantB', payload: arg('--b', '（B 文本）') },
], { seed });

console.log(`双盲对照（seed=${seed}）：`);
for (const b of set.blinded) console.log(`  [${b.code}] ${b.payload}`);
if (process.argv.includes('--reveal')) {
    console.log('揭盲：');
    for (const b of set.blinded) console.log(`  ${b.code} → ${unblindCode(b.code, set.mapping)}`);
} else {
    console.log('（映射已隐藏；加 --reveal 揭盲）');
}
