'use strict';

/**
 * foreshadowFeasibility — 伏笔回收可行性校验（12-创作工艺 Stage3 / §7.5）
 *
 * 解决的问题：规划超前、执行落后——伏笔埋到第26章，书却在第20章收尾，导致大量烂尾。
 * 规则：任何"未回收"的伏笔，其预期回收章不得大于全书规划总章数。
 *
 * 纯函数模块（不依赖DB，便于单测与离线审计）。
 */

/** 从伏笔文本/字段中抽取"预期回收章"（取区间上界） */
function extractResolveChapter(input) {
    const text = String(input || '');
    if (!text) return null;

    let best = null;
    // 第25-30章 / 第25~30章 / 第25至30章
    const rangeRe = /第\s*(\d+)\s*[-~—-至到]\s*(\d+)\s*章/g;
    let m;
    while ((m = rangeRe.exec(text)) !== null) {
        const hi = parseInt(m[2], 10);
        if (Number.isFinite(hi) && (best === null || hi > best)) best = hi;
    }
    // 第30章左右
    const singleRe = /第\s*(\d+)\s*章/g;
    while ((m = singleRe.exec(text)) !== null) {
        const n = parseInt(m[1], 10);
        if (Number.isFinite(n) && (best === null || n > best)) best = n;
    }
    return best;
}

/**
 * @param {object} params
 * @param {Array} params.foreshadows [{ name, status, plantChapter, resolveChapter, expectedResolveWindow, text }]
 * @param {number} params.totalChapterPlan 全书规划总章数
 * @returns {{ ok:boolean, violations:Array, checked:number }}
 */
function checkForeshadowFeasibility({ foreshadows = [], totalChapterPlan = 0 } = {}) {
    const violations = [];
    if (!Number.isFinite(totalChapterPlan) || totalChapterPlan <= 0) {
        return { ok: true, violations: [], checked: 0, note: 'no-total-chapter-plan' };
    }

    for (const f of foreshadows) {
        if (!f) continue;
        if (f.status === 'resolved' || f.resolveChapter) continue;

        const declared = Number.isFinite(f.expectedResolveChapter) ? f.expectedResolveChapter : null;
        const parsed = declared !== null
            ? declared
            : extractResolveChapter(f.expectedResolveWindow || f.text || f.description || '');

        if (parsed && parsed > totalChapterPlan) {
            violations.push({
                name: f.name || '(未命名伏笔)',
                expectedResolveChapter: parsed,
                totalChapterPlan,
                plantChapter: f.plantChapter || 0,
                reason: `伏笔[${f.name}]预期回收章第${parsed}章 > 全书规划第${totalChapterPlan}章，必然烂尾`,
            });
        }
    }

    return { ok: violations.length === 0, violations, checked: foreshadows.length };
}

module.exports = { extractResolveChapter, checkForeshadowFeasibility };
