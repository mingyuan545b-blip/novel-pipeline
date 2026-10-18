'use strict';

/**
 * narrativePromise — "本书叙事承诺"提示块（12-创作工艺 Stage0）
 *
 * 目的：让写手/审核在拿到素材与约束之外，还知道"读者要什么"，避免为凑元素/凑笑点背离主味情绪。
 * 数据来源：project.narrativePromise（唯一写入点：narrativePromiseDesigner）。
 * 缺字段时返回空串，不影响既有项目。
 * 字段名单一源：server/config/narrativePromiseSpec.js（写入端 narrativePromiseDesigner 共用）。
 */
const { FIELDS, pickField } = require('../../config/narrativePromiseSpec');

function buildNarrativePromiseBlock(project) {
    if (!project) return '';
    const p = project.narrativePromise || {};
    const filled = [];
    for (const field of FIELDS) {
        const value = pickField(p, field);
        if (value) filled.push(`- ${field.label}：${value}`);
    }
    if (filled.length === 0) return '';

    const lines = ['【本书叙事承诺（最高优先级，主导每一章的取舍）】', ...filled];
    lines.push('一切写作取舍服从以上承诺：不得为凑元素、凑笑点、凑设定而背离主味情绪。');
    return lines.join('\n');
}

module.exports = { buildNarrativePromiseBlock };
