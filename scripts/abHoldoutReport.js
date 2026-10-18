#!/usr/bin/env node
/**
 * abHoldoutReport.js — 留出集划分报告（D3-a 消费者）
 * 用法：node scripts/abHoldoutReport.js <projectId> [totalChapters] [ratio]
 */
'use strict';

const { isHoldout, bucketOf } = require('../server/services/holdoutAssigner');

const projectId = process.argv[2] || 'demo-project';
const total = Number(process.argv[3]) || 20;
const ratio = process.argv[4] !== undefined ? Number(process.argv[4]) : undefined;

let holdout = 0;
const rows = [];
for (let ch = 1; ch <= total; ch++) {
    const ho = isHoldout(projectId, ch, ratio === undefined ? {} : { ratio });
    if (ho) holdout++;
    rows.push(`ch${String(ch).padStart(3, ' ')}  bucket=${bucketOf(projectId, ch)}  ${ho ? 'HOLDOUT' : 'train'}`);
}
console.log(`project=${projectId}  total=${total}  holdout=${holdout} (${(holdout / total * 100).toFixed(0)}%)`);
console.log(rows.join('\n'));
