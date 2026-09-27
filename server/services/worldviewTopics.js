'use strict';

/**
 * worldviewTopics.js — 世界观主题归一（纯函数）
 *
 * 问题（实测）：materialItemProcessor 逐章用 `wc.name` 新建 KV 世界观主题，
 * 同一设定跨章被拆成多条（三账合议制 / 三账合议制·以账治世 / 三账合议制实体化；
 * 机制 / 协议 / 模式 同义并存）→ 34 条碎片 = 多重源头。
 *
 * 处置：写入前把"新名字"归一到**已有主题**（先剥离括号/斜杠/顿号后缀，再做互含匹配），
 * 命中则更新既有主题，未命中才新建。
 */

/** 同义尾缀：仅用于"匹配"，不改变展示名 */
const SYNONYM_TAILS = /(机制|协议|模式|体系|性质|本质|规律|规则|设定)$/;

/** 归一（匹配键）：去括号/斜杠后缀 → 去同义尾缀 → 去空白标点 */
function normalizeTopic(name) {
    return String(name || '')
        .split(/[（(]/)[0]
        .split(/[\/／]/)[0]
        .replace(/[\s:：・·、,，。.]+/g, '')
        .replace(SYNONYM_TAILS, '')
        .trim();
}

const ratio = (a, b) => (a.length && b.length ? Math.min(a.length, b.length) / Math.max(a.length, b.length) : 0);

/**
 * 把 incoming 归一到已有主题名；找不到则返回原名。
 * @param {string} incoming 新主题名
 * @param {Iterable<string>} existingKeys 已有主题名
 */
function resolveTopicKey(incoming, existingKeys) {
    const raw = String(incoming || '').trim();
    if (!raw) return raw;
    const keys = [...(existingKeys || [])];
    // 1) 精确（区分大小写不敏感）
    const exact = keys.find(k => k === raw);
    if (exact) return exact;

    const n = normalizeTopic(raw);
    if (!n) return raw;
    // 2) 归一后精确
    const normExact = keys.find(k => normalizeTopic(k) === n);
    if (normExact) return normExact;
    // 3) 互含（较长者包含较短者，且长度比 ≥0.6，避免"力量体系"吞并"世界观体系"这类过宽合并）
    let best = null;
    for (const k of keys) {
        const kn = normalizeTopic(k);
        if (!kn) continue;
        if ((kn.includes(n) || n.includes(kn)) && ratio(kn, n) >= 0.6) {
            if (!best || kn.length > normalizeTopic(best).length) best = k;
        }
    }
    return best || raw;
}

module.exports = { normalizeTopic, resolveTopicKey };
