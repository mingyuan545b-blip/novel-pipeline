'use strict';

/**
 * techniqueKey.js — 技法「原子化合成键」（纯函数模块）
 *
 * 目标（D2-a）：给每条技法一个稳定的**原子键** = 部门 | 子类 | 去修饰后的语义核。
 *   - 用途1（防趋同）：提取时同一原子键只保留一条，避免同一"做法"换个说法堆进库。
 *   - 用途2（可检索/分组）：作为跨来源聚合、统计的稳定分组键。
 *
 * 设计取舍（源头治理·不硬编码）：只做**轻量规范化**（大小写/标点/空白/常见虚词），
 *   不做语义嵌入、不维护词表 —— 避免把业务规则写死；真正的同义判定交给 LLM 提取 prompt。
 */

/** 标点/空白/括号等噪音字符（用字符集常量，避免逐字硬编码规则散落） */
const NOISE_CHARS = ' \t\n\r（）()【】[]{}《》「」『』·．.。、，,;；:：!！?？~～-—/|"\'`’“”';
/** 仅去纯结构虚词（不碰"可视化/式样"等有实义的构词，避免破坏语义核） */
const STOP_TOKENS = ['的', '地', '得', '之'];

function stripNoise(text) {
    let out = '';
    for (const ch of String(text == null ? '' : text)) {
        if (NOISE_CHARS.indexOf(ch) === -1) out += ch;
    }
    return out.toLowerCase();
}

/** 语义核：去噪音 + 去虚词/后缀 */
function coreOf(text) {
    let out = stripNoise(text);
    for (const t of STOP_TOKENS) out = out.split(t).join('');
    return out;
}

/**
 * 构建技法原子键。
 * @param {{department?:string, subcategory?:string, display_name?:string, name?:string}} tech
 * @returns {string}
 */
function atomicKey(tech) {
    if (!tech) return '';
    const dept = stripNoise(tech.department);
    const sub = stripNoise(tech.subcategory);
    const core = coreOf(tech.display_name || tech.name);
    return `${dept}|${sub}|${core}`;
}

/**
 * 两条技法是否同一原子单元：同分类且语义核相等/互相包含（≥4字防误并）。
 * @param {string} aKey
 * @param {string} bKey
 * @returns {boolean}
 */
function isSameAtomic(aKey, bKey) {
    if (!aKey || !bKey) return false;
    if (aKey === bKey) return true;
    const [aDept, aSub, aCore] = aKey.split('|');
    const [bDept, bSub, bCore] = bKey.split('|');
    if (aDept !== bDept || aSub !== bSub) return false;
    if (aCore.length >= 4 && bCore.length >= 4) return aCore.includes(bCore) || bCore.includes(aCore);
    return false;
}

module.exports = { atomicKey, isSameAtomic, coreOf, stripNoise };
