/**
 * properNounSignals.js — 现实作品专名信号（可扩展配置，默认空）
 *
 * 设计取舍（D2-b，源头治理·不硬编码）：**不在此处堆长词表**。
 *   检测主体由 properNounGuard 的**名称特征**（引号/书名号/纯 ASCII 等）承担；
 *   本文件仅提供**可扩展插槽** —— 需要补充时由使用方按需追加子串/正则，而非改代码逻辑。
 */
'use strict';

/** 命中即视为"疑似现实作品专名"的子串（默认空） */
const SIGNAL_SUBSTRINGS = [];
/** 命中即视为"疑似现实作品专名"的正则（默认空） */
const SIGNAL_PATTERNS = [];

module.exports = { SIGNAL_SUBSTRINGS, SIGNAL_PATTERNS };
