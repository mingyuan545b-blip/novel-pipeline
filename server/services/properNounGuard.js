'use strict';

/**
 * properNounGuard.js — 现实作品专名信号检测（纯函数）
 *
 * 目标（D2-b 反趋同）：提取/生成阶段拦截"现实作品专名"（书名/角色名/招式名等）进入库或素材。
 * 做法：以**名称特征**为主（引号/书名号/纯 ASCII 等，稳定且无需维护词表），
 *   辅以 config/properNounSignals 的**可扩展插槽**（默认空，按需补充）。
 *   不在此处硬编码长词表 —— 避免"扩词表→误杀→再扩"的维护陷阱（见 PROJECT_STANDARDS 原则6）。
 */

const { SIGNAL_SUBSTRINGS, SIGNAL_PATTERNS } = require('../config/properNounSignals');

/** 书名号/引号包裹 → 多半是作品/专有名 */
const QUOTE_PATTERN = /[《》「」『』]/;
/** 纯 ASCII 数字/字母（≥2）→ 多半是外来名/罗马字 */
const ASCII_ONLY_PATTERN = /^[A-Za-z0-9]{2,}$/;

/**
 * 文本是否含"现实作品专名"信号。
 * @param {string} text
 * @returns {boolean}
 */
function hasProperNounSignal(text) {
    const s = String(text == null ? '' : text).trim();
    if (!s) return false;
    if (QUOTE_PATTERN.test(s)) return true;
    if (ASCII_ONLY_PATTERN.test(s)) return true;
    if (SIGNAL_SUBSTRINGS.some(t => t && s.includes(t))) return true;
    if (SIGNAL_PATTERNS.some(re => re.test(s))) return true;
    return false;
}

module.exports = { hasProperNounSignal, QUOTE_PATTERN, ASCII_ONLY_PATTERN };
