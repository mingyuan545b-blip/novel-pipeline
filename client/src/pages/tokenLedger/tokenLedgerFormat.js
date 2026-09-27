/**
 * tokenLedgerFormat.js — Token 面板格式化工具
 * 目标：把技术数字转成"看得懂"的表达（万/M、百分比、口语化规模）
 */

/** 大数字 → 万/M（中文习惯，避免一长串数字认不出来） */
export function formatTokens(n) {
    const v = Number(n) || 0;
    if (v >= 1000000) return (v / 1000000).toFixed(2) + 'M';
    if (v >= 10000) return (v / 10000).toFixed(1) + '万';
    return v.toLocaleString('zh-CN');
}

/** 精确值（悬停提示用） */
export function formatExact(n) {
    return (Number(n) || 0).toLocaleString('zh-CN');
}

export function formatPct(n, digits = 1) {
    const v = Number(n);
    return Number.isFinite(v) ? v.toFixed(digits) + '%' : '-';
}

/** 口语化规模描述：让"10万 token"有体感 */
export function humanScale(tokens) {
    const v = Number(tokens) || 0;
    if (v === 0) return '暂无数据';
    const books = v / 220000;
    if (books >= 1) return `约等于 ${books.toFixed(1)} 本长篇小说的处理量`;
    if (v >= 50000) return `足够生成约 ${Math.round(v / 12000)} 章正文`;
    return '规模较小';
}

/** 告警级别 → 颜色 */
export const ALERT_COLORS = { warning: '#f59e0b', error: '#ef4444', info: '#38bdf8' };

/** 达成度色阶：越高越"满"，用于每千字 token 等效率指标 */
export function efficiencyColor(perKChar) {
    const v = Number(perKChar) || 0;
    if (v >= 80000) return '#ef4444';
    if (v >= 50000) return '#f59e0b';
    if (v >= 30000) return '#facc15';
    return '#22c55e';
}
