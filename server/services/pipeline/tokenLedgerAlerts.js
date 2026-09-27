'use strict';

/**
 * tokenLedgerAlerts.js — Token 面板告警规则（纯函数）
 *
 * 三类信号，直接回答"哪里出了问题"：
 *   1. 截断：提示词/素材被预算砍掉 → 规则与约束可能没真正进到模型里（最隐蔽的出血点）
 *   2. 返修：token 大量花在返修轮 → 该章质量问题值得复查
 *   3. 效率：每千字 token 远高于中位数 → 该章上下文异常臃肿
 *
 * 截断按「分段」聚合而不是按章展开：20 章 × 同一分段会刷屏 20 条同类告警，
 * 把真正要看的问题（返修烧钱/效率异常）挤出视野。
 *
 * 文件位置：server/services/pipeline/tokenLedgerAlerts.js
 */
const RETRY_SHARE_ALERT = 0.5;    // 返修轮占比阈值
const EFFICIENCY_ALERT_RATIO = 2; // 效率异常倍数（相对中位数）
const MAX_ALERTS = 12;

/** 截断告警：同一分段跨章聚合成一条 */
function buildTruncationAlerts(chapters) {
    const map = new Map();
    for (const ch of chapters) {
        for (const s of ch.bySection) {
            if (!s.truncatedCount) continue;
            const cur = map.get(s.slot) || { slot: s.slot, label: s.label, chapterCount: 0, times: 0, lostTokens: 0, worst: null };
            cur.chapterCount += 1;
            cur.times += s.truncatedCount;
            cur.lostTokens += s.lostTokens;
            if (!cur.worst || s.lostTokens > cur.worst.lostTokens) cur.worst = { chapter: ch.chapter, lostTokens: s.lostTokens };
            map.set(s.slot, cur);
        }
    }
    return [...map.values()]
        .sort((a, b) => b.lostTokens - a.lostTokens)
        .map(t => ({
            level: 'warning', chapter: t.worst.chapter, slot: t.slot, chapterCount: t.chapterCount,
            message: '「' + t.label + '」在 ' + t.chapterCount + ' 个章节被预算截断（共 ' + t.times +
                ' 次），丢失约 ' + t.lostTokens + ' tokens — 这部分内容可能没真正进到模型里，最严重是第' +
                t.worst.chapter + '章',
        }));
}

/** 返修 / 效率告警：逐章展开 */
function buildChapterAlerts(chapters) {
    const alerts = [];
    for (const ch of chapters) {
        if (ch.roundSplit && ch.roundSplit.reliable && ch.retryShare >= RETRY_SHARE_ALERT * 100 && ch.calls > 1) {
            alerts.push({
                level: 'warning', chapter: ch.chapter,
                message: '第' + ch.chapter + '章 ' + ch.retryShare + '% 的 token 花在返修轮（' +
                    ch.roundSplit.retryTokens + ' tokens），该章质量问题值得复查',
            });
        }
    }
    const effs = chapters.map(c => c.tokensPerKChar).filter(v => v > 0).sort((a, b) => a - b);
    const median = effs.length ? effs[Math.floor(effs.length / 2)] : 0;
    if (median > 0) {
        for (const ch of chapters) {
            if (ch.tokensPerKChar > median * EFFICIENCY_ALERT_RATIO) {
                alerts.push({
                    level: 'info', chapter: ch.chapter,
                    message: '第' + ch.chapter + '章每千字消耗 ' + ch.tokensPerKChar + ' tokens（中位数 ' + median + '），效率异常偏高',
                });
            }
        }
    }
    return alerts;
}

function buildTokenAlerts(chapters) {
    return [...buildTruncationAlerts(chapters), ...buildChapterAlerts(chapters)].slice(0, MAX_ALERTS);
}

module.exports = { buildTokenAlerts, RETRY_SHARE_ALERT, EFFICIENCY_ALERT_RATIO, MAX_ALERTS };
