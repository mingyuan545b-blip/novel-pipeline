'use strict';

/**
 * materialChangePrecheck — 零成本预判 + 正文压缩（T5）
 *
 * 要解决的两个浪费（都实测存在）：
 *   ① 每章都调一次 material-manager，哪怕本章**没有任何素材变化信号**
 *      （长篇里大量过渡章属于此类）→ 白付一次 LLM 调用 + 一整章正文 token。
 *   ② 素材管理只需要"新出现的专名 + 状态变化句"，却把**整章正文**（2500 字+）喂进去
 *      → 大量无关文本占用预算、稀释模型专注力。
 *
 * 设计原则（宁可漏判，不可误杀）：
 *   · 判"可以跳过"必须**三条全部成立**：无触发词 + 无素材名命中 + 正文足够短
 *   · 只要有任何不确定 → needsLLM=true，照常走 LLM（安全默认）
 *   · 跳过/压缩都必须**留痕**（SkippedReason / digest），可审计、可回滚
 */

/** 状态变化触发词：命中任一 → 必须走 LLM（无法用规则替代语义判断） */
const TRIGGER_PATTERNS = [
    /死|亡|阵亡|毙|殒|牺牲|断气|咽气|离世/,          // 退场
    /离队|退场|告别|离去|离开|分道扬镳|出走/,
    /回收|揭示|真相大白|浮出水面|水落石出|解开/,        // 伏笔
    /获得|得手|夺|抢到|到手|捡到|拾得|缴获/,            // 获得物
    /突破|晋升|进阶|升级|觉醒|顿悟|大成|筑基|封号/,
    /结盟|反目|决裂|背叛|联手|归顺|投靠/,              // 关系
    /首次|初次|第一次|登场|亮相|横空出世/,              // 新角色/新设定
    /损毁|报废|折断|碎裂|耗尽|失效|被毁/,
    /晋升为|成为|坐上了|接任|继位/,
];

/** 判定阈值：正文短于此时，"无信号"才更可信（长章包含的信息更多） */
const SHORT_CHAPTER_CHARS = 1200;
/** 单句最大长度（压缩时截断，避免一句占满预算） */
const MAX_DIGEST_SENTENCE = 200;

const SENTENCE_SPLIT = /(?<=[。！？!?；\n])/;

/** 素材名索引：用于判断"本章有没有碰到已有素材" */
function buildMaterialIndex(materials) {
    const names = (materials || [])
        .filter(m => m && !m.archived && typeof m.name === 'string' && m.name.trim().length >= 2)
        .map(m => m.name.trim());
    return [...new Set(names)].sort((a, b) => b.length - a.length);
}

function splitSentences(content) {
    return String(content || '').split(SENTENCE_SPLIT).map(s => s.trim()).filter(Boolean);
}

/**
 * 预判：本章是否需要跑 LLM 素材管理。
 * @returns {{needsLLM:boolean, reasons:string[], signals:string[], hitMaterials:string[]}}
 */
function precheckChangeSignals(chapterContent, materials) {
    const content = String(chapterContent || '');
    const reasons = [];
    const signals = [];

    TRIGGER_PATTERNS.forEach((re, i) => {
        const m = content.match(re);
        if (m) { signals.push(m[0]); reasons.push(`触发词#${i}:"${m[0]}"`); }
    });

    const names = buildMaterialIndex(materials);
    const hitMaterials = names.filter(n => content.includes(n));
    if (hitMaterials.length > 0) reasons.push(`命中已有素材名:${hitMaterials.slice(0, 5).join('、')}`);

    // 安全默认：正文够长时，"什么都没命中"更可能是漏判而不是真没变化 → 照常走 LLM
    if (reasons.length === 0 && content.length >= SHORT_CHAPTER_CHARS) {
        reasons.push(`正文长度${content.length}≥${SHORT_CHAPTER_CHARS}，无法确信"无变化"`);
    }

    return { needsLLM: reasons.length > 0, reasons, signals, hitMaterials };
}

/**
 * 正文压缩：只保留"命中触发词或素材名"的句子 ±1 句上下文。
 * 压缩后为空 → 返回 null（调用方必须回退全文，不能拿空摘要糊弄模型）。
 * @returns {{text:string, kept:number, total:number}|null}
 */
function buildChangeDigest(chapterContent, materials, maxChars = 1500) {
    const sentences = splitSentences(chapterContent);
    if (sentences.length === 0) return null;
    const names = buildMaterialIndex(materials);
    const hit = (s) => TRIGGER_PATTERNS.some(re => re.test(s)) || names.some(n => s.includes(n));

    const clip = (s) => (s.length > MAX_DIGEST_SENTENCE ? s.slice(0, MAX_DIGEST_SENTENCE) + '…' : s);
    const core = new Set();
    const ctx = new Set();
    sentences.forEach((s, i) => {
        if (!hit(s)) return;
        core.add(i);
        if (i > 0) ctx.add(i - 1);
        if (i < sentences.length - 1) ctx.add(i + 1);
    });
    if (core.size === 0) return null;

    // 先保信号句（核心），上下文句按剩余预算逐句补 ——
    // 否则"按位置截断"会系统性丢掉后半章的信号（位置偏置 = 漏判）
    const ordered = [...new Set([...core, ...ctx])].sort((a, b) => a - b);
    let text = '';
    for (const i of ordered) {
        const piece = clip(sentences[i]);
        if (!core.has(i) && text.length + piece.length > maxChars) continue;
        text += piece;
    }
    const hardCeiling = maxChars * 3;
    if (text.length > hardCeiling) text = text.slice(0, hardCeiling) + '\n…（信号句过多，已达硬上限）';
    return { text, kept: ordered.length, total: sentences.length, core: core.size };
}

module.exports = {
    precheckChangeSignals, buildChangeDigest, buildMaterialIndex,
    TRIGGER_PATTERNS, SHORT_CHAPTER_CHARS, MAX_DIGEST_SENTENCE,
};
