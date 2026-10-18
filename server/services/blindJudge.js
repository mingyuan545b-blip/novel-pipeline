'use strict';

/**
 * blindJudge.js — 双盲评判去标签（纯函数）
 *
 * 目的（D3-b）：A/B 评估时对评判者**隐藏来源身份**（模型/供应商/技法/章节），
 *   只暴露匿名代号（A/B/C…），并**确定性地打乱位置**（避免"总是 A 更好"的位置偏置）。
 *   映射（代号→原始 id）留在服务端，评判结束后才 unblind。
 *
 * 复用 holdoutAssigner.hashInt 做确定性洗牌 —— 哈希实现单一源（模块化）。
 */
const { hashInt } = require('./holdoutAssigner');

const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** 生成代号序列 A, B, C … */
function assignCodes(n) {
    const codes = [];
    for (let i = 0; i < n; i++) codes.push(CODE_ALPHABET[i] || `X${i}`);
    return codes;
}

/**
 * 构建双盲集合。
 * @param {Array<{id:string, payload:*}>} items
 * @param {{seed?:string}} [opts]
 * @returns {{blinded:Array<{code:string, payload:*}> , mapping:Object<string,string>}}
 *   mapping：代号 → 原始 id（服务端保存，勿给评判者）
 */
function buildBlindSet(items, opts = {}) {
    const list = Array.isArray(items) ? items : [];
    const seed = opts.seed || '';
    const codes = assignCodes(list.length);
    // 确定性洗牌：按 hash(seed#id) 升序，同输入同顺序（可复现、无 Math.random）
    const ordered = list
        .map((it, idx) => ({ it, r: hashInt(`${seed}#${it && it.id != null ? it.id : idx}`) }))
        .sort((a, b) => a.r - b.r);
    const blinded = [];
    const mapping = {};
    ordered.forEach((o, i) => {
        blinded.push({ code: codes[i], payload: o.it.payload });
        if (o.it && o.it.id != null) mapping[codes[i]] = o.it.id;
    });
    return { blinded, mapping };
}

/** 揭盲：代号 → 原始 id */
function unblindCode(code, mapping) {
    return mapping && Object.prototype.hasOwnProperty.call(mapping, code) ? mapping[code] : null;
}

module.exports = { assignCodes, buildBlindSet, unblindCode, CODE_ALPHABET };
