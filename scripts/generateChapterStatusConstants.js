#!/usr/bin/env node
/**
 * 生成前端章节状态常量（单一真相源的派生产物）。
 * 源：server/services/chapterStatus.js
 * 产物：client/src/shared/chapterStatusConstants.js
 * 用法：node scripts/generateChapterStatusConstants.js [--check]
 *   --check 只校验产物是否与源一致（不一致 exit 1），供闸门/CI 使用。
 */
const fs = require('fs');
const path = require('path');
const status = require('../server/services/chapterStatus');

const OUT = path.join(__dirname, '..', 'client', 'src', 'shared', 'chapterStatusConstants.js');

function j(v) { return JSON.stringify(v); }

function build() {
    const order = status.STATUS_ORDER;
    const orderedAll = [...order, ...status.ALL_STATUSES.filter(s => !order.includes(s))];
    const labels = {};
    const colors = {};
    for (const s of orderedAll) {
        labels[s] = status.STATUS_LABELS[s] || s;
        colors[s] = status.STATUS_COLORS[s] || 'blue';
    }
    const written = order.filter(s => status.CHAPTER_STATUS.IN_PROGRESS.includes(s) || status.CHAPTER_STATUS.COMPLETED.includes(s));
    const headerWritten = written.filter(s => s !== status.STATUS_VALUES.MATERIAL_UPDATED);
    const lines = [];
    lines.push('/**');
    lines.push(' * 章节状态展示常量 —— 自动生成，请勿手改！');
    lines.push(' * 生成器：scripts/generateChapterStatusConstants.js（源：server/services/chapterStatus.js）');
    lines.push(' * 校验：npm run gen:chapter-status -- --check（漂移会被闸门/CI 拦截）');
    lines.push(' */');
    lines.push('');
    lines.push(`export const ALL_STATUSES = ${j(status.ALL_STATUSES)};`);
    lines.push('');
    lines.push(`export const STATUS_ORDER = ${j(order)};`);
    lines.push('');
    lines.push(`export const STATUS_LABELS = ${j(labels)};`);
    lines.push('');
    lines.push(`export const STATUS_COLORS = ${j(colors)};`);
    lines.push('');
    lines.push('// 已写状态：包含所有"已有正文内容"的章节状态');
    lines.push(`export const WRITTEN_STATUSES = ${j(written)};`);
    lines.push('');
    lines.push('// 头部统计的已写状态（不含 material-updated）');
    lines.push(`export const HEADER_WRITTEN_STATUSES = ${j(headerWritten)};`);
    lines.push('');
    return lines.join('\n');
}

const content = build();
const check = process.argv.includes('--check');
if (check) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur !== content) {
        console.error('✗ chapterStatusConstants.js 与后端单一源不一致，请运行：node scripts/generateChapterStatusConstants.js');
        process.exit(1);
    }
    console.log('✓ chapterStatusConstants.js 与后端单一源一致');
    process.exit(0);
}
fs.writeFileSync(OUT, content, 'utf8');
console.log(`✓ 已生成 ${path.relative(process.cwd(), OUT)}`);
